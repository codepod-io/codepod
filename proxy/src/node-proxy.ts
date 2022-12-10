// A Configurable node-http-proxy
//
//
// Part of the code is from https://github.com/jupyterhub/configurable-http-proxy
// Original copyright & License information:
//
// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import httpProxy from "http-proxy";
import http from "http";

import express from "express";

import { ApolloServer } from "apollo-server-express";

import { gql } from "apollo-server";

import {
  ApolloServerPluginLandingPageProductionDefault,
  ApolloServerPluginLandingPageLocalDefault,
} from "apollo-server-core";

// Trie

function trimPrefix(prefix) {
  // cleanup prefix form: /foo/bar
  // ensure prefix starts with /
  if (prefix.length === 0 || prefix[0] !== "/") {
    prefix = "/" + prefix;
  }
  // ensure prefix *doesn't* end with / (unless it's exactly /)
  if (prefix.length > 1 && prefix[prefix.length - 1] === "/") {
    prefix = prefix.substr(0, prefix.length - 1);
  }
  return prefix;
}

var _slashesRe = /^[/]+|[/]+$/g;
function stringToPath(s) {
  // turn a /prefix/string/ into ['prefix', 'string']
  s = s.replace(_slashesRe, "");
  if (s.length === 0) {
    // special case because ''.split() gives [''], which is wrong.
    return [];
  } else {
    return s.split("/");
  }
}

class URLTrie {
  prefix;
  branches;
  size;
  data;

  constructor(prefix?) {
    this.prefix = trimPrefix(prefix || "/");
    this.branches = {};
    this.size = 0;
  }
  add(path, data) {
    // add data to a node in the trie at path
    if (typeof path === "string") {
      path = stringToPath(path);
    }
    if (path.length === 0) {
      this.data = data;
      return;
    }
    var part = path.shift();
    if (!Object.prototype.hasOwnProperty.call(this.branches, part)) {
      // join with /, and handle the fact that only root ends with '/'
      var prefix = this.prefix.length === 1 ? this.prefix : this.prefix + "/";
      this.branches[part] = new URLTrie(prefix + part);
      this.size += 1;
    }
    this.branches[part].add(path, data);
  }

  remove(path) {
    // remove `path` from the trie
    if (typeof path === "string") {
      path = stringToPath(path);
    }
    if (path.length === 0) {
      // allow deleting root
      delete this.data;
      return;
    }
    var part = path.shift();
    var child = this.branches[part];
    if (child === undefined) {
      // Requested node doesn't exist,
      // consider it already removed.
      return;
    }
    child.remove(path);
    if (child.size === 0 && child.data === undefined) {
      // child has no branches and is not a leaf
      delete this.branches[part];
      this.size -= 1;
    }
  }
  get(path) {
    // get the data stored at a matching prefix
    // returns:
    // {
    //  prefix: "/the/matching/prefix",
    //  data: {whatever: "was stored by add"}
    // }

    // if I have data, return me, otherwise return undefined
    var me = this.data === undefined ? undefined : this;

    if (typeof path === "string") {
      path = stringToPath(path);
    }
    if (path.length === 0) {
      // exact match, it's definitely me!
      return me;
    }
    var part = path.shift();
    var child = this.branches[part];
    if (child === undefined) {
      // prefix matches, and I don't have any more specific children
      return me;
    } else {
      // I match and I have a more specific child that matches.
      // That *does not* mean that I have a more specific *leaf* that matches.
      var node = child.get(path);
      if (node) {
        // found a more specific leaf
        return node;
      } else {
        // I'm still the most specific match
        return me;
      }
    }
  }
}

// MemoryStore
class MemoryStore {
  routes;
  urls;

  constructor() {
    this.routes = {};
    this.urls = new URLTrie();
  }

  get(path) {
    return Promise.resolve(this.routes[this.cleanPath(path)]);
  }

  getTarget(path) {
    return Promise.resolve(this.urls.get(path));
  }

  getAll() {
    return Promise.resolve(this.routes);
  }

  cleanPath(path) {
    return trimPrefix(path);
  }

  add(path, data) {
    path = this.cleanPath(path);
    this.routes[path] = data;
    this.urls.add(path, data);
    return Promise.resolve(null);
  }

  update(path, data) {
    Object.assign(this.routes[this.cleanPath(path)], data);
  }

  remove(path) {
    path = this.cleanPath(path);
    var route = this.routes[path];
    delete this.routes[path];
    this.urls.remove(path);
    return Promise.resolve(route);
  }
}

