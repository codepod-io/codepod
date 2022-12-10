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

// pretty print the time difference
export function prettyPrintTime(d) {
  let year = d.getUTCFullYear() - 1970;
  let month = d.getUTCMonth();
  let day = d.getUTCDate() - 1;
  let hour = d.getUTCHours();
  let minute = d.getUTCMinutes();
  let second = d.getUTCSeconds();
  return (
    (year > 0 ? year + "y" : "") +
    (month > 0 ? month + "m" : "") +
    (day > 0 ? day + "d" : "") +
    (hour > 0 ? hour + "h" : "") +
    (minute >= 0 ? minute + "m" : "") +
    (second > 0 ? second + "s" : "")
  );
}

export function getUpTime(startedAt: string) {
  let d1 = new Date(parseInt(startedAt));
  let now = new Date();
  let diff = new Date(now.getTime() - d1.getTime());
  let prettyTime = prettyPrintTime(diff);
  return prettyTime;
}
