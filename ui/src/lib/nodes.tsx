import { useCallback, useEffect, useState, useContext } from "react";
import { applyNodeChanges, Node } from "reactflow";
import { RepoContext } from "./store";
import { nodetype2dbtype } from "./utils";
import { useStore } from "zustand";
import { useApolloClient } from "@apollo/client";
import { Transaction, YEvent } from "yjs";

export function useYjsObserver() {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const addPod = useStore(store, (state) => state.addPod);
  const deletePod = useStore(store, (state) => state.deletePod);
  const setPodGeo = useStore(store, (state) => state.setPodGeo);
  const ydoc = useStore(store, (state) => state.ydoc);
  const nodesMap = ydoc.getMap<Node>("pods");
  const updateView = useStore(store, (state) => state.updateView);
  const resetSelection = useStore(store, (state) => state.resetSelection);

  useEffect(() => {
    const observer = (YMapEvent: YEvent<any>, transaction: Transaction) => {
      if (transaction.local) return;
      YMapEvent.changes.keys.forEach((change, key) => {
        const node = nodesMap.get(key);

        switch (change.action) {
          case "add":
            if (!node) throw new Error("Node not found");
            addPod({
              id: node.id,
              children: [],
              parent: "ROOT",
              type: nodetype2dbtype(node.type || ""),
              lang: "python",
              x: node.position.x,
              y: node.position.y,
              width: node.width!,
              height: node.height!,
              ...(node.data.extraPodData || {}),
              dirty: false,
            });

            break;
          case "delete":
            deletePod(null, { id: key });
            break;
          case "update":
            if (!node) throw new Error("Node not found");
            setPodGeo(
              key,
              {
                parent: node.parentNode ? node.parentNode : "ROOT",
                x: node.position.x,
                y: node.position.y,
                width: node.width!,
                height: node.height!,
              },
              false
            );

            break;
          default:
            throw new Error("Unknown action", change.action);
        }
      });
      // TOFIX: a node may be shadowed behind its parent, due to the order to
      // render reactflow node, to fix this, comment out the following sorted
      // method, which brings in a large overhead.

      updateView();
    };

    nodesMap.observe(observer);

    return () => {
      nodesMap.unobserve(observer);
      resetSelection();
    };
  }, [addPod, deletePod, nodesMap, resetSelection, setPodGeo, updateView]);
}
