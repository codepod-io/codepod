import { customAlphabet } from "nanoid";
import { lowercase, numbers } from "nanoid-dictionary";

// FIXME performance for reading this from localstorage
export const getAuthHeaders = () => {
  let authToken = localStorage.getItem("token") || null;
  if (!authToken) return null;
  return {
    authorization: `Bearer ${authToken}`,
  };
};

export function timeDifference(current, previous) {
  const msPerMinute = 60 * 1000;
  const msPerHour = msPerMinute * 60;
  const msPerDay = msPerHour * 24;
  const msPerMonth = msPerDay * 30;
  const msPerYear = msPerDay * 365;
  const elapsed = current - previous;

  if (elapsed < msPerMinute) {
    return Math.round(elapsed / 1000) + " seconds ago";
  } else if (elapsed < msPerHour) {
    return Math.round(elapsed / msPerMinute) + " minutes ago";
  } else if (elapsed < msPerDay) {
    return Math.round(elapsed / msPerHour) + " hours ago";
  } else if (elapsed < msPerMonth) {
    return Math.round(elapsed / msPerDay) + " days ago";
  } else if (elapsed < msPerYear) {
    return Math.round(elapsed / msPerMonth) + " months ago";
  } else {
    return Math.round(elapsed / msPerYear) + " years ago";
  }
}

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

export const myNanoId = customAlphabet(lowercase + numbers, 20);

export const level2color = {
  0: "rgba(187, 222, 251, 0.5)",
  1: "rgba(144, 202, 249, 0.5)",
  2: "rgba(100, 181, 246, 0.5)",
  3: "rgba(66, 165, 245, 0.5)",
  4: "rgba(33, 150, 243, 0.5)",
  // default: "rgba(255, 255, 255, 0.2)",
  default: "rgba(240,240,240,0.25)",
};
