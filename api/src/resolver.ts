import { login, me, signup, updateUser, users } from "./resolver_user";
import {
  addPod,
  createRepo,
  deletePod,
  deleteRepo,
  myRepos,
  pod,
  repo,
  repos,
  updatePod,
} from "./resolver_repo";
import { killRuntime, listAllRuntimes, spawnRuntime } from "./resolver_runtime";

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
    spawnRuntime,
    killRuntime,
  },
};
