import { ApolloClient, InMemoryCache, gql } from "@apollo/client/core";
import Prisma from "@prisma/client";

const { PrismaClient } = Prisma;

const prisma = new PrismaClient();

const apollo_client = new ApolloClient({
  cache: new InMemoryCache({}),
  uri: process.env.PROXY_API_URL,
});

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
      let match_res = url.match(/\/user_(.*)_repo_(.*)/);
      if (match_res) {
        if (`user_${match_res[1]}` === userId)
          return {
            sessionId: `user_${match_res[1]}_repo_${match_res[2]}`,
            lastActive,
          };
      }
      return false;
    })
    .filter((x) => x);
  return res;
}
