import fs from "fs";
import fsp from "fs/promises";
import util from "util";
import * as child from "child_process";

import Prisma from "@prisma/client";
import { ensureRepoEditAccess } from "./resolver_repo";
import { Octokit } from "octokit";

const { PrismaClient } = Prisma;

const prisma = new PrismaClient();

async function exportFS({ repoId, pods }) {
  let path = `/srv/git/${repoId}`;

  if (fs.existsSync(`${path}/src`)) {
    await fs.promises.rm(`${path}/src`, { recursive: true });
  }
  await fs.promises.mkdir(`${path}/src`);
  let d = normalize(pods);
  let config = normalize_cp_config(d);

  // export
  // start from ROOT, do dfs
  async function dfs(id, parentDir) {
    let deck = d[id];
    // let dir = deck.id === "ROOT" ? parentDir : `${parentDir}/${deck.id}`;
    let dir = `${parentDir}/${deck.name || deck.id}`;
    console.log("mkdir", dir);
    // if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir);
    // }
    // console.log("deck", deck);
    let gen = gen_default("python");
    let suffix = "py";

    let content = gen(deck, d);
    if (content) {
      console.log("writing to", `${dir}/main.${suffix}`);
      // console.log(name, "content", content);
      await fs.promises.writeFile(`${dir}/main.${suffix}`, content);
    }

    for (const { id } of deck.children.filter(({ type }) => type === "DECK")) {
      console.log("DFS on ", id);
      await dfs(id, dir);
    }
  }
  // let decks = pods.filter((pod) => pod.type === "DECK");
  await dfs("ROOT", `${path}/src`);
}

async function gitExport({ repo, pods }) {
  // put everything into the folder
  // console.log("=== repo", JSON.stringify(repo, null, 2));
  // console.log("=== pods", pods);
  // 1. write all pods into /path/to/folder/pods/[uuid].json
  // 1. if repo does not exist, create it
  let path = `/srv/git/${repo.id}`;
  // find the user name
  // FIXME this should be done at some level up

  const exec = util.promisify(child.exec);
  if (!fs.existsSync(path)) {
    // FIXME init git repository
    // await NodeGit.Repository.init(path, 0);
    await exec(
      `mkdir -p /srv/git/${repo.id} && cd /srv/git/${repo.id} && git init`
    );
  }
  // I actually want to update it every time so that people can change their name and email
  // config user name
  await exec(
    `cd ${path} && git config user.name "CodePod" && git config user.email "bot@codepod.io"`
  );
  // 2. write file
  // remove
  if (fs.existsSync(`${path}/.pods`)) {
    await fs.promises.rm(`${path}/.pods`, { recursive: true });
  }
  if (!fs.existsSync(`${path}/.pods`)) {
    await fs.promises.mkdir(`${path}/.pods`);
  }
  for (const pod of pods) {
    // delete pod.githead;
    // delete pod.staged;
    // delete pod.result;
    // delete pod.stdout;
    // delete pod.error;
    const { githead, staged, result, stdout, error, ...cleanPod } = pod;
    await fs.promises.writeFile(
      `${path}/.pods/${cleanPod.id}.json`,
      // FIXME this will put string into quoted
      JSON.stringify(cleanPod, null, 2)
    );
  }

  await exportFS({ repoId: repo.id, pods });
  await exec(`cd ${path} && git add .`);
  return true;
}

function normalize(pods) {
  // build a id=>pod map
  let d = {};
  for (const pod of pods) {
    d[pod.id] = pod;
    pod.children = [];
    pod.content = JSON.parse(pod.content);
  }
  d["ROOT"] = {
    id: "ROOT",
    type: "DECK",
    ns: "ROOT",
    children: [],
  };
  // construct .children
  for (const pod of pods) {
    pod.parentId = pod.parentId || "ROOT";
    d[pod.parentId].children.push({
      id: pod.id,
      type: pod.type,
      lang: pod.lang,
      name: pod.name,
    });
  }
  return d;
}

