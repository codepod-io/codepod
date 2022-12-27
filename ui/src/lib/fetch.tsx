import { gql } from "@apollo/client";

import { Pod } from "./store";

/**
 * Load remote repo
 * @param id repo id
 * @param client apollo client
 * @returns a list of pods
 */
export async function doRemoteLoadRepo({ id, client }) {
  // load from remote
  let query = gql`
    query Repo($id: String!) {
      repo(id: $id) {
        id
        name
        userId
        collaborators {
          id
          email
          firstname
          lastname
        }
        public
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
          parent {
            id
          }
          children {
            id
          }
        }
      }
    }
  `;
  try {
    let res = await client.query({
      query,
      variables: {
        id,
      },
      // CAUTION I must set this because refetechQueries does not work.
      fetchPolicy: "no-cache",
    });
    // We need to do a deep copy here, because apollo client returned immutable objects.
    let pods = res.data.repo.pods.map((pod) => ({ ...pod }));
    return {
      pods,
      name: res.data.repo.name,
      error: null,
      userId: res.data.repo.userId,
      collaborators: res.data.repo.collaborators,
      isPublic: res.data.repo.public,
    };
  } catch (e) {
    console.log(e);
    return {
      pods: [],
      name: "",
      error: e,
      userId: null,
      collaborators: [],
      isPublic: false,
    };
  }
}

export function normalize(pods) {
  const res: { [key: string]: Pod } = {
    ROOT: {
      id: "ROOT",
      name: "root",
      parent: "ROOT0",
      children: [],
      // Adding this to avoid errors
      // XXX should I save these to db?
      lang: "python",
      type: "DECK",
      content: "",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
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
    // DEBUG the deck's content seems to be a long string of escaped \
    if (pod.type === "DECK" && pod.content) {
      console.log(
        `warning: deck ${pod.id} content is not null, setting to null:`,
        pod.content
      );
      pod.content = null;
    }
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

export async function doRemoteAddPod(client, { repoId, parent, pod }) {
  const mutation = gql`
    mutation addPod(
      $repoId: String
      $parent: String
      $index: Int
      $input: PodInput
    ) {
      addPod(repoId: $repoId, parent: $parent, index: $index, input: $input)
    }
  `;
  // FIXME refetch
  await client.mutate({
    mutation,
    variables: {
      repoId,
      parent,
      index: 0,
      input: serializePodInput(pod),
    },
    // FIXME the query is not refetched.
    refetchQueries: ["Repo"],
  });
  return true;
}

export async function doRemoteDeletePod(client, { id, toDelete }) {
  const mutation = gql`
    mutation deletePod($id: String, $toDelete: [String]) {
      deletePod(id: $id, toDelete: $toDelete)
    }
  `;
  await client.mutate({
    mutation,
    variables: {
      id,
      toDelete,
    },
  });
  return true;
}

export async function doRemoteUpdatePod(client, { pod }) {
  await client.mutate({
    mutation: gql`
      mutation updatePod($id: String, $input: PodInput) {
        updatePod(id: $id, input: $input)
      }
    `,
    variables: {
      id: pod.id,
      input: serializePodInput(pod),
    },
  });
  return true;
}

export async function doRemoteLoadVisibility(client, { repoId }) {
  const query = gql`
    query ExampleQuery($repoId: String) {
      getVisibility(repoId: $repoId) {
        collaborators {
          id
          email
          firstname
          lastname
        }
        isPublic
      }
    }
  `;
  try {
    const res = await client.query({
      query,
      variables: {
        repoId,
      },
      fetchPolicy: "no-cache",
    });
    return { ...res.data.getVisibility, error: null };
  } catch (e) {
    return { collaborators: [], isPublic: false, error: e };
  }
}

export async function doRemoteUpdateVisibility(client, { repoId, isPublic }) {
  const mutation = gql`
    mutation updateVisibility($repoId: String, $isPublic: Boolean) {
      updateVisibility(repoId: $repoId, isPublic: $isPublic)
    }
  `;
  const res = await client.mutate({
    mutation,
    variables: {
      repoId,
      isPublic,
    },
  });
  return res.data.updateVisibility;
}

export async function doRemoteAddCollaborator(client, { repoId, email }) {
  const mutation = gql`
    mutation addCollaborator($repoId: String, $email: String) {
      addCollaborator(repoId: $repoId, email: $email)
    }
  `;
  try {
    const res = await client.mutate({
      mutation,
      variables: {
        repoId,
        email,
      },
    });
    return { success: true, error: null };
  } catch (e) {
    return { success: false, error: e };
  }
}

export async function doRemoteDeleteCollaborator(
  client,
  { repoId, collaboratorId }
) {
  const mutation = gql`
    mutation deleteCollaborator($repoId: String, $collaboratorId: String) {
      deleteCollaborator(repoId: $repoId, collaboratorId: $collaboratorId)
    }
  `;
  try {
    const res = await client.mutate({
      mutation,
      variables: {
        repoId,
        collaboratorId,
      },
    });
    return { success: true, error: null };
  } catch (e) {
    return { success: false, error: e };
  }
}
