// The endpoint for graphql queries.

// NODE_ENV=production node App.tsx
// https://nodejs.dev/en/learn/nodejs-the-difference-between-development-and-production/

let GRAPHQL_ENDPOINT;
if (process.env.NODE_ENV === "development") {
  GRAPHQL_ENDPOINT = "http://localhost:4000/graphql";
} else {
  GRAPHQL_ENDPOINT = "/graphql";
}

export { GRAPHQL_ENDPOINT };
