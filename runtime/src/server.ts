import { WebSocketServer } from "ws";

import express from "express";
import http from "http";

import { ApolloServer, gql } from "apollo-server-express";

import { ApolloClient, InMemoryCache, Reference } from "@apollo/client/core";

import {
  ApolloServerPluginLandingPageProductionDefault,
  ApolloServerPluginLandingPageLocalDefault,
} from "apollo-server-core";

interface TokenInterface {
  id: string;
}

const cache: InMemoryCache = new InMemoryCache({});

const client = new ApolloClient({
  cache,
  uri: "http://localhost:4011/graphql",
});

export async function spawnMock() {
  return { url: "/ID_FDXF53FI", target: "http://localhost:4020" };
}

async function startAPIServer() {
  const apollo = new ApolloServer({
    typeDefs: gql`
      type Query {
        getAll: [String]
      }

      type Mutation {
        spawn: String
        kill(url: String): Boolean
      }
    `,
    resolvers: {
      Query: {
        getAll: async () => {},
      },
      Mutation: {
        spawn: async () => {
          // launch the kernel
          const { url, target } = await spawnMock();

          // add to routing table
          let res = await client.mutate({
            mutation: gql`
              mutation addRoute($url: String, $target: String) {
                addRoute(url: $url, target: $target)
              }
            `,
            variables: {
              url,
              target,
            },
          });
          // console.log("res", res);
          return url;
        },
        kill: async (_, { url }) => {
          // kill the runtime server.
        },
      },
    },
    plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
  });
  const expapp = express();
  const http_server = http.createServer(expapp);
  // graphql api will be available at /graphql

  await apollo.start();
  apollo.applyMiddleware({ app: expapp });

  const port = process.env.API_PORT || 4001;
  http_server.listen({ port }, () => {
    console.log(`🚀 API server ready at http://localhost:${port}`);
    console.log(`🚀 GraphQL server ready at http://localhost:${port}/graphql`);
  });
}

startAPIServer();
