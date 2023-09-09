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
  function createApolloClient(auth = true) {
    const link = new HttpLink({
      uri: apiUrl,
    });
    const yjslink = new HttpLink({
      uri: spawnerApiUrl,
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
