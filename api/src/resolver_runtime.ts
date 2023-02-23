import { ApolloClient, InMemoryCache, gql } from "@apollo/client/core";

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

import Prisma from "@prisma/client";

const { PrismaClient } = Prisma;

const prisma = new PrismaClient();

const apollo_client = new ApolloClient({
  cache: new InMemoryCache({}),
  uri: process.env.PROXY_API_URL,
});

async function listAllRuntimes(_, {}, { userId }) {
  // 1. get all containers, and filter by container name. This is the safest way to get all the running instances.
  //    If this is too expensive, I should maintain a DB, and periodically check for  zombie containers.
  // 2. get all routes. I need to clean this up as well. UPDATE: the route gets deleted in the end, so I can use this as truth.
  // For UI: I should show the runtime status on the repos page.
  // TODO kill the runtime server.
  // FIXME handle exception, and kill zombie containers
  // let url = `/${sessionId}`;
  // remote route
  let urls = await apollo_client.query({
    // query: gql`
    //   query getUrls {
    //     getUrls
    //   }
    // `,
    query: gql`
      query {
        getUrls {
          url
          lastActive
        }
      }
    `,
    fetchPolicy: "network-only",
  });
  let res = urls.data.getUrls
    .map(({ url, lastActive }) => {
      // Just find userId in the session ID
      let sessionId = url.substring(1);
      if (sessionId.indexOf(userId) !== -1) {
        return {
          sessionId,
          lastActive,
        };
      }
      return false;
    })
    .filter((x) => x);
  return res;
}

export default {
  Query: {
    listAllRuntimes,

    ...(process.env.RUNTIME_SPAWNER === "k8s"
      ? {
          infoRuntime: infoRuntime_k8s,
        }
      : {
          infoRuntime: infoRuntime_docker,
        }),
  },
  Mutation: {
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

export const initRoutes =
  process.env.RUNTIME_SPAWNER !== "k8s" ? initRoutes_docker : initRoutes_k8s;
export const loopKillInactiveRoutes =
  process.env.RUNTIME_SPAWNER !== "k8s"
    ? loopKillInactiveRoutes_docker
    : loopKillInactiveRoutes_k8s;
