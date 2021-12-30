import ast
import types

# The followings are codepod kernel

def code2parts(code):
    ast1 = ast.parse(code)
    if not ast1.body:
        return [None, None]
    if not issubclass(type(ast1.body[-1]), ast.Expr):
        return [code, None]
    if len(ast1.body) == 1:
        return [None, code]
    else:
        return [compile(ast.Module(ast1.body[:-1], type_ignores=[]), "<ast>", "exec"), 
                compile(ast.Expression(ast1.body[-1].value), "<ast>", "eval")]

if __name__ == '__main__':
    code = "x=1+2\nx+2"
    [stmt, expr] = code2parts(code)
    if stmt:
        print('executing stmt ..')
        exec(stmt)
    if expr:
        print('evaluating expr ..')
        print(eval(expr))

d = {}

def CODEPOD_GETMOD(ns):
    if ns not in d:
        d[ns] = types.ModuleType(ns)
        d[ns].__dict__["CODEPOD_GETMOD"] = CODEPOD_GETMOD
    return d[ns]

def CODEPOD_EVAL(code, ns):
    # the codepod(code) is the program sent to backend
    # codepod is defined on the kernel
    mod = CODEPOD_GETMOD(ns)
    [stmt, expr] = code2parts(code)

    if stmt:
        exec(stmt, mod.__dict__)
    if expr:
        return eval(expr, mod.__dict__)