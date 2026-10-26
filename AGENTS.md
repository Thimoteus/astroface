Pebble SDK docs are located in ../pebble-watchface-docs and should be considered the authoritative source Pebble documentation.

## Environment
This machine (NixOS) cannot run the `pebble` CLI properly; it is only set up to work on a separate Ubuntu machine that this repo is pushed to, where all building and installing happens.

- **Never run `pebble` commands here** (`pebble build`, `pebble install`, `pebble logs`, `pebble kill`, `pebble clean`), nor npm scripts that invoke them: `build:pebble`, `clean`, `clean:emu`, `install:emery`, `install:phone`, `logs:phone`.
- Everything else can be run here and should be used to verify changes: `npm run build` (typecheck + bundle, no pebble), `npm run typecheck`, `npm run bundle:pkjs`, and the biome lint/format scripts.
- The root `tsconfig.json` is generated from `tsconfig.template.json` by `scripts/gen-tsconfig.mjs` (runs automatically via the npm `postinstall` hook). Never edit `tsconfig.json` by hand; edit the template instead.
