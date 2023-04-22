import {
  KBarProvider,
  KBarPortal,
  KBarPositioner,
  KBarAnimator,
  KBarSearch,
  KBarResults,
  useMatches,
  NO_GROUP,
} from "kbar";

import { useStore } from "zustand";
import { RepoContext } from "../lib/store";
import { useContext } from "react";

function RenderResults() {
  const { results } = useMatches();

  return (
    <KBarResults
      items={results}
      onRender={({ item, active }) =>
        typeof item === "string" ? (
          <div>{item}</div>
        ) : (
          <div
            style={{
              background: active ? "#eee" : "transparent",
            }}
          >
            {item.name}
          </div>
        )
      }
    />
  );
}

export function MyKBar() {
  const store = useContext(RepoContext);
  if (!store) throw new Error("Missing BearContext.Provider in the tree");
  const autoLayout = useStore(store, (state) => state.autoLayout);
  const actions = [
    {
      id: "auto-layout",
      name: "Auto Layout",
      keywords: "auto layout",
      perform: () => {
        autoLayout();
      },
    },
    // {
    //   id: "blog",
    //   name: "Blog",
    //   shortcut: ["b"],
    //   keywords: "writing words",
    //   perform: () => (window.location.pathname = "blog"),
    // },
    // {
    //   id: "contact",
    //   name: "Contact",
    //   shortcut: ["c"],
    //   keywords: "email",
    //   perform: () => (window.location.pathname = "contact"),
    // },
  ];
  return (
    <KBarProvider actions={actions}>
      <KBarPortal>
        <KBarPositioner>
          <KBarAnimator>
            <KBarSearch />
            <RenderResults />
          </KBarAnimator>
        </KBarPositioner>
      </KBarPortal>
    </KBarProvider>
  );
}
