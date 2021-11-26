function isModuleDefined(names)
    mod = :(Main)
    for name in names
        name = Symbol(name)
        if !isdefined(eval(mod), name) 
            return false
        end
        mod = :($mod.$name)
    end
    return true
end

# function ensureModuleDefined(namespace)
#     # ensure the module is defined, and return the module
#     # 1. split with /
#     names = split(namespace, "/", keepempty=false)
#     mod = :(Main)
#     for name in names
#         name = Symbol(name)
#         if !isdefined(eval(mod), name) 
#             include_string(eval(mod), "module $name using Reexport end")
#         end
#         mod = :($mod.$name)
#     end
#     return mod, eval(mod)
# end


function ensureModuleDefined(namespace)
    if !isdefined(eval(:Main), Symbol(namespace))
        expr = :(module $(Symbol(namespace))
                    using Reexport
                end)
        eval(expr)
    end
    mod = :($(:Main).$(Symbol(namespace)))
    return mod, eval(mod)
end

function CODEPOD_EVAL(code, ns)
    _, mod = ensureModuleDefined(ns)
    include_string(mod, code)
end


function CODEPOD_ADD_IMPORT(from, to, name)
    @debug "ensure " from
    from_name, _ = ensureModuleDefined(from)
    @debug "ensure " to
    _, to_mod = ensureModuleDefined(to)
    newcode = "using $from_name: $name as CP$name\n$name=CP$name\n$name"
    @debug "HEBI: newcode:" newcode
    include_string(to_mod, newcode)
end

function CODEPOD_DELETE_IMPORT(ns, name)
    _, mod = ensureModuleDefined(ns)
    include_string(mod, "$name=nothing")
end

import Pkg
# Pkg.activate("CODEPOD")