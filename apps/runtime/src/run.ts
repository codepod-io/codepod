import { KernelSpec, startServer } from "./server";

let host = process.env.ZMQ_HOST;
if (!host) {
  throw Error("ZMQ_HOST not set");
}

let spec: KernelSpec = {
  shell_port: 55692,
  iopub_port: 55693,
  stdin_port: 55694,
  control_port: 55695,
  hb_port: 55696,
  //   ip: "0.0.0.0",
  ip: host,
  key: "",
  transport: "tcp",
  kernel_name: "",
};

startServer({ spec, port: 4020 });
