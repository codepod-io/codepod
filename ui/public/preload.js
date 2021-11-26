// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { contextBridge } = require("electron");
const fsp = require("fs/promises");

// const { PrismaClient } = require("@prisma/client");
// const prisma = new PrismaClient();

// console.log("preload!!!");

// async function main() {
//   const repo = await prisma.repo.create({
//     data: {
//       name: "test",
//     },
//   });
//   console.log(repo);
// }

// main()
//   .catch((e) => {
//     throw e;
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });

// As an example, here we use the exposeInMainWorld API to expose the browsers
// and node versions to the main window.
// They'll be accessible at "window.versions".
process.once("loaded", () => {
  contextBridge.exposeInMainWorld("versions", process.versions);
  contextBridge.exposeInMainWorld("codepod_is_local", true);
  contextBridge.exposeInMainWorld("foo", () => {
    return "foo";
  });
  contextBridge.exposeInMainWorld("codepod", {
    version: "0.0.1",
    foo: () => "foo",
    getRepos: async () => {
      return ["aaa", "bbb"];
      const homedir = require("os").homedir();
      let files = await fsp.readdir(`${homedir}/Documents/CodePod`);
      return files;
    },
    getRepo: async (reponame) => {
      return {
        data: {
          repo: {
            name: "aaa",
            pods: [],
          },
        },
      };
    },
    addPod: async () => {
      return false;
    },
    deletePod: async () => {
      return false;
    },
    updatePod: async () => {
      return false;
    },
    pastePod: async () => {
      return false;
    },
  });
});
