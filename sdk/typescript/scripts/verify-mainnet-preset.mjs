import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const manifestUrl = new URL("../../../deployments.mainnet.json", import.meta.url);
const presetUrl = new URL("../src/networks/mainnet.ts", import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
const preset = await readFile(presetUrl, "utf8");
const failures = [];

for (const [name, contractId] of Object.entries(manifest.contracts)) {
  const match = preset.match(new RegExp(`\\b${name}:\\s*"([A-Z2-7]+)"`));
  if (!match) {
    failures.push(`${name} is missing from the SDK mainnet preset`);
  } else if (match[1] !== contractId) {
    failures.push(`${name} differs from deployments.mainnet.json`);
  }
}

if (failures.length > 0) {
  throw new Error(failures.join("\n"));
}

console.log(`Verified ${Object.keys(manifest.contracts).length} mainnet SDK contract identifiers.`);
