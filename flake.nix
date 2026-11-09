{
  description = "bespoke-portainer-ce: pinned environment for build and test";

  # flake.lock pins both inputs to exact nixpkgs commits.
  # - nixpkgs provides Go 1.26.10 (go.mod) and GNU make.
  # - nixpkgs-node is an older nixpkgs commit whose nodejs_22 is 22.22.1
  #   (package.json engines ^22.22.1); current nixpkgs has a newer 22.x.
  # pnpm is overridden to 10.26.2 (package.json packageManager).
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    nixpkgs-node.url = "github:NixOS/nixpkgs/33b45ad1d45f5556220ed307d6f4c202ccffea1a";
  };

  outputs = { self, nixpkgs, nixpkgs-node }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "aarch64-darwin" ];
      forAll = f: nixpkgs.lib.genAttrs systems (system: f {
        pkgs = nixpkgs.legacyPackages.${system};
        pkgsNode = nixpkgs-node.legacyPackages.${system};
      });
    in {
      # Enter with `nix develop`, or run one command inside it:
      #   nix develop -c make test
      devShells = forAll ({ pkgs, pkgsNode }:
        let
          go = pkgs.go_1_26;
          nodejs = pkgsNode.nodejs_22;
          pnpm = pkgs.pnpm_10.override {
            version = "10.26.2";
            hash = "sha256-Y7UKS6Fc3iAAbdul2eIf1iPiPwlMn2O7FfaGsOSWrtY=";
            nodejs-slim = pkgsNode.nodejs-slim_22;
          };
        in {
          default = pkgs.mkShell {
            packages = [ go nodejs pnpm pkgs.gnumake pkgs.git ];
            shellHook = ''
              # Use the Go from this shell, never a toolchain downloaded by go.mod.
              export GOTOOLCHAIN=local
            '';
          };
        });
    };
}
