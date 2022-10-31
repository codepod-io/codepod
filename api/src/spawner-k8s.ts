import * as k8s from "@kubernetes/client-node";

import { ApolloClient, InMemoryCache, gql } from "@apollo/client/core";

const apollo_client = new ApolloClient({
  cache: new InMemoryCache({}),
  uri: "http://codepod-proxy-service:4011/graphql",
});

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

function getPodSpec(name) {
  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name: `${name}-deployment`,
    },
    spec: {
      containers: [
        {
          name: `${name}-kernel`,
          image: process.env.ZMQ_KERNEL_IMAGE,
        },
        {
          name: `${name}-ws`,
          image: process.env.WS_RUNTIME_IMAGE,
          // The out-facing port for proxy to talk to.
          ports: [{ containerPort: 4020 }],
          // It will talk to the above kernel container.
          env: [{ name: "ZMQ_HOST", value: `${name}-kernel` }],
        },
      ],
    },
  };
}

export async function spawnRuntime(_, { sessionId }) {
  let url = `/${sessionId}`;
  let k8s_name = `k8s_${sessionId}`;
  // check if exist?
  // 1. create a jupyter kernel pod
  // 2. create a ws pod
  // FIXME namespace
  // FIXME networking?
  await k8sApi.createNamespacedPod("codepod-dev", getPodSpec(k8s_name));
  let ws_host = `${k8s_name}-deployment`;
  // send to node-http
  console.log("adding route", url, ws_host);
  // add to routing table
  await apollo_client.mutate({
    mutation: gql`
      mutation addRoute($url: String, $target: String) {
        addRoute(url: $url, target: $target)
      }
    `,
    variables: {
      url,
      // This 4020 is the WS listening port in WS_RUNTIME_IMAGE
      target: `${ws_host}:4020`,
    },
    // refetchQueries: ["getUrls"],
    refetchQueries: [
      {
        query: gql`
          query getUrls {
            getUrls
          }
        `,
      },
    ],
  });
  return true;
}

export async function killRuntime(_, { sessionId }) {
  let url = `/${sessionId}`;
  let k8s_name = `k8s_${sessionId}`;
  await k8sApi.deleteNamespacedPod(`${k8s_name}-deployment`, "codepod-dev");
  // remote route
  console.log("Removing route ..");
  await apollo_client.mutate({
    mutation: gql`
      mutation deleteRoute($url: String) {
        deleteRoute(url: $url)
      }
    `,
    variables: {
      url,
    },
    // FIMXE why name doesn't work? Actually the refetchQueries doesn't work
    // refetchQueries: ["getUrls"],
    // refetchQueries: [{ query: GET_URLS_QUERY }],
  });
  return true;
}
