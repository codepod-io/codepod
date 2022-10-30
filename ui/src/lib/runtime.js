import produce from "immer";
import { gql } from "@apollo/client";

function getChildExports({ id, pods }) {
  // get all the exports and reexports. The return would be:
  // ns=>names
  // Get the reexports available for the deck id. Those are from this deck's subdecks
  let res = {};

  for (let deck of pods[id].children
    .filter(({ id }) => pods[id].type === "DECK" && !pods[id].thundar)
    .map(({ id, type }) => pods[id])) {
    res[deck.ns] = [].concat(
      ...deck.children
        .filter(({ id }) => pods[id].type !== "DECK")
        .map(({ id }) => pods[id])
        .map((pod) => Object.keys(pod.exports))
    );
    for (let deckpod of deck.children
      .filter(({ id }) => pods[id].type !== "DECK")
      .map(({ id }) => pods[id])) {
      for (let [name, id] of Object.entries(deckpod.reexports)) {
        if (!res[pods[id].ns]) {
          res[pods[id].ns] = [];
        }
        res[pods[id].ns].push(name);
      }
    }
  }
  return res;
}

function getDeckExports({ id, pods }) {
  let res = {};
  res[pods[id].ns] = [].concat(
    ...pods[id].children
      .filter(({ id }) => pods[id].type !== "DECK" && pods[id].exports)
      .map(({ id }) => Object.keys(pods[id].exports))
  );
  for (let pod of pods[id].children
    .filter(({ id }) => pods[id].type !== "DECK" && pods[id].reexports)
    .map(({ id }) => pods[id])) {
    for (let [name, id] of Object.entries(pod.reexports)) {
      if (!res[pods[id].ns]) {
        res[pods[id].ns] = [];
      }
      res[pods[id].ns].push(name);
    }
  }
  return res;
}

function getUtilExports({ id, pods }) {
  let res = {};
  let utilIds = getUtilIds({ id, pods });
  for (let deck of utilIds.map((id) => pods[id])) {
    // FIXME these are identical to getChildExports
    res[deck.ns] = [].concat(
      ...deck.children
        .filter(({ id }) => pods[id].type !== "DECK")
        .map(({ id }) => pods[id])
        .map((pod) => Object.keys(pod.exports))
    );
    for (let deckpod of deck.children
      .filter(({ id }) => pods[id].type !== "DECK")
      .map(({ id }) => pods[id])) {
      for (let [name, id] of Object.entries(deckpod.reexports)) {
        if (!res[pods[id].ns]) {
          res[pods[id].ns] = [];
        }
        res[pods[id].ns].push(name);
      }
    }
  }
  return res;
}

function powerRun_python({ id, socket, set, get }) {
  let pods = get().pods;
  let pod = pods[id];
  // python powerrun
  // 1. create the module

  // for python, we need to introduce the mapping of each exported names
  // 0. [X] so, loop through the child decks, and if there are exported names, evaluate it
  // for all re-exports, gather and evaluate all of them

  // in the future updates
  // 1. [X] if you changed a def, I should find all uses and update them
  // 2. [ ] if you add a new function to be exported, upon evaluation, I should add it to the parent (and TODO others for utility pods)
  //    if that's a new reexport, add to parent as well and do the resolve and evaluation
  // 3. [ ] delete a function. Just delete the parent's def? Not sure.

  let childexports = getChildExports({ id, pods });
  let utilexports = getUtilExports({ id, pods });
  let allexports = Object.assign({}, childexports, utilexports);
  if (pod.thundar) {
    // for testing pod, get all exports/reexports from its parent
    allexports = Object.assign(
      allexports,
      getDeckExports({ id: pod.parent, pods })
    );
  }
  // FIXME would childexports and utilexports overlap?
  let code = Object.keys(allexports)
    .map((ns) =>
      allexports[ns]
        .map(
          (name) =>
            `CODEPOD_EVAL("""${name} = CODEPOD_GETMOD("${ns}").__dict__["${name}"]\n0""", "${pod.ns}")`
        )
        .join("\n")
    )
    .join("\n");

  // console.log("==== PYTHON CODE", code);
  get().clearResults(pod.id);
  get().setRunning(pod.id);
  socket.send(
    JSON.stringify({
      type: "runCode",
      payload: {
        lang: pod.lang,
        code,
        // namespace: pod.ns,
        raw: true,
        // FIXME this is deck's ID
        podId: pod.id,
        sessionId: get().sessionId,
      },
    })
  );
}

