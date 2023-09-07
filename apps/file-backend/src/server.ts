import express from "express";
import http from "http";

import { ApolloServer, gql } from "apollo-server-express";

import { ApolloServerPluginLandingPageLocalDefault } from "apollo-server-core";

export const typeDefs = gql`
  type User {
    id: ID!
    username: String
    email: String!
    password: String!
    firstname: String!
    lastname: String!
  }

  type Repo {
    id: ID!
    name: String
    userId: ID!
    stargazers: [User]
    collaborators: [User]
    public: Boolean
    createdAt: String
    updatedAt: String
    accessedAt: String
  }

  type Query {
    hello: String
  }

  type Mutation {
    world: String
  }
`;

export const resolvers = {
  Query: {
    hello: () => {
      return "Hello world!";
    },
  },
  Mutation: {
    world: () => {
      return "World!";
    },
  },
};

export async function startServer({ port }) {
  const apollo = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
  });
  const expapp = express();
  expapp.use(express.json({ limit: "20mb" }));
  const http_server = http.createServer(expapp);

  await apollo.start();
  apollo.applyMiddleware({ app: expapp });

  http_server.listen({ port }, () => {
    console.log(`🚀 Server ready at http://localhost:${port}`);
  });
}
