import { useCallback, useEffect, useState, useContext } from "react";
import { applyNodeChanges, Edge, Node } from "reactflow";
import { RepoContext } from "./store";
import { useStore } from "zustand";
import { useApolloClient } from "@apollo/client";
import { Transaction, YEvent } from "yjs";

export function useYjsObserver() {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const ydoc = useStore(store, (state) => state.ydoc);
  const nodesMap = useStore(store, (state) => state.getNodesMap());
  const updateView = useStore(store, (state) => state.updateView);
  const resetSelection = useStore(store, (state) => state.resetSelection);

  useEffect(() => {
    const observer = (YMapEvent: YEvent<any>, transaction: Transaction) => {
      if (transaction.local) return;
      updateView();
    };

    // FIXME need to observe edgesMap as well
    // FIXME need to observe resultMap as well
    nodesMap.observe(observer);

    return () => {
      nodesMap.unobserve(observer);
      resetSelection();
    };
  }, [nodesMap, resetSelection, updateView]);
}