function handlePowerRun({ id, doEval, socket, set, get }) {
  // assume id is a deck
  // this is used to init or reset the deck with all exported names
  let pods = get().pods;
  let pod = pods[id];
  if (pod.lang === "python") {
    powerRun_python({ id, socket, set, get });
  } else {
    console.log("Error: only python runtime is supported.");
    return;
  }

  if (doEval) {
    // run all children pods
    pod.children
      .filter(({ id }) => pods[id].type !== "DECK")
      .forEach(({ id }) => {
        let pod = pods[id];
        if (pod.type === "CODE" && pod.content && pod.lang && !pod.thundar) {
          get().clearResults(pod.id);
          get().setRunning(pod.id);
          socket.send(
            JSON.stringify({
              type: "runCode",
              payload: {
                lang: pod.lang,
                code: pod.content,
                namespace: pod.ns,
                raw: pod.raw,
                podId: pod.id,
                sessionId: get().sessionId,
              },
            })
          );
        }
      });
  }
}

function codeForReEvalDeck({ deck, pods, name, ns }) {
  // this deck is a utility deck. Evaluate a re-define of name from ns in all the scope
  let parent = pods[deck.parent];
  let res = "";
  res += `
CODEPOD_EVAL("""${name} = CODEPOD_GETMOD("${ns}").__dict__["${name}"]\n0""", "${parent.ns}")
  `;
  function helper(id) {
    if (pods[id].type === "DECK" && pods[id].ns !== ns) {
      res += `
CODEPOD_EVAL("""${name} = CODEPOD_GETMOD("${ns}").__dict__["${name}"]\n0""", "${pods[id].ns}")
      `;
      pods[id].children.map(({ id, type }) => helper(id));
    }
  }
  // for all the subdecks
  parent.children.map(({ id, type }) => helper(id));
  return res;
}

function handleUpdateDef({ id, socket, get, set }) {
  let pods = get().pods;
  let pod = pods[id];
  if (pod.lang === "python") {
    let code = "";
    for (let [name, uses] of Object.entries(pod.exports)) {
      // reevaluate name in parent deck
      let parent_deck = pods[pods[pod.parent].parent];
      code += `
CODEPOD_EVAL("""${name} = CODEPOD_GETMOD("${pod.ns}").__dict__["${name}"]\n0""", "${parent_deck.ns}")
`;
      if (pods[pod.parent].utility) {
        // TODO get all scopes and reevaluate
        // 1. get parent
        // 2. loop
        code += codeForReEvalDeck({
          deck: pods[pod.parent],
          pods,
          name,
          ns: pod.ns,
        });
      }
      // if the deck of this pod contains testing decks, update there as well
      code += pods[pod.parent].children
        .filter(({ id, type }) => type === "DECK" && pods[id].thundar)
        .map(
          ({ id }) => `
CODEPOD_EVAL("""${name} = CODEPOD_GETMOD("${pod.ns}").__dict__["${name}"]\n0""", "${pods[id].ns}")
`
        )
        .join("\n");

      console.log("==", name, uses);
      if (uses) {
        for (let use of uses) {
          // reevaluate name in use's parent deck
          let to_deck = pods[pods[pods[use].parent].parent];
          code += `
CODEPOD_EVAL("""${name} = CODEPOD_GETMOD("${pod.ns}").__dict__["${name}"]\n0""", "${to_deck.ns}")
`;
          if (pods[pods[use].parent].utility) {
            // TODO get all scopes and re-evaluate
            code += codeForReEvalDeck({
              deck: pods[pods[use].parent],
              pods,
              name,
              ns: pod.ns,
            });
          }
          code += pods[pods[use].parent].children
            .filter(({ id, type }) => type === "DECK" && pods[id].thundar)
            .map(
              ({ id }) =>
                `
CODEPOD_EVAL("""${name} = CODEPOD_GETMOD("${pod.ns}").__dict__["${name}"]\n0""", "${pods[id].ns}")
`
            )
            .join("\n");
        }
      }
    }

    code += `
"ok"
`;

    // console.log("handleUpdateDef code", code);

    // send for evaluation
    console.log("sending for handleUpdateDef ..");
    get().setRunning(pod.id);
    socket.send(
      JSON.stringify({
        type: "runCode",
        payload: {
          lang: pod.lang,
          code,
          namespace: pod.ns,
          // raw: pod.raw,
          raw: true,
          // FIXME TODO podId?
          // podId: "NULL",
          podId: pod.parent,
          sessionId: get().sessionId,
        },
      })
    );
  }
}

