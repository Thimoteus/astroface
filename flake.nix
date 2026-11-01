{
  description = "astroface - Pebble watchface dev environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
    in
    {
      devShells = nixpkgs.lib.genAttrs systems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.mkShell {
            packages = [
              pkgs.nodejs
              pkgs.git
            ];

            # Machine-specific config (PEBBLE_SDK) lives in the gitignored
            # .env.local
            shellHook = ''
              if [ -f ./.env.local ]; then
                set -a; . ./.env.local; set +a
              fi
              if [ -z "''${PEBBLE_SDK:-}" ]; then
                echo "warning: PEBBLE_SDK is not set - create ./.env.local with PEBBLE_SDK=/path/to/sdk" >&2
              elif [ ! -d "''${PEBBLE_SDK}/toolchain/moddable" ]; then
                echo "warning: PEBBLE_SDK=$PEBBLE_SDK has no toolchain/moddable - re-rsync the SDK from the build machine" >&2
              fi
            '';
          };
        }
      );
    };
}
