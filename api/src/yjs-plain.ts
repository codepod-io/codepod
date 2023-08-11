import Y from "yjs";

import { Node as ReactflowNode, Edge as ReactflowEdge } from "reactflow";

import debounce from "lodash/debounce";

import prisma from "./client";
import {
  dbtype2nodetype,
  json2yxml,
  nodetype2dbtype,
  yxml2json,
} from "./yjs-utils";

// const allDebouncedCallbacks: any[] = [];
// function createDebouncedCallback() {
//   const res = debounce(
//     (cb) => {
//       console.log("debounced callback");
//       cb();
//     },
//     250,
//     { maxWait: 1000 }
//   );
//   allDebouncedCallbacks.push(res);
//   return res;
// }

const debounceRegistry = new Map<string, any>();
/**
 * Invoke the callback that debounce w.r.t. the key. Also register the callback
 * in the registry to make sure it's called before the connection is closed..
 */
function getDebouncedCallback(key) {
  if (!debounceRegistry.has(key)) {
    console.log("registering for", key);
    debounceRegistry.set(
      key,
      debounce(
        (cb) => {
          console.log("debounced callback for", key);
          cb();
        },
        250,
        {
          maxWait: 1000,
        }
      )
    );
  }
  // 2. call it
  return debounceRegistry.get(key);
}

type NodeData = {
  level: number;
  name?: string;
};

async function handleAdd({ key, nodesMap, repoId }) {
  const node = nodesMap.get(key)!;
  console.log("add node", key);
  await prisma.pod.create({
    data: {
      id: key,
      name: node.data.name || undefined,
      type: nodetype2dbtype(node.type!),
      x: node.position.x,
      y: node.position.y,
      width: node.width || undefined,
      height: node.height || undefined,
      index: 0,
      repo: {
        connect: {
          id: repoId,
        },
      },
    },
  });
}

async function handleDelete(key) {
  console.log("delete node", key);
  // FIXME verify that scope is deleted recursively, and that edges are deleted.
  await prisma.pod.delete({
    where: {
      id: key,
    },
  });
}

// FIXME make this debounce according to the key.
async function handleUpdate(node) {
  // const node = nodesMap.get(key)!;
  console.log("update node", node.id, node.position);
  await prisma.pod.update({
    where: { id: node.id },
    data: {
      x: node.position.x,
      y: node.position.y,
      width: node.width || undefined,
      height: node.height || undefined,
      parent: node.parentNode
        ? {
            connect: {
              id: node.parentNode || undefined,
            },
          }
        : { disconnect: true },
    },
  });
}

function setupNodesMapObserver(ydoc: Y.Doc, repoId: string) {
  // observe changes to the ydoc and write to the database
  // The nodes: {"nodeID": ReactFlowNode}
  // TODO Maybe embed the content into the nodes?
  const nodesMap = ydoc.getMap<ReactflowNode<NodeData>>("nodesMap");
  // FIXME IMPORTANT do I need to unobserve?
  // FIXME will there be a destroy event?
  nodesMap.observe((YMapEvent, transaction) => {
    // TODO directly write to the database?? Add some delay & debounce?
    if (transaction.local) {
      console.warn("[WARN] Unexpected local change.");
      return;
    }

    YMapEvent.changes.keys.forEach((change, key) => {
      try {
        switch (change.action) {
          case "add":
            // FIXME why there're duplicate add events at server restarts?
            handleAdd({ key, nodesMap, repoId });
            break;
          case "delete":
            handleDelete(key);
            break;
          case "update":
            const node = nodesMap.get(key)!;
            // debouncedUpdateNode(node);
            getDebouncedCallback(`update-node-${node.id}`)(() =>
              handleUpdate(node)
            );
            break;
          default:
            throw new Error("Unknown action", change.action);
        }
      } catch (err) {
        console.error("=== Error handling YMapEvent", err);
        console.error(err);
        // DEBUG this error is thrown too much.
        // throw err;
      }
    });
  });
}

