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

import fs from "fs";
import Y from "yjs";

import debounce from "lodash/debounce";

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
        // write if no new activity in 10s
        1000,
        {
          // write at least every 20s
          maxWait: 5000,
        }
      )
    );
  }
  // 2. call it
  return debounceRegistry.get(key);
}

function handleSaveBlob({ repoId, yDocBlob, repoDir }) {
  console.log("save blob", repoId, yDocBlob.length);
  // create the yjs-blob folder if not exists
  const dir = `${repoDir}/.codepod`;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  // save the blob to file system
  fs.writeFileSync(`${dir}/yjs.bin`, yDocBlob);
}

function handleSavePlain({ repoId, ydoc, repoDir }) {
  console.log("save plain", repoId);
  // save the plain to file system
  const rootMap = ydoc.getMap("rootMap");
  const nodesMap = rootMap.get("nodesMap") as Y.Map<any>;
  const edgesMap = rootMap.get("edgesMap") as Y.Map<any>;
  const codeMap = rootMap.get("codeMap") as Y.Map<Y.Text>;
  const richMap = rootMap.get("richMap") as Y.Map<Y.XmlFragment>;
  const resultMap = rootMap.get("resultMap") as Y.Map<any>;
  const runtimeMap = rootMap.get("runtimeMap") as Y.Map<any>;
  const metaMap = rootMap.get("metaMap") as Y.Map<any>;
  const plain = {
    lastUpdate: new Date().toISOString(),
    metaMap: metaMap.toJSON(),
    nodesMap: nodesMap.toJSON(),
    edgesMap: edgesMap.toJSON(),
    codeMap: codeMap.toJSON(),
    richMap: richMap.toJSON(),
    resultMap: resultMap.toJSON(),
    runtimeMap: runtimeMap.toJSON(),
  };
  const dir = `${repoDir}/.codepod`;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(`${dir}/yjs.json`, JSON.stringify(plain, null, 2));
}

/**
 * This function is called when setting up the WS connection, after the loadFromCodePod step.
 * TODO need to make sure this is only called once per repo, regardless of how many users are connected later.
 */
function setupObserversToDB(ydoc: Y.Doc, repoId: string, repoDir: string) {
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
      handleSaveBlob({ repoId, yDocBlob: Buffer.from(update), repoDir });
      handleSavePlain({ repoId, ydoc, repoDir });
    });
  }
  const rootMap = ydoc.getMap("rootMap");
  const nodesMap = rootMap.get("nodesMap") as Y.Map<any>;
  nodesMap.observe(observer);
  const edgesMap = rootMap.get("edgesMap") as Y.Map<any>;
  edgesMap.observe(observer);
  const codeMap = rootMap.get("codeMap") as Y.Map<Y.Text>;
  codeMap.observeDeep(observer);
  const richMap = rootMap.get("richMap") as Y.Map<Y.XmlFragment>;
  richMap.observeDeep(observer);
  const resultMap = rootMap.get("resultMap") as Y.Map<any>;
  resultMap.observeDeep(observer);
}

/**
 * This function is called when setting up the WS connection, as a first step.
 */
async function loadFromFS(ydoc: Y.Doc, repoId: string, repoDir: string) {
  // load from the database and write to the ydoc
  console.log("=== loadFromFS");
  // read the blob from file system
  const binFile = `${repoDir}/.codepod/yjs.bin`;
  if (fs.existsSync(binFile)) {
    const yDocBlob = fs.readFileSync(binFile);
    Y.applyUpdate(ydoc, yDocBlob);
  } else {
    // init the ydoc
    const rootMap = ydoc.getMap("rootMap");
    rootMap.set("nodesMap", new Y.Map<any>());
    rootMap.set("edgesMap", new Y.Map<any>());
    rootMap.set("codeMap", new Y.Map<Y.Text>());
    rootMap.set("richMap", new Y.Map<Y.XmlFragment>());
    rootMap.set("resultMap", new Y.Map<any>());
    rootMap.set("runtimeMap", new Y.Map<any>());
    const metaMap = new Y.Map();
    metaMap.set("version", "v0.0.1");
    rootMap.set("metaMap", metaMap);
  }
}

export async function bindState(doc: Y.Doc, repoId: string, repoDir: string) {
  // Load persisted document state from the database.
  await loadFromFS(doc, repoId, repoDir);
  // Observe changes and write to the database.
  setupObserversToDB(doc, repoId, repoDir);
  // setupObserversToRuntime(doc, repoId);
  // reset runtime status
  // clear runtimeMap status/commands but keep the ID
  const rootMap = doc.getMap("rootMap");
  if (rootMap.get("runtimeMap") === undefined) {
    rootMap.set("runtimeMap", new Y.Map<any>());
  }
  const runtimeMap = rootMap.get("runtimeMap") as Y.Map<any>;
  for (let key of runtimeMap.keys()) {
    runtimeMap.set(key, {});
  }
}

export function writeState() {
  // FIXME IMPORTANT make sure the observer events are finished.
  console.log("=== flushing allDebouncedCallbacks", debounceRegistry.size);
  debounceRegistry.forEach((cb) => cb.flush());
}
