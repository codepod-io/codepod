import { Center, Text, Flex } from "@chakra-ui/react";
import useMe from "../lib/me";

export default function Profile() {
  const { me } = useMe();

  if (!me) {
    // router.push("/login");
    // return null;
    return (
      <Center>
        <Text>Profile Page</Text>
        <Text>Please Log In</Text>
      </Center>
    );
  }

  return (
    <Center>
      <Flex direction="column">
        <Text>Profile page</Text>
        <Text>Hello {me.name}</Text>
        <Text>Username: {me.username}</Text>
        <pre>{JSON.stringify(me)}</pre>
      </Flex>
    </Center>
  );
}
