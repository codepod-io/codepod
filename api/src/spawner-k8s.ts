import * as k8s from "@kubernetes/client-node";
import * as fs from "fs";

import { ApolloClient, InMemoryCache, gql } from "@apollo/client/core";

const apollo_client = new ApolloClient({
  cache: new InMemoryCache({}),
  uri: "http://codepod-proxy-service:4011/graphql",
});

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);

/**
 * DEPRECATED. Create deployment instead.
 */
function getPodSpec(name) {
  return {
    apiVersion: "v1",
    kind: "Pod",
    metadata: {
      name: `runtime-${name}`,
    },
    spec: {
      containers: [
        {
          name: `runtime-${name}-kernel`,
          image: process.env.ZMQ_KERNEL_IMAGE,
        },
        {
          name: `runtime-${name}-ws`,
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

function getDeploymentSpec(name) {
  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name: `runtime-${name}-deployment`,
    },
    spec: {
      replicas: 1,
      selector: {
        matchLabels: { app: `runtime-${name}` },
      },
      template: {
        metadata: { labels: { app: `runtime-${name}` } },
        spec: {
          containers: [
            {
              name: `runtime-${name}-kernel`,
              image: process.env.ZMQ_KERNEL_IMAGE,
              ports: [
                // These are pre-defined in kernel/conn.json
                { containerPort: 55692 },
                { containerPort: 55693 },
                { containerPort: 55694 },
                { containerPort: 55695 },
                { containerPort: 55696 },
              ],
            },
            {
              name: `runtime-${name}-ws`,
              image: process.env.WS_RUNTIME_IMAGE,
              // The out-facing port for proxy to talk to.
              ports: [{ containerPort: 4020 }],
              // It will talk to the above kernel container.
              env: [
                {
                  name: "ZMQ_HOST",
                  // value: `${name}-kernel`
                  //
                  // In k8s, the sidecar container doesn't get a IP/hostname.
                  // Instead, I have to bind the port and use localhost for them
                  // to connect.
                  value: "localhost",
                },
              ],
            },
          ],
        },
      },
    },
  };
}

function getServiceSpec(name) {
  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name: `runtime-${name}-service`,
    },
    spec: {
      selector: {
        app: `runtime-${name}`,
      },
      ports: [
        {
          protocol: "TCP",
          port: 4020,
          targetPort: 4020,
        },
      ],
    },
  };
}

export async function spawnRuntime(_, { sessionId }) {
  let url = `/${sessionId}`;
  sessionId = sessionId.replaceAll("_", "-").toLowerCase();
  // sessionId = "runtime-k8s-user-UGY6YAk7TM-repo-34prxrgkKG-kernel";
  // sessionId = "k8s-user-UGY6YAk7TM";
  let k8s_name = `k8s-${sessionId}`;
  console.log("spawnRuntime", url, k8s_name);
  // check if exist?
  // 1. create a jupyter kernel pod
  // 2. create a ws pod
  console.log("Creating namespaced pod ..");

  let ns =
    process.env.RUNTIME_NS ||
    fs
      .readFileSync("/var/run/secrets/kubernetes.io/serviceaccount/namespace")
      .toString();
  console.log("Using k8s ns:", ns);
  try {
    // TODO if exists, skip
    // await k8sApi.createNamespacedPod(ns, getPodSpec(k8s_name));
    await k8sAppsApi.createNamespacedDeployment(
      ns,
      getDeploymentSpec(k8s_name)
    );
    // FIXME would this also do creation?
  } catch (e: any) {
    if (e.body.reason === "AlreadyExists") {
      console.log("Already exists, patching ..");
      try {
        await k8sAppsApi.patchNamespacedDeployment(
          getDeploymentSpec(k8s_name).metadata.name,
          ns,
          getDeploymentSpec(k8s_name),
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          {
            headers: {
              "content-type": "application/strategic-merge-patch+json",
            },
          }
        );
      } catch (e: any) {
        console.log("ERROR", e.body.message);
        return false;
      }
    } else {
      console.log("ERROR", e.body.message);
      return false;
    }
  }
  console.log("Creating service ..");
  try {
    await k8sApi.createNamespacedService(ns, getServiceSpec(k8s_name));

    // The DNS name of the service is
  } catch (e: any) {
    if (e.body.reason === "AlreadyExists") {
      console.log("Already exists, patching ..");
      try {
        await k8sApi.patchNamespacedService(
          getServiceSpec(k8s_name).metadata.name,
          ns,
          getServiceSpec(k8s_name),
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          // Ref: https://github.com/kubernetes-client/javascript/issues/19
          //
          // FIXME actually the patch is not the same as kubectl apply -f. It
          // won't remove old selectors with a different label name. But it's
          // not a problem here, as we have only one selector "app".
          {
            headers: {
              "content-type": "application/strategic-merge-patch+json",
            },
          }
        );
      } catch (e: any) {
        console.log("ERROR", e.body.message);
        return false;
      }
    } else {
      console.log("ERROR", e.body.message);
      return false;
    }
  }
  let dnsname = `${
    getServiceSpec(k8s_name).metadata.name
  }.${ns}.svc.cluster.local`;
  console.log("Created, dns:", dnsname);
  // let ws_host = `${k8s_name}-deployment`;
  let ws_host = dnsname;
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
  sessionId = sessionId.replaceAll("_", "-").toLowerCase();
  // sessionId = "runtime-k8s-user-UGY6YAk7TM-repo-34prxrgkKG-kernel";
  // sessionId = "k8s-user-UGY6YAk7TM";
  let k8s_name = `k8s-${sessionId}`;
  console.log("killRuntime", url, k8s_name);
  let ns =
    process.env.RUNTIME_NS ||
    fs
      .readFileSync("/var/run/secrets/kubernetes.io/serviceaccount/namespace")
      .toString();
  console.log("Using k8s ns:", ns);
  console.log("Killing pod ..");
  // await k8sApi.deleteNamespacedPod(getPodSpec(k8s_name).metadata.name, ns);
  await k8sAppsApi.deleteNamespacedDeployment(
    getDeploymentSpec(k8s_name).metadata.name,
    ns
  );
  console.log("Killing service ..");
  await k8sApi.deleteNamespacedService(
    getServiceSpec(k8s_name).metadata.name,
    ns
  );
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

/**
 * Get the runtime info.
 * @param sessionId the session ID
 * @returns {startedAt} the time when the runtime is started.
 */
export async function infoRuntime(_, { sessionId }) {
  // TODO implement
  throw new Error("Not implemented");
  return {
    startedAt: null,
  };
}
