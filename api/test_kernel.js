import {
  Kernel,
  constructExecuteRequest,
  constructMessage,
  createNewConnSpec,
} from "./kernel.js";

import { readFile, readFileSync, writeFile, writeFileSync } from "fs";

async function testJulia() {
  //   let spec = await startJuliaKernel(true);
  //   connectKernel(kernelSpec);
  let kernel = new Kernel("./kernels/julia/conn.json");
  //   console.log("wait 8 sec ..");
  //   await sleep(8000);
  kernel.listenIOPub((topic, msgs) => {
    console.log("topic", topic);
    console.log("msgs", msgs);
  });
  //   let msg = constructExecuteRequest("5+6");
  console.log("=============== 111111");
  kernel.sendShellMessage(constructExecuteRequest({ code: "5+6" }));
  // FIXME the 2nd message is not send successfully
  console.log("=============== 222222");
  kernel.sendShellMessage(
    constructMessage({ msg_type: "kernel_info_request" })
  );
  //   // FIXME the 3rd message will cause error
  //   console.log("=============== 333333");
  //   kernel.sendShellMessage(constructMessage("kernel_info_request"));
  //   kernel.sendShellMessage(constructMessage("kernel_info_request"));
  console.log("finished all the requests");
}

// main();
// gen();

export async function genConnSpec() {
  let connFname = "./codepod-conn-dummy.json";
  let spec = await createNewConnSpec();
  writeFileSync(connFname, JSON.stringify(spec));
}

async function testRacket() {
  //   let spec = await startJuliaKernel(true);
  //   connectKernel(kernelSpec);
  // let kernel = new Kernel("./kernels/racket/codepod-conn-racket.json");
  let kernel = new Kernel("./kernels/racket/conn.json");
  //   console.log("wait 8 sec ..");
  //   await sleep(8000);
  kernel.listenIOPub((topic, msgs) => {
    console.log("topic", topic);
    console.log("msgs", msgs);
  });
  //   let msg = constructExecuteRequest("5+6");
  console.log("=============== 111111");
  kernel.sendShellMessage(constructExecuteRequest({ code: "5+6" }));
  // FIXME the 2nd message is not send successfully
  console.log("=============== 222222");
  kernel.sendShellMessage(
    constructMessage({ msg_type: "kernel_info_request" })
  );
  //   // FIXME the 3rd message will cause error
  //   console.log("=============== 333333");
  //   kernel.sendShellMessage(constructMessage("kernel_info_request"));
  //   kernel.sendShellMessage(constructMessage("kernel_info_request"));
  console.log("finished all the requests");
}

async function main() {
  await genConnSpec();
  // await testRacket();
  // await testJulia();
}

main();
