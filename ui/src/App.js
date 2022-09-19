import "./App.css";

import { HashRouter as Router, Routes, Route } from "react-router-dom";

import Home from "./pages/index";
import About from "./pages/about";
import Repos from "./pages/repos";
import Repo from "./pages/repo";
import Test from "./pages/test";
import Login from "./pages/login";
import Signup from "./pages/signup";
import Profile from "./pages/profile";

import { AuthProvider } from "./lib/auth.js";
import { Header, Footer } from "./components/Header";

import Box from "@mui/material/Box";
import { SnackbarProvider } from "notistack";
import Button from "@mui/material/Button";

import { Provider } from "react-redux";

import store from "./lib/store";
import Docs from "./pages/docs";

import { createTheme, ThemeProvider, styled } from "@mui/material/styles";

const theme = createTheme({
  typography: {
    button: {
      textTransform: "none",
    },
  },
});

function NormalLayout({ children }) {
  return (
    <Box>
      <Header />
      <Box pt="50px">{children}</Box>
      <Footer />
    </Box>
  );
}

function App() {
  return (
    <Router>
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <AuthProvider>
            <SnackbarProvider maxSnack={5}>
              <Routes>
                <Route
                  path="/about"
                  element={
                    <NormalLayout>
                      <About />
                    </NormalLayout>
                  }
                />
                <Route
                  path="/docs"
                  element={
                    <NormalLayout>
                      <Docs />
                    </NormalLayout>
                  }
                ></Route>
                <Route
                  path="/repos"
                  element={
                    <NormalLayout>
                      <Repos />
                    </NormalLayout>
                  }
                ></Route>
                <Route
                  path="/repo/:id"
                  element={
                    <Box height="100vh">
                      <Header />
                      <Box height="100%" pt="50px">
                        <Repo />
                      </Box>
                    </Box>
                  }
                ></Route>
                <Route
                  path="/test"
                  element={
                    <NormalLayout>
                      <Test />
                    </NormalLayout>
                  }
                ></Route>
                <Route
                  path="/login"
                  element={
                    <NormalLayout>
                      <Login />
                    </NormalLayout>
                  }
                ></Route>
                <Route
                  path="/signup"
                  element={
                    <NormalLayout>
                      <Signup />
                    </NormalLayout>
                  }
                ></Route>
                <Route
                  path="/profile"
                  element={
                    <NormalLayout>
                      <Profile />
                    </NormalLayout>
                  }
                ></Route>
                <Route
                  path="/"
                  element={
                    <NormalLayout>
                      <Home />
                    </NormalLayout>
                  }
                ></Route>
              </Routes>
            </SnackbarProvider>
          </AuthProvider>
        </ThemeProvider>
      </Provider>
    </Router>
  );
}

export default App;
