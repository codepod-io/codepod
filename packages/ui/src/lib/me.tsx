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
  const { loading, data, error } = useQuery(PROFILE_QUERY, {
    // fetchPolicy: "network-only",
  });
  if (error) {
    console.error(error);
    throw new Error("Error fetching user profile.");
  }
  return { loading, me: data?.me };
}
