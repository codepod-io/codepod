#!/usr/bin/env node

import { program } from "commander";
import { startServer } from "./server";

// This is a binary executable to run the server.

// First, parse the command line arguments.
// CMD: codepod /path/to/repo

program
  .version("0.0.1")
  .arguments("<repoPath>")
  .action(function (repoPath) {
    console.log("repoPath", repoPath);
    // start the server
    startServer({ port: 4001, blobDir: repoPath });
  });

program.parse(process.argv);
