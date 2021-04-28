import { ChakraProvider } from "@chakra-ui/react";
import { AuthProvider } from "../lib/auth.js";
import { Header, Footer } from "../components/Header";

import { Provider } from "react-redux";

import store from "../lib/store";

import "../styles/globals.css";

function MyApp({ Component, pageProps }) {
  return (
    <Provider store={store}>
      <ChakraProvider>
        <AuthProvider>
          <Header />
          <Component {...pageProps} />
          <Footer />
        </AuthProvider>
      </ChakraProvider>
    </Provider>
  );
}

export default MyApp;
