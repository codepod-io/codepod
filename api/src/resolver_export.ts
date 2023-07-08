import AWS from "aws-sdk";
import { writeFile, readFile, unlink } from "fs/promises";
import prisma from './client'

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
  const filename = `${
    repo.name || "Untitled"
  }-${new Date().toISOString()}.json`;
  const aws_url = await uploadToS3WithExpiration(
    filename,
    JSON.stringify({ name: repo.name, version: "v0.0.1", pods: repo.pods })
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
