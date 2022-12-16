import Parser from "web-tree-sitter";
import keywords from "./python-keywords";

let parser: Parser | null = null;
Parser.init({
  locateFile(scriptName: string, scriptDirectory: string) {
    return "/" + scriptName;
  },
}).then(async () => {
  /* the library is ready */
  console.log("tree-sitter is ready");
  parser = new Parser();
  const Python = await Parser.Language.load("/tree-sitter-python.wasm");
  parser.setLanguage(Python);
});

export type Annotation = {
  name: string;
  type: string;
  startIndex: number;
  endIndex: number;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  // The ID of the pod that defines this name.
  origin?: string;
};

/**
 * Use tree-sitter query to analyze the code. This only work for functions.
 * @param code
 */
export function analyzeCodeViaQuery(code) {
  let annotations: Annotation[] = [];
  let ispublic = false;
  if (code.trim().startsWith("@export")) {
    ispublic = true;
    code = code.slice(7).trim();
  }
  // magic commands
  if (code.startsWith("!")) return { ispublic, annotations };
  if (!parser) {
    throw Error("warning: parser not ready");
  }
  let tree = parser.parse(code);

  const function_def = "(function_definition (identifier) @function)";
  const callsite = `(call (identifier) @callsite)`;

  let query_func = parser.getLanguage().query(`
  [
    ${function_def}
    ${callsite}
  ]
  `);
  query_func.matches(tree.rootNode).forEach((match) => {
    let node = match.captures[0].node;
    annotations.push({
      name: node.text, // the name of the function or variable
      type: match.captures[0].name, // "function" or "variable"
      startIndex: node.startIndex,
      endIndex: node.endIndex,
      startPosition: node.startPosition,
      endPosition: node.endPosition,
    });
  });

  annotations = annotations.filter(({ name }) => !keywords.has(name));
  // Sort the annotations so that rewrite can be done in order.
  annotations.sort((a, b) => a.startIndex - b.startIndex);

  return { ispublic, annotations };
}

/**
 * Return a list of names defined in this code.
 * @param code the code
 * @returns a list of names defined in this code.
 */
export function analyzeCode(code) {
  let annotations: Annotation[] = [];
  let ispublic = false;
  if (code.trim().startsWith("@export")) {
    ispublic = true;
    code = code.slice(7).trim();
  }
  // magic commands
  if (code.startsWith("!")) return { ispublic, annotations };
  if (!parser) {
    throw Error("warning: parser not ready");
  }
  let tree = parser.parse(code);

  const function_def = "(function_definition (identifier) @function)";

  const vardef = `
    (expression_statement (assignment (identifier) @vardef))
    (expression_statement (assignment (pattern_list (identifier) @vardef)))
  `;

  let query_func = parser.getLanguage().query(`
  [
    ${function_def}
  ]
  `);
  query_func.matches(tree.rootNode).forEach((match) => {
    let node = match.captures[0].node;
    annotations.push({
      name: node.text, // the name of the function or variable
      type: match.captures[0].name, // "function" or "variable"
      startIndex: node.startIndex,
      endIndex: node.endIndex,
      startPosition: node.startPosition,
      endPosition: node.endPosition,
    });
  });
  let query_var = parser.getLanguage().query(`
    [
      ${vardef}
    ]
    `);
  // Do not parse variable def/use inside a function definition.
  // FIXME there might be duplicate.
  // let index2annotation: Record<number, Annotation> = {};
  // annotations = annotations.concat(Object.values(index2annotation));
  tree.rootNode.children
    .filter(({ type }) => type !== "function_definition")
    .forEach((child) => {
      query_var.matches(child).forEach((match) => {
        let node = match.captures[0].node;
        let annotation = {
          name: node.text, // the name of the function or variable
          type: match.captures[0].name, // "function" or "variable"
          startIndex: node.startIndex,
          endIndex: node.endIndex,
          startPosition: node.startPosition,
          endPosition: node.endPosition,
        };
        // index2annotation[node.startIndex] = annotation;
        annotations.push(annotation);
      });
    });

  try {
    let unbound_vars = compileModule(tree.rootNode);
    unbound_vars
      .filter((node) => !keywords.has(node.text))
      .forEach((node) => {
        let annotation = {
          name: node.text,
          type: "varuse",
          startIndex: node.startIndex,
          endIndex: node.endIndex,
          startPosition: node.startPosition,
          endPosition: node.endPosition,
        };
        annotations.push(annotation);
      });
  } catch (e) {
    console.log("SymbolTable compiles failed:", e);
  }

  // Sort the annotations so that rewrite can be done in order.
  annotations.sort((a, b) => a.startIndex - b.startIndex);

  return { ispublic, annotations };
}

