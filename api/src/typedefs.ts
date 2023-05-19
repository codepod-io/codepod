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

  type Visibility {
    collaborators: [User]
    isPublic: Boolean
  }

  type Repo {
    id: ID!
    name: String
    pods: [Pod]
    edges: [Edge]
    userId: ID!
    collaborators: [User]
    public: Boolean
    createdAt: String
    updatedAt: String
  }

  type Edge {
    source: String!
    target: String!
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
    getVisibility(repoId: String!): Visibility
    listAllRuntimes: [RuntimeInfo]
    myCollabRepos: [Repo]
    infoRuntime(sessionId: String!): RuntimeInfo
  }

  type Mutation {
    login(email: String!, password: String!): AuthData
    loginGuest(id: String!): AuthData
    signupGuest: AuthData
    signup(
      email: String!
      password: String!
      firstname: String!
      lastname: String!
    ): AuthData
    loginWithGoogle(idToken: String!): AuthData
    updateUser(email: String!, firstname: String!, lastname: String!): Boolean
    createRepo: Repo
    updateRepo(id: ID!, name: String!): Boolean
    deleteRepo(id: ID!): Boolean
    copyRepo(repoId: String!): ID!
    deletePods(ids: [String]): Boolean
    addPods(repoId: String!, pods: [PodInput]): Boolean
    updatePod(id: String!, repoId: String!, input: PodInput): Boolean
    addEdge(source: ID!, target: ID!): Boolean
    deleteEdge(source: ID!, target: ID!): Boolean
    clearUser: Boolean
    clearRepo: Boolean
    clearPod: Boolean
    spawnRuntime(sessionId: String!): Boolean
    killRuntime(sessionId: String!): Boolean
    updateVisibility(repoId: String!, isPublic: Boolean!): Boolean
    addCollaborator(repoId: String!, email: String!): Boolean
    deleteCollaborator(repoId: String!, collaboratorId: String!): Boolean

    exportJSON(repoId: String!): String!
    exportFile(repoId: String!): String!
  }
`;
