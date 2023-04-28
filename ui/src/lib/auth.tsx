import React, { useState, useContext, useEffect, createContext } from "react";
import {
  ApolloProvider,
  ApolloClient,
  InMemoryCache,
  HttpLink,
  gql,
} from "@apollo/client";
import jwt_decode from "jwt-decode";

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
    setAuthToken(
      localStorage.getItem("token") ||
        localStorage.getItem("guestToken") ||
        null
    );
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
    // HEBI CAUTION this must be removed. Otherwise, when getItem back, it is not null, but "null"
    // localStorage.setItem("token", null);
    localStorage.removeItem("token");
    setAuthToken(localStorage.getItem("guestToken") || null);
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

  let guestSigningUp = false;

  const loginGuest = async () => {
    console.log("Loginning as guest.");
    // If there is a guest token, decode the guest ID from it, and login with the guest ID
    let token = localStorage.getItem("guestToken");
    if (token) {
      console.log("Guest token found, logining in ..");
      const { id } = jwt_decode(token) as { id: string };
      // login a guest user with the guest ID
      const client = createApolloClient();
      const LoginGuestMutation = gql`
        mutation LoginGuestMutation($id: String!) {
          loginGuest(id: $id) {
            token
          }
        }
      `;
      const result = await client.mutate({
        mutation: LoginGuestMutation,
        variables: { id },
      });
      if (result?.data?.loginGuest?.token) {
        const token = result.data.loginGuest.token;
        setAuthToken(token);
        localStorage.setItem("guestToken", token);
      }
    } else {
      // Signup a guest user
      console.log("Guest token not found, signing up ..");
      // set a 5 seconds timeout so that no duplicate guest users are created
      if (guestSigningUp) {
        console.log("Guest signing up, waiting ..");
        return;
      }
      guestSigningUp = true;
      setTimeout(() => {
        guestSigningUp = false;
      }, 5000);

      // actually signup the user
      const client = createApolloClient();
      const SignupGuestMutation = gql`
        mutation SignupGuestMutation {
          signupGuest {
            token
          }
        }
      `;

      const result = await client.mutate({
        mutation: SignupGuestMutation,
      });

      if (result?.data?.signupGuest?.token) {
        const token = result.data.signupGuest.token;
        setAuthToken(token);
        localStorage.setItem("guestToken", token);
      }
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
    return (
      localStorage.getItem("token") !== null ||
      localStorage.getItem("guestToken") !== null
    );
  }

  return {
    createApolloClient,
    signIn,
    signOut,
    loginGuest,
    handleGoogle,
    signUp,
    isSignedIn,
    hasToken,
  };
}
