import React, { useState, useContext, useEffect, createContext } from "react";
import {
  ApolloProvider,
  ApolloClient,
  InMemoryCache,
  HttpLink,
  gql,
} from "@apollo/client";

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
  const [username, setUsername] = useState(null);

  useEffect(() => {
    // load initial state from local storage
    setAuthToken(localStorage.getItem("token") || null);
    setUsername(localStorage.getItem("username") || null);
  }, []);

  const getAuthHeaders = () => {
    if (!authToken) return null;

    return {
      authorization: `Bearer ${authToken}`,
    };
  };

  function createApolloClient() {
    const link = new HttpLink({
      uri: "http://localhost:4000/graphql",
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
    setUsername(null);
    // HEBI CAUTION this must be removed. Otherwise, when getItem back, it is not null, but "null"
    // localStorage.setItem("token", null);
    localStorage.removeItem("token");
    localStorage.removeItem("username");
  };

  const signIn = async ({ username, password }) => {
    const client = createApolloClient();
    const LoginMutation = gql`
      mutation LoginMutation($username: String!, $password: String!) {
        login(username: $username, password: $password) {
          token
          username
        }
      }
    `;
    const result = await client.mutate({
      mutation: LoginMutation,
      variables: { username, password },
    });

    console.log(result);

    if (result?.data?.login?.token) {
      const token = result.data.login.token;
      const username = result.data.login.username;
      setAuthToken(token);
      setUsername(username);
      localStorage.setItem("token", token);
      localStorage.setItem("username", username);
    }
  };

  const signUp = async ({ username, email, password }) => {
    const client = createApolloClient();
    const LoginMutation = gql`
      mutation SignupMutation(
        $username: String!
        $email: String!
        $password: String!
      ) {
        signup(username: $username, email: $email, password: $password) {
          token
          username
        }
      }
    `;
    const result = await client.mutate({
      mutation: LoginMutation,
      variables: { username, password, email },
    });

    console.log(result);

    if (result?.data?.signup?.token) {
      const token = result.data.signup.token;
      const username = result.data.signup.username;
      setAuthToken(token);
      setUsername(username);
      localStorage.setItem("token", token);
      localStorage.setItem("username", username);
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
    username,
    createApolloClient,
    signIn,
    signOut,
    signUp,
    isSignedIn,
  };
}
