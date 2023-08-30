import React, { useState, useContext, useEffect, createContext } from "react";
import {
  ApolloProvider,
  ApolloClient,
  InMemoryCache,
  HttpLink,
  gql,
  useQuery,
  split,
} from "@apollo/client";

type AuthContextType = ReturnType<typeof useProvideAuth>;

const authContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children, apiUrl, spawnerApiUrl }) {
  const auth = useProvideAuth({ apiUrl, spawnerApiUrl });

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

function useProvideAuth({ apiUrl, spawnerApiUrl }) {
  const [authToken, setAuthToken] = useState<String | null>(null);

  useEffect(() => {
    // load initial state from local storage
    setAuthToken(localStorage.getItem("token") || null);
  }, []);

  const getAuthHeaders = (): Record<string, string> => {
    if (!authToken) return {};

    return {
      authorization: `Bearer ${authToken}`,
    };
  };

  function createApolloClient(auth = true) {
    const link = new HttpLink({
      uri: apiUrl,
      headers: auth ? getAuthHeaders() : undefined,
    });
    const yjslink = new HttpLink({
      uri: spawnerApiUrl,
      headers: auth ? getAuthHeaders() : undefined,
    });

    return new ApolloClient({
      link: split(
        (operation) => operation.getContext().clientName === "spawner",
        yjslink,
        link
      ),
      cache: new InMemoryCache(),
    });
  }

  const signOut = () => {
    console.log("sign out");
    // HEBI CAUTION this must be removed. Otherwise, when getItem back, it is not null, but "null"
    // localStorage.setItem("token", null);
    localStorage.removeItem("token");
    setAuthToken(null);
  };

  const handleGoogle = async (response) => {
    console.log("Google Encoded JWT ID token: " + response.credential);
    const client = createApolloClient(false);
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
    const client = createApolloClient(false);
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
    const client = createApolloClient(false);
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

  /**
   * This is not immediately set onrefresh.
   */
  const isSignedIn = () => {
    if (authToken && localStorage.getItem("token") !== null) {
      return true;
    } else {
      return false;
    }
  };

  /**
   * This is set immediately on refresh.
   */
  function hasToken() {
    return localStorage.getItem("token") !== null;
  }

  return {
    createApolloClient,
    signIn,
    signOut,
    handleGoogle,
    signUp,
    isSignedIn,
    hasToken,
  };
}

const PROFILE_QUERY = gql`
  query Me {
    me {
      firstname
      lastname
      email
      id
      codeiumAPIKey
    }
  }
`;

//   avatar_url

export function useMe() {
  /* eslint-disable no-unused-vars */
  const { loading, data } = useQuery(PROFILE_QUERY, {
    // fetchPolicy: "network-only",
  });
  return { loading, me: data?.me };
}