/**
 ***** compile functions *****
 */

function union(setA, setB) {
  const _union = new Set(setA);
  for (const elem of setB) {
    _union.add(elem);
  }
  return _union;
}

function pp(node: Parser.SyntaxNode) {
  return {
    type: node.type,
    text: node.text,
    children: node.children.map(pp),
    namedChildren: node.namedChildren.map(pp),
  };
}

let global_unbound;

export function compileModule(node: Parser.SyntaxNode) {
  global_unbound = [];
  let st: Set<any> = new Set();
  switch (node.type) {
    case "module":
      node.namedChildren.forEach((n) => {
        compileModuleItem(n, st);
      });
      // For module items, we don't treat variables as defined, as, those
      // definitions will be rewrite, and we need to rewrite the varuse as well.
      //
      // node.namedChildren.reduce((acc, n) => {
      //   return union(acc, compileModuleItem(n, acc));
      // }, st);
      return global_unbound;
    default:
      throw Error(`unknown top node type: ${node.type}`);
  }
}

function compileForIn(node: Parser.SyntaxNode, st: any, named_expr) {
  let [left, expr] = node.namedChildren;
  compileExpression(expr, st);
  st = union(st, compileLHS(left, st));
  if (node.nextSibling?.type !== "for_in_clause") {
    compileExpression(named_expr, st);
  } else {
    compileForIn(node.nextSibling, st, named_expr);
  }
  return new Set();
}

function compileListComprehension(node: Parser.SyntaxNode, st: any) {
  let named_expr = node.namedChild(0);
  return compileForIn(node.namedChild(1)!, st, named_expr);
}

function compileForStatement(node: Parser.SyntaxNode, st: any) {
  let [left, right, body] = node.namedChildren;
  compileExpression(right, st);
  st = union(st, compileLHS(left, st));
  compileBlock(body, st);
  return new Set();
}

function compileTryStatement(node: Parser.SyntaxNode, st: any) {
  throw new Error("Function not implemented.");
}

function compileIfStatement(node: Parser.SyntaxNode, st: any) {
  let [comp, ifClause, elseClause] = node.namedChildren;
  compileExpression(comp, st);
  compileBlock(ifClause, st);
  if (elseClause) {
    compileBlock(elseClause, st);
  }
  // FIXME if-statement can introduce variable bindings to outside world.
  return new Set();
}

/**
 * 1. compile the expression
 * 2. return the new defined names
 * @param node
 * @returns
 */
function compileLHS(node, st) {
  // left hand side
  switch (node.type) {
    case "identifier":
      return new Set([node.text]);
    case "pattern_list":
      return new Set(node.namedChildren.map((n) => n.text));
    case "subscript":
      let [l, r] = node.namedChildren;
      compileExpression(r, st);
      return compileLHS(l, st);
    default:
      throw new Error("compileLHS: " + node.type);
  }
}

function compileAssignment(node: Parser.SyntaxNode, st: any) {
  let [left, right] = node.namedChildren;
  compileExpression(right, st);
  return union(st, compileLHS(left, st));
}

function compileAugmentedAssignment(node: Parser.SyntaxNode, st: any) {
  let [left, right] = node.namedChildren;
  compileExpression(left, st);
  compileExpression(right, st);
  return new Set();
}

function compileClassDefinition(node: Parser.SyntaxNode) {
  throw new Error("Function not implemented.");
}

function compileStatement(node: Parser.SyntaxNode, st) {
  switch (node.type) {
    case "expression_statement":
      return compileExpression(node.firstChild!, st);
    case "if_statement":
      return compileIfStatement(node, st);
    case "for_statement":
      return compileForStatement(node, st);
    case "while_statement":
      return compileWhileStatement(node, st);
    case "try_statement":
      return compileTryStatement(node, st);
    case "raise_statement":
      return compileRaiseStatement(node, st);
    case "break_statement":
    case "continue_statement":
    case "import_statement":
    case "comment":
      return new Set();
    case "block":
      return compileBlock(node, st);
    case "return_statement":
      if (node.firstNamedChild) {
        return compileExpression(node.firstNamedChild, st);
      }
      return new Set();
    default:
      throw Error(`unknown statement node type: ${node.type}`);
  }
}

