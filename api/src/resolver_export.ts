import Prisma from "@prisma/client";

import AWS from "aws-sdk";
import { writeFile, readFile, unlink } from "fs/promises";

console.log("REGION", process.env.EXPORT_AWS_S3_REGION);

// Set your AWS region and credentials
AWS.config.update({
  region: process.env.EXPORT_AWS_S3_REGION,
  accessKeyId: process.env.EXPORT_AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.EXPORT_AWS_S3_SECRET_ACCESS_KEY,
});

// Create a new S3 object
const s3 = new AWS.S3();

async function uploadToS3WithExpiration(filename, content) {
  try {
    await writeFile(filename, content);

    // Set the S3 parameters
    const params = {
      Bucket: process.env.EXPORT_AWS_S3_BUCKET as string,
      Key: filename,
      Body: await readFile(filename),
    };

    // Upload the file to S3 and set an expiration policy
    const { Location } = await s3.upload(params).promise();

    // Delete the generated file
    await unlink(filename);
    return Location;
  } catch (error) {
    console.log("Error uploading file:", error);
  }
}

const { PrismaClient } = Prisma;

const prisma = new PrismaClient();

/**
 * Export to a JSON file for the pods' raw data.
 */
async function exportJSON(_, { repoId }, { userId }) {
  const repo = await prisma.repo.findFirst({
    where: {
      OR: [
        { id: repoId, public: true },
        { id: repoId, owner: { id: userId || "undefined" } },
        { id: repoId, collaborators: { some: { id: userId || "undefined" } } },
      ],
    },
    include: {
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
  // now export repo to a file
  if (!repo) throw Error("Repo not exists.");
  // podId -> parentId mapping
  let adj = {};
  // Hard-code Jupyter cell format. Reference, https://nbformat.readthedocs.io/en/latest/format_description.html
  let jupyterCellList: {
    cell_type: string;
    execution_count: number;
    metadata: object;
    source: string[];
  }[] = [];

  for (const pod of repo.pods) {
    // Build podId -> parentId mapping
    adj[pod.id] = { name: pod.name, parentId: pod.parentId };
    // Filter by non-empty 'CODE' pods
    if (!pod.name && pod.type == "CODE") {
      jupyterCellList.push({
        cell_type: "code",
        // hard-code execution_count
        execution_count: 1,
        // TODO: expand other Codepod related-metadata fields, or run a real-time search in database when importing.
        metadata: { id: pod.id },
        source: [pod.content || ""],
      });
    }
  }

  // Append the scope structure as comment for each cell and also format source
  for (const cell of jupyterCellList) {
    let scopes: string[] = [];
    let parentId = adj[cell.metadata["id"]].parentId;

    // iterative {parentId,name} retrieval
    while (parentId) {
      scopes.push(adj[parentId].name);
      parentId = adj[parentId].parentId;
    }

    // Add scope structure as a block comment at the head of each cell
    let scopeStructureAsComment = [
      "'''\n",
      `CodePod Scope structure: ${scopes.reverse().join("/")}\n`,
      "'''\n",
    ];
    // TO-FIX, split by newline doesn't work
    const sourceArray = cell.source[0]
      .substring(1, cell.source[0].length - 1)
      .split(/\r?\n/);

    cell.source = [...scopeStructureAsComment, ...sourceArray];
  }
  console.log(jupyterCellList);

  const filename = `${
    repo.name || "Untitled"
  }-${new Date().toISOString()}.ipynb`;
  const aws_url = await uploadToS3WithExpiration(
    filename,
    JSON.stringify({
      metadata: {
        name: repo.name,
        language_info: { name: "python" },
        Codepod_version: "v0.0.1",
      },
      nbformat: 4,
      nbformat_minor: 0,
      cells: jupyterCellList,
    })
  );
  return aws_url;
}

interface Pod {
  type: "CODE" | "DECK";
  id: string;
  children: string[];
  content: string;
  name: string;
}

function generate_dfs(pod: Pod, pods: Record<string, Pod>, level) {
  const space = "  ".repeat(level);
  if (pod.type === "CODE")
    return [
      space + `# BEGIN POD ${pod.id}`,
      space + `${pod.content}`,
      space + `# END POD ${pod.id}`,
    ].join("\n");
  else {
    // this is a DECK
    let ids = pod.children;
    const children_content = ids
      .map((id) => generate_dfs(pods[id], pods, level + 1))
      .join("\n\n");
    return [
      space + `# BEGIN SCOPE ${pod.name} ${pod.id}`,
      children_content,
      space + `# END SCOPE ${pod.name} ${pod.id}`,
    ].join("\n");
  }
}

function pods_list2dict(pods) {
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
    d[pod.parentId].children.push(pod.id);
  }
  return d;
}

/**
 * export to a Python file.
 */
async function exportFile(_, { repoId }, { userId }) {
  const repo = await prisma.repo.findFirst({
    where: {
      OR: [
        { id: repoId, public: true },
        { id: repoId, owner: { id: userId || "undefined" } },
        { id: repoId, collaborators: { some: { id: userId || "undefined" } } },
      ],
    },
    include: {
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
  // now export repo to a file
  if (!repo) throw Error("Repo not exists.");

  let d = pods_list2dict(repo.pods);
  // let decks = pods.filter((pod) => pod.type === "DECK");
  const content = generate_dfs(d["ROOT"], d, 0);

  // create a hierarchy of the pods
  const filename = `${repo.name || "Untitled"}-${new Date().toISOString()}.py`;
  const aws_url = await uploadToS3WithExpiration(filename, content);
  return aws_url;
}

export default {
  Query: {},
  Mutation: {
    exportJSON,
    exportFile,
  },
};
