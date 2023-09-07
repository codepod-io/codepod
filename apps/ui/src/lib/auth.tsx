import { gql, useQuery } from "@apollo/client";

const PROFILE_QUERY = gql`
  query Me {
    me {
      firstname
      lastname
      email
      id
      codeiumAPIKey
    }
  }
`;

//   avatar_url

export function useMe() {
  /* eslint-disable no-unused-vars */
  const { loading, data } = useQuery(PROFILE_QUERY, {
    // fetchPolicy: "network-only",
  });
  return { loading, me: data?.me };
}
