import { startServer } from "./server";

const blobDir = `${process.cwd()}/example-repo`;
console.log("blobDir", blobDir);

startServer({ port: 4000, blobDir });
