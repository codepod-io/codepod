import { WebSocketServer } from "ws";

import express from "express";
import http from "http";

import { ApolloServer, gql } from "apollo-server-express";
import jwt from "jsonwebtoken";

import {
  ApolloServerPluginLandingPageProductionDefault,
  ApolloServerPluginLandingPageLocalDefault,
} from "apollo-server-core";

const { OAuthApp, createNodeMiddleware } = require("octokit");

import { typeDefs } from "./typedefs";
import { resolvers } from "./resolver";

const github_oauth_app = new OAuthApp({
  clientType: "oauth-app",
  clientId: "<CLIENT_ID>",
  clientSecret: "<CLIENT_SECRET>",
});

interface TokenInterface {
  id: string;
}

async function startServer() {
  const apollo = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => {
      const token = req?.headers?.authorization?.slice(7);
      let userId;

      if (token) {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET as string
        ) as TokenInterface;
        userId = decoded.id;
      }
      return {
        userId,
      };
    },
    plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
  });
  const expapp = express();
  // The default login url is /api/oauth/login
  // Well, for standalone server pkg, it's /api/github/oauth/login
  // The default callback url is /api/github/oauth/callback
  // expapp.use(createNodeMiddleware(github_oauth_app));

  expapp.use((req, res, next) => {
    console.log("Time:", Date.now());
    // console.log("req", req);
    console.log("req.url", req.url);
    console.log("req.query", req.query);
    const { pathname } = new URL(req.url as string, "http://localhost");

    // my own middleware to handle github oauth
    if (pathname === "/api/github/oauth/login") {
      console.log("=== logging in");
      const { url } = github_oauth_app.getWebFlowAuthorizationUrl({
        state: req.query.state,
        scopes: ["repo"],
        // redirectUrl: "/api/github/oauth/callback",
        // scopes: req.query.scopes
        //   ? (req.query.scopes as string).split(",")
        //   : undefined,
        // allowSignup: req.query.allowSignup
        //   ? req.query.allowSignup === "true"
        //   : undefined,
        // redirectUrl: req.query.redirectUrl,
      });
      console.log("redirecting to url", url);
      res.redirect(url);
      console.log("after redicting ..");
    } else if (pathname === "/api/github/oauth/callback") {
      console.log("=== callback");
      github_oauth_app
        .createToken({
          code: req.query.code,
          state: req.query.state,
        })
        .then((response) => {
          console.log(response);
          // TODO write the token to database
          // TODO authenticate so that we know where to write the token
          res
            .header("hebi", response.authentication.token)
            .redirect(`/profile?token=${response.authentication.token}`);
          // TODO how to show success indicator on the front-end?
          // res.redirect("/profile");
          // send the token to the front-end
          // res.send(response.authentication.token);
        })
        .catch((error) => {
          console.log(error);
          // res.redirect(`/?error=${error}`);
          // TODO how to show error indicator on the front-end?
          res.redirect("/profile");
        });
    } else {
      next();
    }
  });
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
