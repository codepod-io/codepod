import { gql, useQuery } from "@apollo/client";

const PROFILE_QUERY = gql`
  query Me {
    me {
      firstname
      lastname
      email
      id
    }
  }
`;

//   avatar_url

export function useMe() {
  /* eslint-disable no-unused-vars */
  const { loading, data, error } = useQuery<{
    me: { id: string; firstname: string; lastname: string; email: string };
  }>(PROFILE_QUERY, {
    // fetchPolicy: "network-only",
  });
  return { loading, error, me: data?.me };
}
