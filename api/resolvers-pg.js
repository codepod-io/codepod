import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import NodeGit from "nodegit";
import * as child from "child_process";
import fs from "fs";
import util from "util";

import Prisma from "@prisma/client";
const { PrismaClient } = Prisma;

const prisma = new PrismaClient();

import { listMySessions, killSession } from "./socket.js";

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

async function gitCommit({ username, reponame, content, msg }) {
  // 1. if repo does not exist, create it
  let path = `/srv/git/${username}/${reponame}`;
  if (!fs.existsSync(path)) {
    await NodeGit.Repository.init(path, 0);
  }
  // 2. write file
  await fs.promises.writeFile(`${path}/code.txt`, content);
  // 3. git add file
  const exec = util.promisify(child.exec);
  await exec(`cd ${path} && git add .`);
  // 3. run git diff HEAD
  // FIXME error handling
  // FIXME if no commit, this will fail
  // let { stdout, stderr } = await exec(`cd ${path} && git diff HEAD`);
  // return stdout;
  // 4. do commit
  await exec(`cd ${path} && git commit -m "${msg}"`);
  return true;
}

async function gitGetHead({ username, reponame }) {
  // FIXME for now I'll just get the file, because I'll always add and commit at
  // the same time.
  let path = `/srv/git/${username}/${reponame}`;
  if (!fs.existsSync(`${path}/code.txt`)) {
    return "";
  }
  let content = await fs.promises.readFile(`${path}/code.txt`);
  return content.toString();
}

