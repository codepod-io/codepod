import UserResolver from "./resolver_user";
import RepoResolver from "./resolver_repo";
import RuntimeResolver from "./resolver_runtime";
import ExportResolver from "./resolver_export";

export const resolvers = {
  Query: {
    hello: () => {
      return "Hello world!";
    },
    ...UserResolver.Query,
    ...RepoResolver.Query,
    ...RuntimeResolver.Query,
    ...ExportResolver.Query,
  },
  Mutation: {
    ...UserResolver.Mutation,
    ...RepoResolver.Mutation,
    ...RuntimeResolver.Mutation,
    ...ExportResolver.Mutation,
  },
};
