{ pkgs ? import <nixpkgs> {} }:

pkgs.python3Packages.buildPythonApplication {
  pname = "myapp";
  src = ./.;
  version = "0.1";
  propagatedBuildInputs = [ pkgs.python3Packages.ipykernel ];
}