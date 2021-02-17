import React, { useEffect, useRef, useState } from "react";
// import "./tailwind.output.css";
import "codemirror/lib/codemirror.css";
// import Editor from "@monaco-editor/react";

import "codemirror/mode/python/python";
import "codemirror/addon/search/match-highlighter";

import CodeMirror from "codemirror";
import { v4 as uuidv4 } from "uuid";
import { Link, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  repoSlice,
  selectChildren,
  selectTopLevel,
  selectSiblings,
} from "./store.js";

import { PodContext, retrievePods, retrieveRepos } from "./PodContext";

// import 'codemirror/keymap/emacs';
// import 'codemirror/keymap/vim';
// import 'codemirror/keymap/sublime';
// import 'codemirror/theme/monokai.css';

function MyEditor(props = {}, ref) {
  const { value = "" } = props;
  // "function myScript(){return 100;}\n"
  const textareaRef = useRef();
  const [editor, setEditor] = useState();

  useEffect(() => {
    const editor = CodeMirror(textareaRef.current, {
      lineNumbers: true,
      value: value,
      mode: "python",
      highlightSelectionMatches: { showToken: /\w/, annotateScrollbar: true },
    });
    return () => {
      // editor.toTextArea();
      setEditor(undefined);
    };
  }, [editor]);

  return (
    <div
      ref={textareaRef}
      // className="myeditor"
      // className="max-w-xl mx-auto flex-wrap text-left"
    ></div>
  );
}

// some random staff? generator?
function gen_random_code() {
  const code1 = `def foo():
    return 2`;

  const code2 = `def bar():
    return 3`;

  const code3 = `def foobar():
    return foo() + bar()`;

  const code4 = `import os
var = foobar()
var`;
  const codes = [code1, code2, code3, code4];
  const i = Math.floor(Math.random() * 4);
  return codes[i];
}

export function SequentialPods() {
  return (
    <>
      <h1 className="h1">Sequentail Pods</h1>
      <div>
        {/* <Pebble>

      </Pebble> */}
        <Pod />
        <Pod />
        <Pod />
        <Pod />
      </div>
    </>
  );
}

// TODO each pod/dock should have an ID

export function Pod(props = {}) {
  const { value = gen_random_code() } = props;
  return (
    // currently the Pod is just an Editor
    <>
      {/* TODO each pod has some property marks,
    - purely functional or not
    - status: dirty?
    */}
      {/* TODO each pod has "run/apply" button */}
      {/* TODO fold the pod, and show:
      - the name only
      - the minimap
       */}
      {/* I should be able to move a pod */}
      <MyEditor value={value} />
    </>
  );
}

