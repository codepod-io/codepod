import { useCallback, useEffect, useState, useContext } from "react";
import { applyNodeChanges, Node } from "react-flow-renderer";
import { RepoContext } from "./store";
import { useStore } from "zustand";

const isNodeAddChange = (change) => change.type === "add";
const isNodeRemoveChange = (change) => change.type === "remove";
const isNodeResetChange = (change) => change.type === "reset";

export function useNodesStateSynced(nodeList) {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const addPod = useStore(store, (state) => state.addPod);
  const deletePod = useStore(store, (state) => state.deletePod);
  const setSelected = useStore(store, (state) => state.setSelected);
  const ydoc = useStore(store, (state) => state.ydoc);
  const nodesMap = ydoc.getMap<Node>("pods");

  const [nodes, setNodes] = useState(nodeList);
  // const setNodeId = useStore((state) => state.setSelectNode);
  // const selected = useStore((state) => state.selectNode);

  const onNodesChanges = useCallback((changes) => {
    const nodes = Array.from(nodesMap.values());

    const nextNodes = applyNodeChanges(changes, nodes);

    changes.forEach((change) => {
      if (!isNodeAddChange(change) && !isNodeResetChange(change)) {
        if (isNodeRemoveChange(change)) {
          nodesMap.delete(change.id);
        }
        const node = nextNodes.find((n) => n.id === change.id);
        if (!node) return;

        if (change.type === "select") {
          setSelected(node.id);
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
            width: node.width,
            height: node.height,
          });
        } else if (change.action === "delete") {
          const node = change.oldValue;
          console.log("todelete", node);
          deletePod(null, { id: node.id, toDelete: [] });
        }
      });

      // TOFIX: a node may be shadowed behind its parent, due to the order to render reactflow node, to fix this, comment out the following sorted method, which brings in a large overhead.
      // setNodes(Array.from(nodesMap.values()).sort((a:Node, b:Node) => (a.level - b.level)));
      setNodes(Array.from(nodesMap.values()));
    };

    // setNodes(Array.from(nodesMap.values()));
    nodesMap.observe(observer);

    return () => {
      nodesMap.unobserve(observer);
    };
  }, []);

  return [nodes.filter((n) => n), setNodes, onNodesChanges];
}
