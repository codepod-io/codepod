import sha256 from "crypto-js/sha256";

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

/**
 * For historical reason, the state.pod.type and DB schema pod.type are "CODE",
 * "DECK", "WYSIWYG", while the node types in react-flow are "code", "scope",
 * "rich". These two functions document this and handle the conversion.
 * @param dbtype
 * @returns
 */
export function dbtype2nodetype(dbtype: string) {
  switch (dbtype) {
    case "CODE":
      return "code";
    case "DECK":
      return "scope";
    case "WYSIWYG":
      return "rich";
    default:
      throw new Error(`unknown dbtype ${dbtype}`);
  }
}

export function nodetype2dbtype(nodetype: string) {
  switch (nodetype) {
    case "code":
      return "CODE";
    case "scope":
      return "DECK";
    case "rich":
      return "WYSIWYG";
    default:
      throw new Error(`unknown nodetype ${nodetype}`);
  }
}
