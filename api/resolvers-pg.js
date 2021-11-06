import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import NodeGit from "nodegit";
import * as child from "child_process";
import fs from "fs";
import util from "util";

import Prisma from "@prisma/client";
const { PrismaClient } = Prisma;

import fsp from "fs/promises";

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

async function gitJustCommit({ username, reponame, msg }) {
  let path = `/srv/git/${username}/${reponame}`;
  const exec = util.promisify(child.exec);
  if (!fs.existsSync(path)) {
    return false;
  }
  // FIXME not sure if I want to git add here
  await exec(`cd ${path} && git add .`);
  await exec(`cd ${path} && git commit -m "${msg}"`);
  return true;
}

async function gitDiff({ username, reponame }) {
  let path = `/srv/git/${username}/${reponame}`;
  const exec = util.promisify(child.exec);
  if (!fs.existsSync(path)) {
    return null;
  }
  const diff = await exec(`cd ${path} && git diff --cached`);
  // console.log(typeof diff);
  // console.log(JSON.stringify(diff));
  return diff.stdout;
  // return JSON.stringify(diff);
}

async function gitExport({ username, reponame, pods }) {
  // 1. if repo does not exist, create it
  let path = `/srv/git/${username}/${reponame}`;
  // find the user name
  // FIXME this should be done at some level up
  let user = await prisma.user.findUnique({
    where: { username },
  });

  const exec = util.promisify(child.exec);
  if (!fs.existsSync(path)) {
    await NodeGit.Repository.init(path, 0);
  }
  // I actually want to update it every time so that people can change their name and email
  // config user name
  await exec(
    `cd ${path} && git config user.name "${user.name}" && git config user.email "${user.email}"`
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
    pod.content = pod.staged;
    delete pod.githead;
    delete pod.staged;
    delete pod.result;
    delete pod.stdout;
    delete pod.error;
    await fs.promises.writeFile(
      `${path}/.pods/${pod.id}.json`,
      // FIXME this will put string into quoted
      JSON.stringify(pod, null, 2)
    );
  }

  await exportFS({ username, reponame, pods });
  await exec(`cd ${path} && git add .`);
  return true;
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

async function exportFS({ username, reponame, pods }) {
  let path = `/srv/git/${username}/${reponame}`;
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
    for (const [name, suffix, gen] of [
      ["racket", "rkt", gen_racket],
      ["julia", "jl", gen_julia],
      ["javascript", "js", gen_default("javascript")],
      ["python", "py", gen_default("python")],
    ]) {
      // TODO for each language, generate import and exports
      // For racket, generate (module xxx)

      // gen with different generators
      // DEBUG use the deck's lang
      if (deck.lang === name) {
        let content = gen(deck, d);
        if (content) {
          console.log("writing to", `${dir}/main.${suffix}`);
          // console.log(name, "content", content);
          await fs.promises.writeFile(`${dir}/main.${suffix}`, content);
        }
      }
    }
    for (const { id } of deck.children.filter(({ type }) => type === "DECK")) {
      console.log("DFS on ", id);
      await dfs(id, dir);
    }
  }
  // let decks = pods.filter((pod) => pod.type === "DECK");
  await dfs("ROOT", `${path}/src`);

  if (config.racket) {
    // export info.rkt
    //
    // let defaultconfig = {
    //   name: "bhdl",
    //   root: "ROOT",
    //   deps: ["base", "graph", "rebellion", "uuid"],
    //   "build-deps": ["rackunit-lib"],
    //   "pkg-desc": "BHDL: A Programming Language for making PCBs",
    //   version: "0.1",
    // };
    config.racket.root = config.racket.root
      ? config.racket.root.match(/^\/*(.*)/)[1]
      : "ROOT";
    config.racket.deps = config.racket.deps || [];
    config.racket["build-deps"] = config.racket["build-deps"] || [];

    let inforkt = `
#lang info
(define collection "${config.racket.name}")
(define deps '(${config.racket.deps.map((s) => `"${s}"`).join(" ")}))
(define build-deps '(${config.racket["build-deps"]
      .map((s) => `"${s}"`)
      .join(" ")}))
(define pkg-desc "${config.racket["pkg-desc"]}")
(define pkg-authors '())
(define version "${config.racket.version}")
  `;
    console.log("writing to", `${path}/info.rkt`);
    await fs.promises.writeFile(`${path}/src/info.rkt`, inforkt);
    await fs.promises.writeFile(
      `${path}/src/main.rkt`,
      `#lang racket
(require "${config.racket.root || "ROOT"}/main.rkt")
(provide (all-from-out "${config.racket.root || "ROOT"}/main.rkt"))`
    );
    // write codepod.rkt
    await fs.promises.copyFile(
      "./kernels/racket/codepod.rkt",
      `${path}/src/codepod.rkt`
    );
  }
  if (config.julia) {
    // let defaultconfig = {
    //   lang: "julia",
    //   root: "ROOT/placer",
    //   name: "BHDL",
    //   uuid: "b4cd1eb8-1e24-11e8-3319-93036a3eb9f3",
    //   pkgs: ["ProgressMeter", "CUDA"],
    //   version: "0.1.0",
    // };
    // console.log("Julia config:", config.julia);
    config.julia.root = config.julia.root
      ? config.julia.root.match(/^\/*(.*)/)[1]
      : "ROOT";
    // console.log(config.julia);
    config.julia.pkgs = config.julia.pkgs || [];
    // How to insert deps?
    // I could probably read from the runtime system?
    //     await fs.promises.writeFile(
    //       `${path}/Project.toml`,
    //       `
    // name = "${config.julia.name}"
    // uuid = "${config.julia.uuid}"
    // version = "${config.julia.version}"
    // authors = ["Some One <someone@email.com>"]

    // [deps]
    // ${config.julia.pkgs.join("\n")}
    //     `
    //     );
    function shortns(ns) {
      let arr = ns.split("/");
      return arr[arr.length - 1];
    }
    await fs.promises.writeFile(
      `${path}/src/${config.julia.name}.jl`,
      `
      module ${config.julia.name}
      using Reexport

include("${config.julia.root || "ROOT"}/main.jl")

@reexport using .${shortns(config.julia.root)}
end
    `
    );
  }
}

function normalize(pods) {
  // build a id=>pod map
  let d = {};
  for (const pod of pods) {
    d[pod.id] = pod;
    pod.children = [];
    pod.content = JSON.parse(pod.content);
    pod.imports = JSON.parse(pod.imports);
    pod.exports = JSON.parse(pod.exports);
    pod.midports = JSON.parse(pod.midports);
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
  // sort
  for (const [id, pod] of Object.entries(d)) {
    // console.log("---", id, pod);
    pod.children.sort((a, b) => d[a.id].index - d[b.id].index);
  }
  pods.forEach((pod) => {
    pod.ns = computeNamespace(d, pod.id);
  });
  return d;
}

export function computeNamespace(pods, id) {
  let res = [];
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

function gen_julia(pod, pods) {
  let ids = pod.children
    .filter(({ type }) => type !== "DECK")
    .filter(({ lang }) => lang === "julia")
    .map(({ id }) => id);

  let content = ids.map((id) => pods[id].content).join("\n\n");
  let level = pod.ns.split("/").length;
  let names = pod.children
    .filter(({ lang, type }) => type !== "DECK" && lang === "julia")
    .filter(({ id }) => pods[id].exports)
    .map(({ id }) =>
      Object.entries(pods[id].exports)
        .filter(([k, v]) => v)
        .map(([k, v]) => k)
    );
  names = [].concat(...names);
  let nses = getUtilNs({ id: pod.id, pods });
  console.log("utils nses", nses);
  // child deck's
  // console.log("111");
  const child_deck_nses = pod.children
    .filter(
      ({ id }) =>
        pods[id].type === "DECK" && !pods[id].thundar && !pods[id].utility
    )
    .map(({ id, type }) => pods[id].ns);
  // console.log("222");
  // console.log("child_deck_nses", child_deck_nses);

  // FIXME the child might be utils, which will be duplicate with utilsNS
  nses = nses.concat(child_deck_nses);

  let exported_decks = pod.children
    .filter(
      ({ id }) =>
        pods[id].type === "DECK" && pods[id].exports && pods[id].exports["self"]
    )
    .map(({ id, type }) => pods[id].ns);

  function shortns(ns) {
    let arr = ns.split("/");
    return arr[arr.length - 1];
  }

  let code = `
  module ${shortns(pod.ns)}

  using Reexport

  ${nses
    .map(
      (ns) => `
  include("${"../".repeat(level)}${ns}/main.jl")
  `
    )
    .join("\n")}

  ${nses
    .map(
      (ns) => `
    using .${shortns(ns)}`
    )
    .join("\n")}

  ${exported_decks
    .map(
      (ns) => `
    @reexport using .${shortns(ns)}`
    )
    .join("\n")}
    
  ${names.length > 0 ? `export ${names.join(",")}` : ""}

  ${content}

  end
  `;

  return code;

  let code1 = `
  ${nses
    .map(
      (ns) => `
  include("${"../".repeat(level)}${ns}/main.jl")
  `
    )
    .join("\n")}
  eval(:(module $(Symbol("${pod.ns}"))
    using Reexport

    ${nses
      .map(
        (ns) => `
      eval(:(using $(:Main).$(Symbol("${ns}"))))`
      )
      .join("\n")}
    ${exported_decks
      .map(
        (ns) => `
      eval(:(@reexport using $(:Main).$(Symbol("${ns}"))))`
      )
      .join("\n")}

    ${names.length > 0 ? `export ${names.join(",")}` : ""}

    ${content}

  end))

  
  `;
  return code;
}

function getUtilNs({ id, pods, exclude }) {
  // get all utils for id
  // get children utils nodes
  if (!id) return [];
  let res = pods[id].children
    .filter(({ id }) => id !== exclude && pods[id].utility)
    .map(({ id, type }) => pods[id].ns);
  // keep to go to parents
  return res.concat(getUtilNs({ id: pods[id].parentId, pods, exclude: id }));
}

function gen_racket(pod, pods) {
  // console.log("pods", pods);
  let ids = pod.children
    .filter(({ type }) => type !== "DECK")
    .filter(({ lang }) => lang === "racket")
    .map(({ id }) => id);

  // DEBUG even if there's no racket pod, we still need a main.rkt to export everything out
  // if (ids.length == 0) {
  //   return null;
  // }
  // generate racket code
  let names = pod.children
    .filter(({ lang, type }) => type !== "DECK" && lang === "racket")
    .filter(({ id }) => pods[id].exports)
    .map(({ id }) =>
      Object.entries(pods[id].exports)
        .filter(([k, v]) => v)
        .map(([k, v]) => k)
    );
  names = [].concat(...names);
  let struct_names = names
    .filter((s) => s.startsWith("struct "))
    .map((s) => s.split(" ")[1]);
  names = names.filter((s) => !s.startsWith("struct "));
  console.log("names", names);
  // also I need to require for struct:parent
  let nses = getUtilNs({ id: pod.id, pods });
  console.log("utils nses", nses);
  // child deck's
  // console.log("111");
  const child_deck_nses = pod.children
    .filter(({ id }) => pods[id].type === "DECK" && !pods[id].thundar)
    .map(({ id, type }) => pods[id].ns);
  // console.log("222");
  // console.log("child_deck_nses", child_deck_nses);
  nses = nses.concat(child_deck_nses);
  console.log("nses", nses);
  // if it is a test desk, get parent
  if (pod.thundar) {
    nses.push(pods[pod.parentId].ns);
  }

  // exported subdecks
  let exported_decks = pod.children
    .filter(
      ({ id }) =>
        pods[id].type === "DECK" && pods[id].exports && pods[id].exports["self"]
    )
    .map(({ id, type }) => pods[id].ns);

  console.log("exported_decks", exported_decks);

  let content = ids
    .map((id) =>
      pods[id].thundar
        ? `(module+ test
     ${pods[id].content}
    )`
        : pods[id].content
    )
    .join("\n\n");

  let level = pod.ns.split("/").length;

  let code = `
(module ${pod.ns} racket 
  (require rackunit 
    "${"../".repeat(level)}codepod.rkt"
    ${nses.map((s) => `"${"../".repeat(level)}${s}/main.rkt"`).join(" ")})
  (provide ${names.join(" ")}
    ${struct_names.map((s) => `(struct-out ${s})`).join("\n")}
    ${exported_decks
      .map((s) => `(all-from-out "${"../".repeat(level)}${s}/main.rkt")`)
      .join("\n")}
    )

    ${
      pod.thundar
        ? `(module+ test

      ${content}

      )`
        : content
    }
  )
    `;
  return code;
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

async function gitGetPods({ username, reponame, version }) {
  // TODO select HEAD, commit, STAGED
  let path = `/srv/git/${username}/${reponame}`;
  console.log(path);
  const exec = util.promisify(child.exec);
  if (!fs.existsSync(path)) {
    return [];
  }
  if (!fs.existsSync(`${path}/pods`)) {
    await fs.promises.mkdir(`${path}/pods`);
  }
  const files = await fsp.readdir(`${path}/pods`);
  let pods = [];
  for (const file of files) {
    const content = await fsp.readFile(`${path}/pods/${file}`);
    const pod = JSON.parse(content);
    // pods[pod.id] = pod;
    pods.push(pod);
  }
  return pods;
}

async function prismaGitExport({ username, reponame }) {
  // put everything into the folder
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
  // console.log("=== pods", pods);
  // 1. write all pods into /path/to/folder/pods/[uuid].json
  await gitExport({ reponame, username, pods });
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

      await prismaGitExport({ username, reponame });
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
  if (!pod) {
    // this might be caused by creating a pod and update it too soon before it
    // is created on server, which is a time sequence bug
    throw new Error("Pod not exists.");
  }
  if (pod.repo.owner.id !== userId) {
    throw new Error("You do not have write access.");
  }
}