function getUtilIds({ id, pods, exclude }) {
  // similar to getUtilNs, but return the id of the util deck
  if (!id) return [];
  let res = pods[id].children
    .filter(({ id }) => id !== exclude && pods[id].utility)
    .map(({ id, type }) => id);
  // keep to go to parents
  return res.concat(getUtilIds({ id: pods[id].parent, pods, exclude: id }));
}

function getExports(content) {
  // Return exports, reexports, and the rest content
  // analyze the content for magic commands
  content = content.trim();
  let exports = [];
  let reexports = {};
  while (content.startsWith("@export ") || content.startsWith("@reexport ")) {
    let idx = content.indexOf("\n");
    let line;
    if (idx === -1) {
      line = content;
      content = "";
    } else {
      line = content.substr(0, idx);
      content = content.substr(idx).trimStart();
    }
    if (line.startsWith("@export ")) {
      exports.push(
        ...line
          .substr("@export ".length)
          .split(" ")
          .filter((word) => word.length > 0)
      );
    } else {
      for (let name of line
        .substr("@reexport ".length)
        .split(" ")
        .filter((word) => word.length > 0)) {
        // 1. find the name in child decks
        // 2. if not found, set it to null
        reexports[name] = null;
      }
    }
  }
  // console.log("content", content);
  // console.log("exports", exports);
  // console.log("reexports", reexports);
  return { exports, reexports, content };
}

