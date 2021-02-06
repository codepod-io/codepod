import React, { createContext, useState, useEffect } from "react";
export const PodContext = createContext();

export async function retrievePods(reponame) {
  const query = {
    query: `
              query {
                  repo(name: "${reponame}") {
                      id, name, pods {
                          id, name, content
                      }
                  }
              }
              `,
  };
  console.log(query);
  return fetch("http://localhost:5000/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(query),
  })
    .then((res) => {
      if (res.status !== 200 && res.status !== 201) {
        throw Error("Failed to retrieve");
      }
      return res.json();
    })
    .then((res) => {
      if (res.errors) {
        throw new Error(res.errors[0].message);
      }
      console.log(res.data.repo);
      //   extract the data
      // now just list the names of the repos
      return res.data.repo.pods;
      // TODO interface to create repos and pods
    });
}

export async function retrieveRepos() {
  const query = {
    query: `
            query {
                repos {
                    id, name, pods {
                        id, name
                    }
                }
            }
            `,
  };
  console.log(query);
  return fetch("http://localhost:5000/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(query),
  })
    .then((res) => {
      if (res.status !== 200 && res.status !== 201) {
        throw Error("Failed to retrieve");
      }
      return res.json();
    })
    .then((res) => {
      if (res.errors) {
        throw new Error(res.errors[0].message);
      }
      console.log(res.data.repos);
      //   extract the data
      // now just list the names of the repos
      return res.data.repos;
      // TODO interface to create repos and pods
    });
}

export function PodProvider(props) {
  const [pods, setPods] = useState(null);
  const [repos, setRepos] = useState(null);
  const [repoMap, setRepoMap] = useState({});

  function retrievePods() {}

  return (
    <PodContext.Provider value={{ pods, repos }}>
      {props.children}
    </PodContext.Provider>
  );
}
