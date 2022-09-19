import { gql } from "apollo-server";

export const typeDefs = gql`
  type AuthData {
    token: String
  }

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
    name: String!
    pods: [Pod]
  }

  type Pod {
    id: ID!
    type: String
    content: String
    githead: String
    staged: String
    column: Int
    lang: String
    parent: Pod
    index: Int
    children: [Pod]
    result: String
    stdout: String
    error: String
    imports: String
    exports: String
    reexports: String
    midports: String
    fold: Boolean
    thundar: Boolean
    utility: Boolean
    name: String
  }

  input PodInput {
    id: ID!
    type: String
    content: String
    column: Int
    lang: String
    result: String
    stdout: String
    error: String
    imports: String
    exports: String
    reexports: String
    midports: String
    fold: Boolean
    thundar: Boolean
    utility: Boolean
    name: String
  }

  type Query {
    hello: String
    users: [User]
    me: User
    repos: [Repo]
    repo(id: String!): Repo
    pod(id: ID!): Pod
    myRepos: [Repo]
    activeSessions: [String]
  }

  type Mutation {
    login(email: String, password: String): AuthData
    signup(
      email: String
      password: String
      firstname: String
      lastname: String
      invitation: String
    ): AuthData
    deleteUserCCC: Boolean
    updateUser(email: String, firstname: String, lastname: String): Boolean
    createRepo(name: String): Repo
    deleteRepo(name: String): Boolean
    addPod(repoId: String, parent: String, index: Int, input: PodInput): Boolean
    deletePod(id: String, toDelete: [String]): Boolean
    pastePod(id: String, parentId: String, index: Int, column: Int): Boolean
    pastePods(ids: [String], parentId: String, index: Int, column: Int): Boolean
    updatePod(id: String, input: PodInput): Boolean
    clearUser: Boolean
    clearRepo: Boolean
    clearPod: Boolean
    killSession(sessionId: String): Boolean
  }
`;