function handleRunTree({ id, socket, set, get }) {
  // get all pods
  function helper(id) {
    let pods = get().pods;
    let pod = pods[id];
    // - if it is test deck, it should be evaluated after the parent
    // - if it is a utility deck, it should be evaluated first and import to
    // parent's subtree
    //

    // UPDATE NEW PROCEDURE
    // TODO all testing pods and utility pods
    // 0. get all utility pods that this deck has access to and evaluate?
    // monitor whether the utility pods are evaluated?
    // 1. get all the utility child decks
    const util_pods = pod.children
      .filter(({ id }) => pods[id].type === "DECK")
      .filter(({ id }) => pods[id].utility);
    util_pods.map(({ id }) => helper(id));
    // 2. evaluate all non-utility and non-test child decks
    // TODO if this deck is a test desk, evaluate child
    // FIXME what if this test desk has some non-test desks?
    pod.children
      .filter(({ id }) => pods[id].type === "DECK")
      .filter(({ id }) => !pods[id].utility && !pods[id].thundar)
      .map(({ id }) => helper(id));
    // 3. init this deck
    if (pod.type === "DECK") {
      handlePowerRun({ id, socket, set, get });
      // require parent
    }
    // 4. evaluate all child pods
    pod.children
      .filter(({ id }) => pods[id].type !== "DECK")
      .map(({ id }) => helper(id));
    // 5. evaluate this current node
    if (id !== "ROOT") {
      // actually run the code
      if (pod.type === "CODE" && pod.content && pod.lang && !pod.thundar) {
        get().clearResults(pod.id);

        let { exports, reexports, content } = getExports(pod.content);
        // console.log("resolving ..", reexports);
        // resolve reexports
        for (let subdeckid of pods[pod.parent].children
          .filter(({ id }) => pods[id].type === "DECK")
          .filter(({ id }) => !pods[id].utility && !pods[id].thundar)
          .map(({ id }) => id)) {
          // console.log("trying", subdeckid);
          let subdeck = get().pods[subdeckid];
          let subpods = subdeck.children
            .filter(({ id }) => pods[id].type !== "DECK")
            .map(({ id }) => pods[id]);
          for (let pod of subpods) {
            for (let name of Object.keys(reexports)) {
              if (!reexports[name]) {
                // console.log("in", name);
                if (name in pod.exports) {
                  // console.log("Resolved", name);
                  reexports[name] = pod.id;
                } else if (pod.reexports && pod.reexports[name]) {
                  reexports[name] = pod.reexports[name];
                }
              }
            }
          }
        }

        get().setPodExport({
          id,
          exports,
          reexports,
        });
        if (content) {
          get().setRunning(pod.id);
          socket.send(
            JSON.stringify({
              type: "runCode",
              payload: {
                lang: pod.lang,
                code: content,
                namespace: pod.ns,
                raw: pod.raw,
                podId: pod.id,
                sessionId: get().sessionId,
              },
            })
          );
          handleUpdateDef({ id, socket, set, get });
        }
      }
    }
  }
  helper(id);
}

