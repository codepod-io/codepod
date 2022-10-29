import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { ApolloClient, InMemoryCache, gql } from "@apollo/client/core";

import Prisma from "@prisma/client";
import { loadOrCreateContainer } from "./spawner-docker";
const { PrismaClient } = Prisma;

const prisma = new PrismaClient();

const apollo_client = new ApolloClient({
  cache: new InMemoryCache({}),
  uri: process.env.PROXY_API_URL,
});

export function computeNamespace(pods, id: string) {
  let res: string[] = [];
  // if the pod is a pod, do not include its id
  if (pods[id].type !== "DECK") {
    id = pods[id].parentId;
  }
  while (id) {
    res.push(pods[id].name || id);
    id = pods[id].parentId;
  }
  return res.reverse().join("/");
}

async function pastePod({ id, parentId, index, column }) {
  // 1. just update the pod's parent to the new parent
  let pod = await prisma.pod.findFirst({
    where: {
      id,
    },
  });
  if (!pod) {
    throw new Error("Pod not exists.");
  }
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
    repo: async (_, { id }) => {
      const repo = await prisma.repo.findFirst({
        where: {
          id,
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
      // console.log("Returning repo", repo);
      return repo;
    },
    pod: async (_, { id }) => {
      return await prisma.pod.findFirst({
        where: {
          id: id,
        },
      });
    },
    getRuntimes: async () => {
      // TODO
      return [];
    },
  },
  Mutation: {
    signup: async (_, { id, email, password, firstname, lastname }) => {
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
    },
    updateUser: async (_, { email, firstname, lastname }, { userId }) => {
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
    },
    login: async (_, { email, password }) => {
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
    },
    createRepo: async (_, { id, name }, { userId }) => {
      if (!userId) throw Error("Unauthenticated");
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
        },
      });
      // create repo $name under userId
      const repo = await prisma.repo.create({
        data: {
          id,
          name,
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
    addPod: async (_, { repoId, parent, index, input }, { userId }) => {
      // make sure the repo is writable by this user
      if (!userId) throw new Error("Not authenticated.");
      // 1. find the repo
      const repo = await prisma.repo.findFirst({
        where: {
          id: repoId,
        },
        include: {
          owner: true,
        },
      });
      if (!repo) throw new Error("Repo not found");
      // check ownership
      if (repo.owner.id != userId) {
        throw new Error("You do not have access to the repo.");
      }
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

      let { id: podId } = input;
      const pod = await prisma.pod.create({
        data: {
          id: podId,
          ...input,
          // In case of [], create will throw an error. Thus I have to pass undefined.
          children: input.children.length > 0 ? input.children : undefined,
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

      return true;
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
    updatePod: async (_, { id, input }, { userId }) => {
      if (!userId) throw new Error("Not authenticated.");
      await ensurePodAccess({ id, userId });
      const pod = await prisma.pod.update({
        where: {
          id,
        },
        data: {
          ...input,
          parent:
            input.parent && input.parent !== "ROOT"
              ? {
                  connect: {
                    id: input.parent,
                  },
                }
              : undefined,
          children: {
            connect: input.children?.map((id) => ({ id })),
          },
        },
      });
      console.log("Updated pod", pod);
      return true;
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
      if (!pod) throw new Error("Pod not found");

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
    spawnRuntime: async (_, { sessionId }) => {
      // launch the kernel
      console.log("Spawning ");
      let url = `/${sessionId}`;
      console.log("spawning kernel");
      let zmq_host = `cpkernel_${sessionId}`;
      await loadOrCreateContainer(
        process.env.ZMQ_KERNEL_IMAGE,
        zmq_host,
        // "cpkernel1_hello_world-foo",
        "codepod"
      );
      console.log("spawning ws");
      let ws_host = `cpruntime_${sessionId}`;
      await loadOrCreateContainer(
        process.env.WS_RUNTIME_IMAGE,
        ws_host,
        // "cpruntime1_hello_world-foo",
        "codepod",
        [`ZMQ_HOST=${zmq_host}`]
      );
      console.log("adding route", url, ws_host);
      // add to routing table
      let res = await apollo_client.mutate({
        mutation: gql`
          mutation addRoute($url: String, $target: String) {
            addRoute(url: $url, target: $target)
          }
        `,
        variables: {
          url,
          // This 4020 is the WS listening port in WS_RUNTIME_IMAGE
          target: `${ws_host}:4020`,
        },
      });
      console.log(res);
      console.log("returning");
      // console.log("res", res);
      return true;
    },
    killRuntime: async (_, { url }) => {
      // kill the runtime server.
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
