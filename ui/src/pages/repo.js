import { useParams, Link as ReactLink, Prompt } from "react-router-dom";

import { Box, Text, Button, Flex, Spacer } from "@chakra-ui/react";
import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";

import { repoSlice } from "../lib/store";
import * as wsActions from "../lib/ws/actions";
import * as qActions from "../lib/queue/actions";
import useMe from "../lib/me";
import { Deck } from "../components/repo/pod";
import { Sidebar } from "../components/repo/sidebar";

import { loadPodQueue, loadGit } from "../lib/remote/load";

function RepoWrapper({ children }) {
  // this component is used to provide foldable sidebar
  const [show, setShow] = useState(true);
  return (
    <Box m="auto" height="100%">
      <Box
        display="inline-block"
        verticalAlign="top"
        height="100%"
        w={show ? "18%" : 0}
        overflow="auto"
      >
        <Flex>
          <Spacer />
          <Button
            onClick={() => {
              setShow(!show);
            }}
            size="xs"
            // variant="ghost"
          >
            {show ? "Hide" : "Show"}
          </Button>
        </Flex>
        <Sidebar />
      </Box>

      <Box
        display="inline-block"
        verticalAlign="top"
        height="100%"
        w={show ? "80%" : "100%"}
        overflow="scroll"
      >
        <Box
          style={{
            position: "absolute",
            margin: "5px",
            top: "50px",
            left: "5px",
          }}
          zIndex={100}
          visibility={show ? "hidden" : "inherit"}
        >
          <Button
            onClick={() => {
              setShow(!show);
            }}
            size="xs"
            // variant="ghost"
          >
            {show ? "Hide" : "Show"}
          </Button>
        </Box>
        {children}
      </Box>
    </Box>
  );
}

export default function Repo() {
  let { username, reponame } = useParams();
  const dispatch = useDispatch();
  dispatch(repoSlice.actions.setRepo({ username, reponame }));
  const { loading, me } = useMe();
  useEffect(() => {
    if (me) {
      dispatch(
        repoSlice.actions.setSessionId(
          `${me?.username}_${username}_${reponame}`
        )
      );
      dispatch(wsActions.wsConnect());
    }
  }, [me]);
  useEffect(() => {
    dispatch(repoSlice.actions.resetState());
    // load the repo. It is actually not a queue, just an async thunk
    dispatch(loadPodQueue({ username, reponame }));
    // dispatch(loadGit({ username, reponame }));
    // this is the queue for remote update
    dispatch(qActions.startQueue());
    // dispatch(wsActions.wsConnect());
  }, []);

  // FIXME Removing queueL. This will cause Repo to be re-rendered a lot of
  // times, particularly the delete pod action would cause syncstatus and repo
  // to be re-rendered in conflict, which is weird.
  //
  // const queueL = useSelector((state) => state.repo.queue.length);
  const repoLoaded = useSelector((state) => state.repo.repoLoaded);

  if (loading) return <Text>Loading</Text>;

  return (
    <RepoWrapper>
      {!repoLoaded && <Text>Repo Loading ...</Text>}
      {repoLoaded && (
        <Box
          height="100%"
          //  border="solid 3px"
          p={2}
          overflow="auto"
        >
          <DndContext
            onDragEnd={(event) => {
              const { active, over } = event;
              if (active.id !== over.id) {
                // I'll just get active.id to over.id
                dispatch({
                  type: "MOVE_POD",
                  payload: {
                    from: active.id,
                    to: over.id,
                  },
                });
              }
            }}
          >
            <Deck id="ROOT" />
          </DndContext>
        </Box>
      )}
    </RepoWrapper>
  );
}
