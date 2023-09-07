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

  return {
    createApolloClient,
  };
}
