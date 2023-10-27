import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { writeFileSync } from "fs";
import net from "net";
import http from "http";

import { startServer } from "../runtime/server";

type KernelInfo = {
  // the kernel
  zmq_proc: ChildProcessWithoutNullStreams;
  spec: KernelSpec;
  // the WS gateway
  ws_server: http.Server;
  ws_port: number;
};

const id2KernelInfo = new Map<string, KernelInfo>();

const usedPorts = new Set<number>();

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    // get one free pod
    const srv = net.createServer();
    srv.listen(0, () => {
      const addr = srv.address() as net.AddressInfo;
      const port = addr.port;
      srv.close();
      resolve(port);
    });
  });
}

async function getAvailablePort() {
  while (true) {
    let port = await getFreePort();
    if (!usedPorts.has(port)) {
      usedPorts.add(port);
      return port;
    }
  }
}

type KernelSpec = {
  shell_port: number;
  iopub_port: number;
  stdin_port: number;
  control_port: number;
  hb_port: number;
  ip: string;
  key: string;
  transport: string;
  kernel_name: string;
};

async function createNewConnSpec() {
  let spec: KernelSpec = {
    shell_port: await getAvailablePort(),
    iopub_port: await getAvailablePort(),
    stdin_port: await getAvailablePort(),
    control_port: await getAvailablePort(),
    hb_port: await getAvailablePort(),
    ip: "127.0.0.1",
    key: "",
    transport: "tcp",
    kernel_name: "",
  };
  return spec;
}

/**
 *
 * @returns target url: ws://container:port
 */
export async function spawnRuntime(runtimeId) {
  // 1. launch the kernel with some connection file
  const spec = await createNewConnSpec();
  console.log("=== spec", spec);
  // This file is only used once.
  writeFileSync("/tmp/conn.json", JSON.stringify(spec));
  // create a new process
  // "python3", "-m", "ipykernel_launcher", "-f", "/conn.json"
  const proc = spawn("python3", [
    "-m",
    "ipykernel_launcher",
    "-f",
    "/tmp/conn.json",
  ]);
  proc.stdout.on("data", (data) => {
    console.log(`child stdout:\n${data}`);
  });
  proc.stderr.on("data", (data) => {
    console.error(`child stderr:\n${data}`);
  });

  // 2. launch the WS gateway server, at some port
  const port = await getAvailablePort();
  console.log("=== ws port", port);
  const server = startServer({ spec, port });
  // 3. return the runtimeInfo
  // add the process PID to the runtimeInfo
  const runtimeInfo: KernelInfo = {
    spec,
    zmq_proc: proc,
    ws_server: server,
    ws_port: port,
  };
  id2KernelInfo.set(runtimeId, runtimeInfo);
  return `ws://localhost:${port}`;
}

export async function killRuntime(runtimeId) {
  // free resources
  const info = id2KernelInfo.get(runtimeId);
  if (!info) {
    console.warn(`WARN Runtime ${runtimeId} not found`);
    return;
  }
  // kill the kernel process and free the ports
  info.zmq_proc.kill();
  usedPorts.delete(info.spec.shell_port);
  usedPorts.delete(info.spec.iopub_port);
  usedPorts.delete(info.spec.stdin_port);
  usedPorts.delete(info.spec.control_port);
  usedPorts.delete(info.spec.hb_port);
  // kill the ws server and free its port
  info.ws_server.close();
  usedPorts.delete(info.ws_port);
}