async function handleUpdatePod({
  id,
  content,
}: {
  id: string;
  content: string;
}) {
  console.log("update pod content", id);
  await prisma.pod.update({
    where: { id },
    data: {
      content,
    },
  });
}

function setupCodeMapObserver(ydoc: Y.Doc, repoId: string) {
  const codeMap = ydoc.getMap<Y.Text | Y.XmlFragment>("codeMap");
  // const debouncedCallback = createDebouncedCallback();
  codeMap.observeDeep((events, transaction) => {
    if (transaction.local) {
      // console.log("--- local change");
      return;
    }
    events.forEach(async (event) => {
      codeMap.get(event.target);
      if (event.target instanceof Y.Text) {
        const ytext = event.target as Y.Text;
        const podId = ytext._item?.parentSub;
        if (!podId) {
          throw new Error("setupCodeMapObserver: no podId");
        }
        // TODO update plain text to the database
        getDebouncedCallback(`update-content-${podId}`)(() =>
          handleUpdatePod({ content: ytext.toString(), id: podId })
        );
      } else if (event.target instanceof Y.Map) {
        // console.log("=== map event, skip");
      } else {
        console.log("=== codeMap unknown type", event.target.constructor.name);
      }
    });
  });
}

function setupRichMapObserver(ydoc: Y.Doc, repoId: string) {
  const richMap = ydoc.getMap<Y.XmlFragment>("richMap");
  richMap.observeDeep((events, transaction) => {
    if (transaction.local) {
      return;
    }
    events.forEach(async (event) => {
      let item = event.target;
      if (item && !(item instanceof Y.Map)) {
        // Find the root Y.XmlFragment.
        while (item.parent && !(item.parent instanceof Y.Map)) {
          item = item.parent;
        }
        // Get the pod ID.
        const podId = item._item.parentSub;
        // Perform the debounced update.
        getDebouncedCallback(`update-content-${podId}`)(() =>
          handleUpdatePod({
            id: podId,
            content: JSON.stringify(yxml2json(item)),
          })
        );
      }
    });
  });
}

async function handleAddEdge({ key, edgesMap, repoId }) {
  const edge = edgesMap.get(key)!;
  console.log("add edge", key);
  await prisma.edge.create({
    data: {
      source: {
        connect: {
          id: edge.source,
        },
      },
      target: {
        connect: {
          id: edge.target,
        },
      },
      repo: {
        connect: {
          id: repoId,
        },
      },
    },
  });
}

async function handleDeleteEdge({
  source,
  target,
}: {
  source: string;
  target: string;
}) {
  const sourcePod = await prisma.pod.findFirst({ where: { id: source } });
  const targetPod = await prisma.pod.findFirst({ where: { id: target } });
  if (!sourcePod || !targetPod) throw new Error("Pods not found.");
  console.log("delete edge", source, target);
  if (sourcePod.repoId !== targetPod.repoId)
    throw new Error("Pods are not in the same repo.");
  await prisma.edge.deleteMany({
    where: {
      source: {
        id: source,
      },
      target: {
        id: target,
      },
    },
  });
}

function setupEdgesMapObserver(ydoc: Y.Doc, repoId: string) {
  const edgesMap = ydoc.getMap<ReactflowEdge>("edgesMap");
  edgesMap.observe((YMapEvent, transaction) => {
    if (transaction.local) {
      return;
    }
    YMapEvent.changes.keys.forEach((change, key) => {
      switch (change.action) {
        case "add":
          handleAddEdge({ key, edgesMap, repoId });
          break;
        case "delete":
          // Now the edge is deleted, it's no longer in the edgesMap.
          handleDeleteEdge({
            source: change.oldValue.source,
            target: change.oldValue.target,
          });
          break;
        case "update":
          console.log("WARNING: edge update not implemented");
          break;
        default:
          throw new Error("Unknown action", change.action);
      }
    });
  });
}

