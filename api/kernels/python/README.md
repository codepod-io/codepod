# Python Kernel

```
python3 -m ipykernel_launcher -f ./conn.json
```

Or actually using nix:

```
nix-shell -p nixpkgs.python3Packages.ipykernel --command "python3 -m ipykernel_launcher -f ./conn.json"
```
