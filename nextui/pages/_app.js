import { ChakraProvider } from "@chakra-ui/react";
import { AuthProvider } from "../lib/auth.js";
import Header from "../components/Header";

import "../styles/globals.css";

function MyApp({ Component, pageProps }) {
  return (
    <ChakraProvider>
      <AuthProvider>
        <Header />
        <Component {...pageProps} />
      </AuthProvider>
    </ChakraProvider>
  );
}

export default MyApp;
