import React, { useState, useContext, useEffect, createContext } from "react";
import {
  ApolloProvider,
  ApolloClient,
  InMemoryCache,
  HttpLink,
  gql,
} from "@apollo/client";

import { customAlphabet } from "nanoid";
import { nolookalikes } from "nanoid-dictionary";

const nanoid = customAlphabet(nolookalikes, 10);

const authContext = createContext();

export function AuthProvider({ children }) {
  const auth = useProvideAuth();

  return (
    <authContext.Provider value={auth}>
      <ApolloProvider client={auth.createApolloClient()}>
        {children}
      </ApolloProvider>
    </authContext.Provider>
  );
}

export const useAuth = () => {
  return useContext(authContext);
};

function useProvideAuth() {
  const [authToken, setAuthToken] = useState(null);

  useEffect(() => {
    // load initial state from local storage
    setAuthToken(localStorage.getItem("token") || null);
  }, []);

  const getAuthHeaders = () => {
    if (!authToken) return null;

    return {
      authorization: `Bearer ${authToken}`,
    };
  };

  function createApolloClient() {
    const link = new HttpLink({
      uri: "/graphql",
      headers: getAuthHeaders(),
    });

    return new ApolloClient({
      link,
      cache: new InMemoryCache(),
    });
  }

  const signOut = () => {
    console.log("sign out");
    setAuthToken(null);
    // HEBI CAUTION this must be removed. Otherwise, when getItem back, it is not null, but "null"
    // localStorage.setItem("token", null);
    localStorage.removeItem("token");
  };

  const signIn = async ({ email, password }) => {
    const client = createApolloClient();
    const LoginMutation = gql`
      mutation LoginMutation($email: String!, $password: String!) {
        login(email: $email, password: $password) {
          token
        }
      }
    `;
    const result = await client.mutate({
      mutation: LoginMutation,
      variables: { email, password },
    });

    console.log(result);

    if (result?.data?.login?.token) {
      const token = result.data.login.token;
      setAuthToken(token);
      localStorage.setItem("token", token);
    }
  };

  const signUp = async ({ firstname, lastname, email, password }) => {
    const client = createApolloClient();
    const LoginMutation = gql`
      mutation SignupMutation(
        $firstname: String!
        $lastname: String!
        $email: String!
        $password: String!
        $id: ID
      ) {
        signup(
          firstname: $firstname
          lastname: $lastname
          email: $email
          password: $password
          id: $id
        ) {
          token
        }
      }
    `;
    const result = await client.mutate({
      mutation: LoginMutation,
      variables: {
        firstname,
        lastname,
        password,
        email,
        id: "user_" + nanoid(),
      },
    });

    if (result.errors) {
      throw Error(
        result.errors[0].message +
          "\n" +
          result.errors[0].extensions.exception.stacktrace.join("\n")
      );
    }

    if (result?.data?.signup?.token) {
      const token = result.data.signup.token;
      setAuthToken(token);
      localStorage.setItem("token", token);
    }
  };

  const isSignedIn = () => {
    if (authToken) {
      return true;
    } else {
      return false;
    }
  };

  return {
    createApolloClient,
    signIn,
    signOut,
    signUp,
    isSignedIn,
  };
}
