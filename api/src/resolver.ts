import UserResolver from "./resolver_user";
import RepoResolver from "./resolver_repo";
import RuntimeResolver from "./resolver_runtime";

export const resolvers = {
  Query: {
    hello: () => {
      return "Hello world!";
    },
    ...UserResolver.Query,
    ...RepoResolver.Query,
    ...RuntimeResolver.Query,
  },
  Mutation: {
    ...UserResolver.Mutation,
    ...RepoResolver.Mutation,
    ...RuntimeResolver.Mutation,
  },
};
