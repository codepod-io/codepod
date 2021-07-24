import "./App.css";

import { BrowserRouter as Router, Switch, Route } from "react-router-dom";

import Home from "./pages/index";
import About from "./pages/about";
import Repos from "./pages/repos";
import Repo from "./pages/repo";
import CommitNote from "./pages/commitnote";
import Test from "./pages/test";
import Login from "./pages/login";
import Signup from "./pages/signup";
import Profile from "./pages/profile";

import { ChakraProvider } from "@chakra-ui/react";

import { Box } from "@chakra-ui/react";

import { AuthProvider } from "./lib/auth.js";
import { Header, Footer } from "./components/Header";

import { Provider } from "react-redux";

import store from "./lib/store";
import Kernels from "./pages/kernels";

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
