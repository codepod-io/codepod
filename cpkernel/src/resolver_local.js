import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
// import NodeGit from "nodegit";
import * as child from "child_process";
import fs from "fs";
import util from "util";

import path from "path";

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

async function readpods(dir) {
  let jsons = await fs.promises.readdir(dir);
  let podlst = [];
  for (let jsonfile of jsons) {
    let jobj = JSON.parse(await fs.promises.readFile());
    podlst.push(jobj);
  }
  let d = normalize(podlst);

  return d;
}

export function getResolvers(appDir) {
  if (!fs.existsSync(appDir)) {
    fs.mkdirSync(appDir, {recursive: true});
  }
  return {
    Query: {
      hello: () => {
        return "Hello world!";
      },
      users: async (_, __, { userId }) => {
        return false;
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
        let dirs = await fs.promises.readdir(appDir);
        return dirs.map((dir) => ({
          name: dir,
          id: "NULL",
        }));
      },
      myRepos: async (_, __, { userId }) => {
        let dirs = await fs.promises.readdir(appDir);
        return dirs.map((dir) => ({
          name: dir,
          id: dir,
        }));
      },
      activeSessions: async (_, __, { userId }) => {
        return [];
      },
      repo: async (_, { name, username }) => {
        if (!fs.existsSync(path.join(appDir, name))) {
          return false;
        }
        let dir = path.join(appDir, name, ".pods");
        let jsons = await fs.promises.readdir(dir);
        let podlst = [];
        for (let jsonfile of jsons) {
          let jobj = JSON.parse(
            await fs.promises.readFile(path.join(dir, jsonfile))
          );
          podlst.push(jobj);
        }
        // let pods = await readpods(p);
        console.log("===", podlst);
        return {
          name,
          id: "NULL",
          pods: podlst,
          //   pods: [],
          //   pods: [
          //     {
          //       id: "NULL",
          //       type: "DECK",
          //       index: 0,
          //       children: [],
          //       //   parent: "ROOT",
          //     },
          //   ],
        };
      },
      pod: async (_, { id }) => {
        return false;
      },
      // get diff from repo
      // getDiff: async (_, {}) => {},
      // get the HEAD commit
      gitGetHead: async (_, { username, reponame }, { userId }) => {
        return false;
      },
      gitGetPods: async (_, { username, reponame }, { userId }) => {
        return false;
      },
      gitDiff: async (_, { username, reponame }, { userId }) => {
        return false;
      },
    },
    Mutation: {
      signup: async (_, { username, email, password, invitation }) => {
        return false;
      },
      updateUser: async (_, { username, email, name }, { userId }) => {
        return false;
      },
      gitCommit: async (_, { username, reponame, msg }) => {
        return false;
      },
      gitExport: async (_, { username, reponame }, { userId }) => {
        return false;
      },
      gitStage: async (_, { username, reponame, podId }) => {
        // 1. set pod.staged = pod.content
        // 2. TODO export to FS
        return false;
      },
      gitStageMulti: async (_, { username, reponame, podIds }) => {
        return false;
      },
      gitUnstage: async (_, { username, reponame, podId }) => {
        return false;
      },
      gitUnstageMulti: async (_, { username, reponame, podIds }) => {
        return false;
      },
      login: async (_, { username, password }) => {
        return false;
      },
      createRepo: async (_, { name }, { userId }) => {
        // create repo $name under userId
        await fs.promises.mkdir(path.join(appDir, name, ".pods"), {
          recursive: true,
        });
        // create ROOT.json
        let root = {
          id: "ROOT",
          type: "DECK",
          ns: "ROOT",
          children: [],
        };
        await fs.promises.writeFile(
          path.join(appDir, name, ".pods", "ROOT.json"),
          JSON.stringify(root, null, 2)
        );
        return true;
      },
      deleteRepo: async (_, { name }, { userId }) => {
        await fs.promises.rmdir(path.join(appDir, name, ".pods"), {
          recursive: true,
        });
        await fs.promises.rmdir(path.join(appDir, name));
        return true;
      },
      clearUser: () => {},
      addPod: async (
        _,
        { reponame, username, parent, index, input },
        { userId }
      ) => {
        // 1. read the parent pod
        let parent_json = path.join(
          appDir,
          reponame,
          ".pods",
          `${parent}.json`
        );
        let parent_obj = JSON.parse(await fs.promises.readFile(parent_json));

        // 2. add to children list, save file
        parent_obj.children.splice(index, 0, input.id);
        await fs.promises.writeFile(
          parent_json,
          JSON.stringify(parent_obj, null, 2)
        );
        // 3. add a new json file
        let child_json = path.join(
          appDir,
          reponame,
          ".pods",
          `${input.id}.json`
        );
        await fs.promises.writeFile(
          child_json,
          JSON.stringify({ ...input, parent: parent, children: [] }, null, 2)
        );
        return true;
      },
      pastePod: async (_, { id, parentId, index, column }) => {
        return false;
      },
      pastePods: async (_, { ids, parentId, index, column }) => {
        return false;
      },
      updatePod: async (_, { reponame, username, input }, { userId }) => {
        let { id } = input;
        let fname = path.join(appDir, reponame, ".pods", `${id}.json`);
        let jobj = JSON.parse(await fs.promises.readFile(fname));
        jobj = { ...jobj, ...input };
        await fs.promises.writeFile(fname, JSON.stringify(jobj, null, 2));
        return true;
      },
      deletePod: async (_, { id, toDelete, reponame }, { userId }) => {
        // 1. read the json file
        let fname = path.join(appDir, reponame, ".pods", `${id}.json`);
        let child = JSON.parse(await fs.promises.readFile(fname));
        // 2. update parent's children
        let parent_fname = path.join(
          appDir,
          reponame,
          ".pods",
          `${child.parent}.json`
        );
        let parent = JSON.parse(await fs.promises.readFile(parent_fname));
        parent.children.splice(child.index, 1);
        await fs.promises.writeFile(
          parent_fname,
          JSON.stringify(parent, null, 2)
        );
        // 3. delete all
        for (let id of toDelete) {
          await fs.promises.rm(
            path.join(appDir, reponame, ".pods", `${id}.json`)
          );
        }
        return true;
      },
      killSession: async (_, { sessionId }, { userId }) => {
        return false;
      },
    },
  };
}
