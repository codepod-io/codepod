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
  const nodesMap = ydoc.getMap<Node>("nodesMap");
  const updateView = useStore(store, (state) => state.updateView);
  const resetSelection = useStore(store, (state) => state.resetSelection);
  const buildNode2Children = useStore(
    store,
    (state) => state.buildNode2Children
  );

  useEffect(() => {
    const observer = (YMapEvent: YEvent<any>, transaction: Transaction) => {
      if (transaction.local) return;
      updateView();
    };

    nodesMap.observe(observer);

    return () => {
      nodesMap.unobserve(observer);
      resetSelection();
    };
  }, [nodesMap, resetSelection, updateView]);
}
