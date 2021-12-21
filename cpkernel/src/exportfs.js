import * as pathAPI from "path";
import os from "os";
import fs from "fs";

// import NodeGit from "nodegit";
import * as child from "child_process";
import util from "util";

import fsp from "fs/promises";

const repopath = pathAPI.join(os.homedir(), `.codepod/repos`);

export async function gitJustCommit({ username, reponame, msg }) {
  let path = pathAPI.join(repopath, `${username}/${reponame}`);
  const exec = util.promisify(child.exec);
  if (!fs.existsSync(path)) {
    return false;
  }
  // FIXME not sure if I want to git add here
  await exec(`cd ${path} && git add .`);
  await exec(`cd ${path} && git commit -m "${msg}"`);
  return true;
}

export async function gitDiff({ username, reponame }) {
  let path = pathAPI.join(repopath, `${username}/${reponame}`);
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
  let path = pathAPI.join(repopath, `${username}/${reponame}`);

  const exec = util.promisify(child.exec);
  if (!fs.existsSync(path)) {
    // await NodeGit.Repository.init(path, 0);
    await exec(`mkdir -p ${path} && cd ${path} && git init`);
  }
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

  await exportFS({
    pods,
    repopath: pathAPI.join(repopath, `${username}/${reponame}`),
  });
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

export async function exportFS({ pods, repopath }) {
  let path = repopath;
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
    // console.log("----", pod.id);
    // console.log(pod.content);
    d[pod.id] = pod;
    // pod.children = [];
    pod.content = pod.content && JSON.parse(pod.content);
    pod.imports = pod.imports && JSON.parse(pod.imports);
    pod.exports = pod.exports && JSON.parse(pod.exports);
    pod.reexports = pod.reexports && JSON.parse(pod.reexports);
    pod.midports = pod.midports && JSON.parse(pod.midports);
  }
  // construct .children
  for (const pod of pods) {
    pod.children = pod.children.map((id) => ({
      id,
      type: d[id].type,
      lang: d[id].lang,
      name: d[id].name,
    }));
    // pod.parentId = pod.parentId || "ROOT";
    // d[pod.parentId].children.push({
    //   id: pod.id,
    //   type: pod.type,
    //   lang: pod.lang,
    //   name: pod.name,
    // });
  }
  // sort
  // for (const [id, pod] of Object.entries(d)) {
  //   // console.log("---", id, pod);
  //   pod.children.sort((a, b) => d[a.id].index - d[b.id].index);
  // }
  pods.forEach((pod) => {
    pod.ns = computeNamespace(d, pod.id);
  });
  return d;
}

export function computeNamespace(pods, id) {
  let res = [];
  // if the pod is a pod, do not include its id
  if (pods[id].type !== "DECK") {
    id = pods[id].parent;
  }
  while (id) {
    res.push(pods[id].name || id);
    id = pods[id].parent;
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
  return res.concat(getUtilNs({ id: pods[id].parent, pods, exclude: id }));
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
    nses.push(pods[pod.parent].ns);
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

export async function gitGetHead({ username, reponame }) {
  // FIXME for now I'll just get the file, because I'll always add and commit at
  // the same time.
  let path = pathAPI.join(repopath, `${username}/${reponame}`);
  if (!fs.existsSync(`${path}/code.txt`)) {
    return "";
  }
  let content = await fs.promises.readFile(`${path}/code.txt`);
  return content.toString();
}

async function gitGetPods({ username, reponame, version }) {
  // TODO select HEAD, commit, STAGED
  let path = pathAPI.join(repopath, `${username}/${reponame}`);
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
