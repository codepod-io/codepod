import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";

export function Home() {
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
        </Box>
      </Box>
    </Box>
  );
}
