import express from "express";
import http from "http";
import fs from "fs";

import { ApolloServer, gql } from "apollo-server-express";

import { ApolloServerPluginLandingPageLocalDefault } from "apollo-server-core";

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
    repo(id: String!): Repo
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
    getDashboardRepos: () => {
      if (!fs.existsSync(repoDirs)) fs.mkdirSync(repoDirs);
      // list folders in repoDirs
      const dirs = fs.readdirSync(repoDirs);
      // read meta data from dirs
      const repos = dirs.map((dir) => {
        const meta = JSON.parse(
          fs.readFileSync(`${repoDirs}/${dir}/meta.json`, "utf8")
        );
        return {
          id: meta.id,
          name: meta.name,
          userId: meta.userId,
          stargazers: (meta.stargazers || []).map((id) => ({ id })),
          collaborators: [],
          public: meta.public,
          createdAt: meta.createdAt,
          updatedAt: meta.updatedAt,
          accessedAt: meta.accessedAt,
        };
      });
      return repos;
    },
    repo: (_, { id }) => {
      // read meta data from dirs
      const meta = JSON.parse(
        fs.readFileSync(`${repoDirs}/${id}/meta.json`, "utf8")
      );
      // update the accessedAt time
      meta.accessedAt = new Date().getTime();
      fs.writeFileSync(`${repoDirs}/${id}/meta.json`, JSON.stringify(meta));
      return {
        id: meta.id,
        name: meta.name,
        userId: meta.userId,
        stargazers: (meta.stargazers || []).map((id) => ({ id })),
        collaborators: [],
        public: meta.public,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        accessedAt: meta.accessedAt,
      };
    },
  },
  Mutation: {
    world: () => {
      return "World!";
    },
    // TODO fill APIs
    createRepo: async () => {
      const id = await nanoid();
      // Integer representing the number of milliseconds that have elapsed since the Unix epoch.
      const time = new Date().getTime();
      const meta = {
        id,
        name: null,
        userId: "localUser",
        public: false,
        stargazers: [],
        collaborators: [],
        createdAt: time,
        updatedAt: time,
        accessedAt: time,
      };
      if (!fs.existsSync(repoDirs)) fs.mkdirSync(repoDirs);
      fs.mkdirSync(`${repoDirs}/${id}`);
      fs.writeFileSync(`${repoDirs}/${id}/meta.json`, JSON.stringify(meta));
      return meta;
    },
    updateRepo: (_, { id, name }) => {
      const meta = JSON.parse(
        fs.readFileSync(`${repoDirs}/${id}/meta.json`, "utf8")
      );
      meta.name = name;
      fs.writeFileSync(`${repoDirs}/${id}/meta.json`, JSON.stringify(meta));
      return true;
    },
    deleteRepo: (_, { id }) => {
      fs.rmdirSync(`${repoDirs}/${id}`, { recursive: true });
      return true;
    },
    star: (_, { repoId }) => {
      const meta = JSON.parse(
        fs.readFileSync(`${repoDirs}/${repoId}/meta.json`, "utf8")
      );
      meta.stargazers = ["localUser"];
      fs.writeFileSync(`${repoDirs}/${repoId}/meta.json`, JSON.stringify(meta));
      return true;
    },
    unstar: (_, { repoId }) => {
      const meta = JSON.parse(
        fs.readFileSync(`${repoDirs}/${repoId}/meta.json`, "utf8")
      );
      meta.stargazers = [];
      fs.writeFileSync(`${repoDirs}/${repoId}/meta.json`, JSON.stringify(meta));
      return true;
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
