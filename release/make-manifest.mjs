import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inventory, releaseId } from './source-inventory.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const imported = JSON.parse(fs.readFileSync(root + 'release/r4-import.json'));
const files = inventory(root);
const manifest = { schema: 1, releaseId: releaseId(files), noah: imported.noah, mainnetApproved: false, files };
fs.writeFileSync(root + 'release/source-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ releaseId: manifest.releaseId, files: files.length, mainnetApproved: false }));
