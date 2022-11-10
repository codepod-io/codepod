import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";

import Paper from "@mui/material/Paper";
import { Container, Stack } from "@mui/material";

import useMe from "../lib/me";

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
              <Box>CodePod version 0.4.4</Box>
            </Stack>
          </Paper>
          <Divider />
        </Box>
      )}
    </Container>
  );
}
