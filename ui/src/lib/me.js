import { gql, useQuery } from "@apollo/client";

const PROFILE_QUERY = gql`
  query Me {
    me {
      username
      name
      email
    }
  }
`;

//   avatar_url

export default function useMe() {
  /* eslint-disable no-unused-vars */
  const { client, loading, data } = useQuery(PROFILE_QUERY, {
    fetchPolicy: "network-only",
  });
  return { loading, me: data?.me };
}
