import Prisma from "@prisma/client";
// nanoid v4 does not work with nodejs. https://github.com/ai/nanoid/issues/365
import { customAlphabet } from "nanoid/async";
import { lowercase, numbers } from "nanoid-dictionary";

const nanoid = customAlphabet(lowercase + numbers, 20);
const { PrismaClient } = Prisma;

const prisma = new PrismaClient();

async function ensureRepoEditAccess({ repoId, userId }) {
  let repo = await prisma.repo.findFirst({
    where: {
      id: repoId,
      OR: [
        { owner: { id: userId || "undefined" } },
        { collaborators: { some: { id: userId || "undefined" } } },
      ],
    },
  });
  if (!repo) {
    // this might be caused by creating a pod and update it too soon before it
    // is created on server, which is a time sequence bug
    throw new Error("Repo not exists.");
  }
}

async function ensurePodEditAccess({ id, userId }) {
  let pod = await prisma.pod.findFirst({
    where: {
      id,
      repo: {
        OR: [
          { owner: { id: userId || "undefined" } },
          { collaborators: { some: { id: userId || "undefined" } } },
        ],
      },
    },
  });
  if (!pod) {
    // this might be caused by creating a pod and update it too soon before it
    // is created on server, which is a time sequence bug
    throw new Error("Pod not exists.");
  }
}

export async function repos() {
  throw new Error("Deprecated");
  const repos = await prisma.repo.findMany({
    include: {
      owner: true,
    },
  });
  return repos;
}

export async function myRepos(_, __, { userId }) {
  if (!userId) throw Error("Unauthenticated");
  const repos = await prisma.repo.findMany({
    where: {
      owner: {
        id: userId,
      },
    },
  });
  return repos;
}

export async function myCollabRepos(_, __, { userId }) {
  if (!userId) throw Error("Unauthenticated");
  const repos = await prisma.repo.findMany({
    where: {
      collaborators: {
        some: { id: userId },
      },
    },
  });
  return repos;
}

