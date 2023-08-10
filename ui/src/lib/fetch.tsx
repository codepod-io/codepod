import { ApolloClient, gql } from "@apollo/client";

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
    await client.refetchQueries({ include: ["GetDashboardRepos"] });
    // We need to do a deep copy here, because apollo client returned immutable objects.
    return {
      name: res.data.repo.name,
      error: null,
      userId: res.data.repo.userId,
      collaborators: res.data.repo.collaborators,
      isPublic: res.data.repo.public,
    };
  } catch (e) {
    console.log(e);
    return {
      name: "",
      error: e,
      userId: null,
      collaborators: [],
      isPublic: false,
    };
  }
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
