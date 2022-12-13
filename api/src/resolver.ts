import {
  login,
  loginWithGoogle,
  me,
  signup,
  updateUser,
  users,
} from "./resolver_user";
import {
  addPod,
  createRepo,
  deletePod,
  deleteRepo,
  myRepos,
  myCollabRepos,
  addCollaborator,
  pod,
  repo,
  repos,
  updatePod,
  updateRepo,
} from "./resolver_repo";
import { listAllRuntimes } from "./resolver_runtime";

// chooes between docker and k8s spawners
import {
  spawnRuntime as spawnRuntime_docker,
  killRuntime as killRuntime_docker,
  infoRuntime as infoRuntime_docker,
  loopKillInactiveRoutes as loopKillInactiveRoutes_docker,
  initRoutes as initRoutes_docker,
} from "./spawner-docker";
import {
  spawnRuntime as spawnRuntime_k8s,
  killRuntime as killRuntime_k8s,
  infoRuntime as infoRuntime_k8s,
  loopKillInactiveRoutes as loopKillInactiveRoutes_k8s,
  initRoutes as initRoutes_k8s,
} from "./spawner-k8s";

export const resolvers = {
  Query: {
    hello: () => {
      return "Hello world!";
    },
    users,
    me,
    repos,
    myRepos,
    repo,
    pod,
    listAllRuntimes,
    myCollabRepos,
    ...(process.env.RUNTIME_SPAWNER === "k8s"
      ? {
          infoRuntime: infoRuntime_k8s,
        }
      : {
          infoRuntime: infoRuntime_docker,
        }),
  },
  Mutation: {
    signup,
    updateUser,
    login,
    loginWithGoogle,
    createRepo,
    updateRepo,
    deleteRepo,
    clearUser: () => {},
    addPod,
    updatePod,
    deletePod,
    addCollaborator,
    ...(process.env.RUNTIME_SPAWNER === "k8s"
      ? {
          spawnRuntime: spawnRuntime_k8s,
          killRuntime: killRuntime_k8s,
        }
      : {
          spawnRuntime: spawnRuntime_docker,
          killRuntime: killRuntime_docker,
        }),
  },
};

if (process.env.RUNTIME_SPAWNER !== "k8s") {
  initRoutes_docker();
  loopKillInactiveRoutes_docker();
} else {
  initRoutes_k8s();
  loopKillInactiveRoutes_k8s();
}
