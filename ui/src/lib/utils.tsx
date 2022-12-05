import sha256 from "crypto-js/sha256";

export function computeNamespace(pods, id) {
  let res: string[] = [];
  // if the pod is a pod, do not include its id
  if (pods[id].type !== "DECK") {
    id = pods[id].parent;
  }
  while (id) {
    res.push(pods[id].name || id);
    id = pods[id].parent;
  }
  return res.reverse().join("/");
}

// FIXME performance for reading this from localstorage
export const getAuthHeaders = () => {
  let authToken = localStorage.getItem("token") || null;
  if (!authToken) return null;
  return {
    authorization: `Bearer ${authToken}`,
  };
};
