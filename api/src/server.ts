import { WebSocketServer } from "ws";

import express from "express";
import http from "http";

import { ApolloServer, gql } from "apollo-server-express";
import jwt from "jsonwebtoken";

import jwks from "jwks-rsa";

import Prisma from "@prisma/client";

const { PrismaClient } = Prisma;

const prisma = new PrismaClient();

import {
  ApolloServerPluginLandingPageProductionDefault,
  ApolloServerPluginLandingPageLocalDefault,
} from "apollo-server-core";

import { typeDefs } from "./typedefs";
import { resolvers } from "./resolver";

interface TokenInterface {
  sub: string;
}

const client = jwks({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, function (error, key) {
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

async function isTokenValid(token) {
  if (token) {
    const bearerToken = token.split(" ");

    const result = new Promise((resolve, reject) => {
      jwt.verify(
        bearerToken[1],
        getKey,
        {
          audience: process.env.API_IDENTIFIER,
          issuer: `https://${process.env.AUTH0_DOMAIN}/`,
          algorithms: ["RS256"],
        },
        (error, decoded) => {
          if (error) {
            resolve({ error });
          }
          if (decoded) {
            resolve({ decoded });
          }
        }
      );
    });

    return result;
  }

  return { error: "No token provided" };
}

async function startServer() {
  const apollo = new ApolloServer({
    typeDefs,
    resolvers,
    context: async ({ req }) => {
      const token = req?.headers?.authorization;
      if (!token) return {};
      const { error, decoded } = (await isTokenValid(token)) as {
        error: string;
        decoded: jwt.JwtPayload;
      };

      if (error) {
        console.log("Error", error);
        return {};
      }
      let email = decoded["email"];
      let user = await prisma.user.findFirst({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
          },
        });
      }
      return {
        email,
      };
    },
    plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
  });
  const expapp = express();
  const http_server = http.createServer(expapp);
  const wss = new WebSocketServer({ server: http_server });
  // graphql api will be available at /graphql

  await apollo.start();
  apollo.applyMiddleware({ app: expapp });

  const port = process.env.PORT || 4000;
  http_server.listen({ port }, () => {
    console.log(`🚀 Server ready at http://localhost:${port}`);
  });
}

startServer();
