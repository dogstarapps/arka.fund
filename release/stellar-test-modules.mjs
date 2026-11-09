import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function stellarTestModules() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const variants = [];
  for (const directory of ['apps/web', 'services/catalog-api', 'sdk/typescript']) {
    const folder = path.join(root, directory, 'node_modules/@stellar/stellar-sdk');
    if (!fs.existsSync(path.join(folder, 'package.json'))) continue;
    const metadata = JSON.parse(fs.readFileSync(path.join(folder, 'package.json')));
    const require = createRequire(path.join(root, directory, 'package.json'));
    variants.push({ sdk: require('@stellar/stellar-sdk'), version: metadata.version, format: 'require' });
    const entry = metadata.exports?.['.']?.import;
    if (entry) variants.push({ sdk: await import(pathToFileURL(path.join(folder, entry))), version: metadata.version, format: 'import' });
  }
  return variants;
}