/**
 * This function is called when setting up the WS connection, after the loadFromCodePod step.
 * TODO need to make sure this is only called once per repo, regardless of how many users are connected later.
 */
function setupObserversToDB(ydoc: Y.Doc, repoId: string) {
  console.log("setupObserversToDB for repo", repoId);
  // ydoc.on("update", (update) => {
  //   console.log("ydoc update");
  // });
  setupNodesMapObserver(ydoc, repoId);
  setupEdgesMapObserver(ydoc, repoId);
  // edges.observe((event) => {});
  setupCodeMapObserver(ydoc, repoId);
  // TODO need to close the connection when there's 0 connection.
  // TODO unobserve when done?
  // TODO make sure all updates are saved to the database.
  setupRichMapObserver(ydoc, repoId);
}

/**
 * This function is called when setting up the WS connection, as a first step.
 */
async function loadFromDB(ydoc: Y.Doc, repoId: string) {
  // load from the database and write to the ydoc
  console.log("=== loadFromDB");
  // 1. query DB for repo.pods
  const repo = await prisma.repo.findFirst({
    where: { id: repoId },
    include: {
      owner: true,
      collaborators: true,
      pods: {
        include: {
          children: true,
          parent: true,
        },
        orderBy: {
          index: "asc",
        },
      },
      edges: true,
    },
  });
  if (!repo) {
    throw new Error("repo not found");
  }
  // TODO make sure the ydoc is empty.
  // 2. construct Y doc types
  const nodesMap = ydoc.getMap<ReactflowNode<NodeData>>("nodesMap");
  const edgesMap = ydoc.getMap<ReactflowEdge>("edgesMap");
  const codeMap = ydoc.getMap("codeMap");
  const richMap = ydoc.getMap("richMap");
  // Load pod content.
  repo.pods.forEach((pod) => {
    // let content : Y.Text | Y.XmlFragment;
    if (pod.type === "CODE") {
      const content = new Y.Text(pod.content || undefined);
      codeMap.set(pod.id, content);
    } else if (pod.type === "WYSIWYG") {
      // const yXml = xml2yxml(pod.content);
      if (pod.content) {
        const yxml = json2yxml(JSON.parse(pod.content));
        richMap.set(pod.id, yxml);
      }
    } else {
      console.log("WARNING: unknown pod type", pod.type);
    }
  });
  // repo.yDocBlob && Y.applyUpdate(ydoc, repo.yDocBlob);
  // read the rich content from ydoc2
  repo.pods.forEach((pod) => {
    nodesMap.set(pod.id, {
      id: pod.id,
      type: dbtype2nodetype(pod.type),
      data: {
        name: pod.name || undefined,
        level: 0,
      },
      position: {
        x: pod.x,
        y: pod.y,
      },
      parentNode: pod.parent?.id,
      // TODO width & height
      width: pod.width,
      height: pod.height,
      style: {
        width: pod.width,
        height: pod.height,
      },
      dragHandle: ".custom-drag-handle",
    });
  });
  repo.edges.forEach((edge) => {
    edgesMap.set(`${edge.sourceId}_${edge.targetId}`, {
      id: `${edge.sourceId}_${edge.targetId}`,
      source: edge.sourceId,
      target: edge.targetId,
    });
  });
}

export async function bindState(doc: Y.Doc, repoId: string) {
  // sleep for 2 sec
  // await new Promise((resolve) => setTimeout(resolve, 2000));
  // Load persisted document state from the database.
  await loadFromDB(doc, repoId);
  // Observe changes and write to the database.
  await setupObserversToDB(doc, repoId);
}

export function writeState() {
  // FIXME IMPORTANT make sure the observer events are finished.
  console.log("=== flushing allDebouncedCallbacks", debounceRegistry.size);
  debounceRegistry.forEach((cb) => cb.flush());
}