export function Dock(props = {}) {
  const { value = "" } = props;
  const myref = useRef(null);
  const [showMenu, setShowMenu] = useState(false);
  const [morePods, setMorePods] = useState([]);
  useEffect(() => {
    // handleClickOutside from
    // https://stackoverflow.com/questions/32553158/detect-click-outside-react-component
    function handleClickOutside(e) {
      if (myref.current && !myref.current.contains(e.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  });
  return (
    <div className="dock">
      {/* There's a + for each Dock
      - at the dock
      - TODO at every pod
      - right click menu (I want to avoid this)
      */}
      <button className="insert-btn" onClick={() => setShowMenu(true)}>
        +
      </button>
      {showMenu && (
        <div ref={myref} className="insert-menu">
          <ul>
            <li>
              {/* I should not be using <a href="#"...> because it will jump to top after every click */}
              <button
                onClick={() => {
                  // FIXME this UUID might not make sense. I need to associate the ID
                  // with the  pod, and TODO save this to some database or file.
                  setMorePods(morePods.concat([<Pod key={uuidv4()}></Pod>]));
                  // setMorePods([<Pod></Pod>])
                  // setMorePods([1,2,3].map((n) => <li key={n}>{n}</li>))
                  setShowMenu(false);
                }}
              >
                Insert Pod
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  setMorePods(morePods.concat([<Dock key={uuidv4()}></Dock>]));
                  setShowMenu(false);
                }}
              >
                Insert Dock
              </button>
            </li>
          </ul>
        </div>
      )}
      {/* TODO fold the dock and show:
      - public APIs
      - status
      - "minimap" */}
      {props.children}
      {morePods}
    </div>
  );
}

export function TreePods() {
  return (
    <>
      <h1>TreePods Example</h1>
      <Dock>
        <Pod />
        <Pod />
        <Dock />
        <Dock>
          <Pod />
          <Pod />
          <Dock>
            <Pod />
            <Pod />
          </Dock>
          <Dock>
            <Pod />
            <Pod />
            <Dock>
              <Pod />
              <Pod />
              <Dock>
                <Pod />
              </Dock>
              <Pod />
              <Pod />
              <Dock>
                <Pod />
                <Pod />
              </Dock>
            </Dock>
          </Dock>
        </Dock>
        <Pod />
      </Dock>
    </>
  );
}

export function Repos() {
  const [repos, setRepos] = useState(null);
  // const { repos, retrieveRepos } = useContext(PodContext);
  // FIXME initiate the repos?
  useEffect(() => {
    retrieveRepos().then((repos) => {
      console.log(`Got ${repos}`);
      setRepos(repos);
    });
  }, []);

  // render the repos into the HTML
  // console.log(repos);
  return (
    <div>
      <h1>Repos</h1>
      {/* Query the backend */}
      {repos
        ? repos.map((repo) => {
            return (
              <div>
                <div>
                  Repo:{" "}
                  <Link to={`/repo/${repo.name}`} className="text-blue-700">
                    {repo.name} ({repo.pods.length})
                  </Link>
                </div>
                {/* {repo.pods
                  ? repo.pods.map((pod) => {
                      return <div>Pod: {pod.name}</div>;
                    })
                  : "No pods"} */}
              </div>
            );
          })
        : "No repos found."}
      {/* some examples */}
      <SequentialPods />
      <TreePods />
    </div>
  );
}

export function Repo() {
  const { reponame } = useParams();
  const toplevel = useSelector(selectTopLevel);
  console.log(toplevel);
  const dispatch = useDispatch();
  return (
    <div>
      <div className="flex">
        <h1 className="flex flex-auto width-fit">
          <a href="#" className="text-blue-700">
            your-profile
          </a>{" "}
          /{" "}
          <a href="#" className="text-blue-700 font-medium">
            {reponame}
          </a>
        </h1>
        <div>
          <button
            className="border-2 border-gray-400 shadow p-2 border-solid rounded hover:bg-gray-100 bg-gray-50"
            onClick={() => {
              dispatch(
                repoSlice.actions.addPod({
                  name: "<name>",
                  content: "",
                  anchorId: null,
                  direction: "NEXT",
                })
              );
              // push to the server, and retrieve the real DB ID
              // set the pod's ID
            }}
          >
            + Create Pod
          </button>
        </div>
      </div>

      <div>
        {toplevel.map((id) => (
          <PodOrDock id={id}></PodOrDock>
        ))}
        {/* {pods.headId && <Pods ids={toList(pods.head)}></Pods>} */}
        {/* {pods
          ? pods.map((pod) => {
              return (
                <div>
                  <NewPod pod={pod} />
                </div>
              );
            })
          : "No pods found"} */}
      </div>
    </div>
  );
}

function PodOrDock({ id }) {
  const isPod = useSelector((state) => id in state.pods.id2pod);
  const isDock = useSelector((state) => id in state.pods.id2dock);
  if (isPod) {
    return <Pod2 id={id}></Pod2>;
  } else if (isDock) {
    return <Dock2 id={id}></Dock2>;
  } else {
    throw new Error(`Not pod or dock: ${id}`);
  }
}

export function Dock2({ id }) {
  const children = useSelector((state) => selectChildren(state, id));
  return (
    <div className="dock">
      <button className="insert-btn">+</button>
      {children.map((id) => (
        <PodOrDock id={id}></PodOrDock>
      ))}
    </div>
  );
}

export function Pod2({ id }) {
  const pod = useSelector((state) => state.pods.id2pod[id]);
  const btnstyle =
    "border-2 border-gray-400 shadow px-2 mr-2 border-solid rounded hover:bg-gray-100 bg-gray-50";
  return (
    // currently the Pod is just an Editor
    <>
      {/* TODO each pod has some property marks,
    - purely functional or not
    - status: dirty?
    */}
      {/* TODO each pod has "run/apply" button */}
      {/* TODO fold the pod, and show:
      - the name only
      - the minimap
       */}
      {/* I should be able to move a pod */}
      <div className="max-w-xl mx-auto flex-wrap text-left">
        <div className="flex justify-between">
          <div>{pod.name}</div>
          <div>{pod.id}</div>
        </div>
        {/* Pod operational utilities */}
        <div className="flex">
          <button className={btnstyle} onClick={() => {}}>
            Random Name
          </button>
          <button className={btnstyle}>Random Content</button>
          <button className={btnstyle}>Delete</button>
        </div>
        <MyEditor value={pod.content} />
      </div>
    </>
  );
}

// function Pods(props) {
//   const { ids } = props;
//   return (
//     <div>
//       {pods.map((pod) => {
//         switch (pod.type) {
//           case "DOCK": {
//             return (
//               <Dock>
//                 {pods.child && <Pods pods={toList(pod.child)}></Pods>}
//               </Dock>
//             );
//           }
//           case "POD": {
//             return (
//               <div>
//                 {pods.map((pod) => {
//                   return (
//                     <div>
//                       <Pod2 pod={pod} />
//                     </div>
//                   );
//                 })}
//               </div>
//             );
//           }
//           default: {
//             throw new Error(`Pod type error: ${pod.type}`);
//           }
//         }
//       })}
//     </div>
//   );
// }
