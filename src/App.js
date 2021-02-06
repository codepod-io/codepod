import React, { useContext, useEffect, useState } from "react";
import { TreePods, SequentialPods, Pod, NewPod } from "./Pod.js";
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link,
  Redirect,
  useHistory,
  useParams,
} from "react-router-dom";
// import "./tailwind.output.css";
import { AuthContext } from "./AuthContext";
import { NavBar } from "./Nav";
import { PodContext, retrievePods, retrieveRepos } from "./PodContext";

import { Login, SignUp } from "./Auth.js";

import "./App.css";

function Home() {
  return (
    <div>
      <h1>Home</h1>
    </div>
  );
}

function About() {
  return (
    <div>
      <h1>About</h1>
    </div>
  );
}

function Repos() {
  const [repos, setRepos] = useState(null);
  // const { repos, retrieveRepos } = useContext(PodContext);
  // FIXME initiate the repos?
  useEffect(() => {
    retrieveRepos().then((repos) => {
      console.log(`Got ${repos}`);
      setRepos(repos);
    });
  }, []);

  // render the repos into the HTML
  // console.log(repos);
  return (
    <div>
      <h1>Repos</h1>
      {/* Query the backend */}
      {repos
        ? repos.map((repo) => {
            return (
              <div>
                <div>
                  Repo:{" "}
                  <Link to={`/repo/${repo.name}`} className="text-blue-700">
                    {repo.name} ({repo.pods.length})
                  </Link>
                </div>
                {/* {repo.pods
                  ? repo.pods.map((pod) => {
                      return <div>Pod: {pod.name}</div>;
                    })
                  : "No pods"} */}
              </div>
            );
          })
        : "No repos found."}
      {/* some examples */}
      <SequentialPods />
      <TreePods />
    </div>
  );
}

function Repo(props) {
  console.log(props);
  const [pods, setPods] = useState(null);
  const { reponame } = useParams();
  useEffect(() => {
    retrievePods(reponame).then((pods) => {
      console.log(pods);
      setPods(pods);
    });
  }, []);
  return (
    <div>
      <div>Repo {reponame}</div>
      <div>
        {pods
          ? pods.map((pod) => {
              return (
                <div>
                  Pod: {pod.name} {pod.id} {pod.content}
                  <NewPod pod={pod} />
                </div>
              );
            })
          : "No pods found"}
      </div>
    </div>
  );
}

export default function App() {
  const { isLoggedIn } = useContext(AuthContext);
  console.log(`isLoggedIn: ${isLoggedIn}`);
  return (
    <div>
      <Router>
        <div>
          <NavBar></NavBar>
          <div className="max-w-7xl mx-auto px-5 mt-5">
            <Switch>
              <Route path="/about">
                <About />
              </Route>
              <Route path="/login">
                <Login />
              </Route>
              <Route path="/signup">
                <SignUp />
              </Route>
              <Route path="/repos">
                <Repos />
              </Route>
              <Route path="/repo/:reponame">
                <Repo value="" />
              </Route>
              <Route path="/">
                <Home />
              </Route>
            </Switch>
          </div>
        </div>
      </Router>
    </div>
  );
}

// <div className="App">
//       <h1>
//         CodePod: the <span className="text-red-300">Pod</span> Development
//         Platform
//       </h1>
//       <h2>Start editing to see some magic happen!</h2>
//       <p className="text-blue-300">some random staff</p>
//       <SequentialPods />
//       <button className="insert-btn">+</button>
//       <div className="insert">+</div>
//       <TreePods />
//       Tempor et mollit et nisi ex minim tempor deserunt ullamco amet voluptate
//       exercitation adipisicing. Elit pariatur irure sint tempor irure est
//       adipisicing ut dolore dolore adipisicing veniam id exercitation. Elit amet
//       quis voluptate cupidatat aute cupidatat exercitation exercitation irure
//       incididunt irure do qui. Nostrud in proident eiusmod ipsum quis nulla ea
//       aliqua.
//     </div>
