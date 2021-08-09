import { createAsyncThunk } from "@reduxjs/toolkit";

import { getAuthHeaders, hashPod, computeNamespace } from "../utils";
import { repoSlice } from "../store";

export async function doRemoteLoadRepo({ username, reponame }) {
  // load from remote
  // const reponame = getState().repo.reponame;
  // const username = getState().repo.username;
  const query = `
    query Repo($reponame: String!, $username: String!) {
      repo(name: $reponame, username: $username) {
        name
        owner {
          name
        }
        pods {
          id
          type
          lang
          content
          column
          result
          stdout
          fold
          error
          imports
          exports
          midports
          index
          parent {
            id
          }
          children {
            id
            type
          }
        }
      }
    }
  `;
  // return res
  const res = await fetch("/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      query: query,
      variables: {
        reponame,
        username,
      },
    }),
  });
  return res.json();
}

export function normalize(pods) {
  const res = {
    ROOT: {
      type: "DECK",
      id: "ROOT",
      children: [],
      // Adding this to avoid errors
      // XXX should I save these to db?
      exports: {},
      imports: {},
      midport: {},
      io: {},
    },
  };

  // add id map
  pods.forEach((pod) => {
    res[pod.id] = pod;
  });
  pods.forEach((pod) => {
    if (!pod.parent) {
      // add root
      res["ROOT"].children.push({ id: pod.id, type: pod.type });
      pod.parent = "ROOT";
    } else {
      // change parent.id format
      pod.parent = pod.parent.id;
    }
    // change children.id format
    // UDPATE Or, I just put {id,type} in the children array
    //
    // pod.children = pod.children.map(({ id }) => id);
    //
    // sort according to index
    pod.children.sort((a, b) => res[a.id].index - res[b.id].index);
    if (pod.type === "WYSIWYG" || pod.type === "CODE") {
      pod.content = JSON.parse(pod.content);
    }
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
    if (pod.midports) {
      pod.midports = JSON.parse(pod.midports);
    }
    pod.remoteHash = hashPod(pod);
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
    // parent,
    // index,
    // children,
    result,
    stdout,
    fold,
    error,
    imports,
    exports,
    midports,
  }) => ({
    id,
    type,
    column,
    lang,
    stdout,
    fold,
    content: JSON.stringify(content),
    result: JSON.stringify(result),
    error: JSON.stringify(error),
    imports: JSON.stringify(imports),
    exports: JSON.stringify(exports),
    midports: JSON.stringify(midports),
  }))(pod);
}

export async function doRemoteAddPod({
  username,
  reponame,
  parent,
  index,
  pod,
}) {
  const query = `
    mutation addPod(
      $reponame: String
      $username: String
      $parent: String
      $index: Int
      $input: PodInput
    ) {
      addPod(
        reponame: $reponame
        username: $username
        parent: $parent
        index: $index
        input: $input
      ) {
        id
      }
    }
  `;
  const res = await fetch("/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      query: query,
      variables: {
        reponame,
        username,
        parent,
        index,
        input: serializePodInput(pod),
      },
    }),
  });
  return res.json();
}

export async function doRemoteDeletePod({ id, toDelete }) {
  const query = `
    mutation deletePod(
      $id: String,
      $toDelete: [String]
    ) {
      deletePod(id: $id, toDelete: $toDelete)
    }`;
  const res = await fetch("/graphql", {
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
  return res.json();
}

export async function doRemoteUpdatePod(pod) {
  const res = await fetch("/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      query: `
        mutation updatePod($id: String, $content: String, $type: String, $lang: String,
                           $result: String, $stdout: String, $error: String, $column: Int,
                           $imports: String, $exports: String, $midports: String,
                           $fold: Boolean) {
          updatePod(id: $id, content: $content, type: $type, lang: $lang,
                    result: $result, stdout: $stdout, error: $error, column: $column
                    imports: $imports, exports: $exports, midports: $midports,
                    fold: $fold) {
            id
          }
        }`,
      variables: {
        ...pod,
        content: JSON.stringify(pod.content),
        result: JSON.stringify(pod.result),
        error: JSON.stringify(pod.error),
        imports: JSON.stringify(pod.imports),
        exports: JSON.stringify(pod.exports),
        midports: JSON.stringify(pod.midports),
      },
    }),
  });
  return res.json();
}

export async function doRemotePastePod({ clip, parent, index, column }) {
  const res = await fetch("/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      // movePod(id: String, parentId: String, index: Int): Boolean
      query: `
        mutation PastePod($id: String, $parentId: String, $index: Int, $column: Int) {
          pastePod(id: $id, parentId: $parentId, index: $index, column: $column)
        }`,
      variables: {
        id: clip,
        parentId: parent,
        index,
        column,
      },
    }),
  });
  return res.json();
}
