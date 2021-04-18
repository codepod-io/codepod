import { ApolloServer, gql } from "apollo-server";
import { resolvers } from "./resolvers.js";

const typeDefs = gql`
  type Query {
    hello: String
    users: [User]
    repos: [Repo]
    repo(name: String): Repo
    pods(repo: String): [Pod]
    login(email: String, password: String): AuthData
  }

  type AuthData {
    userID: String
    token: String
  }

  type User {
    id: ID!
    username: String!
    email: String!
    password: String!
    firstname: String
  }

  type Tree {
    children: [Tree]
  }

  type Repo {
    id: ID!
    name: String!
    pods: [Pod]
    docks: [Dock]
    tree: [Tree]
  }

  type Pod {
    id: ID!
    name: String!
    content: String!
  }

  type Dock {
    id: ID!
    name: String!
  }

  type Mutation {
    createUser(
      username: String
      email: String
      password: String
      firstname: String
    ): AuthData
    createRepo(name: String): Repo
    createPod(
      reponame: String
      name: String
      content: String
      parent: String
      index: Int
    ): Pod
    clearUser: Boolean
    clearRepo: Boolean
    clearPod: Boolean
  }
`;

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

server.listen().then(() => {
  console.log(`
      Server is running!
      Listening on port 4000
      Explore at https://studio.apollographql.com/dev
    `);
});
