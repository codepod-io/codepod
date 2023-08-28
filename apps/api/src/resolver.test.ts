import { typeDefs } from "./typedefs";
import { resolvers } from "./resolver";
import { ApolloServer, gql } from "apollo-server-express";
// import { gql } from "@apollo/client";

import { describe, expect, test } from "@jest/globals";

describe("sum module", () => {
  test("adds 1 + 2 to equal 3", () => {
    expect(1 + 2).toBe(3);
  });

  test("returns hello with the provided name", async () => {
    const testServer = new ApolloServer({
      typeDefs,
      resolvers,
    });

    const result = await testServer.executeOperation({
      query: gql`
        query hello {
          hello
        }
      `,
      // query: "query hello() { hello }",
      variables: { name: "world" },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.hello).toBe("Hello world!");
  });
});
