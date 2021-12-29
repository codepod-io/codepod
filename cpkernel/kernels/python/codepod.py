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

from collections import defaultdict

d = {}

"""
here's the new plan for python's eval

Python's module is closely bound to the file system, so it is not possible to use that.

I have to use my own globals and locals during exec/eval.

Then, I'll just record the calling relationships for the modules. When evaluating, I'll:

1. eval_func(code, nses)
    - nses is a list of namespaces in order, the last one is this ns
    - that should be it. The question is where to compute nses. I would
        1. compute it when powerRunTree
        2. let the kernel knows it by using CODEPOD_ADD_IMPORT. The kernel will record this.
"""

# from ns to nses that should imported
import_d = defaultdict(set)
# from ns to exported names
export_d = defaultdict(set)
# from ns to subdeck nses
export_sub_d = defaultdict(set)
# to=>[from=>names]
reexport_d = defaultdict(lambda: defaultdict(set))

def CODEPOD_GETMOD(ns):
    if ns not in d:
        d[ns] = types.ModuleType(ns)
        d[ns].__dict__["CODEPOD_GETMOD"] = CODEPOD_GETMOD
    return d[ns]

def merge_dicts(dicts):
    """
    Given any number of dictionaries, shallow copy and merge into a new dict,
    precedence goes to key-value pairs in latter dictionaries.
    """
    result = {}
    for dictionary in dicts:
        result.update(dictionary)
    return result

def CODEPOD_ADD_IMPORT(FROM, TO):
    import_d[TO].add(FROM)
def CODEPOD_REMOVE_IMPORT(FROM, TO):
    if FROM in import_d[TO]:
        import_d[TO].remove(FROM)
def CODEPOD_SET_EXPORT(ns, exports):
    export_d[ns] = exports
def CODEPOD_SET_EXPORT_SUB(ns, nses):
    export_sub_d[ns] = nses
def CODEPOD_ADD_REEXPORT(from_ns, to_ns, names):
    reexport_d[to_ns][from_ns].update(names)

def CODEPOD_EVAL(code, ns):
    # the codepod(code) is the program sent to backend
    # codepod is defined on the kernel
    mod = CODEPOD_GETMOD(ns)
    [stmt, expr] = code2parts(code)
    
    # _dict = merge_dicts([{k:v for k,v in CODEPOD_GETMOD(x).__dict__.items() if k in export_d[x]} for x in import_d[ns]])
    # for from_ns, names in reexport_d[ns].items():
    #     for name in names:
    #         v = CODEPOD_GETMOD(from_ns).__dict__.get(name, None)
    #         if v:
    #             _dict[name] = v
    if stmt:
        exec(stmt, mod.__dict__)
    if expr:
        return eval(expr, mod.__dict__)