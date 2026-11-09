#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const packagePath = fileURLToPath(new URL("../apps/extension/package.json", import.meta.url));
const version = process.argv[2];

if (!version) {
  console.error("Usage: node scripts/sync-extension-version.mjs <version>");
  process.exit(1);
}

const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
packageJson.version = version;
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
