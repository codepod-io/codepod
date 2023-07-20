// import { describe, expect, test } from "@jest/globals";
import { analyzeCode, initParserForTest } from "../lib/parser";
import * as fs from "fs";

describe("sum module", () => {
  test("adds 1 + 2 to equal 3", () => {
    expect(1 + 2).toBe(3);
  });

  test("initparser", async () => {
    // await new Promise((resolve) => setTimeout(resolve, 1000));
    let res = await initParserForTest();
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

  test("parse subscript LHS", async () => {
    let { annotations, errors } = analyzeCode(`
       x = [1,2,3]
       x[0] = 1
       `);
    expect(annotations).toStrictEqual([
      {
        name: "x",
        type: "vardef",
        startIndex: 8,
        endIndex: 9,
        startPosition: { row: 1, column: 7 },
        endPosition: { row: 1, column: 8 },
      },
      {
        name: "x",
        type: "varuse",
        startIndex: 27,
        endIndex: 28,
        startPosition: { row: 2, column: 7 },
        endPosition: { row: 2, column: 8 },
      },
    ]);
  });

  test("parse recursive funciton", async () => {
    // Here, the recursive function's call site should be recorgnized, not to be
    // parsed as a bound-variable. Ref:
    // https://github.com/codepod-io/codepod/issues/366
    let { annotations, errors } = analyzeCode(`
def recur(x):
  if x == 1:
      return 0
  else:
      return 1 + recur(x-1)
       `);
    expect(annotations).toStrictEqual([
      {
        name: "recur",
        type: "function",
        startIndex: 5,
        endIndex: 10,
        startPosition: { row: 1, column: 4 },
        endPosition: { row: 1, column: 9 },
      },
      {
        name: "recur",
        type: "varuse",
        startIndex: 68,
        endIndex: 73,
        startPosition: { row: 5, column: 17 },
        endPosition: { row: 5, column: 22 },
      },
    ]);
  });

  test("parse attribute LHS", async () => {
    let { annotations } = analyzeCode(`
    a.b = 3
    `);
    expect(annotations).toStrictEqual([
      {
        name: "a",
        type: "varuse",
        startIndex: 5,
        endIndex: 6,
        startPosition: { row: 1, column: 4 },
        endPosition: { row: 1, column: 5 },
      },
    ]);
  });
});
