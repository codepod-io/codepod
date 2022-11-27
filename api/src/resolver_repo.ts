import Prisma from "@prisma/client";
const { PrismaClient } = Prisma;

const prisma = new PrismaClient();

// console.log("resolver_repo.ts", Prisma.RepoInclude);

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
  // public repo can be accessed by everyone
  // if the user is the owner or one of the collaborators, then it is ok
  if (!pod.repo.public &&  pod.repo.owner.id !== userId && pod.repo.collaboratorIds.indexOf(userId) === -1) {
    throw new Error("You do not have access to this pod.");
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

export async function myCollabRepos(_, __, {userId}) {
  if (!userId) throw Error("Unauthenticated");
  // console.log("myCollabRepos", userId);
  const repos = await prisma.repo.findMany({
    where: {
      public: false,
      collaboratorIds: {
        has:userId,
      },
    },
  });
  return repos;
}

export async function repo(_, { id }, { userId }) {
  // a user can only access a private repo if he is the owner or a collaborator
  const repo = await prisma.repo.findFirst({
    where: { OR: [
      { id, public: true },
      { id, owner: { id: userId || "undefined"} },
      { id, collaboratorIds: { has: userId || "undefined"} },
    ]
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
  if(!repo) throw Error("Repo not found");
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

export async function createRepo(_, { id, name, isPublic}, { userId }) {
  if (!userId) throw Error("Unauthenticated");
  const repo = await prisma.repo.create({
    data: {
      id,
      name,
      public: isPublic,
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

export async function deleteRepo(_, { name }, { userId }) {
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
}

export async function addCollaborator(_, { repoId, email }, { userId}) {
  // make sure the repo is writable by this user
  if (!userId) throw new Error("Not authenticated.");
  // 1. find the repo
  const repo = await prisma.repo.findFirst({
    where: {
      id: repoId,
      owner: { id: userId },
    },
  });
  if (!repo) throw new Error("Repo not found or you are not the owner.");
  if (repo.public) throw new Error("Public repo cannot have collaborators.");
  // 2. find the user
  const user = await prisma.user.findFirst({
    where: {
      email,
    }
  });
  if (!user) throw new Error("User not found");
  if (user.id === userId) throw new Error("You are already the owner.");
  if (repo.collaboratorIds.indexOf(user.id) !== -1) throw new Error("The user is already a collaborator.");
  // 3. add the user to the repo
  const res = await prisma.repo.update({
    where: {
      id: repoId,
    },
    data: {
      // public: false,
      // name: "test",
      collaboratorIds: {push: user.id},
    }
  })
  // console.log(res.collaboratorIds);
  return true;
}

export async function addPod(_, { repoId, parent, index, input }, { userId }) {
  // make sure the repo is writable by this user
  if (!userId) throw new Error("Not authenticated.");
  // 1. find the repo
  const repo = await prisma.repo.findFirst({
    where: {
      id: repoId,
      owner: { id: userId },
    },
  });
  if (!repo) throw new Error("Repo not found");
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
}

export async function updatePod(_, { id, input }, { userId }) {
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
}

export async function deletePod(_, { id, toDelete }, { userId }) {
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
}