function compileWhileStatement(node: Parser.SyntaxNode, st) {
  let [comp, body] = node.namedChildren;
  compileExpression(comp, st);
  compileBlock(body, st);
  return new Set();
}

function compileRaiseStatement(node: Parser.SyntaxNode, st) {
  throw new Error("Function not implemented.");
}

function compileBlock(node: Parser.SyntaxNode, st) {
  return node.namedChildren.reduce((acc, n) => {
    return union(acc, compileStatement(n, acc));
  }, st);
}

function compileFunctionDefinition(node: Parser.SyntaxNode, st) {
  let name = node.namedChildren[0];
  let args = node.namedChildren[1];
  // there may be (return) "type" or "comment" nodes in between.
  let body = node.namedChildren[node.namedChildren.length - 1];
  // parse parameters
  let argnames = args.namedChildren.map((arg) => {
    switch (arg.type) {
      case "identifier":
        return arg.text;
      case "typed_parameter":
        return arg.namedChild(0)!.text;
      default:
        throw new Error("function parameters: " + arg.type);
    }
  });
  compileBlock(body, union(st, new Set([name.text, ...argnames])));
  return new Set(name.text);
}

function compilePrimaryExpression(node: Parser.SyntaxNode, st) {
  switch (node.type) {
    case "attribute":
      let [obj, attr] = node.namedChildren;
      return compilePrimaryExpression(obj, st);
    default:
      return compileExpression(node, st);
  }
}

function compileCall(node: Parser.SyntaxNode, st) {
  let [callee, args] = node.children;
  compilePrimaryExpression(callee, st);
  args.namedChildren.forEach((n) => {
    switch (n.type) {
      case "keyword_argument":
        compileExpression(n.namedChild(1)!, st);
        break;
      default:
        compileExpression(n, st);
    }
  });
  return new Set();
}

function compileExpression(node: Parser.SyntaxNode, st) {
  switch (node.type) {
    case "integer":
    case "float":
    case "string":
    case "boolean":
      return new Set();
    case "binary_operator": {
      let [left, , right] = node.children;
      compileExpression(left, st);
      compileExpression(right, st);
      return new Set();
    }
    case "comparison_operator": {
      let [left, right] = node.namedChildren;
      compileExpression(left, st);
      compileExpression(right, st);
      return new Set();
    }
    case "list":
      return node.namedChildren.reduce((acc, n) => {
        return union(acc, compileExpression(n, acc));
      }, st);

    case "tuple":
      return node.namedChildren.reduce((acc, n) => {
        return union(acc, compileExpression(n, acc));
      }, st);
    case "pair":
      // This is interesting, it is actually `a:b` in {a:b for a in [1,2,3] for b in [4,5,6]}
      return node.namedChildren.reduce((acc, n) => {
        return union(acc, compileExpression(n, acc));
      }, st);
    case "identifier":
      if (!st.has(node.text)) {
        global_unbound.push(node);
      }
      return new Set();
    case "assignment":
      return compileAssignment(node, st);
    case "augmented_assignment":
      return compileAugmentedAssignment(node, st);
    case "call":
      return compileCall(node, st);
    case "expression_list":
      return node.namedChildren.reduce((acc, n) => {
        return union(acc, compileExpression(n, acc));
      }, st);
    case "list_comprehension":
      return compileListComprehension(node, st);
    case "dictionary_comprehension":
      return compileListComprehension(node, st);
    case "parenthesized_expression":
      return compileExpression(node.firstNamedChild!, st);
    case "subscript":
      return node.namedChildren
        .map((n) => compileExpression(n, st))
        .reduce(union);
    default:
      throw Error(`unknown expression node type: ${node.type}`);
  }
}

function compileModuleItem(node, st) {
  switch (node.type) {
    case "import_statement":
    case "import_from_statement":
    case "comment":
      return new Set();
    case "function_definition":
      return compileFunctionDefinition(node, st);
    case "class_definition":
      return compileClassDefinition(node);
    case "expression_statement":
    case "return_statement":
    case "if_statement":
    case "for_statement":
    case "while_statement":
    case "try_statement":
    case "raise_statement":
    case "break_statement":
      return compileStatement(node, st);
    case "expression":
      return compileExpression(node, st);
    default:
      throw Error(`unknown module node type: ${node.type}`);
  }
}
