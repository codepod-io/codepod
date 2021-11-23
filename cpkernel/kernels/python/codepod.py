import ast
import types


def code2parts(code):
    ast1 = ast.parse(code)
    if not ast1.body:
        return [None, None]
    if not issubclass(type(ast1.body[-1]), ast.Expr):
        return [code, None]
    expr = ast.unparse(ast1.body[-1])
    if len(ast1.body) == 1:
        return [None, expr]
    else:
        return [ast.unparse(ast1.body[:-1]), expr]


def _make_codepod():
    d = {}

    def getmod(ns):
        if ns not in d:
            d[ns] = types.ModuleType(ns)
            # for testing purpose
            d[ns].__dict__["CODEPOD_GETMOD"] = getmod
        return d[ns]

    def eval_func(code, ns):
        # the codepod(code) is the program sent to backend
        # codepod is defined on the kernel
        mod = getmod(ns)
        [stmt, expr] = code2parts(code)
        if stmt:
            exec(stmt, mod.__dict__)
        if expr:
            return eval(expr, mod.__dict__)

    return eval_func, getmod


CODEPOD_EVAL, CODEPOD_GETMOD = _make_codepod()
