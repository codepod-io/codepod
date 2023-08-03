import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";

import Paper from "@mui/material/Paper";
import {
  Button,
  ClickAwayListener,
  Container,
  Popper,
  Stack,
} from "@mui/material";

import useMe from "../lib/me";
import React from "react";

export default function Profile() {
  const { loading, me } = useMe();

  if (!me) {
    // router.push("/login");
    // return null;
    return (
      <Box>
        <Box>Profile Page</Box>
        <Box>Please Log In</Box>
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 2 }}>
      {loading ? (
        "Loading"
      ) : (
        <Box>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Stack>
              <Typography variant="h4">User profile</Typography>
              <Box>
                Name {me.firstname} {me.lastname}
              </Box>
              <Box> Email: {me.email}</Box>
              <Box>CodePod version 0.4.6</Box>
              <HandleButton />
            </Stack>
          </Paper>
          <Divider />
        </Box>
      )}
    </Container>
  );
}

const HandleButton = ({}) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(anchorEl ? null : event.currentTarget);
  };
  const open = Boolean(anchorEl);

  const handler = React.useCallback((e) => {
    console.log("keydown", e.key);
    if (e.key === "Escape") {
      setAnchorEl(null);
    }
  }, []);

  React.useEffect(() => {
    document.addEventListener("keydown", handler);

    return () => {
      document.removeEventListener("keydown", handler);
    };
  }, []);
  return (
    <>
      <Button onClick={handleClick}>Hello</Button>

      <Popper open={open} anchorEl={anchorEl} placement={"right"}>
        <ClickAwayListener
          onClickAway={() => {
            console.log("click away!");
            setAnchorEl(null);
          }}
        >
          <Stack
            sx={{ border: 1, p: 1, bgcolor: "background.paper" }}
            spacing={1}
          >
            <Button variant="contained">Code</Button>
            <Button variant="contained">Rich</Button>
          </Stack>
        </ClickAwayListener>
      </Popper>
    </>
  );
};
