import Docker from "dockerode";

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
  Env: String[] = []
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
