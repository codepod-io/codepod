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

async function createDeployment(ns, deploy_spec) {
  try {
    // TODO if exists, skip
    // await k8sApi.createNamespacedPod(ns, getPodSpec(k8s_name));
    await k8sAppsApi.createNamespacedDeployment(ns, deploy_spec);
    // FIXME would this also do creation?
  } catch (e: any) {
    if (e.body.reason === "AlreadyExists") {
      console.log("Already exists, patching ..");
      try {
        await k8sAppsApi.patchNamespacedDeployment(
          deploy_spec.metadata.name,
          ns,
          deploy_spec,
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
}

async function createService(ns: string, service_spec) {
  try {
    await k8sApi.createNamespacedService(ns, service_spec);

    // The DNS name of the service is
  } catch (e: any) {
    if (e.body.reason === "AlreadyExists") {
      console.log("Already exists, patching ..");
      try {
        await k8sApi.patchNamespacedService(
          service_spec.metadata.name,
          ns,
          service_spec,
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
}

async function addRoute(ns: string, service_spec, url: string) {
  let dnsname = `${service_spec.metadata.name}.${ns}.svc.cluster.local`;
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
}

export async function spawnRuntime(_, { sessionId }) {
  let url = `/${sessionId}`;
  sessionId = sessionId.replaceAll("_", "-").toLowerCase();
  let k8s_name = `k8s-${sessionId}`;
  console.log("spawnRuntime", url, k8s_name);
  console.log("Creating namespaced pod ..");
  let ns =
    process.env.RUNTIME_NS ||
    fs
      .readFileSync("/var/run/secrets/kubernetes.io/serviceaccount/namespace")
      .toString();
  console.log("Using k8s ns:", ns);
  let deploy_spec = getDeploymentSpec(k8s_name);
  let service_spec = getServiceSpec(k8s_name);
  await createDeployment(ns, deploy_spec);
  console.log("Creating service ..");
  await createService(ns, service_spec);
  await addRoute(ns, service_spec, url);
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
  sessionId = sessionId.replaceAll("_", "-").toLowerCase();
  let k8s_name = `k8s-${sessionId}`;
  let ns =
    process.env.RUNTIME_NS ||
    fs
      .readFileSync("/var/run/secrets/kubernetes.io/serviceaccount/namespace")
      .toString();
  let deploy_spec = getDeploymentSpec(k8s_name);
  // read the startTime from the deployment status
  let status = await k8sAppsApi.readNamespacedDeployment(
    deploy_spec.metadata.name,
    ns
  );
  let startedAt = status.body.metadata?.creationTimestamp;
  return {
    startedAt: startedAt ? new Date(startedAt).getTime() : null,
  };
}

// debug: 3 min: 1000 * 60 * 3;
// prod: 12 hours: 1000 * 60 * 60 * 12;
let kernel_ttl: number = process.env.KERNEL_TTL
  ? parseInt(process.env.KERNEL_TTL)
  : 1000 * 60 * 60 * 12;
let loop_interval = process.env.LOOP_INTERVAL
  ? parseInt(process.env.LOOP_INTERVAL)
  : 1000 * 60 * 1;

async function killInactiveRoutes() {
  let { data } = await apollo_client.query({
    query: gql`
      query GetUrls {
        getUrls {
          url
          lastActive
        }
      }
    `,
    fetchPolicy: "network-only",
  });
  const now = new Date();
  let inactiveRoutes = data.getUrls
    .filter(({ url, lastActive }) => {
      // If the lastActive is null, it means the route is not active.
      if (!lastActive) return true;
      let d2 = new Date(parseInt(lastActive));
      let activeTime = now.getTime() - d2.getTime();
      return activeTime > kernel_ttl;
    })
    .map(({ url }) => url);
  console.log("Inactive routes", inactiveRoutes);
  for (let url of inactiveRoutes) {
    let sessionId = url.substring(1);
    await killRuntime(null, { sessionId });
  }
}

/**
 * Periodically kill inactive routes every minute.
 */
export function loopKillInactiveRoutes() {
  setInterval(async () => {
    await killInactiveRoutes();
  }, loop_interval);
}

function deploymentName2sessionId(deploymentName: string) {
  // NOTE: this is sessionId.replaceAll("_", "-").toLowerCase()
  return deploymentName.match(/runtime-k8s-(.*)-deployment/)![1];
}

async function scanRunningSessions(): Promise<string[]> {
  let ns =
    process.env.RUNTIME_NS ||
    fs
      .readFileSync("/var/run/secrets/kubernetes.io/serviceaccount/namespace")
      .toString();
  let deployments = await k8sAppsApi.listNamespacedDeployment(ns);
  let sessionIds = deployments.body.items
    .map((d) => d.metadata!.name!)
    .filter((x) => x)
    .map((name) => deploymentName2sessionId(name));

  return new Promise((resolve, reject) => {
    resolve(sessionIds || []);
  });
}

/**
 * At startup, check all active containers and add them to the table.
 */
export async function initRoutes() {
  let ns =
    process.env.RUNTIME_NS ||
    fs
      .readFileSync("/var/run/secrets/kubernetes.io/serviceaccount/namespace")
      .toString();
  let sessionIds = await scanRunningSessions();
  console.log("initRoutes sessionIds", sessionIds);
  for (let id of sessionIds) {
    let url = `/${id}`;
    let k8s_name = `k8s-${id}`;
    let service_spec = getServiceSpec(k8s_name);
    await addRoute(ns, service_spec, url);
  }
}
