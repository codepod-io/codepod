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
import React, { useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { gql, useMutation, useQuery } from "@apollo/client";

import { repoSlice } from "../../lib/store";
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

function list2dict(pods) {
  const res = {};
  pods.forEach((pod) => {
    res[pod.id] = pod;
  });
  return res;
}

function RepoCanvas({ pods, root }) {
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(
      repoSlice.actions.setInit({
        // change list of pods to a dictionary
        pods: list2dict(pods),
        root: root,
      })
    );
  }, []);
  const rootId = useSelector((state) => state.repo.root);
  console.log("RootID:", rootId);

  return (
    <Flex direction="column" m="auto">
      {/* <Box pb={10} m="auto">
        <Text>
          Repo: <StyledLink href={`/${username}`}>{username}</StyledLink> /{" "}
          <StyledLink href={`/${username}/${reponame}`}>{reponame}</StyledLink>
        </Text>
      </Box> */}

      <Box m="auto">
        <Box
          overflowX="scroll"
          border="solid 3px"
          p={5}
          m={5}
          maxW={["sm", "lg", "3xl", "4xl", "6xl"]}
        >
          {rootId && (
            <Box>
              <PodOrDeck id={rootId} isRoot={true} />
            </Box>
          )}
          {!rootId && (
            <Box>
              <Button
                onClick={() => {
                  dispatch(repoSlice.actions.addRoot());
                }}
              >
                +
              </Button>
            </Box>
          )}
        </Box>
      </Box>
    </Flex>
  );
}

export default function Repo({ params }) {
  const { username, reponame } = params;

  // retrieve pods

  // this should happen only once
  const { loading, error, data } = useQuery(
    gql`
      query Repo($reponame: String!, $username: String!) {
        repo(name: $reponame, username: $username) {
          name
          owner {
            name
          }
          root {
            id
          }
          pods {
            id
          }
        }
      }
    `,
    {
      variables: {
        reponame,
        username,
      },
    }
  );

  if (loading) return <Text>Loading repo ...</Text>;
  if (error) return <Text>Error loading repo</Text>;
  if (!username || !reponame) {
    return <Text>No usrname or reponame</Text>;
  }
  return <RepoCanvas pods={data.repo.pods} root={data.repo.root}></RepoCanvas>;
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
      value={pod.content}
      placeholder="code here"
    ></Textarea>
  );
}

function PodOrDeck({ id, isRoot }) {
  const pod = useSelector((state) => state.repo.pods[id]);
  const pods = useSelector((state) => state.repo.pods);
  const dispatch = useDispatch();
  // this update the pod, insert if not exist
  const [updatePod, { data, loading, error }] = useMutation(gql`
    mutation updatePod(
      $id: ID!
      $parentId: ID!
      $index: Number!
      $type: String!
      $content: String
    ) {
      updatePod(
        id: $id
        parent: $parentId
        index: $index
        type: $type
        content: $content
      ) {
        id
      }
    }
  `);
  function doAddPod({ anchor, direction, type }) {
    return addPod({
      variables: {
        id: uuidv4(),
        parentId: {
          up: pods[anchor].parent,
          down: pods[anchor].parent,
          right: anchor,
        }[direction],
        index: {
          up: pods[pods[anchor].parent].children.indexOf(anchor),
          down: pods[pods[anchor].parent].children.indexOf(anchor) + 1,
          right: -1,
        }[direction],
        type: type,
      },
    });
  }

  function editPod({ id, content }) {
    return updatePod({
      variables: {
        id: id,
        content: content,
      },
    });
  }

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
        {pod.dirty ? (
          <Box>
            <IconButton
              icon={<RepeatIcon />}
              colorScheme="yellow"
              onClick={() => {
                updatePod({
                  variables: {
                    id: pod.id,
                    parentId: pod.parent,
                    type: pod.type,
                    content: pod.content,
                    index: pod.index,
                  },
                });
              }}
            ></IconButton>
          </Box>
        ) : (
          <Box>
            <CheckIcon colorScheme="green" />
          </Box>
        )}
        {!isRoot && (
          <Flex align="center" border="solid 1px" fontSize="xs">
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
        )}
      </Flex>

      {isDeck ? <Deck id={id} /> : <Pod id={id} />}

      {!isRoot && (
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
      )}
    </Flex>
  );
}
