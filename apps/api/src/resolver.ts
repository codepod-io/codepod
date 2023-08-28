import UserResolver from "./resolver_user";
import RepoResolver from "./resolver_repo";
import RuntimeResolver from "./resolver_runtime";
import YjsResolver from "./resolver_yjs";

export const resolvers = {
  Query: {
    hello: () => {
      return "Hello world!";
    },
    ...UserResolver.Query,
    ...RepoResolver.Query,
    ...RuntimeResolver.Query,
    ...YjsResolver.Query,
  },
  Mutation: {
    ...UserResolver.Mutation,
    ...RepoResolver.Mutation,
    ...RuntimeResolver.Mutation,
    ...YjsResolver.Mutation,
  },
};
