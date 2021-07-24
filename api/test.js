import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import * as pty from "node-pty";

// import { typeDefs } from './graphql-schema'

// set environment variables from .env
// dotenv.config();

// jwt.sign({ id: "jfdlksf", username: "lihebi" }, process.env.JWT_SECRET, {
//   expiresIn: "30d",
// });

function test_nodepty() {
  // test whether node-pty will funciton correctly
  // Whether the spawned process will exit when the main process exits
  // let proc = pty.spawn("./print.sh");
  // pty.spawn("docker", ["exec", "-it", "julia_kernel_1"])
  let args = "exec -it julia_kernel_1 bash -c";
  let code =
    "for ((i=0;i<10;i++)); do echo printing; echo hello >> test.txt; sleep 1; done";
  let argv = args.split(" ").concat([code]);
  console.log(argv);
  // let proc = pty.spawn("docker", argv);
  //
  // When I run the docker command by itself, I can stop it
  // But when I run it through node-pty, when the pty exit, it does not exit.
  let proc = pty.spawn("docker", [
    // "exec",
    "run",
    "-it",
    // "julia_kernel_1",
    "-v",
    "/Users/hebi/Documents/GitHub/codepod/api/test.txt:/test.txt",
    "ubuntu",
    "bash",
    "-c",
    // "echo hello",
    // "for ((i=0;i<10;i++)); do echo hello >> test.txt; sleep 1; done",
    "for ((i=0;i<10;i++)); do echo printing; echo hello $i >> /test.txt; sleep 1; done",
  ]);
  console.log("2");
  // let proc = pty.spawn("docker", ["run", "hello-world"]);
  proc.onData((data) => {
    console.log(data);
  });
  proc.onExit(() => {
    console.log("exit");
  });
  proc.write();
  setTimeout(() => {
    console.log("trying to kill ..");
    proc.kill("SIGKILL");
    // process.kill(proc.pid, "SIGKILL");
  }, 1000);
  // proc.kill();
  // proc.dispose();
  // dispose(proc);
  console.log(proc.pid);
}

function main() {
  let container_name = `julia_kernel_1`;
  let cmd = `docker exec -it ${container_name} bash -c '/start.sh'`;
  console.log("====== spawning ", cmd);
  console.log(cmd.split(" ")[0]);
  console.log(cmd.split(" ").splice(1));
  // let proc = pty.spawn(cmd.split()[0], cmd.split().splice(1));
  //
  // FIXME this won't stop even after the program terminates. So shich
  // let proc = pty.spawn("bash", ["-c", cmd]);
  // let proc = pty.spawn("docker", ["run", "-it", "hello-world"]);
  let proc = pty.spawn("docker", [
    "exec",
    "-it",
    "julia_kernel_1",
    "bash",
    "-c",
    "/start.sh",
  ]);
  proc.onData((data) => {
    console.log(data);
  });
  proc.onExit(() => {
    console.log("exit");
  });
  proc.kill();
}

// main();
// test_nodepty();
