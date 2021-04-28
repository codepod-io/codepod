import {
  Box,
  Text,
  Flex,
  Center,
  Textarea,
  Button,
  Tooltip,
  Image,
  Spacer,
} from "@chakra-ui/react";
import { ArrowUpIcon, ArrowForwardIcon, ArrowDownIcon } from "@chakra-ui/icons";
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

function Deck({ id }) {
  const pod = useSelector((state) => state.repo.pods[id]);
  const dispatch = useDispatch();
  const left = useRef();
  const right = useRef();
  return (
    <Box border="solid 1px" p={3}>
      <Flex align="center">
        <Flex ref={left}>
          <Text>
            <Tooltip label={pod.id}>Deck</Tooltip>
          </Text>
          {pod.children.length === 0 && (
            <Box>
              <Button
                ml={1}
                size="xs"
                onClick={() => {
                  dispatch(
                    repoSlice.actions.addPod({
                      anchor: pod.id,
                      direction: "right",
                      type: "pod",
                    })
                  );
                }}
              >
                Add Pod <ArrowForwardIcon />
              </Button>
              <Button
                ml={1}
                size="xs"
                onClick={() => {
                  dispatch(
                    repoSlice.actions.addPod({
                      anchor: pod.id,
                      direction: "right",
                      type: "deck",
                    })
                  );
                }}
              >
                Add Deck <ArrowForwardIcon />
              </Button>
            </Box>
          )}
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

        <Flex direction="column" ref={right}>
          {pod.children.map((id) => {
            return <PodOrDeck id={id} key={id}></PodOrDeck>;
          })}
        </Flex>
      </Flex>
    </Box>
  );
}

function PodOrDeck({ id }) {
  const pod = useSelector((state) => state.repo.pods[id]);
  const dispatch = useDispatch();

  if (pod.type !== "deck" && pod.type !== "pod") {
    return (
      <Box>
        <Box>Error: pod.type: {pod.type}</Box>
        <pre>{JSON.stringify(pod)}</pre>
      </Box>
    );
  }

  const isDeck = pod.type === "deck";

  return (
    <Flex direction="column" m={2}>
      <Flex align="center" border="solid 1px" fontSize="xs">
        <Button color="red" size="xs" ml={1}>
          <u>D</u>elete
        </Button>{" "}
        <Button
          ml={1}
          size="xs"
          onClick={() => {
            dispatch(
              repoSlice.actions.addPod({
                anchor: pod.id,
                direction: "up",
                type: "pod",
              })
            );
          }}
        >
          Add&nbsp;<u>P</u>od <ArrowUpIcon />
        </Button>{" "}
        <Button
          ml={1}
          size="xs"
          onClick={() => {
            dispatch(
              repoSlice.actions.addPod({
                anchor: pod.id,
                direction: "up",
                type: "deck",
              })
            );
          }}
        >
          Add&nbsp;<u>D</u>eck <ArrowUpIcon />
        </Button>
      </Flex>
      {isDeck ? (
        <Deck id={id} />
      ) : (
        <Textarea
          w="xs"
          onChange={() => {}}
          value={pod.content}
          placeholder="code here"
        ></Textarea>
      )}

      <Flex align="center" border="solid 1px" fontSize="xs">
        <Button
          ml={1}
          size="xs"
          onClick={() => {
            dispatch(
              repoSlice.actions.addPod({
                anchor: pod.id,
                direction: "down",
                type: "pod",
              })
            );
          }}
        >
          Add&nbsp;<u>P</u>od <ArrowDownIcon />
        </Button>{" "}
        <Button
          ml={1}
          size="xs"
          onClick={() => {
            dispatch(
              repoSlice.actions.addPod({
                anchor: pod.id,
                direction: "down",
                type: "deck",
              })
            );
          }}
        >
          Add&nbsp;<u>D</u>eck <ArrowDownIcon />
        </Button>
      </Flex>
    </Flex>
  );
}
