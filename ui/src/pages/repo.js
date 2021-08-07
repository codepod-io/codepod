import { useParams, Link as ReactLink, Prompt } from "react-router-dom";

import { Box, Text } from "@chakra-ui/react";
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

import { loadPodQueue } from "../lib/remote/load";

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
    // load the repo. It is actually not a queue, just an async thunk
    dispatch(loadPodQueue({ username, reponame }));
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
    <Box m="auto" height="100%">
      <Box
        display="inline-block"
        verticalAlign="top"
        height="100%"
        w="18%"
        overflow="auto"
      >
        <Sidebar />
      </Box>
      <Box
        display="inline-block"
        verticalAlign="top"
        height="100%"
        w="80%"
        overflow="scroll"
      >
        {!repoLoaded && <Text>Repo Loading ...</Text>}
        {repoLoaded && (
          <Box height="100%" border="solid 3px" p={2} overflow="auto">
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
      </Box>
    </Box>
  );
}
