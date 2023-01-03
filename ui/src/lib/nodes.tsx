import { useCallback, useEffect, useState, useContext } from "react";
import { applyNodeChanges, Node } from "reactflow";
import { RepoContext, RoleType } from "./store";
import { useStore } from "zustand";
import { useApolloClient } from "@apollo/client";
import { Transaction, YEvent } from "yjs";

const selectedPods = new Set();

// apply the same-parent rule, make sure all selected nodes have the same parent
export var parent: string | undefined = undefined;

// clear all selections
export function resetSelection() {
  if (selectedPods.size === 0) return false;
  selectedPods.clear();
  parent = undefined;
  return true;
}

export function useNodesStateSynced() {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const addPod = useStore(store, (state) => state.addPod);
  const getPod = useStore(store, (state) => state.getPod);
  const deletePod = useStore(store, (state) => state.deletePod);
  const setPodGeo = useStore(store, (state) => state.setPodGeo);
  const apolloClient = useApolloClient();
  const role = useStore(store, (state) => state.role);
  const ydoc = useStore(store, (state) => state.ydoc);
  const nodesMap = ydoc.getMap<Node>("pods");
  const clientId = useStore(
    store,
    (state) => state.provider?.awareness?.clientID
  );

  const [nodes, setNodes] = useState<Node[]>([]);
  // const setNodeId = useStore((state) => state.setSelectNode);
  // const selected = useStore((state) => state.selectNode);

  const selectPod = useCallback(
    (id, selected) => {
      if (selected) {
        const p = getPod(id)?.parent;

        // if you select a node that has a different parent, clear all previous selections
        if (parent !== undefined && parent !== p) {
          selectedPods.clear();
          setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
        }
        parent = p;
        selectedPods.add(id);
      } else {
        if (!selectedPods.delete(id)) return;
        if (selectedPods.size === 0) parent = undefined;
      }
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, selected } : n)));
    },
    [getPod]
  );

  const onNodesChange = useCallback(
    (changes) => {
      const nodes = Array.from(nodesMap.values());

      const nextNodes = applyNodeChanges(changes, nodes);

      // prevent updates from guest users
      if (role === RoleType.GUEST) {
        setNodes(nextNodes);
        return;
      }

      changes.forEach((change) => {
        if (change.type !== "add") {
          if (change.type === "remove") {
            nodesMap.delete(change.id);
            return;
          }
          const node = nextNodes.find((n) => n.id === change.id);
          if (!node) return;
          if (change.type === "reset" || change.type === "select") {
            selectPod(node.id, change.selected);
            return;
          }

          if (node) {
            nodesMap.set(change.id, node);
          }
        }
      });
    },
    [nodesMap, role, selectPod]
  );

  const triggerUpdate = useCallback(() => {
    setNodes(
      Array.from(nodesMap.values())
        .filter(
          (node) =>
            !node.data.hasOwnProperty("clientId") ||
            node.data.clientId === clientId
        )
        .sort((a: Node, b: Node) => a.data.level - b.data.level)
        .map((node) => ({
          ...node,
          selected: selectedPods.has(node.id),
          hidden: node.data?.hidden === clientId,
        }))
    );
  }, [clientId, nodesMap]);

  useEffect(() => {
    const observer = (YMapEvent: YEvent<any>, transaction: Transaction) => {
      YMapEvent.changes.keys.forEach((change, key) => {
        switch (change.action) {
          case "add":
            {
              const node = nodesMap.get(key);
              if (!node || node.data?.clientId || getPod(key)) return;
              addPod(null, {
                id: node.id,
                children: [],
                parent: "ROOT",
                type: node.type === "code" ? "CODE" : "DECK",
                lang: "python",
                x: node.position.x,
                y: node.position.y,
                width: node.width!,
                height: node.height!,
                name: node.data?.name,
                dirty: false,
              });
            }
            break;
          case "delete":
            {
              const node = change.oldValue;
              if (transaction.local && !node.data?.clientId) {
                // If the delete is made by the current user, and it is not a
                // pasting node, delete it from the server.
                deletePod(apolloClient, { id: node.id, toDelete: [] });
              } else {
                deletePod(null, { id: node.id, toDelete: [] });
              }
            }
            break;
          case "update":
            {
              const node = nodesMap.get(key);
              if (!node) {
                console.error("Node not found", key);
                break;
              }
              // The node is a node pasting from this user or other users.
              if (node.data?.clientId) break;
              setPodGeo(
                key,
                {
                  parent: node.parentNode ? node.parentNode : "ROOT",
                  x: node.position.x,
                  y: node.position.y,
                  width: node.width!,
                  height: node.height!,
                },
                transaction.local ? true : false
              );
            }
            break;
          default:
            throw new Error("Unknown action", change.action);
        }
      });
      // TOFIX: a node may be shadowed behind its parent, due to the order to
      // render reactflow node, to fix this, comment out the following sorted
      // method, which brings in a large overhead.

      triggerUpdate();
    };

    // setNodes(Array.from(nodesMap.values()));
    nodesMap.observe(observer);

    return () => {
      nodesMap.unobserve(observer);
      resetSelection();
    };
  }, [
    addPod,
    apolloClient,
    clientId,
    deletePod,
    getPod,
    nodesMap,
    setPodGeo,
    triggerUpdate,
  ]);

  return {
    nodes: nodes.filter((n) => n),
    onNodesChange,
    setNodes,
    triggerUpdate,
  };
}
