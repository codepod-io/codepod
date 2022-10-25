import { getAuthHeaders, hashPod, computeNamespace } from "../utils";

import { GRAPHQL_ENDPOINT } from "../vars";

const graphql_url = GRAPHQL_ENDPOINT;

export async function doRemoteLoadRepo({ id }) {
  // load from remote
  const query = `
    query Repo($id: String!) {
      repo(id: $id) {
        id
        name
        pods {
          id
          type
          lang
          content
          githead
          staged
          column
          result
          stdout
          fold
          thundar
          utility
          name
          error
          imports
          exports
          reexports
          midports
          index
          x
          y
          width
          height
          parent {id}
          children {id}
        }
      }
    }
  `;
  // return res
  let res = await fetch(graphql_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      query: query,
      variables: {
        id,
      },
    }),
  });
  res = await res.json();
  if (res.errors) {
    throw Error(`Error: ${res.errors[0].message}`);
  }
  return res;
}

export function normalize(pods) {
  const res = {
    ROOT: {
      id: "ROOT",
      name: "root",
      children: [],
      // Adding this to avoid errors
      // XXX should I save these to db?
      exports: {},
      imports: {},
      midport: {},
      io: {},
      lang: "python",
    },
  };

  // add id map
  pods.forEach((pod) => {
    res[pod.id] = pod;
  });
  // console.log(res);
  pods.forEach((pod) => {
    // console.log("P:", pod.parent);
    // FIXME this is for backward compatibility
    if (!pod.parent) {
      // add root
      res["ROOT"].children.push({ id: pod.id, type: pod.type });
      pod.parent = "ROOT";
      // console.log("=========");
    } else {
      // change parent.id format
      pod.parent = pod.parent.id;
    }

    pod.children = pod.children
      ? pod.children.map(({ id }) => ({
          id: res[id].id,
          type: res[id].type,
        }))
      : [];
    // change children.id format
    // UDPATE Or, I just put {id,type} in the children array
    //
    // pod.children = pod.children.map(({ id }) => id);
    //
    // sort according to index
    pod.children.sort((a, b) => res[a.id].index - res[b.id].index);
    // if (pod.type === "WYSIWYG" || pod.type === "CODE") {
    //   pod.content = JSON.parse(pod.content);
    // }
    pod.content = JSON.parse(pod.content);
    pod.staged = JSON.parse(pod.staged);
    pod.githead = JSON.parse(pod.githead);
    if (pod.result) {
      pod.result = JSON.parse(pod.result);
    }
    if (pod.error) {
      pod.error = JSON.parse(pod.error);
    }
    if (pod.imports) {
      pod.imports = JSON.parse(pod.imports);
    }
    if (pod.exports) {
      pod.exports = JSON.parse(pod.exports);
    }
    if (pod.reexports) {
      pod.reexports = JSON.parse(pod.reexports);
    }
    if (pod.midports) {
      pod.midports = JSON.parse(pod.midports);
    }
    pod.remoteHash = hashPod(pod);
    // DEBUG the deck's content seems to be a long string of escaped \
    if (pod.type === "DECK" && pod.content) {
      console.log(
        `warning: deck ${pod.id} content is not null, setting to null:`,
        pod.content
      );
      pod.content = null;
    }
  });
  pods.forEach((pod) => {
    pod.ns = computeNamespace(res, pod.id);
    // set IO
    pod.io = {};
  });
  return res;
}

function serializePodInput(pod) {
  // only get relevant input
  return (({
    id,
    type,
    content,
    column,
    lang,
    parent,
    // index,
    children,
    result,
    stdout,
    fold,
    thundar,
    utility,
    name,
    error,
    imports,
    exports,
    reexports,
    midports,
    x,
    y,
    width,
    height,
  }) => ({
    id,
    type,
    column,
    lang,
    // stdout,
    fold,
    thundar,
    utility,
    name,
    content: JSON.stringify(content),
    // result: JSON.stringify(result),
    // error: JSON.stringify(error),
    imports: JSON.stringify(imports),
    exports: JSON.stringify(exports),
    reexports: JSON.stringify(reexports),
    midports: JSON.stringify(midports),
    x,
    y,
    width,
    height,
    parent,
    children: children?.map(({ id }) => id),
  }))(pod);
}

export async function doRemoteAddPod({ repoId, parent, index, pod }) {
  const query = `
    mutation addPod(
      $repoId: String
      $parent: String
      $index: Int
      $input: PodInput
    ) {
      addPod(
        repoId: $repoId
        parent: $parent
        index: $index
        input: $input
      )
    }
  `;
  let res = await fetch(graphql_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      query: query,
      variables: {
        repoId,
        parent,
        index,
        input: serializePodInput(pod),
      },
    }),
  });
  res = await res.json();
  if (res.errors) {
    throw Error(`Error: ${res.errors[0].message}`);
  }
  return res;
}

export async function doRemoteDeletePod({ id, toDelete }) {
  const query = `
    mutation deletePod($id: String, $toDelete: [String]) {
      deletePod(id: $id, toDelete: $toDelete)
    }
  `;
  let res = await fetch(graphql_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      query: query,
      variables: {
        id,
        toDelete,
      },
    }),
  });
  res = await res.json();
  if (res.errors) {
    throw Error(`Error: ${res.errors[0].message}`);
  }
  return res;
}

export async function doRemoteUpdatePod({ pod }) {
  const res = await fetch(graphql_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      query: `
        mutation updatePod($id: String, $input: PodInput) {
          updatePod(id: $id, input: $input)
        }
      `,
      variables: {
        id: pod.id,
        input: serializePodInput(pod),
      },
    }),
  });
  const result = await res.json();
  if (result["errors"]) {
    console.log(result["errors"][0].message);
    throw new Error("fetch error. See console for detail.");
  }
  return result;
}

export async function doRemotePastePod({
  clip,
  repoId, // FIXME repoId is not used.
  parent,
  index,
  column,
}) {
  let res = await fetch(graphql_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      // movePod(id: String, parentId: String, index: Int): Boolean
      query: `
        mutation PastePods(
          $repoId: String
          $ids: [String]
          $parentId: String
          $index: Int
          $column: Int
        ) {
          pastePods(
            repoId: $repoId
            ids: $ids
            parentId: $parentId
            index: $index
            column: $column
          )
        }
      `,
      variables: {
        ids: clip,
        parentId: parent,
        index,
        column,
        repoId,
      },
    }),
  });
  res = await res.json();
  if (res.errors) {
    throw Error(`Error: ${res.errors[0].message}`);
  }
  return res;
}
