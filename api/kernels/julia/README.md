# Julia Kernel

Start the kernel:

```
julia -i --color=yes --project=/IJulia.jl /IJulia.jl/src/kernel.jl /conn.json
```

Using nix

```
nix-shell -p nixpkgs.julia --command "julia -i --color=yes --project=/IJulia.jl /IJulia.jl/src/kernel.jl /conn.json"
```
