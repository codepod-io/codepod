import express from "express";
import http from "http";
import fs from "fs";

import { ApolloServer, gql } from "apollo-server-express";

import { ApolloServerPluginLandingPageLocalDefault } from "apollo-server-core";

import cors from "cors";

import { customAlphabet } from "nanoid/async";
import { lowercase, numbers } from "nanoid-dictionary";

const nanoid = customAlphabet(lowercase + numbers, 20);

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
    me: User
    repo: Repo
    getDashboardRepos: [Repo]
  }

  type Mutation {
    world: String
    createRepo: Repo
    updateRepo(id: ID!, name: String!): Boolean
    deleteRepo(id: ID!): Boolean
    star(repoId: ID!): Boolean
    unstar(repoId: ID!): Boolean
  }
`;

const CODEPOD_ROOT = "/var/codepod";
const repoDirs = `${CODEPOD_ROOT}/repos`;

const repoPath = "/tmp/example-repo";

export const resolvers = {
  Query: {
    hello: () => {
      return "Hello world!";
    },
    // TODO Dummy Data
    me: () => {
      return {
        id: "localUser",
        username: "localUser",
        email: "",
        firstname: "Local",
        lastname: "User",
      };
    },
    repo: (_, {}) => {
      return {
        id: repoPath,
        name: repoPath,
      };
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
  // support cors
  expapp.use(cors());
  expapp.use(express.static("../../packages/ui/dist"));

  const http_server = http.createServer(expapp);

  await apollo.start();
  apollo.applyMiddleware({ app: expapp });

  http_server.listen({ port }, () => {
    console.log(`🚀 Server ready at http://localhost:${port}`);
  });
}
