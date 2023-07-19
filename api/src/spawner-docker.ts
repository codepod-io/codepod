import Docker from "dockerode";

import { ApolloClient, InMemoryCache, gql } from "@apollo/client/core";

const apollo_client = new ApolloClient({
  cache: new InMemoryCache({}),
  uri: process.env.PROXY_API_URL,
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function removeContainer(name) {
  return new Promise((resolve, reject) => {
    var docker = new Docker();
    console.log("remove if already exist");
    let old = docker.getContainer(name);
    old.inspect((err, data) => {
      if (err) {
        console.log("removeContainer: container seems not exist.");
        return resolve(null);
      }
      if (data?.State.Running) {
        old.stop((err, data) => {
          // FIXME If the container is stopped but not removed, will there be errors
          // if I call stop?
          if (err) {
            // console.log("ERR:", err);
            // console.log("No such container, resolving ..");
            // reject();
            console.log("No such container running. Returning.");
            return resolve(null);
          }
          console.log("Stopped. Removing ..");
          old.remove((err, data) => {
            if (err) {
              console.log("ERR during removing container:", err);
              return reject("ERROR!!!");
              // resolve();
            }
            console.log("removed successfully");
            return resolve(null);
          });
        });
      } else {
        console.log("Already stopped. Removing ..");
        old.remove((err, data) => {
          if (err) {
            console.log("ERR during removing container:", err);
            return reject("ERROR!!!");
            // resolve();
          }
          console.log("removed successfully");
          return resolve(null);
        });
      }
    });
  });
}

/**
 * Load or create a docker container.
 * @param image image name
 * @param name name of container
 * @param network which docker network to use
 * @param Env additional optional env for the container
 * @returns Boolean for whether a new container is created.
 */
async function loadOrCreateContainer(spec, network) {
  console.log("loading container", spec.name);
  let ip = await loadContainer(spec.name, network);
  if (ip) return false;
  console.log("beforing creating container, removing just in case ..");
  await removeContainer(spec.name);
  console.log("creating container ..");
  await createContainer(spec, network);
  return true;
}

async function getContainerInfo(name): Promise<string | null> {
  return new Promise((resolve, reject) => {
    var docker = new Docker();
    let container = docker.getContainer(name);
    container.inspect((err, data) => {
      if (err) {
        console.log("getContainerInfo: container seems not exist.");
        return resolve(null);
      }
      if (data?.State.Running) {
        return resolve(data.State.StartedAt);
      }
      return resolve(null);
    });
  });
}

async function loadContainer(name, network) {
  // if already exists, just return the IP
  // else, create and return the IP
  return new Promise((resolve, reject) => {
    var docker = new Docker();
    console.log("remove if already exist");
    let old = docker.getContainer(name);
    old.inspect((err, data) => {
      if (err) {
        console.log("removeContainer: container seems not exist.");
        return resolve(null);
      }
      if (data?.State.Running) {
        // console.log(data.NetworkSettings.Networks);
        let ip = data.NetworkSettings.Networks[network].IPAddress;
        console.log("IP:", ip);
        resolve(ip);
      } else {
        console.log("Already stopped. Removing ..");
        old.remove((err, data) => {
          if (err) {
            console.log("ERR during removing container:", err);
            return reject("ERROR!!!");
            // resolve();
          }
          console.log("removed successfully");
          return resolve(null);
        });
      }
    });
  });
}

// return promise of IP address
async function createContainer(spec, network) {
  return new Promise((resolve, reject) => {
    var docker = new Docker();
    // spawn("docker", ["run", "-d", "jp-julia"]);
    // 1. first check if the container already there. If so, stop and delete
    // let name = "julia_kernel_X";
    console.log("spawning kernel in container ..");
    docker.createContainer(spec, (err, container) => {
      if (err) {
        console.log("ERR:", err);
        return;
      }
      container?.start((err, data) => {
        console.log("Container started!");
        // console.log(container);
        container.inspect((err, data) => {
          // console.log("inspect");
          // let ip = data.NetworkSettings.IPAddress
          //
          // If created using codepod network bridge, the IP is here:
          console.log(data?.NetworkSettings.Networks);
          let ip = data?.NetworkSettings.Networks[network].IPAddress;
          if (!ip) {
            console.log(
              "ERROR: IP not available. All network",
              data?.NetworkSettings.Networks
            );
            resolve(null);
          } else {
            console.log("IP:", ip);
            resolve(ip);
          }
        });
        // console.log("IPaddress:", container.NetworkSettings.IPAddress)
      });
    });
  });
}

async function scanRunningSessions(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    var docker = new Docker();
    docker.listContainers((err, containers) => {
      if (err) {
        console.log("ERR:", err);
        return;
      }
      let sessionIds = containers
        ?.filter(
          (c) => c.Names[0].startsWith("/cpkernel_") && c.State === "running"
        )
        .map((c) => c.Names[0].substring("/cpkernel_".length));
      return resolve(sessionIds || []);
    });
  });
}