function onMessage(set, get) {
  return (msg) => {
    // console.log("onMessage", msg.data || msg.body || undefined);
    // msg.data for websocket
    // msg.body for rabbitmq
    let { type, payload } = JSON.parse(msg.data || msg.body || undefined);
    console.log("got message", type, payload);
    switch (type) {
      case "output":
        console.log("output:", payload);

        break;
      case "stdout": {
        let { podId, stdout } = payload;
        set(
          produce((state) => {
            state.pods[podId].stdout = stdout;
          })
        );
        break;
      }
      case "execute_result":
        {
          let { podId, content, count } = payload;
          set(
            produce((state) => {
              if (podId in state.pods) {
                let text = content.data["text/plain"];
                let html = content.data["text/html"];
                let file;
                if (text) {
                  let match = text.match(/CODEPOD-link\s+(.*)"/);
                  if (match) {
                    let fname = match[1].substring(
                      match[1].lastIndexOf("/") + 1
                    );
                    let url = `${window.location.protocol}//api.${window.location.host}/static/${match[1]}`;
                    console.log("url", url);
                    html = `<a target="_blank" style="color:blue" href="${url}" download>${fname}</a>`;
                    file = url;
                  }
                  // http:://api.codepod.test:3000/static/30eea3b1-e767-4fa8-8e3f-a23774eef6c6/ccc.txt
                  // http:://api.codepod.test:3000/static/30eea3b1-e767-4fa8-8e3f-a23774eef6c6/ccc.txt
                }
                state.pods[podId].result = {
                  text,
                  html,
                  file,
                  count,
                };
                // state.pods[podId].running = false;
              } else {
                // most likely this podId is "CODEPOD", which is for startup code and
                // should not be send to the browser
                console.log("WARNING podId not recognized", podId);
              }
            })
          );
        }
        break;
      case "display_data":
        {
          let { podId, content, count } = payload;
          set(
            produce((state) => {
              // console.log("WS_DISPLAY_DATA", content);
              state.pods[podId].result = {
                text: content.data["text/plain"],
                // FIXME hard coded MIME
                image: content.data["image/png"],
                count: count,
              };
            })
          );
        }
        break;
      case "execute_reply":
        set(
          produce((state) => {
            let { podId, result, count } = payload;
            // console.log("WS_EXECUTE_REPLY", action.payload);
            if (podId in state.pods) {
              // state.pods[podId].execute_reply = {
              //   text: result,
              //   count: count,
              // };
              // console.log("WS_EXECUTE_REPLY", result);
              state.pods[podId].running = false;
              if (!state.pods[podId].result) {
                state.pods[podId].result = {
                  text: result,
                  count: count,
                };
              }
            } else {
              // most likely this podId is "CODEPOD", which is for startup code and
              // should not be send to the browser
              console.log("WARNING podId not recognized", podId);
            }
          })
        );

        break;
      case "error":
        set(
          produce((state) => {
            let { podId, ename, evalue, stacktrace } = payload;
            if (podId === "CODEPOD") return;
            state.pods[podId].error = {
              ename,
              evalue,
              stacktrace,
            };
          })
        );

        break;
      case "stream":
        set(
          produce((state) => {
            let { podId, content } = payload;
            if (!(podId in state.pods)) {
              console.log("WARNING podId is not found:", podId);
              return;
            }
            // append
            let pod = state.pods[podId];
            if (content.name === "stderr" && pod.lang === "racket") {
              // if (!pod.result) {
              //   pod.result = {};
              // }
              // pod.result.stderr = true;
              pod.error = {
                ename: "stderr",
                evalue: "stderr",
                stacktrace: "",
              };
            }
            pod.stdout += content.text;
          })
        );
        break;
      case "IO:execute_result":
        set(
          produce((state) => {
            let { podId, result, name } = payload;
            // if (!("io" in state.pods[podId])) {
            //   state.pods[podId].io = {};
            // }
            state.pods[podId].io[name] = { result };
          })
        );
        break;
      case "IO:execute_reply":
        // CAUTION ignore
        break;
      case "IO:error":
        set(
          produce((state) => {
            let { podId, name, ename, evalue, stacktrace } = payload;
            console.log("IOERROR", { podId, name, ename, evalue, stacktrace });
            state.pods[podId].io[name] = {
              error: {
                ename,
                evalue,
                stacktrace,
              },
            };
          })
        );
        break;
      case "status":
        set(
          produce((state) => {
            const { lang, status, id } = payload;
            // console.log("WS_STATUS", { lang, status });
            state.kernels[lang].status = status;
            // this is for racket kernel, which does not have a execute_reply
            if (lang === "racket" && status === "idle" && state.pods[id]) {
              state.pods[id].running = false;
            }
          })
        );
        break;
      case "interrupt_reply":
        // console.log("got interrupt_reply", payload);
        get().wsRequestStatus({ lang: payload.lang });
        break;
      default:
        console.log("WARNING unhandled message", { type, payload });
    }
  };
}

const onOpen = (set, get) => {
  return () => {
    console.log("connected");
    set({ runtimeConnected: true });
    // call connect kernel

    if (get().socketIntervalId) {
      clearInterval(get().socketIntervalId);
    }
    let id = setInterval(() => {
      if (get().socket) {
        console.log("sending ping ..");
        get().socket.send(JSON.stringify({ type: "ping" }));
      }
      // websocket resets after 60s of idle by most firewalls
    }, 30000);
    set({ socketIntervalId: id });
    console.log("get()", get());

    // request kernel status after connection
    Object.keys(get().kernels).forEach((k) => {
      get().wsRequestStatus({
        lang: k,
        sessionId: get().sessionId,
      });
    });
  };
};

async function spawnRuntime({ client, sessionId }) {
  // load from remote
  console.log("spawnRuntime");
  let res = await client.mutate({
    mutation: gql`
      mutation spawnRuntime($sessionId: String!) {
        spawnRuntime(sessionId: $sessionId)
      }
    `,
    variables: {
      sessionId,
    },
    // refetchQueries with array of strings are known not to work in many
    // situations, ref:
    // https://lightrun.com/answers/apollographql-apollo-client-refetchqueries-not-working-when-using-string-array-after-mutation
    //
    // refetchQueries: ["listAllRuntimes"],
    refetchQueries: [
      {
        query: gql`
          query {
            listAllRuntimes
          }
        `,
      },
    ],
  });
  console.log("spawnRuntime res", res);
  if (res.errors) {
    throw Error(
      `Error: ${
        res.errors[0].message
      }\n ${res.errors[0].extensions.exception.stacktrace.join("\n")}`
    );
  }
  return res.data.spawnRuntime;
}

export const createRuntimeSlice = (set, get) => ({
  wsConnect: async (client, sessionId) => {
    // 0. ensure the runtime is created
    // let sessionId = get().sessionId;
    console.log("sessionId", sessionId);
    let runtimeCreated = await spawnRuntime({ client, sessionId });
    if (!runtimeCreated) {
      throw Error("ERROR: runtime not ready");
    }
    // 1. get the socket
    console.log("WS_CONNECT");
    // FIXME socket should be disconnected when leaving the repo page.
    if (get().socket !== null) {
      console.log("already connected, skip");
      return;
    }
    // reset kernel status
    set({
      kernels: {
        python: {
          status: null,
        },
      },
    });
    console.log("connecting ..");

    // connect to the remote host
    // socket = new WebSocket(action.host);
    //
    // I canont use "/ws" for a WS socket. Thus I need to detect what's the
    // protocol used here, so that it supports both dev and prod env.
    let socket_url = `ws://${process.env.REACT_APP_RUNTIME_PROXY}/${sessionId}`;
    console.log("socket_url", socket_url);
    let socket = new WebSocket(socket_url);
    set({ socket });
    // socket.emit("spawn", state.sessionId, lang);

    // If the mqAddress is not supplied, use the websocket
    socket.onmessage = onMessage(set, get);

    // well, since it is already opened, this won't be called
    //
    // UPDATE it works, this will be called even after connection

    socket.onopen = onOpen(set, get);
    // so I'm setting this
    // Well, I should probably not dispatch action inside another action
    // (even though it is in a middleware)
    //
    // I probably can dispatch the action inside the middleware, because
    // this is not a dispatch. It will not modify the store.
    //
    // store.dispatch(actions.wsConnected());
    socket.onclose = () => {
      console.log("Disconnected ..");
      set({ runtimeConnected: false });
      set({ socket: null });
    };
  },
  wsDisconnect: () => {
    if (get().socket !== null) {
      get().socket.close();
    }
  },
  wsRequestStatus: ({ lang }) => {
    if (get().socket) {
      // set to unknown
      set(
        produce((state) => {
          state.kernels[lang].status = null;
        })
      );
      console.log("Sending requestKernelStatus ..");
      get().socket.send(
        JSON.stringify({
          type: "requestKernelStatus",
          payload: {
            sessionId: get().sessionId,
            lang,
          },
        })
      );
    } else {
      console.log("ERROR: not connected");
    }
  },
  wsRun: async (id) => {
    if (!get().socket) {
      get().addError({
        type: "error",
        msg: "Runtime not connected",
      });
      return;
    }
    handleRunTree({
      id,
      socket: {
        send: (payload) => {
          console.log("sending", payload);
          get().socket.send(payload);
        },
      },
      set,
      get,
    });
  },
  wsPowerRun: ({ id, doEval }) => {
    if (!get().socket) {
      get().addError({
        type: "error",
        msg: "Runtime not connected",
      });

      return;
    }
    // This is used to evaluate the current deck and init the namespace
    handlePowerRun({ id, doEval, socket: get().socket, set, get });
  },
  wsInterruptKernel: ({ lang }) => {
    if (!get().socket) {
      get().addError({
        type: "error",
        msg: "Runtime not connected",
      });

      return;
    }
    get().socket.send(
      JSON.stringify({
        type: "interruptKernel",
        payload: {
          sessionId: get().sessionId,
          lang,
        },
      })
    );
  },
  clearResults: (id) => {
    set(
      produce((state) => {
        state.pods[id].result = null;
        state.pods[id].stdout = null;
        state.pods[id].error = null;
      })
    );
  },
  clearAllResults: () => {
    set(
      produce((state) => {
        Object.keys(state.pods).forEach((id) => {
          state.pods[id].result = null;
          state.pods[id].stdout = "";
          state.pods[id].error = null;
        });
      })
    );
  },
  setRunning: (id) => {
    set(
      produce((state) => {
        state.pods[id].running = true;
      })
    );
  },
  // ==========
  // exports
  addPodExport: ({ id, name }) => {
    set(
      produce((state) => {
        // XXX at pod creation, remote pod in db gets null in exports/imports.
        // Thus this might be null. So create here to avoid errors.
        let pod = state.pods[id];
        if (!pod.exports) {
          pod.exports = {};
        }
        pod.exports[name] = false;
      })
    );
  },
  clearAllExports: () => {
    set(
      produce((state) => {
        for (let [, pod] of Object.entries(state.pods)) {
          pod.exports = {};
          pod.reexports = {};
        }
      })
    );
  },
  setPodExport: ({ id, exports, reexports }) => {
    set(
      produce((state) => {
        let pod = state.pods[id];
        pod.exports = Object.assign(
          {},
          ...exports.map((name) => ({ [name]: pod.exports[name] || [] }))
        );
        pod.reexports = reexports;
        // add the reexports use reference to the origin
        for (let [name, origid] of Object.entries(reexports)) {
          if (state.pods[origid].exports[name].indexOf(id) === -1) {
            state.pods[origid].exports[name].push(id);
          }
        }
      })
    );
  },
  clearIO: ({ id, name }) => {
    set(
      produce((state) => {
        delete state.pods[id].io[name];
      })
    );
  },
  deletePodExport: ({ id, name }) => {
    set(
      produce((state) => {
        delete state.pods[id].exports[name];
      })
    );
  },
  clearPodExport: ({ id }) => {
    set(
      produce((state) => {
        state.pods[id].exports = null;
      })
    );
  },
  togglePodExport: ({ id, name }) => {
    set(
      produce((state) => {
        let pod = state.pods[id];
        pod.exports[name] = !pod.exports[name];
      })
    );
  },
  toggleDeckExport: ({ id }) => {
    set(
      produce((state) => {
        let pod = state.pods[id];
        // this is only for deck
        // state.pods[id].exports = {};
        if (!pod.exports) {
          pod.exports = {};
        }
        if (!state.pods[id].exports["self"]) {
          pod.exports["self"] = true;
        } else {
          pod.exports["self"] = false;
        }
      })
    );
  },
  addPodImport: ({ id, name }) => {
    set(
      produce((state) => {
        let pod = state.pods[id];
        if (!pod.imports) {
          pod.imports = {};
        }
        pod.imports[name] = false;
      })
    );
  },
  deletePodImport: ({ id, name }) => {
    set(
      produce((state) => {
        delete state.pods[id].imports[name];
      })
    );
  },
  togglePodImport: ({ id, name }) => {
    set(
      produce((state) => {
        let pod = state.pods[id];
        pod.imports[name] = !pod.imports[name];
      })
    );
  },
  addPodMidport: ({ id, name }) => {
    set(
      produce((state) => {
        let pod = state.pods[id];
        if (!pod.midports) {
          pod.midports = {};
        }
        pod.midports[name] = false;
      })
    );
  },
  deletePodMidport: ({ id, name }) => {
    set(
      produce((state) => {
        if (state.pods[id].midports) {
          delete state.pods[id].midports[name];
        }
      })
    );
  },
  togglePodMidport: ({ id, name }) => {
    set(
      produce((state) => {
        let pod = state.pods[id];
        pod.midports[name] = !pod.midports[name];
      })
    );
  },
});
