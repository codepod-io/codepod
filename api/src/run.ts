import { startServer } from "./server";

const repoDir = `${process.cwd()}/example-repo`;
console.log("repoDir", repoDir);

startServer({ port: 4000, repoDir });
