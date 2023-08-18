// nanoid v4 does not work with nodejs. https://github.com/ai/nanoid/issues/365
import { customAlphabet } from "nanoid/async";
import { lowercase, numbers } from "nanoid-dictionary";
import prisma from "./client";

const nanoid = customAlphabet(lowercase + numbers, 20);

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

async function getDashboardRepos(_, __, { userId }) {
  if (!userId) throw Error("Unauthenticated");
  const repos = await prisma.repo.findMany({
    where: {
      OR: [
        {
          owner: {
            id: userId,
          },
        },
        {
          collaborators: {
            some: { id: userId },
          },
        },
      ],
    },
    include: {
      UserRepoData: {
        where: {
          userId: userId,
        },
      },
      stargazers: true,
    },
  });
  return repos.map((repo) => {
    return {
      ...repo,
      accessedAt:
        repo.UserRepoData.length > 0
          ? repo.UserRepoData[0].accessedAt
          : repo.updatedAt,
    };
  });
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
        user: { connect: { id: userId } },
        repo: { connect: { id: repoId } },
      },
    });
  } else {
    await prisma.userRepoData.updateMany({
      where: {
        user: { id: userId },
        repo: { id: repoId },
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
      edges: true,
    },
  });
  if (!repo) throw Error("Repo not found");
  await updateUserRepoData({ userId, repoId: id });
  return {
    ...repo,
    edges: repo.edges.map((edge) => ({
      source: edge.sourceId,
      target: edge.targetId,
    })),
  };
}

async function addEdge(_, { source, target }, { userId }) {
  if (!userId) throw new Error("Not authenticated.");
  const sourcePod = await prisma.pod.findFirst({ where: { id: source } });
  const targetPod = await prisma.pod.findFirst({ where: { id: target } });
  if (!sourcePod || !targetPod) throw new Error("Pods not found.");
  if (sourcePod.repoId !== targetPod.repoId)
    throw new Error("Pods are not in the same repo.");
  await ensureRepoEditAccess({ repoId: sourcePod.repoId, userId });
  await prisma.edge.create({
    data: {
      source: {
        connect: {
          id: source,
        },
      },
      target: {
        connect: {
          id: target,
        },
      },
      repo: {
        connect: {
          id: sourcePod.repoId,
        },
      },
    },
  });
  return true;
}

async function deleteEdge(_, { source, target }, { userId }) {
  if (!userId) throw new Error("Not authenticated.");
  const sourcePod = await prisma.pod.findFirst({ where: { id: source } });
  const targetPod = await prisma.pod.findFirst({ where: { id: target } });
  if (!sourcePod || !targetPod) throw new Error("Pods not found.");
  if (sourcePod.repoId !== targetPod.repoId)
    throw new Error("Pods are not in the same repo.");
  await ensureRepoEditAccess({ repoId: sourcePod.repoId, userId });
  await prisma.edge.deleteMany({
    where: {
      source: {
        id: source,
      },
      target: {
        id: target,
      },
    },
  });
  return true;
}

async function createRepo(_, {}, { userId }) {
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
  // only a repo owner can delete a repo.
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
  // 2. delete UserRepoData
  await prisma.userRepoData.deleteMany({
    where: {
      repo: {
        id: repo.id,
      },
    },
  });
  // 3. delete the repo itself
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

async function star(_, { repoId }, { userId }) {
  // make sure the repo is visible by this user
  if (!userId) throw new Error("Not authenticated.");
  let repo = await prisma.repo.findFirst({
    where: {
      id: repoId,
      OR: [
        { owner: { id: userId || "undefined" } },
        { collaborators: { some: { id: userId || "undefined" } } },
        { public: true },
      ],
    },
  });
  if (!repo) throw new Error("Repo not found.");
  // 3. add the user to the repo
  await prisma.repo.update({
    where: {
      id: repoId,
    },
    data: {
      stargazers: { connect: { id: userId } },
    },
  });
  return true;
}

async function unstar(_, { repoId }, { userId }) {
  if (!userId) throw new Error("Not authenticated.");
  // 1. find the repo
  const repo = await prisma.repo.findFirst({
    where: {
      id: repoId,
    },
  });
  // 2. delete the user from the repo
  if (!repo) throw new Error("Repo not found.");
  await prisma.repo.update({
    where: {
      id: repoId,
    },
    data: {
      stargazers: { disconnect: { id: userId } },
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
      parent: input.parent
        ? input.parent === "ROOT"
          ? { disconnect: true }
          : {
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

async function copyRepo(_, { repoId }, { userId }) {
  // Find the repo
  const repo = await prisma.repo.findFirst({
    where: {
      id: repoId,
    },
    include: {
      pods: {
        include: {
          parent: true,
        },
      },
    },
  });
  if (!repo) throw new Error("Repo not found");

  // Create a new repo
  const { id } = await createRepo(_, {}, { userId });
  // update the repo name
  await prisma.repo.update({
    where: {
      id,
    },
    data: {
      name: repo.name ? `Copy of ${repo.name}` : `Copy of ${repo.id}`,
    },
  });

  // Create new id for each pod
  const sourcePods = repo.pods;
  const idMap = await sourcePods.reduce(async (acc, pod) => {
    const map = await acc;
    const newId = await nanoid();
    map.set(pod.id, newId);
    return map;
  }, Promise.resolve(new Map()));

  // Update the parent/child relationship with their new ids
  const targetPods = sourcePods.map((pod) => {
    return {
      ...pod,
      id: idMap.get(pod.id),
      parent: pod.parent ? { id: idMap.get(pod.parent.id) } : undefined,
      repoId: id,
      parentId: pod.parentId ? idMap.get(pod.parentId) : undefined,
    };
  });

  // Add all nodes without parent/child relationship to the new repo.
  //
  // TODO: it updates the parent/child relationship automatically somehow,maybe
  // because the parentId? Try to figure out why, then refactor addPods method.
  await prisma.pod.createMany({
    data: targetPods.map((pod) => ({
      ...pod,
      id: pod.id,
      index: 0,
      parent: undefined,
    })),
  });

  return id;
}

/**
 * create yDoc snapshot upon request.
 */
async function addRepoSnapshot(_, { repoId, message }) {
  const repo = await prisma.repo.findFirst({
    where: { id: repoId },
    include: {
      owner: true,
      collaborators: true,
    },
  });
  if (!repo) throw Error("Repo not exists.");
  if (!repo.yDocBlob) throw Error(`yDocBlob on ${repoId} not found`);
  const snapshot = await prisma.yDocSnapshot.create({
    data: {
      id: await nanoid(),
      yDocBlob: repo.yDocBlob,
      message: message,
      repo: { connect: { id: repoId } },
    },
  });
  return snapshot.id;
}

/**
 * query yDoc snapshot for a repo.
 */
async function getRepoSnapshots(_, { repoId }) {
  const snapshots = await prisma.yDocSnapshot.findMany({
    where: { repo: { id: repoId } },
  });
  if (!snapshots) throw Error(`No snapshot exists for repo ${repoId}.`);

  return snapshots.map((snapshot) => ({
    ...snapshot,
    yDocBlob: JSON.stringify(snapshot.yDocBlob),
  }));
}

export default {
  Query: {
    repo,
    getDashboardRepos,
    getRepoSnapshots,
  },
  Mutation: {
    createRepo,
    updateRepo,
    deleteRepo,
    copyRepo,
    updatePod,
    addEdge,
    deleteEdge,
    addCollaborator,
    updateVisibility,
    deleteCollaborator,
    addRepoSnapshot,
    star,
    unstar,
  },
};
