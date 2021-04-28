import {
  Box,
  Text,
  Flex,
  Center,
  Textarea,
  Button,
  Tooltip,
  Image,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { StyledLink } from "../../components/utils";
import React, { useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { repoSlice } from "../../lib/store";

export default function Repo() {
  const router = useRouter();
  const { username, reponame } = router.query;
  console.log(router.query);
  console.log(username);

  const rootId = useSelector((state) => state.repo.root);
  console.log(rootId);
  const dispatch = useDispatch();
  return (
    <Flex direction="column" m="auto">
      <Box pb={10} m="auto">
        <Text>
          Repo: <StyledLink href={`/${username}`}>{username}</StyledLink> /{" "}
          <StyledLink href={`/${username}/${reponame}`}>{reponame}</StyledLink>
        </Text>
      </Box>

      <Box overflowX="scroll" border="solid 3px" p={5} m={5}>
        <Box>
          <PodOrDeck id={rootId} />
        </Box>
      </Box>
    </Flex>
  );
}

function PodOrDeck({ id }) {
  const pod = useSelector((state) => state.repo.pods[id]);
  const pods = useSelector((state) => state.repo.pods);
  const dispatch = useDispatch();
  const left = useRef();
  const right = useRef();
  switch (pod.type) {
    case "deck":
      return (
        <Box border="solid 1px" p={3}>
          <Flex align="center">
            <Flex direction="column" ref={left}>
              <Text>
                <Tooltip label={pod.id}>Deck</Tooltip>
              </Text>
              <Button
                onClick={() => {
                  dispatch(
                    repoSlice.actions.addPod({
                      parent: pod.id,
                      content: "",
                    })
                  );
                }}
              >
                +pod
              </Button>
              <Button
                onClick={() => {
                  dispatch(
                    repoSlice.actions.addDeck({
                      parent: pod.id,
                    })
                  );
                }}
              >
                +deck
              </Button>
            </Flex>

            {left.current && right.current && (
              <div>
                <Image
                  src="/GullBraceLeft.svg"
                  alt="brace"
                  h={`${right.current.offsetHeight}px`}
                  maxW="none"
                  w="20px"
                />
              </div>
            )}

            <Flex direction="column" ref={right} pl={2}>
              {pod.children.map((id) => {
                return <PodOrDeck id={id} key={id}></PodOrDeck>;
              })}
            </Flex>
          </Flex>
        </Box>
      );
    case "pod":
      return (
        <Textarea
          w="xs"
          onChange={() => {}}
          value={pod.content}
          placeholder="code here"
        ></Textarea>
      );
    default:
      return (
        <Box>
          <Box>Error: pod.type: {pod.type}</Box>
          <pre>{JSON.stringify(pod)}</pre>
        </Box>
      );
  }
}
