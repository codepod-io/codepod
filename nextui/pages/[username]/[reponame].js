import {
  Box,
  Text,
  Flex,
  Center,
  Textarea,
  Button,
  Tooltip,
  Image,
  IconButton,
  Spacer,
  Spinner,
  Code,
} from "@chakra-ui/react";
import {
  ArrowUpIcon,
  ArrowForwardIcon,
  ArrowDownIcon,
  CheckIcon,
  RepeatIcon,
} from "@chakra-ui/icons";
import { useRouter } from "next/router";
import Link from "next/link";
import { StyledLink } from "../../components/utils";
import React, { useRef, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { gql, useMutation, useQuery } from "@apollo/client";
import { useSpring, animated, config } from "react-spring";
import useResizeObserver from "use-resize-observer";

import { repoSlice, loadPodQueue, remoteUpdatePod } from "../../lib/store";
import useMe from "../../lib/me";

export async function getServerSideProps({ params }) {
  // console.log(params);
  // const router = useRouter();
  // const { username, reponame } = router.query;
  // FIXME this will cause warning on React. The query is {} at first rendering.
  // And this seems to mess up the order of hooks
  // if (!username || !reponame) return null;

  // Fetch data from external API
  // const res = await fetch(`https://.../data`)
  // const data = await res.json()

  // Pass data to the page via props
  return { props: { params } };
}

export default function Repo({ params }) {
  const { username, reponame } = params;
  const dispatch = useDispatch();
  dispatch(repoSlice.actions.setRepo({ username, reponame }));
  useEffect(() => {
    // load the repo
    dispatch(loadPodQueue({ username, reponame }));
  }, []);

  const queueL = useSelector((state) => state.repo.queue.length);
  const repoLoaded = useSelector((state) => state.repo.repoLoaded);

  return (
    <Flex direction="column" m="auto">
      <Box pb={10} m="auto">
        <Text>
          Repo: <StyledLink href={`/${username}`}>{username}</StyledLink> /{" "}
          <StyledLink href={`/${username}/${reponame}`}>{reponame}</StyledLink>
        </Text>
        <Text>SyncQueue: {queueL}</Text>
        {!repoLoaded && <Text>Repo Loading ...</Text>}
      </Box>
      {repoLoaded && (
        <Box m="auto">
          <Box
            overflowX="scroll"
            border="solid 3px"
            p={5}
            m={5}
            maxW={["sm", "lg", "3xl", "4xl", "6xl"]}
          >
            <Box>
              <Deck id="ROOT" />
            </Box>
          </Box>
        </Box>
      )}
    </Flex>
  );
}

function PodOrDeck({ id }) {
  const pod = useSelector((state) => state.repo.pods[id]);
  const dispatch = useDispatch();
  const [show, setShow] = useState(true);
  const styles = useSpring({
    from: {
      opacity: 0,
      transform: "scale(0)",
    },
    to: {
      opacity: show ? 1 : 0,
      transform: show ? "scale(1)" : "scale(0)",
    },
    config: show
      ? config.stiff
      : {
          // this removes the long wait at the end
          precision: 0.2,
          ...config.stiff,
        },
    onRest: () => {
      if (!show) {
        // dispatch the delete action after animation finishes
        dispatch(repoSlice.actions.deletePod({ id }));
      }
    },
  });
  // this update the pod, insert if not exist
  if (!pod) {
    return <Box>Error: pod is undefined: {id}</Box>;
  }

  if (pod.type !== "DECK" && pod.type !== "CODE") {
    return (
      <Box>
        <Box>Error: pod.type: {pod.type}</Box>
        <pre>{JSON.stringify(pod)}</pre>
      </Box>
    );
  }

  const isDeck = pod.type === "DECK";

  return (
    <animated.div style={styles}>
      <Flex direction="column" p={2}>
        {/* The top toolbar */}
        <Flex align="center" border="solid 1px" fontSize="xs">
          <Button
            color="red"
            size="xs"
            ml={1}
            onClick={() => {
              // dispatch(repoSlice.actions.deletePod({ id }));
              setShow(false);
            }}
          >
            <u>D</u>elete
          </Button>{" "}
          {pod.status !== "dirty" &&
            pod.status !== "synced" &&
            pod.status !== "syncing" && <Box>Error {pod.status}</Box>}
          {pod.status === "dirty" && (
            <Box>
              <IconButton
                icon={<RepeatIcon />}
                colorScheme={"yellow"}
                onClick={() => {
                  dispatch(remoteUpdatePod({ id, content: pod.content }));
                }}
              ></IconButton>
            </Box>
          )}
          {pod.status === "synced" && (
            <Box>
              <CheckIcon color="green" />
            </Box>
          )}
          {pod.status === "syncing" && (
            <Box>
              <Spinner
                thickness="4px"
                speed="0.65s"
                emptyColor="gray.200"
                color="blue.500"
                size="xl"
              />
            </Box>
          )}
          <Button
            ml={1}
            size="xs"
            onClick={() => {
              dispatch(
                repoSlice.actions.addPod({
                  parent: pod.parent,
                  index: pod.index,
                  type: "CODE",
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
                  parent: pod.parent,
                  index: pod.index,
                  type: "DECK",
                })
              );
            }}
          >
            Add&nbsp;<u>D</u>eck <ArrowUpIcon />
          </Button>
        </Flex>

        {/* The info bar */}
        <Flex align="center" border="solid 1px" fontSize="xs">
          <Text mr={5}>
            ID: <Code colorScheme="blackAlpha">{pod.id.substring(0, 8)}</Code>
          </Text>
          <Text mr={5}>Index: {pod.index}</Text>
          <Text>
            Parent:{" "}
            <Code colorScheme="blackAlpha">{pod.parent.substring(0, 8)}</Code>
          </Text>
        </Flex>

        {/* the pod iteself */}
        {isDeck ? <Deck id={id} /> : <Pod id={id} />}

        {/* The bottom toolbar */}
        <Flex align="center" border="solid 1px" fontSize="xs">
          <Button
            ml={1}
            size="xs"
            onClick={() => {
              dispatch(
                repoSlice.actions.addPod({
                  parent: pod.parent,
                  index: pod.index + 1,
                  type: "CODE",
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
                  parent: pod.parent,
                  index: pod.index + 1,
                  type: "DECK",
                })
              );
            }}
          >
            Add&nbsp;<u>D</u>eck <ArrowDownIcon />
          </Button>
        </Flex>
      </Flex>
    </animated.div>
  );
}

function Deck({ id }) {
  const pod = useSelector((state) => state.repo.pods[id]);
  const dispatch = useDispatch();
  const { ref: right, width = 0, height = 0 } = useResizeObserver();

  return (
    <Box border="solid 1px" p={3}>
      <Flex align="center">
        {/* LEFT */}
        <Flex>
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
                      parent: pod.id,
                      type: "CODE",
                      index: 0,
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
                      parent: pod.id,
                      index: 0,
                      type: "DECK",
                    })
                  );
                }}
              >
                Add Deck <ArrowForwardIcon />
              </Button>
            </Box>
          )}
        </Flex>

        {/* The brace */}
        <div>
          <Image
            src="/GullBraceLeft.svg"
            alt="brace"
            h={height}
            maxW="none"
            w="20px"
          />
        </div>

        {/* RIGHT */}
        <Flex direction="column" ref={right}>
          {pod.children.map((id) => {
            return <PodOrDeck id={id} key={id}></PodOrDeck>;
          })}
        </Flex>
      </Flex>
    </Box>
  );
}

function Pod({ id }) {
  const pod = useSelector((state) => state.repo.pods[id]);
  const dispatch = useDispatch();
  return (
    <Textarea
      w="xs"
      onChange={(e) => {
        dispatch(
          repoSlice.actions.setPodContent({ id, content: e.target.value })
        );
      }}
      value={pod.content || ""}
      placeholder="code here"
    ></Textarea>
  );
}