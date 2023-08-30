import "./App.css";
import "./custom.css";

import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from "react-router-dom";

import { createTheme, ThemeProvider } from "@mui/material/styles";

import { Home } from "./pages/index";
import { Dashboard } from "./pages/dashboard";
import { Repo } from "./pages/repo";
import { Test } from "./pages/test";
import { SignIn } from "./pages/login";
import { SignUp } from "./pages/signup";
import { Profile } from "./pages/profile";

import { AuthProvider } from "./lib/auth";
import { Header, Footer } from "./components/Header";

import Box from "@mui/material/Box";
import { SnackbarProvider } from "notistack";

import { Docs } from "./pages/docs";

const yjsWsUrl = import.meta.env.VITE_APP_YJS_WS_URL;
const apiUrl = import.meta.env.VITE_APP_API_URL;
const spawnerApiUrl = import.meta.env.VITE_APP_SPAWNER_API_URL;

if (!yjsWsUrl) {
  throw new Error("VITE_APP_YJS_WS_URL is not defined");
}
if (!apiUrl) {
  throw new Error("VITE_APP_API_URL is not defined");
}
if (!spawnerApiUrl) {
  throw new Error("VITE_APP_RUNTIME_API_URL is not defined");
}

const theme = createTheme({
  typography: {
    button: {
      textTransform: "none",
    },
  },
});

type NormalLayoutProps = {
  currentPage?: string | null;
  children: React.ReactNode;
};

const NormalLayout: React.FC<NormalLayoutProps> = ({
  currentPage,
  children,
}) => {
  return (
    <Box>
      <Header currentPage={currentPage} />
      <Box pt="50px">{children}</Box>
      {/* <Footer /> */}
    </Box>
  );
};

const router = createBrowserRouter([
  {
    path: "docs",
    element: (
      <NormalLayout>
        <Docs />
      </NormalLayout>
    ),
  },
  {
    path: "dashboard",
    element: (
      <NormalLayout currentPage="Dashboard">
        <Dashboard />
      </NormalLayout>
    ),
  },
  {
    path: "repo/:id",
    element: (
      <Box height="100vh" width="100%" boxSizing={"border-box"}>
        <Repo yjsWsUrl={yjsWsUrl} />
      </Box>
    ),
  },
  {
    path: "login",
    element: (
      <NormalLayout>
        <SignIn />
      </NormalLayout>
    ),
  },
  {
    path: "signup",
    element: (
      <NormalLayout>
        <SignUp />
      </NormalLayout>
    ),
  },
  {
    path: "profile",
    element: (
      <NormalLayout currentPage="Profile">
        <Profile />
      </NormalLayout>
    ),
  },
  {
    path: "test",
    element: (
      <NormalLayout>
        <Test />
      </NormalLayout>
    ),
  },
  {
    path: "/",
    element: (
      <NormalLayout>
        {/* <Home /> */}
        <Dashboard />
      </NormalLayout>
    ),
  },
]);

export function App() {
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
