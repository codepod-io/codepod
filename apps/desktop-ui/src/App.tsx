import "@codepod/ui/src/App.css";
import "@codepod/ui/src/custom.css";

import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from "react-router-dom";

import { createTheme, ThemeProvider } from "@mui/material/styles";

import { Repo } from "./pages/repo";

import { Header, Footer } from "@codepod/ui";
import { AuthProvider } from "./lib/auth";

import Link from "@mui/material/Link";
import { Link as ReactLink } from "react-router-dom";

import Box from "@mui/material/Box";
import { SnackbarProvider } from "notistack";
import { Typography } from "@mui/material";

const yjsWsUrl = "http://localhost:4233/socket";
const apiUrl = "http://localhost:4000/graphql";
const spawnerApiUrl = null;

const theme = createTheme({
  typography: {
    button: {
      textTransform: "none",
    },
  },
});

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <Box height="100vh" width="100%" boxSizing={"border-box"}>
        <Repo yjsWsUrl={yjsWsUrl} />
      </Box>
    ),
  },
]);

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <AuthProvider apiUrl={apiUrl} spawnerApiUrl={spawnerApiUrl}>
        <SnackbarProvider maxSnack={5}>
          <RouterProvider router={router} />
        </SnackbarProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
