import Prisma from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const { PrismaClient } = Prisma;

const prisma = new PrismaClient();

export async function users(_, __, { userId }) {
  if (!userId) throw Error("Unauthenticated");
  const allUsers = await prisma.user.findMany();
  return allUsers;
}

export async function me(_, __, { userId }) {
  if (!userId) throw Error("Unauthenticated");
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
    },
  });
  if (!user) throw Error("Authorization token is not valid");
  return user;
}

export async function signup(_, { id, email, password, firstname, lastname }) {
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(password, salt);
  const user = await prisma.user.create({
    data: {
      id,
      email,
      firstname,
      lastname,
      hashedPassword: hashed,
    },
  });
  return {
    token: jwt.sign({ id: user.id }, process.env.JWT_SECRET as string, {
      expiresIn: "7d",
    }),
  };
}

export async function updateUser(
  _,
  { email, firstname, lastname },
  { userId }
) {
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

export async function login(_, { email, password }) {
  // FIXME findUnique seems broken https://github.com/prisma/prisma/issues/5071
  const user = await prisma.user.findFirst({
    where: {
      email,
    },
  });
  if (!user) throw Error(`User does not exist`);
  const match = await bcrypt.compare(password, user.hashedPassword);
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
