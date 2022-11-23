import Parser from "web-tree-sitter";

let parser: Parser | null = null;
Parser.init({
  locateFile(scriptName: string, scriptDirectory: string) {
    return scriptName;
  },
}).then(async () => {
  /* the library is ready */
  console.log("tree-sitter is ready");
  parser = new Parser();
  const Python = await Parser.Language.load("/tree-sitter-python.wasm");
  parser.setLanguage(Python);
});

/**
 * Return a list of names defined in this code.
 * @param code the code
 * @returns a list of names defined in this code.
 */
export function analyzeCode(code) {
  let names: string[] = [];
  let ispublic = false;
  if (code.trim().startsWith("@export")) {
    ispublic = true;
    code = code.slice(7).trim();
  }
  if (!parser) {
    throw Error("warning: parser not ready");
  }
  let tree = parser.parse(code);
  tree.rootNode.children.forEach((node) => {
    if (node.type === "function_definition") {
      let name = node.firstNamedChild!.text;
      names.push(name);
    }
  });
  return { ispublic, names };
}

/**
 * 1. parse the code, get: (defs, refs) to functions & variables
 * 2. consult symbol table to resolve them
 * 3. if all resolved, rewrite the code; otherwise, return null.
 * @param code
 * @param symbolTable
 * @returns
 */
export function rewriteCode(code, symbolTable) {
  console.log("--- rewriteCode with symbol table", symbolTable);
  if (!parser) {
    throw Error("warning: parser not ready");
  }
  let ispublic = false;
  if (code.trim().startsWith("@export")) {
    ispublic = true;
    code = code.slice(7).trim();
  }
  let tree = parser.parse(code);
  // iterate through all first-level children.
  let defrefs: Parser.SyntaxNode[] = [];
  // get all the references to variables and functions (currently just functions)
  let all_query = parser
    .getLanguage()
    .query(
      "[" +
        "(function_definition (identifier) @name)" +
        "(call (identifier) @name)" +
        "(module (expression_statement (identifier) @id))" +
        "]"
    );
  all_query.matches(tree.rootNode).forEach((match) => {
    let node = match.captures[0].node;
    defrefs.push(node);
  });
  // replace with symbol table
  let newcode = "";
  let index = 0;
  defrefs.forEach((node) => {
    newcode += code.slice(index, node.startIndex);
    if (node.text in symbolTable) {
      newcode += symbolTable[node.text];
    } else {
      console.log("warning: cannot resolve", node.text);
      newcode += node.text;
    }
    index = node.endIndex;
  });
  newcode += code.slice(index);
  return { ispublic, newcode };
}
