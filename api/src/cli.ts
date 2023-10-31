#!/usr/bin/env node

import { program } from "commander";
import { startServer } from "./server";

// This is a binary executable to run the server.

// First, parse the command line arguments.
// CMD: codepod /path/to/repo

program
  // get the version from package.json
  .version(require("../package.json").version)
  .arguments("<repoPath>")
  .action(function (repoPath) {
    console.log("repoPath", repoPath);
    // start the server
    startServer({ port: 4001, repoDir: repoPath });
  });

program.parse(process.argv);