// Proxy

const _routes = new MemoryStore();

function parseHost(req) {
  var host = req.headers.host;
  if (host) {
    host = host.split(":")[0];
  }
  return host;
}

async function getRouteTarget(req) {
  // return proxy target for a given url path
  // FIXME what's this?
  var hostRouting = true;
  // var basePath = hostRouting ? "/" + parseHost(req) : "";
  // console.log(basePath);
  // var path = basePath + decodeURIComponent(new URL(req.url).pathname);
  var route = await _routes.getTarget(req.url);
  if (route) {
    return {
      prefix: route.prefix,
      target: route.data,
    };
  }
  return null;
}

// In memory store for active routes.
const activeTable: Record<string, Date> = {};

async function startAPIServer() {
  const apollo = new ApolloServer({
    typeDefs: gql`
      type RouteInfo {
        url: String
        lastActive: String
      }
      type Query {
        getUrls: [RouteInfo]
        getRoute(url: String): String
      }

      type Mutation {
        addRoute(url: String, target: String): Boolean
        deleteRoute(url: String): Boolean
      }
    `,
    resolvers: {
      Query: {
        getUrls: async () => {
          // return all routes
          const res = await _routes.getAll();
          let urls = Object.keys(res);
          return urls.map((url) => ({
            url: url,
            lastActive: activeTable[url],
          }));
        },
        getRoute: async (_, { url }) => {
          return await _routes.get(url);
        },
      },
      Mutation: {
        addRoute: async (_, { url, target }) => {
          console.log("Add route", url, target);
          try {
            await _routes.add(url, target);
            return true;
          } catch (error) {
            console.log("=== Error", error);
            return false;
          }
        },
        deleteRoute: async (_, { url }) => {
          console.log("Delete route", url);
          await _routes.remove(url);
          if (activeTable[url]) {
            delete activeTable[url];
          }
          return true;
        },
      },
    },
    plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
  });
  const expapp = express();
  const http_server = http.createServer(expapp);
  // graphql api will be available at /graphql

  await apollo.start();
  apollo.applyMiddleware({ app: expapp });

  const port = process.env.API_PORT || 4011;
  http_server.listen({ port }, () => {
    console.log(`🚀 API server ready at http://localhost:${port}`);
  });
}

function startProxyServer() {
  const proxy = httpProxy.createProxyServer({ ws: true });
  const server = http.createServer(async (req, res) => {
    console.log("proxy http req");
    let match = await getRouteTarget(req);
    if (!match) {
      res.writeHead(404);
      res.end();
      return;
    }
    // proxy.web(req, res, { target: "http://127.0.0.1:9000" });
    proxy.web(req, res, { target: `http://${match.target}` }, function (error) {
      console.log("==Error", error);
    });
  });

  server.on("upgrade", async (req, socket, head) => {
    if (!req.url) {
      return;
    }
    console.log("proxy ws req", req.url);
    // FIXME why there're two leading slashes? "//user_xxx_repo_xxx"
    activeTable[req.url.substring(1)] = new Date();
    let match = await getRouteTarget(req);
    if (!match) {
      return;
    }
    console.log("target", `http://${match.target}`);
    // proxy.ws(req, socket, head, { target: "ws://127.0.0.1:9000" });
    proxy.ws(
      req,
      socket,
      head,
      { target: `http://${match.target}` },
      function (error) {
        console.log("== Error", error);
      }
    );
  });

  const PROXY_PORT = process.env.PROXY_PORT || 4010;
  console.log(`Proxy server listening on http://localhost:${PROXY_PORT}.`);
  server.listen(PROXY_PORT);
}

function startWebServer() {
  //
  // Create your proxy server and set the target in the options.
  //
  // httpProxy.createProxyServer({ target: "http://localhost:9000" }).listen(8000); // See (†)

  //
  // Create your target server
  //
  const WEB_PORT = process.env.WEB_PORT || 4012;
  // _routes.add("/", { target: "http://127.0.0.1:9000" });
  _routes.add("/test", `http://localhost:${WEB_PORT}`);
  // Now http://localhost:4010/test should redirect to localhost:4012 and show some response.
  console.log(`Demo web server listenning on http://localhost:${WEB_PORT}`);
  http
    .createServer(function (req, res) {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.write(
        "request successfully proxied!" + "\n" + JSON.stringify(req.headers)
      );
      res.end();
    })
    .listen(WEB_PORT);
}

startAPIServer();
startProxyServer();
startWebServer();
