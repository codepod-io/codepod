import { ApolloClient, InMemoryCache, gql } from "@apollo/client/core";
import Prisma from "@prisma/client";

import { loadOrCreateContainer, removeContainer } from "./spawner-docker";

const { PrismaClient } = Prisma;

const prisma = new PrismaClient();

const apollo_client = new ApolloClient({
  cache: new InMemoryCache({}),
  uri: process.env.PROXY_API_URL,
});

const GET_URLS_QUERY = gql`
  query getUrls {
    getUrls
  }
`;

export async function listAllRuntimes(_, {}, { userId }) {
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
    query: GET_URLS_QUERY,
    fetchPolicy: "network-only",
  });
  let res = urls.data.getUrls
    .map((url) => {
      let match_res = url.match(/\/user_(.*)_repo_(.*)/);
      if (match_res) {
        if (`user_${match_res[1]}` === userId) return `repo_${match_res[2]}`;
      }
      return false;
    })
    .filter((x) => x);
  return res;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    refetchQueries: [{ query: GET_URLS_QUERY }],
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
