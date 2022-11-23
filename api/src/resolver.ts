import { login, me, signup, updateUser, users } from "./resolver_user";
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
} from "./resolver_repo";
import { listAllRuntimes } from "./resolver_runtime";

// chooes between docker and k8s spawners
import {
  spawnRuntime as spawnRuntime_docker,
  killRuntime as killRuntime_docker,
} from "./spawner-docker";
import {
  spawnRuntime as spawnRuntime_k8s,
  killRuntime as killRuntime_k8s,
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
  },
  Mutation: {
    signup,
    updateUser,
    login,
    createRepo,
    deleteRepo,
    clearUser: () => {},
    addPod,
    updatePod,
    deletePod,
    addCollaborator,
    spawnRuntime:
      process.env.RUNTIME_SPAWNER === "k8s"
        ? spawnRuntime_k8s
        : spawnRuntime_docker,
    killRuntime:
      process.env.RUNTIME_SPAWNER === "k8s"
        ? killRuntime_k8s
        : killRuntime_docker,
  },
};
