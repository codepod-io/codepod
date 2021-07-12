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
import { AuthProvider } from "./lib/auth.js";
import { Header, Footer } from "./components/Header";

import { Provider } from "react-redux";

import store from "./lib/store";

import "./styles/globals.css";

function App() {
  return (
    <Router>
      <Provider store={store}>
        <ChakraProvider>
          <AuthProvider>
            <Header />
            <Switch>
              <Route path="/about">
                <About />
              </Route>
              <Route path="/repos">
                <Repos />
              </Route>
              <Route path="/:username/:reponame">
                <Repo />
              </Route>
              <Route path="/commitnote">
                <CommitNote />
              </Route>
              <Route path="/test">
                <Test />
              </Route>
              <Route path="/login">
                <Login />
              </Route>
              <Route path="/signup">
                <Signup />
              </Route>
              <Route path="/profile">
                <Profile />
              </Route>
              <Route path="/">
                <Home />
              </Route>
            </Switch>
            <Footer />
          </AuthProvider>
        </ChakraProvider>
      </Provider>
    </Router>
  );
}

export default App;