function normalize_cp_config(d) {
  // extract and remove config deck, return the config
  let configs = d["ROOT"].children.filter(({ name }) => name === "CP_CONFIG");

  if (configs.length == 0) {
    // use default config
    return {};
  }
  let res = {};
  if (configs.length > 1) {
    console.log("WARNING: more than 1 config deck found");
  }
  // use first config
  let { id } = configs[0];
  let deck = d[id];
  deck.children.forEach(({ id }) => {
    let content = d[id].content;
    let jobj = JSON.parse(content);
    if (jobj && jobj["lang"]) {
      res[jobj["lang"]] = jobj;
    }
  });
  // remove from d
  configs.forEach(({ id }) => {
    let children = d["ROOT"].children;
    children.splice(
      children.findIndex(({ id: id2 }) => id === id2),
      1
    );
  });
  return res;
}

function gen_default(name) {
  return (pod, pods) => {
    // default gen from a list of pods to content
    let ids = pod.children
      .filter(({ type }) => type !== "DECK")
      .filter(({ lang }) => lang === name)
      .map(({ id }) => id);
    if (ids.length == 0) return null;
    return ids.map((id) => pods[id].content).join("\n\n");
  };
}

async function ensureGitRepo({ repo, user }) {
  // 1. ensure the github repo exits. If not, create it.

  // This function is only used to export to github repo. If no git repo is
  // configured, this function should not be called.
  if (!repo.githubRepo) {
    throw new Error("No github repo configured");
  }
  // Create gitub repo query github api
  const octokit = new Octokit({
    auth: user.githubAccessToken,
  });
  // 2. clone the repo
  const path = `/srv/git/${repo.id}`;
  const exec = util.promisify(child.exec);
  // FIXME different copies of the api server should connect to the same drive?
  if (!fs.existsSync(`${path}`)) {
    // check if the repo exists. If not, create it.

    let res = await octokit.request("GET /repos/{owner_repo}", {
      owner_repo: repo.githubRepo,
    });
    // FIXME what if the repo exist?
    if (!res) {
      // create the repo
      await octokit.request("POST /user/repos", {
        // FIXME the user name?
        name: repo.githubRepo.split("/")[1],
        private: true,
      });
    }
    await exec(
      // CAUTION the token info would be inside the git remote url
      `git clone https://${user.githubAccessToken}@github.com/${repo.githubRepo} ${path}`
    );
    // await fs.promises.rm(`${path}/src`, { recursive: true });
  } else {
    // run git pull
    // FIXME this could be very slow to pull every time.
    await exec(`cd ${path} && git pull`);
  }
}

async function gitCommitAndPush(repoId) {
  let path = `/srv/git/${repoId}`;
  // /srv/git/ob88ejg7qc24cuvvjzh3
  // const child = require("child_process")
  // child.exec(`cd /srv/git/ob88ejg7qc24cuvvjzh3 $ && git push`);
  const exec = util.promisify(child.exec);
  if (!fs.existsSync(path)) {
    return false;
  }
  // FIXME not sure if I want to git add here
  console.log("Committing", path);
  await exec(`cd ${path} && git add .`);
  console.log("commiting ..");
  try {
    await exec(`cd ${path} && git commit -m "sync by CodePod"`);
  } catch (e) {
    console.log("nothing to commit");
  }
  // CAUTION this will push to github
  let { stdout } = await exec(`cd ${path} && git status`);
  if (stdout.indexOf("Your branch is up to date with") !== -1) {
    console.log("nothing to push");
    return true;
  }
  console.log("Pushing ..");
  // throw new Error("Not implemented");
  // add timeout?
  await asyncTimeout(async () => {
    await exec(`cd ${path} && git push`);
    console.log("done");
  }, 5000);
  // setTimeout(() => {
  //   // throw exception?
  //   throw new Error("Timeout");
  // }, 5000);
  // await exec(`cd ${path} && git push`);
  // console.log("done");
}

async function sanityCheck(repoId) {
  // Sanity check
  // 1. if the repo is empty
  // 2. if the .codepod/repoId === repoId
  let path = `/srv/git/${repoId}`;
  if (!fs.existsSync(path)) {
    return false;
  }
  const exec = util.promisify(child.exec);
  // check empty
  let { stdout } = await exec(`cd ${path} && git status`);
  if (stdout.indexOf("No commits yet") !== -1) {
    return true;
  }
  // check .codepod/repoId
  // TODO generate this file when exporting.
  let repoIdContent = await fs.promises.readFile(
    `${path}/.codepod/repoId`,
    "utf8"
  );
  if (repoIdContent === repoId) {
    return true;
  }
  return false;
}

