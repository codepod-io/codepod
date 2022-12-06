import "./App.css";

import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from "react-router-dom";

import { createTheme, ThemeProvider } from "@mui/material/styles";

import Home from "./pages/index";
import Repos from "./pages/repos";
import Repo from "./pages/repo";
import Test from "./pages/test";
import Profile from "./pages/profile";

import { Auth0Provider } from "@auth0/auth0-react";
import { Header, Footer } from "./components/Header";

import Box from "@mui/material/Box";
import { SnackbarProvider } from "notistack";

import Docs from "./pages/docs";
import { ApolloWrapper } from "./lib/auth";
import { Container } from "@mui/material";

const theme = createTheme({
  typography: {
    button: {
      textTransform: "none",
    },
  },
});

function NormalLayout({ children }: any) {
  return (
    <Box>
      <Header />
      <Box pt="50px">
        <Container>{children}</Container>
      </Box>
      {/* <Footer /> */}
    </Box>
  );
}

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
    path: "repo/:id",
    element: (
      <Box height="100vh">
        <Header />
        <Box
          height="100%"
          boxSizing={"border-box"}
          sx={{
            pt: "50px",
          }}
        >
          <Repo />
        </Box>
      </Box>
    ),
  },
  {
    path: "profile",
    element: (
      <NormalLayout>
        <Profile />
      </NormalLayout>
    ),
  },
  {
    path: "/",
    element: (
      <NormalLayout>
        <Repos />
      </NormalLayout>
    ),
  },
]);

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <Auth0Provider
        domain="<MY_DOMAIN>"
        clientId="<MY_CLIENT_ID>"
        redirectUri={window.location.origin}
        audience="<MY_AUDIENCE>"
      >
        <ApolloWrapper>
          <SnackbarProvider maxSnack={5}>
            <RouterProvider router={router} />
          </SnackbarProvider>
        </ApolloWrapper>
      </Auth0Provider>
    </ThemeProvider>
  );
}

// function App() {
//   return (
//     <div className="App">
//       <header className="App-header">
//         <img src={logo} className="App-logo" alt="logo" />
//         <p>
//           Edit <code>src/App.tsx</code> and save to reload.
//         </p>
//         <a
//           className="App-link"
//           href="https://reactjs.org"
//           target="_blank"
//           rel="noopener noreferrer"
//         >
//           Learn React
//         </a>
//       </header>
//     </div>
//   );
// }

// export default App;
