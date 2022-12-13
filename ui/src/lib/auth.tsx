import React, { useState, useContext, useEffect, createContext } from "react";
import {
  ApolloProvider,
  ApolloClient,
  InMemoryCache,
  HttpLink,
  gql,
} from "@apollo/client";

type AuthContextType = ReturnType<typeof useProvideAuth>;

const authContext = createContext<AuthContextType | null>(null);

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
  return useContext(authContext)!;
};

function useProvideAuth() {
  const [authToken, setAuthToken] = useState<String | null>(null);

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

  const handleGoogle = async (response) => {
    console.log("Google Encoded JWT ID token: " + response.credential);
    const client = createApolloClient();
    const LoginMutation = gql`
      mutation LoginWithGoogleMutation($idToken: String!) {
        loginWithGoogle(idToken: $idToken) {
          token
        }
      }
    `;
    const result = await client.mutate({
      mutation: LoginMutation,
      variables: { idToken: response.credential },
    });
    console.log("LoginMutation result:", result);

    if (result?.data?.loginWithGoogle?.token) {
      const token = result.data.loginWithGoogle.token;
      setAuthToken(token);
      localStorage.setItem("token", token);
    }
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
      ) {
        signup(
          firstname: $firstname
          lastname: $lastname
          email: $email
          password: $password
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
      },
    });

    if (result.errors) {
      throw Error(result.errors[0].message);
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
    handleGoogle,
    signUp,
    isSignedIn,
  };
}
