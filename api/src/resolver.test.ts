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

  test("User signup, login, me, delete.", async () => {
    const testServer = new ApolloServer({
      typeDefs,
      resolvers,
    });

    let result = null;

    // remove this user
    result = await testServer.executeOperation({
      query: gql`
        mutation {
          deleteUserCCC
        }
      `,
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.deleteUserCCC).toBeTruthy();

    // signup again
    result = await testServer.executeOperation({
      query: gql`
        mutation Signup(
          $email: String
          $password: String
          $firstname: String
          $lastname: String
          $invitation: String
        ) {
          signup(
            email: $email
            password: $password
            firstname: $firstname
            lastname: $lastname
            invitation: $invitation
          ) {
            token
          }
        }
      `,
      // query: "query hello() { hello }",
      variables: {
        email: "ccc@ccc.com",
        password: "ccc",
        firstname: "C1",
        lastname: "C2",
        invitation: "CPFOUNDERS",
      },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.signup.token).toBeDefined();

    // login the user
    result = await testServer.executeOperation({
      query: gql`
        mutation Login($email: String, $password: String) {
          login(email: $email, password: $password) {
            token
          }
        }
      `,
      variables: {
        email: "ccc@ccc.com",
        password: "ccc",
      },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.login.token).toBeDefined();
  });
});
