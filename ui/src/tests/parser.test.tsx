// import { describe, expect, test } from "@jest/globals";
import { analyzeCode, initParser } from "../lib/parser";
import * as fs from "fs";

describe("sum module", () => {
  test("adds 1 + 2 to equal 3", () => {
    expect(1 + 2).toBe(3);
  });

  test("initparser", async () => {
    // await new Promise((resolve) => setTimeout(resolve, 1000));
    let res = await initParser("./public/");
    expect(res).toBe(true);
  });

  test.skip("parse a simple code", async () => {
    const code = `
    x = 1
    y = x + 1
    def foo(a,b):
        return a+b
    `;
    analyzeCode(code);
  });

  test("parse python3.8.py", async () => {
    let code = fs.readFileSync("./src/tests/python3.8-grammar.py", {
      encoding: "utf8",
      flag: "r",
    });
    let { error_messages } = analyzeCode(code);
    expect(error_messages).toStrictEqual([]);
  });

  test.skip("parse all py files", async () => {
    let files = fs.readdirSync("./src/tests/");
    files
      .filter((f) => f.endsWith(".py"))
      .forEach((f) => {
        console.log("=== testing", f);
        let code = fs.readFileSync("./src/tests/" + f, {
          encoding: "utf8",
          flag: "r",
        });
        let { errors } = analyzeCode(code);
        expect(errors).toStrictEqual([]);
      });
  });
});