export const resolvers = {
  Query: {
    hello: () => {
      return "Hello world!";
    },
    users: async (_, __, { userId }) => {
      if (!userId) throw Error("Unauthenticated");
      const allUsers = await prisma.user.findMany();
      return allUsers;
    },
    me: async (_, __, { userId }) => {
      if (!userId) throw Error("Unauthenticated");
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
        },
      });
      if (!user) throw Error("Authorization token is not valid");
      return user;
    },
    repos: async () => {
      const repos = await prisma.repo.findMany({
        include: {
          owner: true,
        },
      });
      return repos;
    },
    myRepos: async (_, __, { userId }) => {
      if (!userId) throw Error("Unauthenticated");
      const repos = await prisma.repo.findMany({
        where: {
          owner: {
            id: userId,
          },
        },
      });
      return repos;
    },
    activeSessions: async (_, __, { userId }) => {
      // I could just use userId
      // how to connect to the socket runtime?
      //
      // FIXME why this could be null
      if (!userId) throw new Error("Not authenticated.");
      console.log("activeSessions", userId);
      let user = await prisma.user.findFirst({
        where: {
          id: userId,
        },
      });
      console.log("username:", user.username);
      let sessions = listMySessions(user.username);
      return sessions;
    },
    repo: async (_, { name, username }) => {
      const repo = await prisma.repo.findFirst({
        where: {
          name: name,
          owner: {
            username: username,
          },
        },
        include: {
          owner: true,
          pods: {
            include: {
              children: true,
              parent: true,
            },
            orderBy: {
              index: "asc",
            },
          },
        },
      });
      return repo;
    },
    pod: async (_, { id }) => {
      return await prisma.pod.findFirst({
        where: {
          id: id,
        },
      });
    },
    // get diff from repo
    // getDiff: async (_, {}) => {},
    // get the HEAD commit
    gitGetHead: async (_, { username, reponame }, { userId }) => {
      if (!userId) throw Error("Unauthenticated");
      return await gitGetHead({ username, reponame });
    },
  },
  Mutation: {
    signup: async (_, { username, email, password, invitation }) => {
      if (invitation !== "CPFOUNDERS") {
        console.log("Invalid signup with invalid code", invitation);
        throw Error(`Invalid signup with invalid code: ${invitation}`);
      }
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(password, salt);
      const user = await prisma.user.create({
        data: {
          username,
          email,
          hashedPassword: hashed,
        },
      });
      return {
        token: jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
          expiresIn: "7d",
        }),
      };
    },
    // add file to git and run git add, and do commit
    gitCommit: async (_, { username, reponame, content, msg }, { userId }) => {
      // TODO commit with specific user name and email
      if (!userId) throw Error("Unauthenticated");
      let user = await prisma.user.findFirst({
        where: {
          username,
        },
      });
      if (user.id !== userId) {
        throw new Error("You do not have access to the repo.");
      }
      return await gitCommit({ username, reponame, content, msg });
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
          token: jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
            expiresIn: "30d",
          }),
        };
      }
    },
    createRepo: async (_, { name }, { userId }) => {
      if (!userId) throw Error("Unauthenticated");
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
        },
      });
      // create repo $name under userId
      const repo = await prisma.repo.create({
        data: {
          name: name,
          owner: {
            connect: {
              id: userId,
            },
          },
        },
        include: {
          owner: true,
        },
      });
      return repo;
    },
    deleteRepo: async (_, { name }, { userId }) => {
      if (!userId) throw Error("Unauthenticated");
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
        },
      });
      const repo = await prisma.repo.findFirst({
        where: {
          name,
          owner: {
            id: userId,
          },
        },
      });
      if (!repo) throw new Error("Repo not found");
      // 1. delete all pods
      await prisma.pod.deleteMany({
        where: {
          repo: {
            id: repo.id,
          },
        },
      });
      await prisma.repo.delete({
        where: {
          id: repo.id,
        },
      });
      return true;
    },
    clearUser: () => {},
    addPod: async (
      _,
      { reponame, username, parent, index, input },
      { userId }
    ) => {
      // make sure the repo is writable by this user
      if (!userId) throw new Error("Not authenticated.");
      let user = await prisma.user.findFirst({
        where: {
          username,
        },
      });
      if (user.id !== userId) {
        throw new Error("You do not have access to the repo.");
      }
      let { id } = input;
      // 1. find the repo
      const repo = await prisma.repo.findFirst({
        where: {
          name: reponame,
          owner: {
            username: username,
          },
        },
      });
      // update all other records
      await prisma.pod.updateMany({
        where: {
          repo: {
            id: repo.id,
          },
          index: {
            gte: index,
          },
          parent:
            parent === "ROOT"
              ? null
              : {
                  id: parent,
                },
        },
        data: {
          index: {
            increment: 1,
          },
        },
      });

      const pod = await prisma.pod.create({
        data: {
          id,
          ...input,
          index,
          repo: {
            connect: {
              id: repo.id,
            },
          },
          parent:
            parent === "ROOT"
              ? undefined
              : {
                  connect: {
                    id: parent,
                  },
                },
        },
      });

      return pod;
    },
    pastePod: async (_, { id, parentId, index, column }) => {
      // 1. just update the pod's parent to the new parent
      let pod = await prisma.pod.findFirst({
        where: {
          id,
        },
      });
      // 2. decrease current index
      await prisma.pod.updateMany({
        where: {
          // FIXME root?
          parentId: pod.parentId,
          index: {
            gt: pod.index,
          },
        },
        data: {
          index: {
            decrement: 1,
          },
        },
      });
      if (pod.parentId === parentId) {
        index -= 1;
      }
      // 3. increase for new parent's children's index
      await prisma.pod.updateMany({
        where: {
          parentId: parentId,
          index: {
            gte: index,
          },
        },
        data: {
          index: {
            increment: 1,
          },
        },
      });
      // update itself: parent, index
      await prisma.pod.update({
        where: {
          id,
        },
        data: {
          parent: {
            connect: {
              id: parentId,
            },
          },
          index,
          column,
        },
      });
      return true;
    },
    updatePod: async (
      _,
      {
        id,
        content,
        column,
        type,
        lang,
        result,
        stdout,
        error,
        imports,
        exports,
        midports,
      },
      { userId }
    ) => {
      if (!userId) throw new Error("Not authenticated.");
      await ensurePodAccess({ id, userId });
      const pod = await prisma.pod.update({
        where: {
          id,
        },
        data: {
          content,
          column,
          type,
          lang,
          result,
          stdout,
          error,
          imports,
          exports,
          midports,
        },
      });
      return pod;
    },
    deletePod: async (_, { id, toDelete }, { userId }) => {
      if (!userId) throw new Error("Not authenticated.");
      await ensurePodAccess({ id, userId });
      // find all children of this ID
      // FIXME how to ensure atomic
      // 1. find the parent of this node
      const pod = await prisma.pod.findFirst({
        where: {
          id: id,
        },
        include: {
          parent: true,
        },
      });

      // 4. update all siblings index
      await prisma.pod.updateMany({
        where: {
          // CAUTION where to put null is tricky
          parent: pod.parent
            ? {
                id: pod.parent.id,
              }
            : null,
          index: {
            gt: pod.index,
          },
        },
        data: {
          index: {
            decrement: 1,
          },
        },
      });
      // 5. delete it and all its children
      await prisma.pod.deleteMany({
        where: {
          id: {
            in: toDelete,
          },
        },
      });
      return true;
    },
    killSession: async (_, { sessionId }, { userId }) => {
      if (!userId) throw new Error("Not authenticated.");
      console.log("killSession", sessionId);
      // FIXME errors
      await killSession(sessionId);
      return true;
    },
  },
};

async function ensurePodAccess({ id, userId }) {
  let pod = await prisma.pod.findFirst({
    where: { id },
    // HEBI: select is used to select a subset of fields
    // select: {
    //   repo: {
    //     select: {
    //       owner: true,
    //     },
    //   },
    // },
    // HEBI: include is used to include additional fields
    // Both include and select can go through relations, but they cannot be used
    // at the same time.
    include: {
      repo: {
        include: {
          owner: true,
        },
      },
    },
  });
  if (pod.repo.owner.id !== userId) {
    throw new Error("You do not have write access.");
  }
}
