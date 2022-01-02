import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
// import NodeGit from "nodegit";
import * as child from "child_process";
import fs from "fs";
import util from "util";

import path from "path";
import { exportFS } from "./exportfs.js";

function normalize(pods) {
  // build a id=>pod map
  let d = {};
  for (const pod of pods) {
    d[pod.id] = pod;
    pod.children = [];
    pod.content = JSON.parse(pod.content);
    pod.imports = JSON.parse(pod.imports);
    pod.exports = JSON.parse(pod.exports);
    pod.reexports = JSON.parse(pod.reexports);
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

async function pastePod({ appDir, reponame, id, parentId, index }) {
  let jsonfile = path.join(appDir, reponame, ".pods", `${id}.json`);
  let jobj = JSON.parse(await fs.promises.readFile(jsonfile));
  // remove from old parent
  {
    let parent_json = path.join(
      appDir,
      reponame,
      ".pods",
      `${jobj.parent}.json`
    );
    let parent_obj = JSON.parse(await fs.promises.readFile(parent_json));
    let oldindex = parent_obj.children.indexOf(id);
    if (jobj.parent == parentId && index > oldindex) {
      // moving within the same deck.
      // from 5 to 3: simply remove 5 and insert into 3
      // from 5 to 7: remove 5, insert to 6
      index -= 1;
    }
    parent_obj.children.splice(oldindex, 1);
    await fs.promises.writeFile(
      parent_json,
      JSON.stringify(parent_obj, null, 2)
    );
  }

  {
    // add to the new parent
    let parent_json = path.join(appDir, reponame, ".pods", `${parentId}.json`);
    let parent_obj = JSON.parse(await fs.promises.readFile(parent_json));
    parent_obj.children.splice(index, 0, id);
    await fs.promises.writeFile(
      parent_json,
      JSON.stringify(parent_obj, null, 2)
    );
  }
  // set the pod data itself
  jobj.parent = parentId;
  await fs.promises.writeFile(jsonfile, JSON.stringify(jobj, null, 2));

  return true;
}

// Deprecated Utility function
async function convertLocal(podsdir) {
  // convert local files
  // 1. read local files
  let jsons = await fs.promises.readdir(podsdir);
  let podlst = [];
  for (let jsonfile of jsons) {
    let jobj = JSON.parse(
      await fs.promises.readFile(path.join(podsdir, jsonfile))
    );
    podlst.push(jobj);
  }
  // 2. build d
  podlst.forEach((pod) => {
    pod.parent = pod.parentId || "ROOT";
    delete pod.parentId;
    pod.children = [];
  });
  // children
  let d = {};
  d["ROOT"] = {
    type: "DECK",
    id: "ROOT",
    children: [],
  };
  podlst.forEach((pod) => {
    d[pod.id] = pod;
  });
  // 3. modify format and save back to files
  podlst.forEach((pod) => {
    d[pod.parent].children.push(pod.id);
  });
  podlst.forEach((pod) => {
    pod.children.sort((a, b) => d[a].index - d[b].index);
  });
  podlst.forEach((pod) => {
    delete pod.index;
  });
  podlst.push(d["ROOT"]);
  // 4. save back to files
  podlst.forEach(async (pod) => {
    await fs.promises.writeFile(
      path.join(podsdir, `${pod.id}.json`),
      JSON.stringify(pod, null, 2)
    );
  });
}

export function getResolvers(appDir) {
  if (!fs.existsSync(appDir)) {
    fs.mkdirSync(appDir, { recursive: true });
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
      repoConfig: async (_, { name }) => {
        if (!fs.existsSync(path.join(appDir, name))) {
          return false;
        }
        // codepod config
        let config_file = path.join(appDir, name, "codepod.json");
        let config = "{}";
        if (fs.existsSync(config_file)) {
          config = await fs.promises.readFile(config_file);
        }
        return config.toString();
      },
      repo: async (_, { name, username }) => {
        if (!fs.existsSync(path.join(appDir, name))) {
          return false;
        }
        // if (name === "bhdl") {
        // await convertLocal(path.join(appDir, name, ".pods"));
        // }
        let dir = path.join(appDir, name, ".pods");
        if (!fs.existsSync(dir)) {
          // This is a folder, without .pods. So init it.
          await fs.promises.mkdir(dir, {
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
            path.join(dir, "ROOT.json"),
            JSON.stringify(root, null, 2)
          );
        }
        let jsons = await fs.promises.readdir(dir);
        let podlst = [];
        for (let jsonfile of jsons) {
          let jobj = JSON.parse(
            await fs.promises.readFile(path.join(dir, jsonfile))
          );
          podlst.push(jobj);
        }
        // let pods = await readpods(p);
        // console.log("===", podlst);
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
      updateRepoConfig: async (_, { name, config }) => {
        if (!fs.existsSync(path.join(appDir, name))) {
          return false;
        }
        let config_file = path.join(appDir, name, "codepod.json");
        let newconfig = JSON.parse(config);

        let obj = {};
        if (fs.existsSync(config_file)) {
          obj = JSON.parse(await fs.promises.readFile(config_file));
        }
        Object.assign(obj, newconfig);
        await fs.promises.writeFile(config_file, JSON.stringify(obj, null, 2));
        return true;
      },
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
        // 1. read pods
        let dir = path.join(appDir, reponame, ".pods");
        let jsons = await fs.promises.readdir(dir);
        let podlst = [];
        for (let jsonfile of jsons) {
          let jobj = JSON.parse(
            await fs.promises.readFile(path.join(dir, jsonfile))
          );
          podlst.push(jobj);
        }
        // 2. export fs
        await exportFS({ pods: podlst, repopath: path.join(appDir, reponame) });
        return true;
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
        await fs.promises.rmdir(path.join(appDir, name), {
          recursive: true,
        });
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
      pastePods: async (_, { reponame, ids, parentId, index }) => {
        for (let id of ids) {
          await pastePod({
            appDir,
            reponame,
            id,
            parentId,
            index,
          });
          index += 1;
        }
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
        parent.children.splice(parent.children.indexOf(child.id), 1);
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
