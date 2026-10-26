#!/usr/bin/env node
// Generates tsconfig.json from tsconfig.template.json by substituting the
// absolute path of the Pebble SDK's Moddable toolchain for the `__MODDABLE__`
// placeholder.
//
// The SDK is located (in order of precedence) at:
//   1. $PEBBLE_SDK (directory containing toolchain/moddable)
//   2. ~/.local/share/pebble-sdk/SDKs/4.33.1  (new pebble-sdk location)
//   3. ~/.pebble-sdk/SDKs/current             (legacy pebble-sdk location)

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const templatePath = join(projectRoot, "tsconfig.template.json");
const outputPath = join(projectRoot, "tsconfig.json");
const PLACEHOLDER = "__MODDABLE__";

const candidates = process.env.PEBBLE_SDK
	? [process.env.PEBBLE_SDK]
	: [
			join(homedir(), ".local/share/pebble-sdk/SDKs/4.33.1"),
			join(homedir(), ".pebble-sdk/SDKs/current"),
		];

const sdk = candidates.find((dir) => existsSync(join(dir, "toolchain/moddable")));
if (!sdk) {
	console.error(
		`error: could not locate the Pebble SDK. Tried:\n${candidates.map((c) => `  - ${c}`).join("\n")}\n` +
			"Set PEBBLE_SDK to the SDK directory containing toolchain/moddable.",
	);
	process.exit(1);
}

const moddable = join(sdk, "toolchain/moddable").replaceAll("\\", "/");
const rendered = readFileSync(templatePath, "utf8").replaceAll(PLACEHOLDER, moddable);

// tsconfig.json tolerates comments, but the template must be strict JSON so we
// can verify the substitution produced valid JSON.
JSON.parse(rendered);

writeFileSync(outputPath, rendered);
console.log(`wrote ${outputPath} (SDK: ${sdk})`);
