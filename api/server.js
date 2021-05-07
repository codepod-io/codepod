import { ApolloServer, gql } from "apollo-server";
import { resolvers } from "./resolvers-pg.js";
import jwt from "jsonwebtoken";

const typeDefs = gql`
  type Query {
    hello: String
    users: [User]
    me: User
    repos: [Repo]
    repo(name: String!, username: String!): Repo
    pods(username: String, reponame: String): [Pod]
    myRepos: [Repo]
  }

  type AuthData {
    token: String
  }

  type User {
    id: ID!
    username: String!
    email: String!
    password: String!
    name: String
  }

  type Repo {
    id: ID!
    name: String!
    owner: User!
    pods: [Pod]
  }

  type Pod {
    id: ID!
    type: String
    content: String
    parent: Pod
    index: Int
    children: [Pod]
  }

  type Mutation {
    login(username: String, password: String): AuthData
    signup(
      username: String
      email: String
      password: String
      name: String
    ): AuthData
    createRepo(name: String): Repo
    addPod(
      reponame: String
      username: String
      parent: String
      index: Int
      id: String
      type: String
    ): Pod
    deletePod(id: String, toDelete: [String]): Boolean
    updatePod(id: String, content: String): Pod
    clearUser: Boolean
    clearRepo: Boolean
    clearPod: Boolean
  }
`;

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => {
    const token = req?.headers?.authorization?.slice(7);
    let userId;

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.id;
    }
    return {
      userId,
    };
  },
});

server.listen().then(() => {
  console.log(`
      Server is running!
      Listening on port 4000
      Explore at https://studio.apollographql.com/dev
      Explore at http://localhost:4000/graphql
    `);
});
