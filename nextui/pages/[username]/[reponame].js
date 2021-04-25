import { Box, Text, Center } from "@chakra-ui/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { StyledLink } from "../../components/utils";

export default function Repo() {
  const router = useRouter();
  const { username, reponame } = router.query;
  console.log(router.query);
  console.log(username);
  return (
    <Center>
      <Text>
        Repo: <StyledLink href={`/${username}`}>{username}</StyledLink> /{" "}
        <StyledLink href={`/${username}/${reponame}`}>{reponame}</StyledLink>
      </Text>
    </Center>
  );
}
