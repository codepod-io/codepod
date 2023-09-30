import { t } from "./trpc";
import { z } from "zod";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

// nanoid v4 does not work with nodejs. https://github.com/ai/nanoid/issues/365
import { customAlphabet } from "nanoid/async";
import { lowercase, numbers } from "nanoid-dictionary";

import prisma from "@codepod/prisma";

import { ENV } from "./utils";

const nanoid = customAlphabet(lowercase + numbers, 20);

const me = t.procedure.query(async ({ ctx: { userId } }) => {
  if (!userId) throw Error("Unauthenticated");
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
    },
  });
  if (!user) throw Error("Authorization token is not valid");
  return user;
});

const signup = t.procedure
  .input(
    z.object({
      email: z.string(),
      password: z.string(),
      firstname: z.string(),
      lastname: z.string(),
    })
  )
  .mutation(async ({ input: { email, password, firstname, lastname } }) => {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    const user = await prisma.user.create({
      data: {
        id: await nanoid(),
        email,
        firstname,
        lastname,
        hashedPassword: hashed,
      },
    });
    return {
      token: jwt.sign({ id: user.id }, ENV.JWT_SECRET, {
        expiresIn: "30d",
      }),
    };
  });

const updateUser = t.procedure
  .input(
    z.object({ email: z.string(), firstname: z.string(), lastname: z.string() })
  )
  .mutation(
    async ({ input: { email, firstname, lastname }, ctx: { userId } }) => {
      if (!userId) throw Error("Unauthenticated");
      let user = await prisma.user.findFirst({
        where: {
          id: userId,
        },
      });
      if (!user) throw Error("User not found.");
      if (user.id !== userId) {
        throw new Error("You do not have access to the user.");
      }
      // do the udpate
      await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          firstname,
          lastname,
          email,
        },
      });
      return true;
    }
  );

const login = t.procedure
  .input(z.object({ email: z.string(), password: z.string() }))
  .mutation(async ({ input: { email, password } }) => {
    // FIXME findUnique seems broken https://github.com/prisma/prisma/issues/5071
    const user = await prisma.user.findFirst({
      where: {
        email,
      },
    });
    if (!user) throw Error(`User does not exist`);
    if (!user.hashedPassword) throw Error(`User does not have a password`);
    const match = await bcrypt.compare(password, user.hashedPassword!);
    if (!match) {
      throw Error(`Email and password do not match.`);
    } else {
      return {
        id: user.id,
        email: user.email,
        token: jwt.sign({ id: user.id }, ENV.JWT_SECRET, {
          expiresIn: "30d",
        }),
      };
    }
  });

const client = new OAuth2Client(ENV.GOOGLE_CLIENT_ID);

const loginWithGoogle = t.procedure
  .input(z.object({ idToken: z.string() }))
  .mutation(async ({ input: { idToken } }) => {
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: ENV.GOOGLE_CLIENT_ID, // Specify the CLIENT_ID of the app that accesses the backend
      // Or, if multiple clients access the backend:
      //[CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
    });
    const payload = ticket.getPayload();
    if (!payload) throw Error(`Invalid token`);
    // check if registered
    let user = await prisma.user.findFirst({
      where: {
        email: payload["email"]!,
      },
    });
    if (!user) {
      // create a new user
      user = await prisma.user.create({
        data: {
          id: await nanoid(),
          email: payload["email"]!,
          firstname: payload["given_name"]!,
          lastname: payload["family_name"]!,
        },
      });
    }
    if (!user) throw Error("User create failed.");
    // return a token
    return {
      id: user.id,
      email: user.email,
      token: jwt.sign({ id: user.id }, ENV.JWT_SECRET, {
        expiresIn: "30d",
      }),
    };
  });

export const userRouter = t.router({
  hello: t.procedure
    .input(z.string().nullish())
    .query(({ input, ctx }) => `hello ${input ?? ctx.userId ?? "world"}`),

  // The actual resolvers
  me,
  login,
  loginWithGoogle,
  signup,
  updateUser,
});
