import { z } from "zod";
import { inferAsyncReturnType, initTRPC } from "@trpc/server";
import * as trpcExpress from "@trpc/server/adapters/express";
import jwt from "jsonwebtoken";

import { ENV } from "./utils";

import { userRouter } from "./resolver_user";
import { repoRouter } from "./resolver_repo";

// created for each request
const createContext = ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) => {
  const token = req?.headers?.authorization?.slice(7);
  let userId;

  console.log("in context", token);

  if (token) {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as {
      id: string;
    };
    userId = decoded.id;
  }
  return {
    userId,
  };
}; // no context

type Context = inferAsyncReturnType<typeof createContext>;
export const t = initTRPC.context<Context>().create();
// export const t = initTRPC.create();

export const appRouter = t.router({
  hello: t.procedure
    .input(z.string().nullish())
    .query(({ input, ctx }) => `hello ${input ?? ctx.userId ?? "world"}`),
  getUser: t.procedure.input(z.string()).query((opts) => {
    opts.input; // string
    return { id: opts.input, name: "Bilbo" };
  }),
  createUser: t.procedure
    .input(z.object({ name: z.string().min(5) }))
    .mutation(async (opts) => {
      // use your ORM of choice
      // return await UserModel.create({
      //   data: opts.input,
      // });
    }),
  user: userRouter,
  repo: repoRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

export const expressMiddleware = trpcExpress.createExpressMiddleware({
  router: appRouter,
  createContext,
});
