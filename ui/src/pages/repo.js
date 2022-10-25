import { useParams } from "react-router-dom";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";

import { useEffect, useState } from "react";

import { useRepoStore } from "../lib/store";

import useMe from "../lib/me";
// import { Deck } from "../components/repo/pod";
import { Deck } from "../components/repo/graph";
import { Sidebar } from "../components/repo/sidebar";

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
  const resetState = useRepoStore((state) => state.resetState);
  const setRepo = useRepoStore((state) => state.setRepo);
  const loadRepo = useRepoStore((state) => state.loadRepo);
  const setSessionId = useRepoStore((state) => state.setSessionId);
  const repoLoaded = useRepoStore((state) => state.repoLoaded);

  const { loading, me } = useMe();
  useEffect(() => {
    if (me) {
      setSessionId(`user_${me.id}_repo_${id}`);
    }
  }, [me, id, setSessionId]);
  useEffect(() => {
    resetState();
    setRepo(id);
    // load the repo. It is actually not a queue, just an async thunk
    loadRepo(id);
  }, [id, loadRepo, resetState, setRepo]);

  // FIXME Removing queueL. This will cause Repo to be re-rendered a lot of
  // times, particularly the delete pod action would cause syncstatus and repo
  // to be re-rendered in conflict, which is weird.

  if (loading) return <Box>Loading</Box>;

  return (
    <RepoWrapper>
      {!repoLoaded && <Box>Repo Loading ...</Box>}
      {repoLoaded && (
        <Box
          height="90%"
          border="solid 3px"
          p={2}
          // m={2}
          overflow="auto"
        >
          <Deck id="ROOT" />
        </Box>
      )}
    </RepoWrapper>
  );
}
