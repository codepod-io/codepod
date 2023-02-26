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

async function myRepos(_, __, { userId }) {
  if (!userId) throw Error("Unauthenticated");
  const repos = await prisma.repo.findMany({
    where: {
      owner: {
        id: userId,
      },
    },
    include: {
      UserRepoData: {
        where: {
          userId: userId,
        },
      },
    },
  });
  // Sort by last access time.
  repos.sort((a, b) => {
    if (a.UserRepoData.length > 0) {
      if (b.UserRepoData.length > 0) {
        return (
          b.UserRepoData[0].accessedAt.valueOf() -
          a.UserRepoData[0].accessedAt.valueOf()
        );
      }
      return -1;
    }
    return a.updatedAt.valueOf() - b.updatedAt.valueOf();
  });
  // Re-use updatedAt field (this is actually the lastviewed field).
  return repos.map((repo) => {
    return {
      ...repo,
      updatedAt:
        repo.UserRepoData.length > 0
          ? repo.UserRepoData[0].accessedAt
          : repo.updatedAt,
    };
  });
}

async function myCollabRepos(_, __, { userId }) {
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

async function updateUserRepoData({ userId, repoId }) {
  // FIXME I should probably rename this from query to mutation?
  //
  // update AccessTime field
  const repoData = await prisma.userRepoData.findFirst({
    where: {
      userId,
      repoId,
    },
  });
  if (!repoData) {
    await prisma.userRepoData.create({
      data: {
        id: await nanoid(),
        user: { connect: { id: userId } },
        repo: { connect: { id: repoId } },
      },
    });
  } else {
    await prisma.userRepoData.update({
      where: {
        id: repoData.id,
      },
      data: {
        dummyCount: { increment: 1 },
        // TODO I could also update accessedAt directly
        // accessedAt: new Date(),
      },
    });
  }
}

async function repo(_, { id }, { userId }) {
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
  await updateUserRepoData({ userId, repoId: id });
  return repo;
}

async function createRepo(_, { id, name, isPublic }, { userId }) {
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

async function getVisibility(_, { repoId }, { userId }) {
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

async function updateVisibility(_, { repoId, isPublic }, { userId }) {
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

async function updateRepo(_, { id, name }, { userId }) {
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

async function deleteRepo(_, { id }, { userId }) {
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

async function addCollaborator(_, { repoId, email }, { userId }) {
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

async function deleteCollaborator(_, { repoId, collaboratorId }, { userId }) {
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

async function updatePod(_, { id, repoId, input }, { userId }) {
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
  // or, return false and leave it dirty
  if (!pod_found) return false;
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
  return true;
}

async function addPods(_, { repoId, pods }, { userId }) {
  if (!userId) throw new Error("Not authenticated.");
  await ensureRepoEditAccess({ repoId, userId });
  // notice: we keep the field "children", "parent", "repo" empty when first insertion the repo. Because if we insist on filling them, we must specify children, parent and repo by prisma.create.pod. Regardless of what order we insert them, we can't make sure both children and parent exist in the DB, the insertion must fail.
  // Here, we first insert all pods and ignore their any relationship, then the relationship will be updated by updateAllPods because we don't clean the dirty tag of them next.
  await prisma.pod.createMany({
    data: pods.map((pod) => {
      const res = { ...pod, id: pod.id, index: 0, parent: undefined, repoId };
      if (res.children) delete res.children;
      return res;
    }),
  });

  return true;
}

async function deletePod(_, { id, toDelete }, { userId }) {
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

export default {
  Query: {
    myRepos,
    repo,
    myCollabRepos,
    getVisibility,
  },
  Mutation: {
    addPods,
    createRepo,
    updateRepo,
    deleteRepo,
    updatePod,
    deletePod,
    addCollaborator,
    updateVisibility,
    deleteCollaborator,
  },
};
