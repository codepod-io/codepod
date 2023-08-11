/**
 * This is an alternative to yjs-plain. The persietence layer here saves a
 * binary blob to the DB.
 *
 * Cons (and the reason why I'm not using this):
 * - This requires DB schame change and manual DB migration.
 *
 * Pros:
 * - Support history.
 * - The logic is simpler than yjs-plain, no need to save each entries to the
 *   DB, just the single entire Y.Doc blob.
 * - The plain version seems to have trouble syncing with reconnected clients.
 *   I.e., if a client disconnects, make some offline edits, and connect back,
 *   those offline edits are not synced. THIS is the reason why I'm using this
 *   binary blob version.
 */

// throw new Error("Experimental not implemented.");

import Y from "yjs";
import { Node as ReactflowNode, Edge as ReactflowEdge } from "reactflow";

import debounce from "lodash/debounce";

import prisma from "./client";
import { dbtype2nodetype, json2yxml } from "./yjs-utils";

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
        1000,
        {
          maxWait: 2000,
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

async function handleSaveBlob({ repoId, yDocBlob }) {
  console.log("save blob", repoId, yDocBlob.length);
  await prisma.repo.update({
    where: { id: repoId },
    data: {
      yDocBlob,
    },
  });
}

/**
 * This function is called when setting up the WS connection, after the loadFromCodePod step.
 * TODO need to make sure this is only called once per repo, regardless of how many users are connected later.
 */
function setupObserversToDB(ydoc: Y.Doc, repoId: string) {
  console.log("setupObserversToDB for repo", repoId);
  //   just observe and save the entire doc
  function observer(_, transaction) {
    if (transaction.local) {
      // There shouldn't be local updates.
      console.log("[WARNING] Local update");
      return;
    }
    // FIXME the waiting time could be used to reduce the cost of saving to DB.
    getDebouncedCallback(`update-blob-${repoId}`)(() => {
      // encode state as update
      // FIXME it may be too expensive to update the entire doc.
      // FIXME history is discarded
      const update = Y.encodeStateAsUpdate(ydoc);
      handleSaveBlob({ repoId, yDocBlob: Buffer.from(update) });
    });
  }
  ydoc.getMap("nodesMap").observe(observer);
  ydoc.getMap("edgesMap").observe(observer);
  ydoc.getMap("codeMap").observeDeep(observer);
  ydoc.getMap("richMap").observeDeep(observer);
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

  if (repo.yDocBlob) {
    Y.applyUpdate(ydoc, repo.yDocBlob);
  } else {
    if (repo.pods.length > 0) {
      migrate_v_0_0_1(ydoc, repoId);
    }
    ydoc.getMap("meta").set("version", "v0.0.1");
  }
}

export async function bindState(doc: Y.Doc, repoId: string) {
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

/**
 * Load content from the DB and migrate to the new Y.Doc format.
 */
async function migrate_v_0_0_1(ydoc: Y.Doc, repoId: string) {
  console.log("=== initialMigrate");
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
  // nodes
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
  // edges
  repo.edges.forEach((edge) => {
    edgesMap.set(`${edge.sourceId}_${edge.targetId}`, {
      id: `${edge.sourceId}_${edge.targetId}`,
      source: edge.sourceId,
      target: edge.targetId,
    });
  });
  // content
  repo.pods.forEach((pod) => {
    // let content : Y.Text | Y.XmlFragment;
    if (pod.type === "CODE") {
      const content = new Y.Text(pod.content || undefined);
      codeMap.set(pod.id, content);
    } else if (pod.type === "WYSIWYG") {
      if (pod.content) {
        const yxml = json2yxml(JSON.parse(pod.content));
        richMap.set(pod.id, yxml);
      }
    }
  });
}
