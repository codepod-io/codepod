import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";

import Paper from "@mui/material/Paper";

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
    <Box
      sx={{
        textAlign: "center",
        maxWidth: "80%",
      }}
    >
      {loading ? (
        "Loading"
      ) : (
        <Box>
          <Paper elevation={3}>
            <Box sx={{ display: "flex" }}>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h3">Profile page</Typography>
                Hello {me.firstname}
                <Box component="pre">{JSON.stringify(me)}</Box>
              </Box>
            </Box>
          </Paper>
          <Divider />
        </Box>
      )}
    </Box>
  );
}
