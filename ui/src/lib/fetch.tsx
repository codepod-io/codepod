import { ApolloClient, gql } from "@apollo/client";

import { Pod } from "./store";

/**
 * Load remote repo
 * @param id repo id
 * @param client apollo client
 * @returns a list of pods
 */
export async function doRemoteLoadRepo(client: ApolloClient<any>, id: string) {
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
        edges {
          source
          target
        }
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
    // refetch queries
    await client.refetchQueries({ include: ["GetRepos", "GetCollabRepos"] });
    // We need to do a deep copy here, because apollo client returned immutable objects.
    let pods = res.data.repo.pods.map((pod) => ({ ...pod }));
    let edges = res.data.repo.edges;
    return {
      pods,
      edges,
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
      edges: [],
      name: "",
      error: e,
      userId: null,
      collaborators: [],
      isPublic: false,
    };
  }
}

/**
 * For historical reason, the backend DB schema pod.type are "CODE", "DECK",
 * "WYSIWYG", while the node types in front-end are "CODE", "SCOPE", "RICH".
 */

function dbtype2nodetype(dbtype: string) {
  switch (dbtype) {
    case "CODE":
      return "CODE";
    case "DECK":
      return "SCOPE";
    case "WYSIWYG":
      return "RICH";
    default:
      throw new Error(`unknown dbtype ${dbtype}`);
  }
}

function nodetype2dbtype(nodetype: string) {
  switch (nodetype) {
    case "CODE":
      return "CODE";
    case "SCOPE":
      return "DECK";
    case "RICH":
      return "WYSIWYG";
    default:
      throw new Error(`unknown nodetype ${nodetype}`);
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
      type: "SCOPE",
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
    pod.content = JSON.parse(pod.content);
    pod.staged = JSON.parse(pod.staged);
    pod.githead = JSON.parse(pod.githead);
    pod.type = dbtype2nodetype(pod.type);
    if (pod.result) {
      pod.result = JSON.parse(pod.result);
    }
    if (pod.error) {
      pod.error = JSON.parse(pod.error);
    }
    if (pod.stdout) pod.stdout = JSON.parse(pod.stdout);
    // DEBUG the deck's content seems to be a long string of escaped \
    if (pod.type === "SCOPE" && pod.content) {
      console.log(
        `warning: SCOPE ${pod.id} content is not null, setting to null:`,
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
    x,
    y,
    width,
    height,
  }) => ({
    id,
    type: nodetype2dbtype(type),
    column,
    lang,
    fold,
    thundar,
    utility,
    name,
    content: JSON.stringify(content),
    stdout: JSON.stringify(stdout),
    result: JSON.stringify(result),
    error: JSON.stringify(error),
    x,
    y,
    width,
    height,
    parent,
    children: children?.map(({ id }) => id),
  }))(pod);
}

export async function doRemoteDeletePod(
  client: ApolloClient<any>,
  ids: string[]
) {
  const mutation = gql`
    mutation deletePods($ids: [String]) {
      deletePods(ids: $ids)
    }
  `;
  await client.mutate({
    mutation,
    variables: {
      ids,
    },
  });
  return true;
}

export async function doRemoteUpdatePod(client, { repoId, pod }) {
  const result = await client.mutate({
    mutation: gql`
      mutation updatePod($id: String!, $repoId: String!, $input: PodInput) {
        updatePod(id: $id, repoId: $repoId, input: $input)
      }
    `,
    variables: {
      id: pod.id,
      repoId,
      input: serializePodInput(pod),
    },
  });
  return result.data.updatePod;
}

export async function doRemoteAddPods(client, { repoId, pods }) {
  const result = await client.mutate({
    mutation: gql`
      mutation createAddPods($repoId: String!, $input: [PodInput]) {
        addPods(repoId: $repoId, pods: $input)
      }
    `,
    variables: {
      repoId,
      input: pods.map(serializePodInput),
    },
  });
  return result.data.addPods;
}

export async function doRemoteLoadVisibility(client, { repoId }) {
  const query = gql`
    query ExampleQuery($repoId: String!) {
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
    mutation updateVisibility($repoId: String!, $isPublic: Boolean!) {
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
    mutation addCollaborator($repoId: String!, $email: String!) {
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
    mutation deleteCollaborator($repoId: String!, $collaboratorId: String!) {
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

export async function doRemoteUpdateCodeiumAPIKey(client, { apiKey }) {
  const mutation = gql`
    mutation updateCodeiumAPIKey($apiKey: String!) {
      updateCodeiumAPIKey(apiKey: $apiKey)
    }
  `;
  try {
    const res = await client.mutate({
      mutation,
      variables: {
        apiKey,
      },
    });
    return { success: true, error: null };
  } catch (e) {
    return { success: false, error: e };
  }
}
