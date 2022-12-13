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
    name: String
    pods: [Pod]
    userId: ID!
    collaboratorIds: [ID!]
    public: Boolean
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
    x: Float
    y: Float
    width: Float
    height: Float
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
    x: Float
    y: Float
    width: Float
    height: Float
    parent: ID
    children: [ID]
  }

  type RuntimeInfo {
    startedAt: String
    lastActive: String
    sessionId: String
    ttl: Int
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
    listAllRuntimes: [RuntimeInfo]
    myCollabRepos: [Repo]
    infoRuntime(sessionId: String!): RuntimeInfo
  }

  type Mutation {
    login(email: String, password: String): AuthData
    signup(
      email: String
      password: String
      firstname: String
      lastname: String
    ): AuthData
    loginWithGoogle(idToken: String): AuthData
    updateUser(email: String, firstname: String, lastname: String): Boolean
    createRepo: Repo
    updateRepo(id: ID, name: String): Boolean
    deleteRepo(id: ID): Boolean
    addPod(repoId: String, parent: String, index: Int, input: PodInput): Boolean
    deletePod(id: String, toDelete: [String]): Boolean
    updatePod(id: String, input: PodInput): Boolean
    clearUser: Boolean
    clearRepo: Boolean
    clearPod: Boolean
    spawnRuntime(sessionId: String): Boolean
    killRuntime(sessionId: String!): Boolean
    addCollaborator(repoId: String, email: String): Boolean
  }
`;
