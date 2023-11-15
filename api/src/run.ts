import { startServer } from "./server";

const repoDir = `${process.cwd()}/example-repo`;
console.log("repoDir", repoDir);

const args = process.argv.slice(2);

const options = {
  copilotIpAddress: "127.0.0.1",
  copilotPort: 9090,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--copilotIP" && i + 1 < args.length) {
    options.copilotIpAddress = args[i + 1];
    i++;
  } else if (args[i] === "--copilotPort" && i + 1 < args.length) {
    options.copilotPort = Number(args[i + 1]);
    i++;
  }
}

startServer({ port: 4000, repoDir, ...options });
