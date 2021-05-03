import { gql, useQuery } from "@apollo/client";
import { Center, Text, Flex } from "@chakra-ui/react";
import { useRouter } from "next/router";

const PROFILE_QUERY = gql`
  query {
    me {
      username
      name
    }
  }
`;

//   avatar_url

export default function Profile() {
  const router = useRouter();
  const { client, loading, data } = useQuery(PROFILE_QUERY, {
    fetchPolicy: "network-only",
  });
  if (loading) {
    return <Text>Loading ..</Text>;
  }

  if (!data) {
    router.push("/login");
    return null;
  }

  return (
    <Center>
      <Flex direction="column">
        <Text>Profile page</Text>
        <Text>Hello {data.me.name}</Text>
        <Text>Username: {data.me.username}</Text>
        <pre>{JSON.stringify(data)}</pre>
      </Flex>
    </Center>
  );
}
