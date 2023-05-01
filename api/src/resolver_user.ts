import Prisma from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

// nanoid v4 does not work with nodejs. https://github.com/ai/nanoid/issues/365
import { customAlphabet } from "nanoid/async";
import { lowercase, numbers } from "nanoid-dictionary";

const nanoid = customAlphabet(lowercase + numbers, 20);

const { PrismaClient } = Prisma;

const prisma = new PrismaClient();

async function me(_, __, { userId }) {
  if (!userId) throw Error("Unauthenticated");
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
    },
  });
  if (!user) throw Error("Authorization token is not valid");
  return user;
}

async function signup(_, { email, password, firstname, lastname }) {
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
    token: jwt.sign({ id: user.id }, process.env.JWT_SECRET as string, {
      expiresIn: "30d",
    }),
  };
}

/**
 * Create a guest user and return a token. The guest user doesn't have a password or email.
 */
async function signupGuest(_, {}) {
  const id = await nanoid();
  const user = await prisma.user.create({
    data: {
      id: id,
      email: id + "@example.com",
      firstname: "Guest",
      lastname: "Guest",
      isGuest: true,
    },
  });
  return {
    // CAUTION the front-end should save the user ID so that we can login again after expiration.
    token: jwt.sign({ id: user.id }, process.env.JWT_SECRET as string, {
      expiresIn: "30d",
    }),
  };
}

/**
 * Login a user with a guest ID and no password.
 */
async function loginGuest(_, {id}) {
  const user = await prisma.user.findFirst({
    where: {
      id,
      isGuest: true,
    }
  });
  if (!user) throw Error(`User does not exist`);
  return {
    id: user.id,
    email: user.email,
    token: jwt.sign({ id: user.id }, process.env.JWT_SECRET as string, {
      expiresIn: "30d",
    }),
  };
}

async function updateUser(_, { email, firstname, lastname }, { userId }) {
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

async function login(_, { email, password }) {
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
      token: jwt.sign({ id: user.id }, process.env.JWT_SECRET as string, {
        expiresIn: "30d",
      }),
    };
  }
}

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function loginWithGoogle(_, { idToken }) {
  const ticket = await client.verifyIdToken({
    idToken: idToken,
    audience: process.env.GOOGLE_CLIENT_ID, // Specify the CLIENT_ID of the app that accesses the backend
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
    token: jwt.sign({ id: user.id }, process.env.JWT_SECRET as string, {
      expiresIn: "30d",
    }),
  };
}

export default {
  Query: {
    me,
  },
  Mutation: {
    login,
    loginWithGoogle,
    signup,
    updateUser,
    signupGuest,
    loginGuest,
  },
};
