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
    codeiumAPIKey: String
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
    users: [User]
    me: User
    repos: [Repo]
    repo(id: String!): Repo
    getDashboardRepos: [Repo]
  }

  type Mutation {
    login(email: String!, password: String!): AuthData
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
    updateVisibility(repoId: String!, isPublic: Boolean!): Boolean
    addCollaborator(repoId: String!, email: String!): Boolean
    deleteCollaborator(repoId: String!, collaboratorId: String!): Boolean
    star(repoId: ID!): Boolean
    unstar(repoId: ID!): Boolean

    updateCodeiumAPIKey(apiKey: String!): Boolean
  }
`;
