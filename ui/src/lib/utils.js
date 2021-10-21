import sha256 from "crypto-js/sha256";

export function computeNamespace(pods, id) {
  let res = [];
  // if the pod is a pod, do not include its id
  if (pods[id].type !== "DECK") {
    id = pods[id].parent;
  }
  while (id) {
    res.push(id);
    id = pods[id].parent;
  }
  return res.reverse().join("/");
}

export function hashPod(pod) {
  return sha256(
    JSON.stringify({
      id: pod.id,
      content: pod.content,
      column: pod.column,
      type: pod.type,
      lang: pod.lang,
      result: pod.result,
      stdout: pod.stdout,
      error: pod.error,
      imports: pod.imports,
      exports: pod.exports,
      midports: pod.midports,
      fold: pod.fold,
      thundar: pod.thundar,
      utility: pod.utility,
      name: pod.name,
    })
  ).toString();
}

// FIXME performance for reading this from localstorage
export const getAuthHeaders = () => {
  let authToken = localStorage.getItem("token") || null;
  if (!authToken) return null;
  return {
    authorization: `Bearer ${authToken}`,
  };
};
