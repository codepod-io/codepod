import { useCallback, useEffect, useState, useContext } from "react";
import { applyNodeChanges, Node } from "reactflow";
import { RepoContext, RoleType } from "./store";
import { useStore } from "zustand";

const isNodeAddChange = (change) => change.type === "add";
const isNodeRemoveChange = (change) => change.type === "remove";
const isNodeResetChange = (change) => change.type === "reset";

export function useNodesStateSynced(nodeList) {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const addPod = useStore(store, (state) => state.addPod);
  const getPod = useStore(store, (state) => state.getPod);
  const deletePod = useStore(store, (state) => state.deletePod);
  const updatePod = useStore(store, (state) => state.updatePod);
  const setPodSelected = useStore(store, (state) => state.setPodSelected);
  const role = useStore(store, (state) => state.role);
  const ydoc = useStore(store, (state) => state.ydoc);
  const nodesMap = ydoc.getMap<Node>("pods");

  const [nodes, setNodes] = useState(nodeList);
  // const setNodeId = useStore((state) => state.setSelectNode);
  // const selected = useStore((state) => state.selectNode);

  const onNodesChanges = useCallback((changes) => {
    const nodes = Array.from(nodesMap.values());

    const nextNodes = applyNodeChanges(changes, nodes);

    // prevent updates from guest users
    if (role === RoleType.GUEST) {
      setNodes(nextNodes);
      return;
    }

    changes.forEach((change) => {
      if (!isNodeAddChange(change)) {
        if (isNodeRemoveChange(change)) {
          nodesMap.delete(change.id);
          return;
        }
        const node = nextNodes.find((n) => n.id === change.id);

        if (!node) return;

        if (isNodeResetChange(change) || change.type === "select") {
          setPodSelected(node.id, change.selected as boolean);
          return;
        }

        if (change.type === "dimensions" && node.type === "code") {
          // There is a (seemingly unnecessary) dimension change at the very
          // beginning of canvas page, which causes dirty status of all
          // CodeNodes to be set. This is a workaround to prevent that.
          if (getPod(node.id).width !== node.width) {
            // only sync width
            updatePod({
              id: node.id,
              data: {
                width: node.style?.width as number,
              },
            });
          }
          return;
        }

        if (node) {
          nodesMap.set(change.id, node);
        }
      }
    });
  }, []);

  useEffect(() => {
    const observer = (YMapEvent) => {
      YMapEvent.changes.keys.forEach((change, key) => {
        if (change.action === "add") {
          const node = nodesMap.get(key);
          if (!node) return;
          addPod(null, {
            id: node.id,
            parent: "ROOT",
            index: 0,
            type: node.type === "code" ? "CODE" : "DECK",
            lang: "python",
            x: node.position.x,
            y: node.position.y,
            width: node.style?.width,
            height: node.style?.height,
          });
        } else if (change.action === "delete") {
          const node = change.oldValue;
          console.log("todelete", node);
          deletePod(null, { id: node.id, toDelete: [] });
        }
      });

      // TOFIX: a node may be shadowed behind its parent, due to the order to render reactflow node, to fix this, comment out the following sorted method, which brings in a large overhead.
      setNodes(
        Array.from(nodesMap.values())
          .sort((a: Node & { level }, b: Node & { level }) => a.level - b.level)
          .map((node) => ({ ...node, selected: getPod(node.id)?.selected }))
      );

      // setNodes(Array.from(nodesMap.values()));
    };

    // setNodes(Array.from(nodesMap.values()));
    nodesMap.observe(observer);

    return () => {
      nodesMap.unobserve(observer);
    };
  }, []);

  return [nodes.filter((n) => n), setNodes, onNodesChanges];
}
