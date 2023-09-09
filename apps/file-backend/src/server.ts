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
    me: User
    repo(id: String!): Repo
    getDashboardRepos: [Repo]
  }

  type Mutation {
    world: String
    createRepo: Repo
    updateRepo(id: ID!, name: String!): Boolean
    deleteRepo(id: ID!): Boolean
  }
`;

// TODO Dummy Data
const repos = [
  {
    id: "repo1",
    name: "test",
    userId: "user1",
    stargazers: [],
    collaborators: [],
    public: false,
    createdAt: "2021-01-01",
    updatedAt: "2021-01-01",
    accessedAt: "2021-01-01",
  },
  {
    id: "repo2",
    name: "test2",
    userId: "user1",
    stargazers: [],
    collaborators: [],
    public: false,
    createdAt: "2021-01-01",
    updatedAt: "2021-01-01",
    accessedAt: "2021-01-01",
  },
];

export const resolvers = {
  Query: {
    hello: () => {
      return "Hello world!";
    },
    // TODO Dummy Data
    me: () => {
      return {
        id: "user1",
        username: "test",
        email: "",
        firstname: "Local",
        lastname: "User",
      };
    },
    getDashboardRepos: () => {
      console.log("returning repos");
      console.log(repos);
      return repos;
    },
    repo: (_, { id }) => {
      console.log("finding", id);
      const res = repos.find((repo) => repo.id === id);
      repos.forEach((repo) => {
        console.log(repo.id === id);
      });
      console.log("res", res);
      return repos.find((repo) => repo.id === id);
    },
  },
  Mutation: {
    world: () => {
      return "World!";
    },
    // TODO fill APIs
    createRepo: () => {},
    updateRepo: () => {},
    deleteRepo: () => {},
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
