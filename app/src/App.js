import logo from "./logo.svg";
import "./App.css";

import { BrowserRouter as Router, Switch, Route } from "react-router-dom";

import Home from "./uisrc/pages/index";
import About from "./uisrc/pages/about";
import Repos from "./uisrc/pages/repos";
import Repo from "./uisrc/pages/repo";
import CommitNote from "./uisrc/pages/commitnote";
import Test from "./uisrc/pages/test";
import Login from "./uisrc/pages/login";
import Signup from "./uisrc/pages/signup";
import Profile from "./uisrc/pages/profile";

import { ChakraProvider } from "@chakra-ui/react";

import { Box } from "@chakra-ui/react";

import { AuthProvider } from "./uisrc/lib/auth.js";
import { Header, Footer } from "./uisrc/components/Header";

import { Provider } from "react-redux";

import store from "./uisrc/lib/store";
import Kernels from "./uisrc/pages/kernels";
import Docs from "./uisrc/pages/docs";

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
        <ChakraProvider>
          <AuthProvider>
            <Switch>
              <Route path="/about">
                <NormalLayout>
                  <About />
                </NormalLayout>
              </Route>
              <Route path="/docs">
                <NormalLayout>
                  <Docs />
                </NormalLayout>
              </Route>
              <Route path="/repos">
                <NormalLayout>
                  <Repos />
                </NormalLayout>
              </Route>
              <Route path="/:username/:reponame">
                <Box height="100vh">
                  <Header />
                  <Box height="100%" pt="50px">
                    <Repo />
                  </Box>
                </Box>
              </Route>
              <Route path="/kernels">
                <NormalLayout>
                  <Kernels />
                </NormalLayout>
              </Route>
              <Route path="/commitnote">
                <NormalLayout>
                  <CommitNote />
                </NormalLayout>
              </Route>
              <Route path="/test">
                <NormalLayout>
                  <Test />
                </NormalLayout>
              </Route>
              <Route path="/login">
                <NormalLayout>
                  <Login />
                </NormalLayout>
              </Route>
              <Route path="/signup">
                <NormalLayout>
                  <Signup />
                </NormalLayout>
              </Route>
              <Route path="/profile">
                <NormalLayout>
                  <Profile />
                </NormalLayout>
              </Route>
              <Route path="/">
                <NormalLayout>
                  <Home />
                </NormalLayout>
              </Route>
            </Switch>
          </AuthProvider>
        </ChakraProvider>
      </Provider>
    </Router>
  );
}

export default App;
