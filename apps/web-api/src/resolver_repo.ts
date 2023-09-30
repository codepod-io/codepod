import { t } from "./trpc";
import { z } from "zod";

// nanoid v4 does not work with nodejs. https://github.com/ai/nanoid/issues/365
import { customAlphabet } from "nanoid/async";
import { lowercase, numbers } from "nanoid-dictionary";
import prisma from "@codepod/prisma";

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

const getDashboardRepos = t.procedure.query(async ({ ctx: { userId } }) => {
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
});

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

const repo = t.procedure
  .input(z.object({ id: z.string() }))
  .query(async ({ input: { id }, ctx: { userId } }) => {
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
      },
    });
    if (!repo) throw Error("Repo not found");
    await updateUserRepoData({ userId, repoId: id });
    return repo;
  });

const createRepo = t.procedure.mutation(async ({ ctx: { userId } }) => {
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
});

const updateVisibility = t.procedure
  .input(z.object({ repoId: z.string(), isPublic: z.boolean() }))
  .mutation(async ({ input: { repoId, isPublic }, ctx: { userId } }) => {
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
  });

const updateRepo = t.procedure
  .input(z.object({ id: z.string(), name: z.string() }))
  .mutation(async ({ input: { id, name }, ctx: { userId } }) => {
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
  });

const deleteRepo = t.procedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ input: { id }, ctx: { userId } }) => {
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
  });

const addCollaborator = t.procedure
  .input(z.object({ repoId: z.string(), email: z.string() }))
  .mutation(async ({ input: { repoId, email }, ctx: { userId } }) => {
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
  });

const deleteCollaborator = t.procedure
  .input(z.object({ repoId: z.string(), collaboratorId: z.string() }))
  .mutation(async ({ input: { repoId, collaboratorId }, ctx: { userId } }) => {
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
  });

const star = t.procedure
  .input(z.object({ repoId: z.string() }))
  .mutation(async ({ input: { repoId }, ctx: { userId } }) => {
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
  });

const unstar = t.procedure
  .input(z.object({ repoId: z.string() }))
  .mutation(async ({ input: { repoId }, ctx: { userId } }) => {
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
  });

const copyRepo = t.procedure
  .input(z.object({ repoId: z.string() }))
  .mutation(async ({ input: { repoId }, ctx: { userId } }) => {
    if (!userId) throw Error("Unauthenticated");
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
    const { id } = await prisma.repo.create({
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
  });

export const repoRouter = t.router({
  hello: t.procedure
    .input(z.string().nullish())
    .query(({ input, ctx }) => `hello ${input ?? ctx.userId ?? "world"}`),

  // The actual resolvers
  repo,
  getDashboardRepos,

  // mutations
  createRepo,
  updateRepo,
  deleteRepo,
  copyRepo,
  addCollaborator,
  updateVisibility,
  deleteCollaborator,
  star,
  unstar,
});