export async function repo(_, { id }, { userId }) {
  // a user can only access a private repo if he is the owner or a collaborator
  const repo = await prisma.repo.findFirst({
    where: {
      OR: [
        { id, public: true },
        { id, owner: { id: userId || "undefined" } },
        { id, collaborators: { some: { id: userId || "undefined" } } },
      ],
    },
    include: {
      owner: true,
      collaborators: true,
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
  if (!repo) throw Error("Repo not found");
  return repo;
}

export async function pod(_, { id }) {
  throw new Error("Deprecated");
  return await prisma.pod.findFirst({
    where: {
      id: id,
    },
  });
}

export async function createRepo(_, { id, name, isPublic }, { userId }) {
  if (!userId) throw Error("Unauthenticated");
  const repo = await prisma.repo.create({
    data: {
      id: await nanoid(),
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
}

export async function getVisibility(_, { repoId }, { userId }) {
  if (!userId) throw Error("Unauthenticated");
  const repo = await prisma.repo.findFirst({
    where: {
      id: repoId,
      owner: { id: userId || "undefined" },
    },
    include: {
      collaborators: true,
    },
  });
  if (!repo) throw Error("Repo not found");
  return { collaborators: repo.collaborators, isPublic: repo.public };
}

export async function updateVisibility(_, { repoId, isPublic }, { userId }) {
  if (!userId) throw Error("Unauthenticated");
  const repo = await prisma.repo.findFirst({
    where: {
      id: repoId,
      owner: { id: userId || "undefined" },
    },
  });
  if (!repo) throw Error("Repo not found");
  await prisma.repo.update({
    where: {
      id: repoId,
    },
    data: {
      public: isPublic,
    },
  });
  return true;
}

export async function updateRepo(_, { id, name }, { userId }) {
  if (!userId) throw Error("Unauthenticated");
  const repo = await prisma.repo.findFirst({
    where: {
      id,
      owner: {
        id: userId,
      },
    },
  });
  if (!repo) throw new Error("Repo not found");
  const updatedRepo = await prisma.repo.update({
    where: {
      id,
    },
    data: {
      name,
    },
  });
  return true;
}

export async function deleteRepo(_, { id }, { userId }) {
  if (!userId) throw Error("Unauthenticated");
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
    },
  });
  const repo = await prisma.repo.findFirst({
    where: {
      id,
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
}

export async function addCollaborator(_, { repoId, email }, { userId }) {
  // make sure the repo is writable by this user
  if (!userId) throw new Error("Not authenticated.");
  // 1. find the repo
  const repo = await prisma.repo.findFirst({
    where: {
      id: repoId,
      owner: { id: userId },
    },
    include: {
      collaborators: true,
    },
  });
  if (!repo) throw new Error("Repo not found or you are not the owner.");
  // 2. find the user
  const other = await prisma.user.findFirst({
    where: {
      email,
    },
  });
  if (!other) throw new Error("User not found");
  if (other.id === userId) throw new Error("You are already the owner.");
  if (repo.collaborators.findIndex((user) => user.id === other.id) !== -1)
    throw new Error("The user is already a collaborator.");
  // 3. add the user to the repo
  const res = await prisma.repo.update({
    where: {
      id: repoId,
    },
    data: {
      collaborators: { connect: { id: other.id } },
    },
  });
  return true;
}

export async function deleteCollaborator(
  _,
  { repoId, collaboratorId },
  { userId }
) {
  if (!userId) throw new Error("Not authenticated.");
  // 1. find the repo
  const repo = await prisma.repo.findFirst({
    where: {
      id: repoId,
      owner: { id: userId },
    },
  });
  // 2. delete the user from the repo
  if (!repo) throw new Error("Repo not found or you are not the owner.");
  const res = await prisma.repo.update({
    where: {
      id: repoId,
    },
    data: {
      collaborators: { disconnect: { id: collaboratorId } },
    },
  });
  return true;
}

export async function updatePod(_, { id, repoId, input }, { userId }) {
  if (!userId) throw new Error("Not authenticated.");
  await ensureRepoEditAccess({ repoId, userId });
  // if repoId has id, just update
  let pod_found = await prisma.pod.findFirst({
    where: {
      id,
      repo: {
        id: repoId,
      },
    },
  });
  if (pod_found) {
    // if repoId doesn't have id, create it IF input.parent exists
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
  } else {
    console.log(input);
    return false;
    // if repoId doesn't have id, create it IF input.parent exists, otherwise throw error.
    // await prisma.pod.create({
    //   data: {
    //     id,
    //     ...input,
    //     // Dummy index because it is a required field for historical reasons.
    //     index: 0,
    //     parent:
    //       input.parent && input.parent !== "ROOT"
    //         ? {
    //             connect: {
    //               id: input.parent,
    //             },
    //           }
    //         : undefined,
    //     // In case of [], create will throw an error. Thus I have to pass undefined.
    //     // children: input.children.length > 0 ? input.children : undefined,
    //     children: {
    //       connect: input.children?.map((id) => ({ id })),
    //     },
    //     repo: {
    //       connect: {
    //         id: repoId,
    //       },
    //     },
    //   },
    // });
  }

  return true;
}

export async function addPods(_, { repoId, pods }, { userId }) {
  if (!userId) throw new Error("Not authenticated.");
  await ensureRepoEditAccess({ repoId, userId });
  console.log("addPod", pods);
  pods.forEach(async (pod) => {
    await prisma.pod.create({
      data: {
        ...pod,
        id: pod.id,
        index: 0,
        parent: undefined,
        children: {
          connect: [],
        },
        repo: {
          connect: {
            id: repoId,
          },
        },
      },
    });
  });

  return true;
}

export async function deletePod(_, { id, toDelete }, { userId }) {
  if (!userId) throw new Error("Not authenticated.");
  await ensurePodEditAccess({ id, userId });
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
}
