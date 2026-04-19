# astroface

## CSV Data

Columns are:

Name, RA Hours, RA Minutes, RA Seconds, Dec Sign, Dec Degrees, Dec Minutes, Dec Seconds, Magnitude, B-V index

Hand-picked star names: Polaris, Rigel, Betelgeuse, Vega, Antares, Sirius, Capella, Fomalhaut, Spica

## IDE setup

After cloning (or after changes to `tsconfig.json`), reload the TypeScript language server in VS Code / VS Codium so it picks up the module paths for the Pebble SDK typings:

**Cmd/Ctrl+Shift+P → "TypeScript: Restart TS Server"**

## Emulator workflow

Use `npm run install:emery`. It builds, installs on the emery emulator, and tails logs in one command. The script retries up to 3 times with a 60s timeout per attempt; on failure it cleans up orphan `qemu-pebble`/`pypkjs` processes, the stale `/tmp/pb-emulator.json` state file, and the `~/.pebble-sdk/*/emery/qemu_spi_flash.bin` SPI image (a corrupt one presents as the firmware hanging at the Pebble logo and never emitting the boot banner). On a successful install, the script `exec`s into `pebble logs --emulator emery -v` so Ctrl+C cleanly exits instead of triggering a retry.

## Out-of-tree patch: `libpebble2` QEMU transport

The installed `pebble-tool`'s `libpebble2/communication/transports/qemu/__init__.py` has been hand-patched so `QemuTransport.connect()` retries `[Errno 111] Connection refused` for up to 5 seconds (20 × 0.25s) instead of failing on the first try. Without this, `pypkjs` races QEMU's bind of its first `-serial tcp::PORT,server,nowait` and dies before the install reaches the watch — `pebble-tool`'s `_wait_for_qemu` only watches the *second* serial for the firmware boot banner, so by the time it spawns `pypkjs` the first port may not yet be accepting connections.

Find the patched method by grepping for `# Patched by astroface:`. **Any reinstall of `pebble-tool` (e.g., `uv tool upgrade pebble-tool`) wipes this patch — re-apply after upgrades.** The retry-loop in `npm run install:emery` is the belt to this patch's suspenders.
