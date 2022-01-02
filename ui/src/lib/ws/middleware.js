import * as actions from "./actions";

import { repoSlice } from "../store";
import Stomp from "stompjs";
import pod from "../reducers/pod";

function getReexports({ id, pods }) {
  // Get the reexports available for the deck id. Those are from this deck's subdecks
  let reexports = Object.assign(
    {},
    ...pods[id].children
      .filter(({ id }) => pods[id].type === "DECK" && !pods[id].thundar)
      .map(({ id, type }) => pods[id])
      .map((deck) =>
        Object.assign(
          {},
          ...deck.children
            .filter(({ id }) => pods[id].type !== "DECK")
            .map(({ id }) => pods[id])
            .map((pod) => pod.reexports)
        )
      )
  );

  // change reexport from name=>id to ns=>names
  let res = {};
  for (let [name, id] of Object.entries(reexports)) {
    if (!res[pods[id].ns]) {
      res[pods[id].ns] = [];
    }
    res[pods[id].ns].push(name);
  }
  return res;
}

function powerRun_racket({ id, storeAPI, socket }) {
  let pods = storeAPI.getState().repo.pods;
  let pod = pods[id];
  let names = pod.children
    .filter(({ id }) => pods[id].type !== "DECK")
    .filter(({ id }) => pods[id].exports)
    .map(({ id }) => Object.keys(pods[id].exports));
  names = [].concat(...names);
  let struct_codes = pod.children
    .filter(
      ({ id }) =>
        pods[id].type === "DECK" && !pods[id].thundar && pods[id].exports
    )
    .filter(
      ({ id }) =>
        pods[id].exports.filter((k) => k.startsWith("struct:")).length > 0
    )
    .map(({ id }) => pods[id].content);
  // FIXME reset-module is problematic! it is equivalanet to the following expansion. Why??
  // let code = `(enter! #f) (reset-module ${ns} ${names.join(" ")})`;
  let struct_names = names
    .filter((s) => s.startsWith("struct:"))
    .map((s) => s.split(" ")[1]);
  // FIXME will the struct-out support update?
  //
  // UPDATE this does not work. Instead, I could insert the real content for
  // all exported names maybe?
  names = names.filter((s) => !s.startsWith("struct:"));

  // also I need to require for struct:parent
  let nses = getUtilNs({ id, pods });
  // console.log("nses", nses);
  // child deck's
  const child_deck_nses = pods[id].children
    .filter(({ id }) => pods[id].type === "DECK" && !pods[id].thundar)
    .map(({ id, type }) => pods[id].ns);
  // console.log("child_deck_nses", child_deck_nses);
  nses = nses.concat(child_deck_nses);
  // if it is a test desk, get parent
  if (pod.thundar) {
    nses.push(pods[pod.parent].ns);
  }

  let reexports = getReexports({ id, pods });
  let reexport_code = Object.keys(reexports)
    .map(
      (ns) => `
      (require (only-in '${ns} ${reexports[ns]
        .map((name) => `${name}`)
        .join(" ")}))
      (provide ${reexports[ns].map((name) => `${name}`).join(" ")})
      `
    )
    .join("\n");

  let code = `
(enter! #f)
(module ${pod.ns} racket 
(require rackunit 'CODEPOD ${nses.map((s) => "'" + s).join(" ")})
${reexport_code}
(provide ${names.join(" ")}
${struct_names.map((s) => `(struct-out ${s})`).join("\n")}
)
${names.map((name) => `(define ${name} "PLACEHOLDER-${name}")`).join("\n")}
${struct_codes.join("\n")}
)
`;
  // ${struct_names.map((name) => `(struct ${name} ())`)}

  storeAPI.dispatch(repoSlice.actions.clearResults(pod.id));
  storeAPI.dispatch(repoSlice.actions.setRunning(pod.id));
  socket.send(
    JSON.stringify({
      type: "runCode",
      payload: {
        lang: pod.lang,
        code,
        namespace: pod.ns,
        raw: true,
        // FIXME this is deck's ID
        podId: pod.id,
        sessionId: storeAPI.getState().repo.sessionId,
      },
    })
  );
}

