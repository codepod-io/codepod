import Docker from "dockerode";

import { ApolloClient, InMemoryCache, gql } from "@apollo/client/core";

const apollo_client = new ApolloClient({
  cache: new InMemoryCache({}),
  uri: process.env.PROXY_API_URL,
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function removeContainer(name) {
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
export async function loadOrCreateContainer(
  image,
  name,
  network,
  Env: string[] = []
) {
  console.log("loading container", name);
  let ip = await loadContainer(name, network);
  if (ip) return false;
  console.log("beforing creating container, removing just in case ..");
  await removeContainer(name);
  console.log("creating container ..");
  await createContainer(image, name, network, Env);
  return true;
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
async function createContainer(image, name, network, Env) {
  return new Promise((resolve, reject) => {
    var docker = new Docker();
    // spawn("docker", ["run", "-d", "jp-julia"]);
    // 1. first check if the container already there. If so, stop and delete
    // let name = "julia_kernel_X";
    console.log("spawning kernel in container ..");
    docker.createContainer(
      {
        Image: image,
        name,
        Env,
        HostConfig: {
          NetworkMode: network,
          Binds: [
            "dotjulia:/root/.julia",
            "pipcache:/root/.cache/pip",
            // FIXME hard coded dev_ prefix
            "dev_shared_vol:/mount/shared",
          ],
          // DeviceRequests: [
          //   {
          //     Count: -1,
          //     Driver: "nvidia",
          //     Capabilities: [["gpu"]],
          //   },
          // ],
        },
      },
      (err, container) => {
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
      }
    );
  });
}

export async function spawnRuntime(_, { sessionId }) {
  // launch the kernel
  console.log("Spawning ");
  let url = `/${sessionId}`;
  console.log("spawning kernel");
  let zmq_host = `cpkernel_${sessionId}`;
  let need_wait = false;
  let created = await loadOrCreateContainer(
    process.env.ZMQ_KERNEL_IMAGE,
    zmq_host,
    // "cpkernel1_hello_world-foo",
    "codepod"
  );
  console.log("spawning ws");
  let ws_host = `cpruntime_${sessionId}`;
  need_wait ||= created;
  created = await loadOrCreateContainer(
    process.env.WS_RUNTIME_IMAGE,
    ws_host,
    // "cpruntime1_hello_world-foo",
    "codepod",
    [`ZMQ_HOST=${zmq_host}`]
  );
  need_wait ||= created;
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

  if (need_wait) {
    console.log("Waiting for 2 seconds for the container to startup.");
    await delay(1000);
  }
  console.log("returning");
  // console.log("res", res);
  return true;
}

export async function killRuntime(_, { sessionId }) {
  // TODO kill the runtime server.
  // FIXME handle exception, and kill zombie containers
  let url = `/${sessionId!}`;
  let zmq_host = `cpkernel_${sessionId}`;
  await removeContainer(zmq_host);
  let ws_host = `cpruntime_${sessionId}`;
  await removeContainer(ws_host);
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
