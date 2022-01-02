import { createAsyncThunk } from "@reduxjs/toolkit";

import { getAuthHeaders, hashPod, computeNamespace } from "../utils";
import { repoSlice } from "../store";

const graphql_url = !window.codepodio
  ? "http://localhost:14321/graphql"
  : "/graphql";

export async function doRemoteLoadGit({ username, reponame }) {
  // get the pods of the git HEAD
  const query = `
  query GitPods{
    gitGetPods(reponame: "${reponame}", username: "${username}", version:"HEAD") {
      id
      content
    }
  }
  `;
  const res = await fetch(graphql_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      query: query,
    }),
  });
  return res.json();
}

export async function doRemoteLoadRepo({ username, reponame }) {
  // load from remote
  // const reponame = getState().repo.reponame;
  // const username = getState().repo.username;
  const query = `
    query Repo($reponame: String!, $username: String!) {
      repo(name: $reponame, username: $username) {
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
          parent
          children
        }
      }
    }
  `;
  // return res
  const res = await fetch(graphql_url, {
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
  // console.log(res);
  pods.forEach((pod) => {
    // console.log("P:", pod.parent);
    // FIXME this is for backward compatibility
    // if (!pod.parent) {
    //   // add root
    //   res["ROOT"].children.push({ id: pod.id, type: pod.type });
    //   pod.parent = "ROOT";
    //   console.log("=========");
    // } else {
    //   // change parent.id format
    //   // pod.parent = pod.parent.id;
    // }

    // console.log(pod);
    pod.children = pod.children
      ? pod.children.map((id) => ({
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
    // pod.children.sort((a, b) => res[a.id].index - res[b.id].index);
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
    // parent,
    // index,
    // children,
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
      )
    }
  `;
  const res = await fetch(graphql_url, {
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

export async function doRemoteDeletePod({ id, toDelete, reponame, username }) {
  const query = `
    mutation deletePod(
      $id: String,
      $toDelete: [String]
      $reponame: String
      $username: String
    ) {
      deletePod(id: $id, toDelete: $toDelete, reponame: $reponame, username: $username)
    }`;
  const res = await fetch(graphql_url, {
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
        reponame,
        username,
      },
    }),
  });
  return res.json();
}

export async function doRemoteUpdatePod({ pod, reponame, username }) {
  const res = await fetch(graphql_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      query: `
        mutation updatePod($reponame: String, $username: String, 
          $input: PodInput
          ) {
          updatePod(reponame: $reponame
            username: $username
            input: $input)
        }`,
      variables: {
        reponame,
        username,
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
  reponame,
  parent,
  index,
  column,
}) {
  const res = await fetch(graphql_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      // movePod(id: String, parentId: String, index: Int): Boolean
      query: `
        mutation PastePods($reponame: String, $ids: [String], $parentId: String, $index: Int, $column: Int) {
          pastePods(reponame: $reponame, ids: $ids, parentId: $parentId, index: $index, column: $column)
        }`,
      variables: {
        ids: clip,
        parentId: parent,
        index,
        column,
        reponame,
      },
    }),
  });
  return res.json();
}