function powerRun_julia({ id, storeAPI, socket }) {
  let pods = storeAPI.getState().repo.pods;
  let pod = pods[id];
  let names = pod.children
    .filter(({ id }) => pods[id].type !== "DECK")
    .filter(({ id }) => pods[id].exports)
    .map(({ id }) => Object.keys(pods[id].exports));
  names = [].concat(...names);
  let nses = getUtilNs({ id, pods });
  const child_deck_nses = pods[id].children
    .filter(({ id }) => pods[id].type === "DECK" && !pods[id].thundar)
    .map(({ id, type }) => pods[id].ns);
  nses = nses.concat(child_deck_nses);
  // if it is a test desk, get parent
  if (pod.thundar) {
    nses.push(pods[pod.parent].ns);
  }

  let reexports = getReexports({ id, pods });

  let reexport_code = Object.keys(reexports)
    .map(
      (ns) =>
        `
    eval(:(@reexport using $(:Main).$(Symbol("${ns}")): ${reexports[ns]
          .map((name) => `${name}`)
          .join(",")}))
    `
    )
    .join("\n");

  function ns2jlmod(ns) {
    return "Main." + ns.replaceAll("/", ".");
  }

  // Much better!!!
  let code = `
    ${nses
      .map(
        (ns) => `
    eval(:(using $(:Main).$(Symbol("${ns}"))))
    `
      )
      .join("\n")}
    
    ${reexport_code}

    ${names.length > 0 ? `export ${names.join(",")}` : ""}
    `;
  // console.log("code:", code);
  // ${struct_names.map((name) => `(struct ${name} ())`)}

  storeAPI.dispatch(repoSlice.actions.clearResults(pod.id));
  storeAPI.dispatch(repoSlice.actions.setRunning(pod.id));
  socket.send(
    JSON.stringify({
      type: "runCode",
      payload: {
        lang: pod.lang,
        code,
        namespace: pod.ns,
        // raw: true,
        // FIXME this is deck's ID
        podId: pod.id,
        sessionId: storeAPI.getState().repo.sessionId,
      },
    })
  );
}

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

function powerRun_python({ id, storeAPI, socket }) {
  let pods = storeAPI.getState().repo.pods;
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
  storeAPI.dispatch(repoSlice.actions.clearResults(pod.id));
  storeAPI.dispatch(repoSlice.actions.setRunning(pod.id));
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
        sessionId: storeAPI.getState().repo.sessionId,
      },
    })
  );
}