/**
 * Entry point of Github export and sync. This function will:
 * 1. ensure the github repo exits. If not, create it.
 * 2. clone the repo
 * 3. export the content to the repo folder
 * 4. commit and push to github
 * @param _
 * @param param1
 * @param param2
 * @returns
 */
export async function githubExport(_, { repoId }, { userId }) {
  if (!userId) throw Error("Unauthenticated");
  // 1. update db
  // 2. TODO commit on FS. FIXME the DB only records content change, but the
  //    staged changes also include metadata.
  ensureRepoEditAccess({ repoId, userId });
  let repo = await prisma.repo.findUnique({
    where: {
      id: repoId,
    },
  });
  if (!repo) throw new Error("Repo not found");
  let user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });
  if (!user) throw new Error("User not found");
  if (!user.githubAccessToken)
    throw new Error("User has no github access token.");
  console.log("ensure git repo");
  await ensureGitRepo({ repo, user });
  // Sanity check
  // 1. if the repo is empty
  // 2. if the .codepod/repoId === repoId
  let sanity = await sanityCheck(repoId);
  if (!sanity) {
    throw new Error("Repo sanity check failed.");
  }

  console.log("exporting");
  const pods = await prisma.pod.findMany({
    where: {
      repo: {
        id: repo.id,
      },
    },
  });
  // 3. export files
  await gitExport({ repo, pods });
  // 4. git commit and push
  await gitCommitAndPush(repoId);
  return true;
}

const asyncTimeout = (func, timeout) =>
  new Promise(async (resolve, reject) => {
    setTimeout(() => {
      reject(new Error("Timeout"));
    }, timeout);
    await func();
    resolve(true);
  });

export async function setGitHubAccessToken(_, { token }, { userId }) {
  if (!userId) throw Error("Unauthenticated");
  let user = await prisma.user.findFirst({
    where: {
      id: userId,
    },
  });
  if (!user) {
    throw new Error("User not found");
  }
  // save
  await prisma.user.update({
    where: { id: userId },
    data: {
      githubAccessToken: token,
    },
  });
  return true;
}

export async function getGitHubAccessToken(_, {}, { userId }) {
  let user = await prisma.user.findFirst({
    where: { id: userId },
  });
  return user?.githubAccessToken;
}

export async function deleteGitHubAccessToken(_, {}, { userId }) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      githubAccessToken: null,
    },
  });
  return true;
}

export async function linkedGitHubRepo(_, { repoId }, { userId }) {
  await ensureRepoEditAccess({ repoId, userId });
  let repo = await prisma.repo.findFirst({
    where: {
      id: repoId,
    },
  });
  if (!repo) {
    throw Error("repo not found");
  }
  return repo.githubRepo;
}
export async function linkGitHubRepo(_, { repoId, ghRepoName }, { userId }) {
  await ensureRepoEditAccess({ repoId, userId });
  // create the repo if not exist
  let user = await prisma.user.findFirst({
    where: {
      id: userId,
    },
  });
  // do the link
  await prisma.repo.update({
    where: {
      id: repoId,
    },
    data: {
      githubRepo: ghRepoName,
    },
  });
  return true;
}

export async function unlinkGitHubRepo(_, { repoId }, { userId }) {
  await ensureRepoEditAccess({ repoId, userId });
  await prisma.repo.update({
    where: {
      id: repoId,
    },
    data: {
      githubRepo: null,
    },
  });
  return true;
}

export async function getMyGitHubRepos(_, {}, { userId }) {
  // 1. get the access token
  let user = await prisma.user.findFirst({
    where: {
      id: userId,
    },
  });
  if (!user) {
    throw new Error("User not found");
  }
  // 2. query github api
  const octokit = new Octokit({
    auth: user.githubAccessToken,
  });
  let { data } = await octokit.request("GET /user/repos");
  const repos = data.map((repo) => repo.full_name);
  return repos;
}
