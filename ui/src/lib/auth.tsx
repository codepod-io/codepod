import React, { useState, useContext, useEffect, createContext } from "react";
import {
  ApolloProvider,
  ApolloClient,
  InMemoryCache,
  HttpLink,
  gql,
} from "@apollo/client";
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";

import { customAlphabet } from "nanoid";
import { nolookalikes } from "nanoid-dictionary";

const nanoid = customAlphabet(nolookalikes, 10);

export function ApolloWrapper({ children }) {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [token, setToken] = useState("");
  useEffect(() => {
    async function getToken() {
      if (isAuthenticated) {
        const _token = await getAccessTokenSilently();
        setToken(_token);
      }
    }
    getToken();
  }, [getAccessTokenSilently, isAuthenticated]);

  const link = new HttpLink({
    uri: "/graphql",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const client = new ApolloClient({
    link,
    cache: new InMemoryCache(),
  });
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