function handlePowerRun({ id, doEval, storeAPI, socket }) {
  // assume id is a deck
  // this is used to init or reset the deck with all exported names
  let pods = storeAPI.getState().repo.pods;
  let pod = pods[id];
  if (pod.lang === "racket") {
    powerRun_racket({ id, storeAPI, socket });
  } else if (pod.lang === "julia") {
    powerRun_julia({ id, storeAPI, socket });
  } else if (pod.lang === "python") {
    powerRun_python({ id, storeAPI, socket });
  }

  if (doEval) {
    // run all children pods
    pod.children
      .filter(({ id }) => pods[id].type !== "DECK")
      .map(({ id }) => {
        let pod = pods[id];
        if (pod.type === "CODE" && pod.content && pod.lang && !pod.thundar) {
          storeAPI.dispatch(repoSlice.actions.clearResults(pod.id));
          storeAPI.dispatch(repoSlice.actions.setRunning(pod.id));
          socket.send(
            JSON.stringify({
              type: "runCode",
              payload: {
                lang: pod.lang,
                code: pod.content,
                namespace: pod.ns,
                raw: pod.raw,
                podId: pod.id,
                sessionId: storeAPI.getState().repo.sessionId,
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

function handleUpdateDef({ id, storeAPI, socket }) {
  let pods = storeAPI.getState().repo.pods;
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
      pods[pod.parent].children
        .filter(({ id, type }) => type === "DECK" && pods[id].thundar)
        .map(({ id }) => {
          code += `
CODEPOD_EVAL("""${name} = CODEPOD_GETMOD("${pod.ns}").__dict__["${name}"]\n0""", "${pods[id].ns}")
`;
        });

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
          pods[pods[use].parent].children
            .filter(({ id, type }) => type === "DECK" && pods[id].thundar)
            .map(({ id }) => {
              code += `
CODEPOD_EVAL("""${name} = CODEPOD_GETMOD("${pod.ns}").__dict__["${name}"]\n0""", "${pods[id].ns}")
`;
            });
        }
      }
    }

    code += `
"ok"
`;

    // console.log("handleUpdateDef code", code);

    // send for evaluation
    console.log("sending for handleUpdateDef ..");
    storeAPI.dispatch(repoSlice.actions.setRunning(pod.id));
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
          sessionId: storeAPI.getState().repo.sessionId,
        },
      })
    );
  }
}

function getUtilNs({ id, pods, exclude }) {
  // get all utils for id
  // get children utils nodes
  if (!id) return [];
  let res = pods[id].children
    .filter(({ id }) => id !== exclude && pods[id].utility)
    .map(({ id, type }) => pods[id].ns);
  // keep to go to parents
  return res.concat(getUtilNs({ id: pods[id].parent, pods, exclude: id }));
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
    if (idx == -1) {
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

function handleRunTree({ id, storeAPI, socket }) {
  // get all pods
  console.log("handleRunTree", { id, storeAPI, socket });
  function helper(id) {
    let pods = storeAPI.getState().repo.pods;
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
      handlePowerRun({ id, storeAPI, socket });
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
        storeAPI.dispatch(repoSlice.actions.clearResults(pod.id));

        let { exports, reexports, content } = getExports(pod.content);
        // console.log("resolving ..", reexports);
        // resolve reexports
        for (let subdeckid of pods[pod.parent].children
          .filter(({ id }) => pods[id].type === "DECK")
          .filter(({ id }) => !pods[id].utility && !pods[id].thundar)
          .map(({ id }) => id)) {
          // console.log("trying", subdeckid);
          let subdeck = storeAPI.getState().repo.pods[subdeckid];
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

        storeAPI.dispatch(
          repoSlice.actions.setPodExport({
            id,
            exports,
            reexports,
          })
        );
        if (content) {
          storeAPI.dispatch(repoSlice.actions.setRunning(pod.id));
          socket.send(
            JSON.stringify({
              type: "runCode",
              payload: {
                lang: pod.lang,
                code: content,
                namespace: pod.ns,
                raw: pod.raw,
                podId: pod.id,
                sessionId: storeAPI.getState().repo.sessionId,
              },
            })
          );
          handleUpdateDef({ id, storeAPI, socket });
        }
      }
    }
  }
  helper(id);
}

function onMessage(store) {
  return (msg) => {
    // console.log("onMessage", msg.data || msg.body || undefined);
    // msg.data for websocket
    // msg.body for rabbitmq
    let { type, payload } = JSON.parse(msg.data || msg.body || undefined);
    // console.log("got message", type, payload);
    switch (type) {
      case "output":
        {
          console.log("output:", payload);
        }
        break;
      case "stdout":
        {
          store.dispatch(actions.wsStdout(payload));
        }
        break;
      case "execute_result":
        {
          store.dispatch(actions.wsResult(payload));
        }
        break;
      case "display_data":
        {
          store.dispatch(actions.wsDisplayData(payload));
        }
        break;
      case "execute_reply":
        {
          store.dispatch(actions.wsExecuteReply(payload));
        }
        break;
      case "error":
        {
          store.dispatch(actions.wsError(payload));
        }
        break;
      case "stream":
        {
          store.dispatch(actions.wsStream(payload));
        }
        break;
      case "IO:execute_result":
        {
          store.dispatch(actions.wsIOResult(payload));
        }
        break;
      case "IO:execute_reply":
        {
          // CAUTION ignore
        }
        break;
      case "IO:error":
        {
          store.dispatch(actions.wsIOError(payload));
        }
        break;
      case "status":
        {
          // console.log("Received status:", payload);
          store.dispatch(actions.wsStatus(payload));
        }
        break;
      case "interrupt_reply":
        {
          // console.log("got interrupt_reply", payload);
          store.dispatch(actions.wsRequestStatus({ lang: payload.lang }));
        }
        break;
      default:
        console.log("WARNING unhandled message", { type, payload });
    }
  };
}

const socketMiddleware = () => {
  let socket = null;
  let socket_intervalId = null;
  let mq_client = null;

  // the middleware part of this function
  return (store) => (next) => (action) => {
    switch (action.type) {
      case "WS_CONNECT":
        console.log("WS_CONNECT");
        if (socket !== null) {
          console.log("already connected, skip");
          // store.dispatch(
          //   repoSlice.actions.addError({
          //     type: "warning",
          //     msg: "Already connected.",
          //   })
          // );
          // socket.close();
          break;
        }
        // reset kernel status
        store.dispatch(repoSlice.actions.resetKernelStatus());
        console.log("connecting ..");

        // connect to the remote host
        // socket = new WebSocket(action.host);
        //
        // I canont use "/ws" for a WS socket. Thus I need to detect what's the
        // protocol used here, so that it supports both dev and prod env.
        let socket_url;
        if (!window.codepodio) {
          // socket_url = `ws://localhost:14321`;
          // socket_url = `ws://192.168.1.142:14321`;
          // FIXME variable not ready?
          socket_url = `ws://${store.getState().repo.activeRuntime[0]}`;
        } else if (window.location.protocol === "http:") {
          socket_url = `ws://${window.location.host}/ws`;
        } else {
          socket_url = `wss://${window.location.host}/ws`;
        }
        console.log("socket_url", socket_url);
        socket = new WebSocket(socket_url);
        // socket.emit("spawn", state.sessionId, lang);

        if (!store.getState().repo.activeRuntime[1]) {
          // If the mqAddress is not supplied, use the websocket
          socket.onmessage = onMessage(store);
        } else {
          // otherwise, use the mqAddress

          // if (mq_client) {
          //   mq_client.disconnect()
          // }
          console.log("connecting to stomp ..");
          // TODO for production
          let mq_url;
          if (window.location.protocol === "http:") {
            // "ws://codepod.test/ws"
            // "ws://mq.codepod.test/ws"
            // FIXME why have to use /ws suffix?
            // mq_url = `ws://mq.${window.location.host}/ws`;
            // mq_url = `ws://192.168.1.142:15674/ws`;
            mq_url = `ws://${store.getState().repo.activeRuntime[1]}/ws`;
          } else {
            mq_url = `wss://mq.${window.location.host}/ws`;
          }
          console.log("connecting to MQ:", mq_url);
          mq_client = Stomp.over(new WebSocket(mq_url));
          // remove debug messages
          mq_client.debug = () => {};
          mq_client.connect(
            "guest",
            "guest",
            function () {
              console.log("connected to rabbitmq");
              mq_client.subscribe(
                store.getState().repo.sessionId,
                onMessage(store)
              );
            },
            function () {
              console.log("error connecting RabbitMQ");
            },
            "/"
          );
        }

        // websocket handlers
        // socket.onmessage = onMessage(store);
        // socket.onclose = onClose(store);
        // socket.onopen = onOpen(store);

        // well, since it is already opened, this won't be called
        //
        // UPDATE it works, this will be called even after connection

        socket.onopen = () => {
          console.log("connected");
          store.dispatch(actions.wsConnected());
          // call connect kernel

          if (socket_intervalId) {
            clearInterval(socket_intervalId);
          }
          socket_intervalId = setInterval(() => {
            if (socket) {
              console.log("sending ping ..");
              socket.send(JSON.stringify({ type: "ping" }));
            }
            // websocket resets after 60s of idle by most firewalls
          }, 30000);

          // request kernel status after connection
          Object.keys(store.getState().repo.kernels).map((k) => {
            store.dispatch(
              actions.wsRequestStatus({
                lang: k,
                sessionId: store.getState().repo.sessionId,
              })
            );
            // wait 1s and resend. The kernel needs to rebind the socket to
            // IOPub, which takes sometime and the status result might not send
            // back. This will ensure the browser gets a fairly consistent
            // status report upon connection.
            // [100, 1000, 5000].map((t) => {
            //   setTimeout(() => {
            //     console.log(`Resending after ${t} ms ..`);
            //     store.dispatch(
            //       actions.wsRequestStatus({
            //         lang: k,
            //         sessionId: store.getState().repo.sessionId,
            //       })
            //     );
            //   }, t);
            // });
          });
        };
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
          store.dispatch(actions.wsDisconnected());
          socket = null;
        };
        // TODO log other unhandled messages
        // socket.onMessage((msg)=>{
        //   console.log("received", msg)
        // })

        break;
      case "WS_DISCONNECT":
        if (socket !== null) {
          socket.close();
        }
        // socket = null;
        // console.log("websocket closed");
        break;
      case "NEW_MESSAGE":
        console.log("sending a message", action.msg);
        socket.send(
          JSON.stringify({ command: "NEW_MESSAGE", message: action.msg })
        );
        break;
      case "WS_RUN": {
        if (!socket) {
          store.dispatch(
            repoSlice.actions.addError({
              type: "error",
              msg: "Runtime not connected",
            })
          );
          break;
        }
        handleRunTree({
          id: action.payload,
          storeAPI: store,
          socket: {
            send: (payload) => {
              console.log("sending", payload);
              socket.send(payload);
            },
          },
        });
        break;
      }
      case "WS_POWER_RUN": {
        if (!socket) {
          store.dispatch(
            repoSlice.actions.addError({
              type: "error",
              msg: "Runtime not connected",
            })
          );
          break;
        }
        let { id, doEval } = action.payload;

        // This is used to evaluate the current deck and init the namespace
        handlePowerRun({ id, doEval, storeAPI: store, socket });
        break;
      }
      case "WS_RUN_ALL": {
        throw new Error("WS_RUN_ALL deprecated");
        if (!socket) {
          store.dispatch(
            repoSlice.actions.addError({
              type: "error",
              msg: "Runtime not connected",
            })
          );
          break;
        }
        // get all pods
        let pods = store.getState().repo.pods;
        function helper(id) {
          let pod = pods[id];
          pod.children.map(({ id }) => helper(id));
          // evaluate child first, then parent
          if (id !== "ROOT") {
            // if the pod content code
            // FIXME check validity, i.e. have code, etc
            // import
            if (pod.imports) {
              for (const [k, v] of Object.entries(pod.imports)) {
                // store.dispatch(actions.wsToggleImport);
                // console.log("???", k, v);
                //
                // I don't need to check v, because v means whether this is
                // further exported to parent ns. As long as it is shown here,
                // it is exported from child.
                // console.log("addImport", k, v);
                socket.send(
                  JSON.stringify({
                    type: "addImport",
                    payload: {
                      lang: pod.lang,
                      // this is the child's ns, actually only related to current
                      // parent CAUTION but i'm computing it here. Should be
                      // extracted to somewhere
                      // from: pod.ns,
                      from: `${pod.ns}/${pod.id}`,
                      to: pod.ns,
                      id: pod.id,
                      name: k,
                      sessionId: store.getState().repo.sessionId,
                    },
                  })
                );
              }
            }

            if (pod.type === "CODE" && pod.content && pod.lang) {
              store.dispatch(repoSlice.actions.clearResults(pod.id));
              socket.send(
                JSON.stringify({
                  type: "runCode",
                  payload: {
                    lang: pod.lang,
                    code: pod.content,
                    namespace: pod.ns,
                    podId: pod.id,
                    sessionId: store.getState().repo.sessionId,
                  },
                })
              );
            }
          }
        }
        helper("ROOT");
        // run each one in order
        break;
      }
      case "WS_REQUEST_STATUS":
        if (socket) {
          // set to unknown
          store.dispatch(actions.wsStatus({ status: null, ...action.payload }));
          socket.send(
            JSON.stringify({
              type: "requestKernelStatus",
              payload: {
                sessionId: store.getState().repo.sessionId,
                ...action.payload,
              },
            })
          );
        } else {
          console.log("ERROR: not connected");
        }
        break;
      case "WS_INTERRUPT_KERNEL":
        {
          if (!socket) {
            store.dispatch(
              repoSlice.actions.addError({
                type: "error",
                msg: "Runtime not connected",
              })
            );
            break;
          }
          socket.send(
            JSON.stringify({
              type: "interruptKernel",
              payload: {
                sessionId: store.getState().repo.sessionId,
                ...action.payload,
              },
            })
          );
        }
        break;

      case "WS_TOGGLE_MIDPORT": {
        let { id, name } = action.payload;
        if (!socket) {
          store.dispatch(
            repoSlice.actions.addError({
              type: "error",
              msg: "Runtime not connected",
            })
          );
          break;
        }
        store.dispatch(repoSlice.actions.togglePodMidport({ id, name }));
        let pods = store.getState().repo.pods;
        let pod = pods[id];
        let parent = pods[pod.parent];
        // just send socket
        if (pod.midports[name]) {
          // this name is then ready to be exported!
          store.dispatch(repoSlice.actions.addPodExport({ id, name }));
          // it is exported, then run the pod again
          socket.send(
            JSON.stringify({
              type: "runCode",
              payload: {
                lang: pod.lang,
                code: pod.content,
                namespace: pod.ns,
                podId: pod.id,
                sessionId: store.getState().repo.sessionId,
                midports:
                  pod.midports &&
                  Object.keys(pod.midports).filter((k) => pod.midports[k]),
              },
            })
          );
        } else {
          // FIXME should call removePodExport and update all parents
          // store.dispatch(actions.wsToggleExport)
          //
          // FIXME also, the Slate editor action should do some toggle as well
          store.dispatch(repoSlice.actions.deletePodExport({ id, name }));
          // it is deleted, run delete
          socket.send(
            JSON.stringify({
              type: "deleteMidport",
              payload: {
                lang: pod.lang,
                id: pod.id,
                ns: pod.ns,
                name,
                sessionId: store.getState().repo.sessionId,
              },
            })
          );
        }
        break;
      }
      case "WS_TOGGLE_EXPORT": {
        let { id, name } = action.payload;
        if (!socket) {
          store.dispatch(
            // FIXME this shoudl be warning
            repoSlice.actions.addError({
              type: "warning",
              msg: "Runtime not connected. Not evaluated.",
            })
          );
          // break;
        }
        store.dispatch(repoSlice.actions.togglePodExport({ id, name }));
        store.dispatch(repoSlice.actions.clearIO({ id, name }));
        let pods = store.getState().repo.pods;
        let pod = pods[id];
        // toggle for its parent
        if (pod.exports[name]) {
          console.log("sending addImport ..");
          socket.send(
            JSON.stringify({
              type: "addImport",
              payload: {
                lang: pod.lang,
                from: pod.ns,
                to: pods[pod.parent].ns,
                id: id,
                sessionId: store.getState().repo.sessionId,
                name,
              },
            })
          );
        } else {
          socket?.send(
            JSON.stringify({
              type: "deleteImport",
              payload: {
                lang: pod.lang,
                id,
                ns: pods[pod.parent].ns,
                sessionId: store.getState().repo.sessionId,
                name,
              },
            })
          );
        }
        break;
      }
      case "WS_TOGGLE_IMPORT": {
        let { id, name } = action.payload;
        if (!socket) {
          store.dispatch(
            repoSlice.actions.addError({
              type: "warning",
              msg: "Runtime not connected. Not evaluated.",
            })
          );
          // break;
        }
        store.dispatch(repoSlice.actions.togglePodImport({ id, name }));
        let pods = store.getState().repo.pods;
        let pod = pods[id];
        let parent = pods[pod.parent];
        // toggle for its parent
        if (pod.imports[name]) {
          store.dispatch(
            repoSlice.actions.addPodImport({ id: parent.id, name })
          );
          socket?.send(
            JSON.stringify({
              type: "addImport",
              payload: {
                lang: pod.lang,
                from: pod.ns,
                to: parent.ns,
                id: parent.id,
                name,
              },
            })
          );
        } else {
          // delete for all its parents
          while (parent && parent.imports && name in parent.imports) {
            store.dispatch(
              repoSlice.actions.deletePodImport({ id: parent.id, name })
            );
            socket?.send(
              JSON.stringify({
                type: "deleteImport",
                payload: {
                  lang: pod.lang,
                  ns: parent.ns,
                  id: parent.id,
                  name,
                },
              })
            );
            parent = pods[parent.parent];
          }
        }
        break;
      }
      default:
        return next(action);
    }
  };
};

export default socketMiddleware();
