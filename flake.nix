{
  description = "Node pkgs environment";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    nixpkgs,
    flake-utils,
    ...
  }:
    flake-utils.lib.eachDefaultSystem (
      system: let
        pkgs = nixpkgs.legacyPackages.${system};
        lib = pkgs.lib;
        inherit (pkgs) importNpmLock;
        # The Node version is fixed here
        nodejs = pkgs.nodejs_24;

        nodeModulesDir = importNpmLock.buildNodeModules {
          inherit nodejs;

          package = lib.importJSON ./package.json;
          packageLock = lib.importJSON ./package-lock.json;
        };
      in {
        devShells.default = pkgs.mkShell {
          packages = [
            importNpmLock.hooks.linkNodeModulesHook
            nodejs
          ];
          npmDeps = nodeModulesDir;

          preShellHook = ''
            echo "Node.js version: $(node -v)
            add:
            npm install -D <package-name>@<version> --package-lock-only
            remove:
            npm uninstall -D <package-name> --package-lock-only
            convert package.json to package-lock.json:
            npm install --package-lock-only"
          '';
        };
      }
    );
}
