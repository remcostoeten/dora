{
  description = "Dora, a free, open source database client";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs }:
    let
      release = builtins.fromJSON (builtins.readFile ./release.json);
      systems = builtins.attrNames release.systems;
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      packages = forAllSystems (system: {
        dora = nixpkgs.legacyPackages.${system}.callPackage ./package.nix { };
        default = self.packages.${system}.dora;
      });

      apps = forAllSystems (system: {
        default = {
          type = "app";
          program = "${self.packages.${system}.dora}/bin/dora";
        };
      });

      overlays.default = final: _prev: {
        dora = final.callPackage ./package.nix { };
      };
    };
}
