import "./App.css";
import "@codepod/ui/src/custom.css";

import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
  useNavigate,
} from "react-router-dom";

import { Link as ReactLink } from "react-router-dom";
import Link from "@mui/material/Link";

import { createTheme, ThemeProvider } from "@mui/material/styles";

import { Dashboard, Repo, Test, Docs } from "@codepod/ui";

import { Profile } from "./pages/profile";
import { SignIn } from "./pages/login";
import { SignUp } from "./pages/signup";

import { Header, Footer } from "@codepod/ui";
import { AuthProvider, useAuth } from "./lib/auth";
import { useMe } from "@codepod/ui";

import Box from "@mui/material/Box";
import { SnackbarProvider } from "notistack";
import { Button } from "@mui/material";

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
  const { isSignedIn, signOut } = useAuth();
  let navigate = useNavigate();
  const { me } = useMe();
  return (
    <Box>
      <Header currentPage={currentPage}>
        {isSignedIn() ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Box sx={{ mr: 2 }}>
              <Link component={ReactLink} to="/profile" underline="none">
                {me?.firstname}
              </Link>
            </Box>
            <Button
              onClick={() => {
                signOut();
                navigate("/login");
              }}
            >
              Logout
            </Button>
          </Box>
        ) : (
          <Box display="block">
            <Link to="/login" component={ReactLink} underline="none">
              Login
            </Link>
          </Box>
        )}
      </Header>
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
