import { gql, useQuery } from "@apollo/client";

const PROFILE_QUERY = gql`
  query {
    me {
      username
      name
    }
  }
`;

//   avatar_url

export default function useMe() {
  const { client, loading, data } = useQuery(PROFILE_QUERY, {
    fetchPolicy: "network-only",
  });
  return { me: data?.me };
}
