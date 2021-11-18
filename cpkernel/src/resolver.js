import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
// import NodeGit from "nodegit";
import * as child from "child_process";
import fs from "fs";
import util from "util";

import Prisma from "@prisma/client";
const { PrismaClient } = Prisma;

import fsp from "fs/promises";

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

async function pastePod({ id, parentId, index, column }) {
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
      parentId: parentId === "ROOT" ? null : parentId,
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
      parent:
        parentId === "ROOT"
          ? { disconnect: true }
          : {
              connect: {
                id: parentId,
              },
            },
      index,
      column,
    },
  });
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
      // if (!userId) throw Error("Unauthenticated");
      // const user = await prisma.user.findFirst({
      //   where: {
      //     id: userId,
      //   },
      // });
      // if (!user) throw Error("Authorization token is not valid");
      // return user;
      return {
        name: "local",
        id: "local",
        username: "local",
        email: "local",
      };
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
      const repos = await prisma.repo.findMany({});
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
        },
        include: {
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
    gitGetPods: async (_, { username, reponame }, { userId }) => {
      // Read a specific commit's files, and return a list of pods
      //
      // I should checkout to a temporary folder and checkout the commits
      // Also, I would like to show the staged content as well
      // So:
      // - HEAD
      // - Staged
      // - a specific commit
      if (!userId) throw Error("Unauthenticated");
      return await gitGetPods({ username, reponame, version: "HEAD" });
    },
    gitDiff: async (_, { username, reponame }, { userId }) => {
      if (!userId) throw Error("Unauthenticated");
      let user = await prisma.user.findFirst({
        where: {
          username,
        },
      });
      if (user.id !== userId) {
        throw new Error("You do not have access to the repo.");
      }
      // this mutates file system
      // DEBUG I'm trying to export unpon diff request
      // await prismaGitExport({ username, reponame });
      return await gitDiff({ reponame, username });
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
    updateUser: async (_, { username, email, name }, { userId }) => {
      if (!userId) throw Error("Unauthenticated");
      let user = await prisma.user.findFirst({
        where: {
          username,
        },
      });
      if (user.id !== userId) {
        throw new Error("You do not have access to the user.");
      }
      // do the udpate
      await prisma.user.update({
        where: {
          username,
        },
        data: {
          name,
          email,
        },
      });
      return true;
    },
    // add file to git and run git add, and do commit
    // gitCommit: async (_, { username, reponame, content, msg }, { userId }) => {
    //   // TODO commit with specific user name and email
    //   if (!userId) throw Error("Unauthenticated");
    //   let user = await prisma.user.findFirst({
    //     where: {
    //       username,
    //     },
    //   });
    //   if (user.id !== userId) {
    //     throw new Error("You do not have access to the repo.");
    //   }
    //   return await gitCommit({ username, reponame, content, msg });
    // },
    gitCommit: async (_, { username, reponame, msg }) => {
      // 1. update db
      // 2. TODO commit on FS. FIXME the DB only records content change, but the
      //    staged changes also include metadata.
      const repo = await prisma.repo.findFirst({
        where: {
          name: reponame,
          owner: {
            username: username,
          },
        },
      });
      // console.log("=== repo", JSON.stringify(repo, null, 2));
      const pods = await prisma.pod.findMany({
        where: {
          repo: {
            id: repo.id,
          },
        },
      });
      // get all the pods whose githead is different from staged
      // FIXME performance
      const staged_pods = pods.filter((pod) => pod.githead !== pod.staged);
      for (const pod of staged_pods) {
        await prisma.pod.updateMany({
          where: {
            id: pod.id,
          },
          data: {
            githead: pod.staged,
          },
        });
      }
      return gitJustCommit({ username, reponame, msg });
      // return true;
    },
    // gitImport: async (_, { username, reponame }, { userId }) => {
    //   // recover data for username and reponame from git repo
    //   if (!userId) throw Error("Unauthenticated");
    //   let user = await prisma.user.findFirst({
    //     where: {
    //       username,
    //     },
    //   });
    //   if (user.id !== userId) {
    //     throw new Error("You do not have access to the repo.");
    //   }
    //   // 1. read the pods
    //   // 2. read the rel.json
    //   // 3. store into DB
    //   // TODO add githead field in DB
    // },
    gitExport: async (_, { username, reponame }, { userId }) => {
      if (!userId) throw Error("Unauthenticated");
      let user = await prisma.user.findFirst({
        where: {
          username,
        },
      });
      if (user.id !== userId) {
        throw new Error("You do not have access to the repo.");
      }
      await prismaGitExport({ username, reponame });
      return true;
    },
    gitStage: async (_, { username, reponame, podId }) => {
      // 1. set pod.staged = pod.content
      // 2. TODO export to FS
      const pod = await prisma.pod.findUnique({
        where: {
          id: podId,
        },
      });
      await prisma.pod.update({
        where: {
          id: podId,
        },
        data: {
          staged: pod.content,
        },
      });
      await prismaGitExport({ username, reponame });
      return true;
    },
    gitStageMulti: async (_, { username, reponame, podIds }) => {
      // 1. set pod.staged = pod.content
      // 2. TODO export to FS
      for (const podId of podIds) {
        const pod = await prisma.pod.findUnique({
          where: {
            id: podId,
          },
        });
        await prisma.pod.update({
          where: {
            id: podId,
          },
          data: {
            staged: pod.content,
          },
        });
      }
      await prismaGitExport({ username, reponame });
      return true;
    },
    gitUnstage: async (_, { username, reponame, podId }) => {
      // 1. set pod.staged = pod.content
      // 2. TODO export to FS
      const pod = await prisma.pod.findUnique({
        where: {
          id: podId,
        },
      });
      await prisma.pod.update({
        where: {
          id: podId,
        },
        data: {
          staged: pod.githead,
        },
      });
      await prismaGitExport({ username, reponame });
      return true;
    },
    gitUnstageMulti: async (_, { username, reponame, podIds }) => {
      // 1. set pod.staged = pod.content
      // 2. TODO export to FS
      for (const podId of podIds) {
        const pod = await prisma.pod.findUnique({
          where: {
            id: podId,
          },
        });
        await prisma.pod.update({
          where: {
            id: podId,
          },
          data: {
            staged: pod.githead,
          },
        });
      }
      await prismaGitExport({ username, reponame });
      return true;
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
      // create repo $name under userId
      const repo = await prisma.repo.create({
        data: {
          name: name,
        },
      });
      return repo;
    },
    deleteRepo: async (_, { name }, { userId }) => {
      const repo = await prisma.repo.findFirst({
        where: {
          name,
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
      let { id } = input;
      // 1. find the repo
      const repo = await prisma.repo.findFirst({
        where: {
          name: reponame,
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

      // await prismaGitExport({ username, reponame });
      return pod;
    },
    pastePod: async (_, { id, parentId, index, column }) => {
      await pastePod({ id, parentId, index, column });
      return true;
    },
    pastePods: async (_, { ids, parentId, index, column }) => {
      for (let id of ids) {
        await pastePod({ id, parentId, index, column });
        index += 1;
      }
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
        fold,
        thundar,
        utility,
        name,
      },
      { userId }
    ) => {
      // if (!userId) throw new Error("Not authenticated.");
      // await ensurePodAccess({ id, userId });
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
          fold,
          thundar,
          utility,
          name,
          error,
          imports,
          exports,
          midports,
        },
      });
      return pod;
    },
    deletePod: async (_, { id, toDelete }, { userId }) => {
      // if (!userId) throw new Error("Not authenticated.");
      // await ensurePodAccess({ id, userId });
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
  if (!pod) {
    // this might be caused by creating a pod and update it too soon before it
    // is created on server, which is a time sequence bug
    throw new Error("Pod not exists.");
  }
  if (pod.repo.owner.id !== userId) {
    throw new Error("You do not have write access.");
  }
}
