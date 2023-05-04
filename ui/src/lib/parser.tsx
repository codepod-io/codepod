import Parser from "web-tree-sitter";
import { match, P } from "ts-pattern";
import keywords from "./python-keywords";

let parser: Parser | null = null;
let parser_loading = false;

export async function initParser(prefix = "/", callback = () => {}) {
  if (parser_loading) return false;
  if (parser) {
    callback();
    return true;
  }
  return new Promise((resolve, reject) => {
    parser_loading = true;
    Parser.init({
      locateFile(scriptName: string, scriptDirectory: string) {
        return "/" + scriptName;
      },
    }).then(async () => {
      /* the library is ready */
      console.log("tree-sitter is ready");
      parser = new Parser();
      const Python = await Parser.Language.load(
        `${prefix}tree-sitter-python.wasm`
      );
      parser.setLanguage(Python);
      parser_loading = false;
      callback();
      resolve(true);
    });
  });
}

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
  // FIXME better error handling
  if (!code) return { ispublic, annotations };
  if (code.trim().startsWith("@export")) {
    ispublic = true;
    code = code.replace("@export", " ".repeat("@export".length));
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
  // FIXME better error handling
  if (!code) return { ispublic, annotations };
  if (code.trim().startsWith("@export")) {
    ispublic = true;
    code = code.replace("@export", " ".repeat("@export".length));
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

  let { unbound, errors } = compileModule(tree.rootNode);
  if (errors.length > 0) {
    console.log("ERROR in compileModule", errors);
  }
  unbound
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

  // Sort the annotations so that rewrite can be done in order.
  annotations.sort((a, b) => a.startIndex - b.startIndex);

  return {
    ispublic,
    annotations,
    errors,
    error_messages: errors.map((e) => e.message),
  };
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

function pp0(node: Parser.SyntaxNode) {
  return {
    type: node.type,
    text: node.text,
  };
}

function pp1(node: Parser.SyntaxNode) {
  return {
    type: node.type,
    text: node.text,
    namedChildren: node.namedChildren.map(pp0),
  };
}

function pp(node: Parser.SyntaxNode) {
  return {
    type: node.type,
    text: node.text,
    parent: node.parent && pp1(node.parent),
    namedChildren: node.namedChildren.map(pp),
  };
}

function mysubstr(text: string) {
  return text.slice(0, 40);
}

function notComment(n: Parser.SyntaxNode) {
  return n.type !== "comment";
}

let global_unbound: Parser.SyntaxNode[] = [];
let global_errors: any[] = [];

export function compileModule(node: Parser.SyntaxNode) {
  global_unbound = [];
  global_errors = [];
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
      break;
    default:
      global_errors.push({
        message: `unknown top node type: ${node.type} in ${mysubstr(
          node.text
        )}`,
        node: pp(node),
      });
      break;
  }
  return { unbound: global_unbound, errors: global_errors };
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
  let [left, right, body] = node.namedChildren.filter(notComment);
  compileExpression(right, st);
  st = union(st, compileLHS(left, st));
  compileBlock(body, st);
  return new Set();
}

function compileAsPattern(node: Parser.SyntaxNode, st: any) {
  let [source, target] = node.namedChildren;
  compileExpression(source, st);
  if (target) {
    return new Set([target.text]);
  }
  return new Set();
}

function compileExceptClause(node: Parser.SyntaxNode, st: any) {
  match(node.namedChildren.filter(notComment))
    .with([{ type: "as_pattern" }, P._], ([pattern, body]) => {
      st = union(st, compileAsPattern(pattern, st));
      compileBlock(body, st);
    })
    .with([P._, P._], ([pattern, body]) => {
      compileBlock(body, st);
    })
    .with([P._], ([body]) => {
      compileBlock(body, st);
    })
    .otherwise(() => {
      global_errors.push({
        message: `unknown except clause: ${node.type} in ${mysubstr(
          node.text
        )}`,
        node: pp(node),
      });
    });
  return new Set();
}

function compileTryStatement(node: Parser.SyntaxNode, st: any) {
  let [tryClause, ...clauses] = node.namedChildren;
  compileBlock(tryClause, st);
  clauses.forEach((clause) => {
    switch (clause.type) {
      case "except_clause":
        compileExceptClause(clause, st);
        break;
      case "else_clause":
      case "finally_clause":
        compileBlock(clause.namedChildren.filter(notComment)[0], st);
        break;
      default:
        global_errors.push({
          message: `unknown try clause: ${clause.type} in ${mysubstr(
            clause.text
          )}`,
          node: pp(clause),
        });
    }
  });
  return new Set();
}

function compileIfStatement(node: Parser.SyntaxNode, st: any) {
  // There's no way to get the children by field names. let cond =
  // node.childForFieldName("condition"); let alt =
  // node.childForFieldName("alternative");
  //
  // NOTE: When the if body starts with comment, it is passed as the children of
  // ifclause, not the children of the block.
  let [comp, ifClause, ...elseClauses] = node.namedChildren.filter(notComment);
  compileExpression(comp, st);
  compileBlock(ifClause, st);
  elseClauses.forEach((n) => {
    if (n.type === "else_clause") {
      // else
      compileBlock(n.namedChild(0)!, st);
    } else if (n.type === "elif_clause") {
      // else if
      compileExpression(n.namedChild(0)!, st);
      compileBlock(n.namedChild(1)!, st);
    } else {
      global_errors.push({
        message: `unknown if clause type: ${n.type} in ${n.text}`,
        node: pp(n),
      });
    }
  });
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
    case "tuple_pattern":
      return new Set(node.namedChildren.map((n) => n.text));
    case "subscript":
      let [l, r] = node.namedChildren;
      compileExpression(r, st);
      return compileLHS(l, st);
    case "attribute":
      let [obj, attr] = node.namedChildren;
      return compileLHS(obj, st);
    default:
      global_errors.push({
        message: `unknown LHS type: ${node.type} in ${mysubstr(node.text)}`,
        node: pp(node),
      });
      return new Set();
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

function compileClassDefinition(node: Parser.SyntaxNode, st) {
  match(node.namedChildren.filter(notComment))
    .with(
      [{ type: "identifier" }, { type: "argument_list" }, { type: "block" }],

      ([name, bases, body]) => {
        bases.namedChildren.forEach((n) => {
          compileExpression(n, st);
        });
        compileBlock(body, st);
        return new Set([name.text]);
      }
    )
    .with(
      [{ type: "identifier" }, { type: "block" }],

      ([name, body]) => {
        compileBlock(body, st);
        return new Set([name.text]);
      }
    )
    .otherwise(() => {
      global_errors.push({
        message: `unknown class definition: ${node.namedChildren.map(
          (n) => n.type
        )} in ${mysubstr(node.text)}`,
        node: pp(node),
      });
    });
  return new Set();
}

function compileWithStatement(node: Parser.SyntaxNode, st: any) {
  match(node.namedChildren)
    .with(
      [{ type: "with_clause" }, { type: "block" }],
      ([withClause, body]) => {
        st = withClause.namedChildren.reduce((acc, item) => {
          let n = item.namedChild(0)!;
          switch (n.type) {
            case "as_pattern":
              return union(acc, compileAsPattern(n, acc));
            default:
              return union(acc, compileExpression(n, acc));
          }
        }, st);
        // with body
        compileBlock(body, st);
      }
    )
    .otherwise(() => {
      global_errors.push({
        message: `unknown with statement: ${node.namedChildren.map(
          (n) => n.type
        )} in ${mysubstr(node.text)}`,
        node: pp(node),
      });
    });
  return new Set();
}

function compileStatement(node: Parser.SyntaxNode, st) {
  switch (node.type) {
    case "function_definition":
      return compileFunctionDefinition(node, st);
    case "class_definition":
      return compileClassDefinition(node, st);
    case "decorated_definition":
      return compileStatement(node.namedChild(1)!, st);
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
    case "with_statement":
      return compileWithStatement(node, st);
    case "break_statement":
    case "continue_statement":
    case "import_statement":
    case "import_from_statement":
    case "pass_statement":
    case "comment":
      return new Set();
    case "block":
      return compileBlock(node, st);
    case "return_statement":
      if (node.firstNamedChild) {
        return compileExpression(node.firstNamedChild, st);
      }
      return new Set();
    case "assert_statement":
    case "delete_statement":
    case "nonlocal_statement":
    case "global_statement":
      return compileExpression(node.firstNamedChild!, st);
    default:
      global_errors.push({
        message: `unknown statement node type: ${node.type} in ${mysubstr(
          node.text
        )}`,
        node: pp(node),
      });
      return new Set();
  }
}

function compileWhileStatement(node: Parser.SyntaxNode, st) {
  let [comp, body] = node.namedChildren;
  compileExpression(comp, st);
  compileBlock(body, st);
  return new Set();
}

function compileRaiseStatement(node: Parser.SyntaxNode, st) {
  node.namedChildren.forEach((n) => {
    compileExpression(n, st);
  });
  return new Set();
}

function compileBlock(node: Parser.SyntaxNode, st) {
  return node.namedChildren.reduce((acc, n) => {
    return union(acc, compileStatement(n, acc));
  }, st);
}

function compileArgs(node: Parser.SyntaxNode, st) {
  let argnames = node.namedChildren
    .map((arg) => {
      switch (arg.type) {
        case "identifier":
          return arg.text;
        case "typed_parameter":
          return arg.namedChild(0)!.text;
        case "list_splat_pattern":
          return arg.namedChild(0)!.text;
        case "default_parameter":
          return arg.namedChild(0)!.text;
        case "typed_default_parameter":
          return arg.namedChild(0)!.text;
        case "dictionary_splat_pattern":
          return arg.namedChild(0)!.text;
        case "keyword_separator":
          // def f(a, *, b,): pass
          return null;
        default:
          global_errors.push({
            message: `unknown function parameter type: ${arg.type} in ${arg.text}`,
            node: pp(arg),
          });
          return null;
      }
    })
    .filter((n) => n);
  return new Set(argnames);
}

function compileFunctionDefinition(node: Parser.SyntaxNode, st) {
  let name = node.namedChildren[0];
  let args = node.namedChildren[1];
  // there may be (return) "type" or "comment" nodes in between.
  let body = node.namedChildren[node.namedChildren.length - 1];
  // parse parameters
  st = union(st, compileArgs(args, st));
  compileBlock(body, union(st, new Set([name.text])));
  return new Set(name.text);
}

function compileGeneratorExpression(node: Parser.SyntaxNode, st) {
  let [exp, forin] = node.namedChildren;
  compileForIn(forin, st, exp);
  return new Set();
}

function compileCall(node: Parser.SyntaxNode, st) {
  let [callee, args] = node.children;
  compileExpression(callee, st);
  switch (args.type) {
    case "argument_list":
      args.namedChildren.forEach((n) => {
        compileExpression(n, st);
      });
      break;
    case "generator_expression":
      compileGeneratorExpression(args, st);
      break;
    default:
      global_errors.push({
        message: `unknown call argument type: ${args.type} in ${args.text}`,
        node: pp(args),
      });
  }
  return new Set();
}

function compileDictionary(node: Parser.SyntaxNode, st) {
  node.namedChildren.forEach((n) => {
    compileExpression(n, st);
  });
  return new Set();
}

function compileConditionalExpression(node: Parser.SyntaxNode, st) {
  let [left, cond, right] = node.namedChildren;
  compileExpression(cond, st);
  compileExpression(left, st);
  compileExpression(right, st);
  return new Set();
}

function compileLambda(node: Parser.SyntaxNode, st) {
  match(node.namedChildren)
    .with([{ type: "lambda_parameters" }, P._], ([args, exp]) => {
      compileExpression(exp, union(st, compileArgs(args, st)));
      // compile exp
    })
    .with([P._], ([exp]) => {
      compileExpression(exp, st);
    })
    .otherwise(() => {
      global_errors.push({
        message: `unknown lambda node type: ${node.type} in ${mysubstr(
          node.text
        )}`,
        node: pp(node),
      });
    });
  return new Set();
}

function compileExpression(node: Parser.SyntaxNode, st) {
  switch (node.type) {
    case "comment":
      return new Set();
    case "integer":
    case "float":
    case "string":
    case "boolean":
    case "ellipsis":
    case "none":
    case "false":
    case "true":
    case "concatenated_string":
    case "self":
    case "super":
      return new Set();
    // FIXME we should allow custom type names.
    case "type":
      return new Set();
    case "lambda":
      return compileLambda(node, st);
    case "keyword_argument":
      return compileExpression(node.namedChild(1)!, st);
    case "yield":
      if (node.firstNamedChild) {
        return compileExpression(node.firstNamedChild, st);
      }
      return new Set();

    case "generator_expression":
      return compileGeneratorExpression(node, st);
    case "dictionary":
      return compileDictionary(node, st);
    case "not_operator":
    case "await":
      return compileExpression(node.firstNamedChild!, st);
    case "attribute":
      let [obj, attr] = node.namedChildren;
      return compileExpression(obj, st);
    case "binary_operator":
    case "boolean_operator": {
      let [left, , right] = node.children;
      compileExpression(left, st);
      compileExpression(right, st);
      return new Set();
    }
    case "list_splat":
    case "dictionary_splat":
      return compileExpression(node.namedChild(0)!, st);
    case "unary_operator":
      return compileExpression(node.namedChild(0)!, st);
    case "comparison_operator": {
      let [left, right] = node.namedChildren;
      compileExpression(left, st);
      compileExpression(right, st);
      return new Set();
    }
    case "list":
    case "set":
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
    case "conditional_expression":
      return compileConditionalExpression(node, st);
    case "slice":
      node.namedChildren.forEach((n) => {
        compileExpression(n, st);
      });
      return new Set();
    case "subscript":
      return node.namedChildren
        .map((n) => compileExpression(n, st))
        .reduce(union);
    default:
      global_errors.push({
        message: `unknown expression node type: ${node.type} in ${mysubstr(
          node.text
        )}`,
        node: pp(node),
      });
      return new Set();
  }
}

function compileModuleItem(node, st) {
  switch (node.type) {
    case "expression":
      return compileExpression(node, st);
    default:
      return compileStatement(node, st);
  }
}
