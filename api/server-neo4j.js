import { makeAugmentedSchema, assertSchema } from "neo4j-graphql-js";
import neo4j from "neo4j-driver";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { ApolloServer } from "apollo-server";
import dotenv from "dotenv";
// import { typeDefs } from './graphql-schema'

// set environment variables from .env
dotenv.config();

const typeDefs = `
type Mutation {
  signup(username: String!, password: String!, email: String!): AuthData
  login(username: String!, password: String!): AuthData
  createRepo(name: String!): Repo @cypher(
    statement: """
    MATCH (u:User {id: $cypherParams.userId})
    CREATE (r:Repo)<-[:OWN]-(u)
    SET r.name  = $name, r.id = randomUUID()
    RETURN r
    """
  )
}

type AuthData {
  token: String!
  username: String!
  id: ID!
}

type Query {
  currentUser: User @cypher(
    statement: """
    MATCH (u:User {id: $cypherParams.userId})
    return u
    """
  )
  myRepos: [Repo] @cypher (
    statement: """
    MATCH (u:User {id: $cypherParams.userId})
    MATCH (r:Repo)<-[:OWN]-(u)
    RETURN r
    """
  )
}

type User {
  id: ID!
  username: String! @unique
  email: String! @unique
  repos: [Repo] @relation(name: "OWN", direction: OUT)
}

type Repo {
  id: ID!
  name: String!
  owner: User! @relation(name: "OWN", direction: IN)
  root: Deck
}

type Pod {
  id: ID!
  name: String!
  content: String!
  repo: Repo! @relation(name: "HAS_POD", direction: IN)
  parent: Deck! @relation(name: "HOLD", direction: IN)
}

type Deck {
  id: ID!
  name: String!
  pods: [Pod] @relation(name: "HOLD", direction: OUT)
  parent: Deck @relation(name: "HOLD", direction: IN)
}
`;

const resolvers = {
  Mutation: {
    signup: (obj, args, context, info) => {
      args.password = bcrypt.hashSync(args.password, 10);
      const session = context.driver.session();
      // check duplicate users
      // TODO this is done in the database
      // CREATE CONSTRAINT unique_email ON (u:User) ASSERT u.email IS UNIQUE
      // CREATE CONSTRAINT unique_username ON (u:User) ASSERT u.username IS UNIQUE
      return session
        .run(
          `CREATE (u:User) SET u += $args, u.id = randomUUID()
           RETURN u`,
          { args }
        )
        .then((res) => {
          session.close();
          const { id, username } = res.records[0].get("u").properties;
          console.log("returning jwt token ..");
          return {
            token: jwt.sign({ id, username }, process.env.JWT_SECRET, {
              expiresIn: "30d",
            }),
            id,
            username,
          };
        });
    },
    login: (obj, args, context, info) => {
      const session = context.driver.session();
      return session
        .run(
          `
          MATCH (u:User)
          WHERE u.username = $username OR u.email = $username
          RETURN u LIMIT 1`,
          { username: args.username }
        )
        .then((res) => {
          session.close();
          const { id, username, password } = res.records[0].get("u").properties;
          if (!bcrypt.compareSync(args.password, password)) {
            throw new Error("Authorization Error");
          }
          return {
            token: jwt.sign({ id, username }, process.env.JWT_SECRET, {
              expiresIn: "30d",
            }),
            id,
            username,
          };
        });
    },
  },
};

const schema = makeAugmentedSchema({
  typeDefs,
  resolvers,
  config: {
    query: {
      exclude: ["User", "AuthToken"],
    },
    mutation: {
      exclude: ["User", "AuthToken"],
    },
  },
});

const driver = neo4j.driver(
  process.env.NEO4J_URI || "bolt://localhost:7687",
  neo4j.auth.basic(
    process.env.NEO4J_USER || "neo4j",
    process.env.NEO4J_PASSWORD || "neo4j"
  )
);

assertSchema({ schema, driver, debug: true });

const server = new ApolloServer({
  // context: { driver, neo4jDatabase: process.env.NEO4J_DATABASE },
  context: ({ req }) => {
    const token = req?.headers?.authorization?.slice(7);
    let userId;

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.id;
    }
    return {
      cypherParams: { userId },
      driver,
      neo4jDatabase: process.env.NEO4J_DATABASE,
    };
  },
  schema: schema,
  introspection: true,
  playground: true,
});

// Specify host, port and path for GraphQL endpoint
const port = process.env.GRAPHQL_SERVER_PORT || 4000;
const path = process.env.GRAPHQL_SERVER_PATH || "/graphql";
const host = process.env.GRAPHQL_SERVER_HOST || "0.0.0.0";

// server.listen(port, `${host}`, path).then(({ url }) => {
//   console.log(`GraphQL API ready at ${url}`);
// });

console.log(`${host}${path}`);

server.listen({ port, url: `${host}${path}` }).then(({ url }) => {
  console.log(`
  GraphQL API ready at ${url}
  Explore at https://studio.apollographql.com/dev
  `);
});
