import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import Prisma from "@prisma/client";
const { PrismaClient } = Prisma;

const prisma = new PrismaClient();

// import { User, Repo, Pod } from "./db.js";

function genToken(userID) {
  const token = jwt.sign(
    {
      data: userID,
    },
    "mysuperlongsecretkey",
    {
      expiresIn: "1d",
    }
  );
  return token;
}

export const resolvers = {
  Query: {
    hello: () => {
      return "Hello world!";
    },
    users: async () => {
      console.log("Finding users ..");
      const allUsers = await prisma.user.findMany();
      return allUsers;
      //   return User.find((err, users) => {
      //     if (err) return console.log(err);
      //   });
    },
    repos: () => {},
    repo: (_, { name }) => {},
    pods: (_, reponame) => {},
  },
  Mutation: {
    signup: async (_, { username, email, password, name }) => {
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(password, salt);
      const user = await prisma.user.create({
        data: {
          username,
          email,
          hashedPassword: hashed,
          name,
        },
      });
      return {
        token: jwt.sign(
          { id: user.id, username: user.username },
          process.env.JWT_SECRET,
          {
            expiresIn: "7d",
          }
        ),
      };
    },
    login: async (_, { username, password }) => {
      // FIXME findUnique seems broken https://github.com/prisma/prisma/issues/5071
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ username: username }, { email: username }],
        },
      });
      if (!user) throw Error(`User does not exist`);
      const match = await bcrypt.compare(password, user.hashedPassword);
      if (!match) {
        throw Error(`Email and password do not match.`);
      } else {
        return {
          id: user.id,
          username: user.usernaame,
          token: jwt.sign({ id: user.id, username }, process.env.JWT_SECRET, {
            expiresIn: "30d",
          }),
        };
      }
    },
    createRepo: (_, { name }) => {},
    clearUser: () => {},
    createPod: (_, { reponame, name, content, parent, index }) => {},
  },
};
