import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";

export default function Home() {
  return (
    <Box
      sx={{
        maxWidth: "lg",
        m: "auto",
      }}
    >
      <Box my={20}>
        <Box sx={{ textAlign: "center", fontSize: 50 }}>
          Coding on a canvas, organized.
          <Stack sx={{ width: "100%" }} spacing={2}>
            <Alert severity="warning">
              CodePod v0.1 is on internal testing. The data (user info, repos)
              will likely be deleted.
            </Alert>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
