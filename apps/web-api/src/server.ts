import express from "express";
import http from "http";

import { expressMiddleware } from "./trpc";

export async function startServer({ port }) {
  const expapp = express();
  expapp.use(express.json({ limit: "20mb" }));
  expapp.use("/trpc", expressMiddleware);
  const http_server = http.createServer(expapp);

  http_server.listen({ port }, () => {
    console.log(`🚀 Server ready at http://localhost:${port}`);
  });
}
