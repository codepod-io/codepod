import { useParams, Link as ReactLink, Prompt } from "react-router-dom";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";

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

import { loadRepoQueue, loadGit } from "../lib/remote/load";

function RepoWrapper({ children }) {
  // this component is used to provide foldable sidebar
  const [show, setShow] = useState(true);
  return (
    <Box m="auto" height="100%">
      <Box
        sx={{
          display: "inline-block",
          verticalAlign: "top",
          height: "100%",
          width: show ? 0.18 : 0,
          overflow: "auto",
        }}
      >
        <Box sx={{ display: "flex" }}>
          {/* <Spacer /> */}
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
        <Sidebar />
      </Box>

      <Box
        sx={{
          display: "inline-block",
          verticalAlign: "top",
          height: "100%",
          width: show ? 0.8 : 1,
          overflow: "scroll",
        }}
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
  let { id } = useParams();
  const dispatch = useDispatch();

  const { loading, me } = useMe();
  useEffect(() => {
    if (me) {
      // TODO
      dispatch(repoSlice.actions.setSessionId(`user_${me.id}_repo_${id}`));
      // Do not connect on open
      // dispatch(wsActions.wsConnect());
    }
    // return () => {
    //   console.log("disconnecting the socket ..");
    //   dispatch(wsActions.wsDisconnect());
    // };
  }, [me]);
  useEffect(() => {
    dispatch(repoSlice.actions.resetState());
    dispatch(repoSlice.actions.setRepo({ repoId: id }));
    // load the repo. It is actually not a queue, just an async thunk
    dispatch(loadRepoQueue({ id }));
    // this is the queue for remote update
    dispatch(qActions.startQueue());
    console.log("connecting the socket ..");
    dispatch(wsActions.wsConnect());
  }, []);

  // FIXME Removing queueL. This will cause Repo to be re-rendered a lot of
  // times, particularly the delete pod action would cause syncstatus and repo
  // to be re-rendered in conflict, which is weird.
  //
  // const queueL = useSelector((state) => state.repo.queue.length);
  const repoLoaded = useSelector((state) => state.repo.repoLoaded);

  if (loading) return <Box>Loading</Box>;

  return (
    <RepoWrapper>
      {!repoLoaded && <Box>Repo Loading ...</Box>}
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