export async function spawnRuntime(_, { sessionId }) {
  // launch the kernel
  console.log("Spawning ");
  let url = `/${sessionId}`;
  console.log("spawning kernel");
  let zmq_host = `cpkernel_${sessionId}`;
  await loadOrCreateContainer(
    {
      Image: process.env.ZMQ_KERNEL_IMAGE,
      name: zmq_host,
      HostConfig: {
        NetworkMode: "codepod",
        Binds: [
          "dotjulia:/root/.julia",
          "pipcache:/root/.cache/pip",
          // FIXME hard coded dev_ prefix
          "dev_shared_vol:/mount/shared",
        ],
      },
    },
    "codepod"
  );
  console.log("spawning ws");
  let ws_host = `cpruntime_${sessionId}`;
  await loadOrCreateContainer(
    {
      Image: process.env.WS_RUNTIME_IMAGE,
      name: ws_host,
      WorkingDir: "/app",
      Cmd: ["sh", "-c", "yarn && yarn dev"],
      Env: [`ZMQ_HOST=${zmq_host}`],
      HostConfig: {
        NetworkMode: "codepod",
        Binds: [
          "/Users/hebi/git/codepod/runtime:/app",
          "runtime-node-modules:/app/node_modules",
        ],
      },
    },
    "codepod"
  );
  console.log("adding route", url, ws_host);
  // add to routing table
  await apollo_client.mutate({
    mutation: gql`
      mutation addRoute($url: String, $target: String) {
        addRoute(url: $url, target: $target)
      }
    `,
    variables: {
      url,
      // This 4020 is the WS listening port in WS_RUNTIME_IMAGE
      target: `${ws_host}:4020`,
    },
    // refetchQueries: ["getUrls"],
    refetchQueries: [
      {
        query: gql`
          query getUrls {
            getUrls
          }
        `,
      },
    ],
  });
  console.log("returning");
  // console.log("res", res);
  return true;
}

export async function killRuntime(_, { sessionId }) {
  if (!sessionId) return false;
  // TODO kill the runtime server.
  // FIXME handle exception, and kill zombie containers
  let url = `/${sessionId!}`;
  let zmq_host = `cpkernel_${sessionId}`;
  try {
    await removeContainer(zmq_host);
  } catch (e) {
    console.log("Error removing container", zmq_host, e);
    return false;
  }
  let ws_host = `cpruntime_${sessionId}`;
  try {
    await removeContainer(ws_host);
  } catch (e) {
    console.log("Error removing container", ws_host, e);
    return false;
  }
  // remote route
  console.log("Removing route ..");
  await apollo_client.mutate({
    mutation: gql`
      mutation deleteRoute($url: String) {
        deleteRoute(url: $url)
      }
    `,
    variables: {
      url,
    },
    // FIMXE why name doesn't work? Actually the refetchQueries doesn't work
    // refetchQueries: ["getUrls"],
    // refetchQueries: [{ query: GET_URLS_QUERY }],
  });
  return true;
}

/**
 * Get the runtime info.
 * @param sessionId the session ID
 * @returns {startedAt} the time when the runtime is started.
 */
export async function infoRuntime(_, { sessionId }) {
  let zmq_host = `cpkernel_${sessionId}`;
  let ws_host = `cpruntime_${sessionId}`;
  let startedAt = await getContainerInfo(ws_host);
  return {
    startedAt: startedAt ? new Date(startedAt).getTime() : null,
  };
}
// debug: 3 min: 1000 * 60 * 3;
// prod: 12 hours: 1000 * 60 * 60 * 12;
let kernel_ttl: number = process.env.KERNEL_TTL
  ? parseInt(process.env.KERNEL_TTL)
  : 1000 * 60 * 60 * 12;
let loop_interval = process.env.LOOP_INTERVAL
  ? parseInt(process.env.LOOP_INTERVAL)
  : 1000 * 60 * 1;

async function killInactiveRoutes() {
  let { data } = await apollo_client.query({
    query: gql`
      query GetUrls {
        getUrls {
          url
          lastActive
        }
      }
    `,
    fetchPolicy: "network-only",
  });
  const now = new Date();
  let inactiveRoutes = data.getUrls
    .filter(({ url, lastActive }) => {
      if (!lastActive) return true;
      let d2 = new Date(parseInt(lastActive));
      let activeTime = now.getTime() - d2.getTime();
      return activeTime > kernel_ttl;
    })
    .map(({ url }) => url);
  console.log("Inactive routes", inactiveRoutes);
  for (let url of inactiveRoutes) {
    let sessionId = url.substring(1);
    await killRuntime(null, { sessionId });
  }
}

/**
 * Periodically kill inactive routes every minute.
 */
export function loopKillInactiveRoutes() {
  setInterval(async () => {
    await killInactiveRoutes();
  }, loop_interval);
}

/**
 * At startup, check all active containers and add them to the table.
 */
export async function initRoutes() {
  let sessionIds = await scanRunningSessions();
  console.log("initRoutes sessionIds", sessionIds);
  for (let id of sessionIds) {
    let url = `/${id}`;
    let ws_host = `cpruntime_${id}`;
    await apollo_client.mutate({
      mutation: gql`
        mutation addRoute($url: String, $target: String) {
          addRoute(url: $url, target: $target)
        }
      `,
      variables: {
        url,
        // This 4020 is the WS listening port in WS_RUNTIME_IMAGE
        target: `${ws_host}:4020`,
      },
      // refetchQueries: ["getUrls"],
      refetchQueries: [
        {
          query: gql`
            query getUrls {
              getUrls
            }
          `,
        },
      ],
    });
  }
}
