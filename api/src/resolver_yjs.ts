import { ApolloClient, InMemoryCache, gql } from "@apollo/client/core";

const apollo_client = new ApolloClient({
  cache: new InMemoryCache({}),
  //   uri: process.env.PROXY_API_URL,
  uri: "http://yjs-server:4011/graphql",
});

export default {
  Query: {},
  Mutation: {
    connectRuntime: async (_, { runtimeId, repoId }) => {
      // send this to yjs-server graphql endpoint
      console.log("connectRuntime", runtimeId, repoId);
      apollo_client.mutate({
        mutation: gql`
          mutation ConnectRuntime($runtimeId: String, $repoId: String) {
            connectRuntime(runtimeId: $runtimeId, repoId: $repoId)
          }
        `,
        variables: { runtimeId: runtimeId, repoId: repoId },
      });
    },
    runCode: async (_, { spec, runtimeId }) => {
      // relay this to yjs-server graphql endpoint
      apollo_client.mutate({
        mutation: gql`
          mutation RunCode($runtimeId: String, $spec: RunSpecInput) {
            runCode(runtimeId: $runtimeId, spec: $spec)
          }
        `,
        variables: { spec, runtimeId },
      });
    },
    runChain: async (_, { specs, runtimeId }) => {
      // relay this to yjs-server graphql endpoint
      apollo_client.mutate({
        mutation: gql`
          mutation RunChain($specs: [RunSpecInput], $runtimeId: String) {
            runChain(specs: $specs, runtimeId: $runtimeId)
          }
        `,
        variables: { specs, runtimeId },
      });
    },
    interruptKernel: async (_, { runtimeId }) => {
      // relay this to yjs-server graphql endpoint
      apollo_client.mutate({
        mutation: gql`
          mutation InterruptKernel($runtimeId: String) {
            interruptKernel(runtimeId: $runtimeId)
          }
        `,
        variables: { runtimeId: runtimeId },
      });
    },
    requestKernelStatus: async (_, { runtimeId }) => {
      // relay this to yjs-server graphql endpoint
      apollo_client.mutate({
        mutation: gql`
          mutation RequestKernelStatus($runtimeId: String) {
            requestKernelStatus(runtimeId: $runtimeId)
          }
        `,
        variables: { runtimeId: runtimeId },
      });
    },
  },
};
