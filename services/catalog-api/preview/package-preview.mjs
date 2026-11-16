import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';

const source = fileURLToPath(new URL('./index.mjs', import.meta.url));
const output = resolve(process.argv[2] ?? fileURLToPath(new URL('../dist/testnet-preview/testnetPreview.mjs', import.meta.url)));
await mkdir(dirname(output), { recursive: true });
const bundle = await rolldown({
  input: source,
  platform: 'node',
  external: id => id === '@stellar/stellar-sdk' || id.startsWith('@stellar/stellar-sdk/') || id.startsWith('node:'),
  plugins: [{
    name: 'node-fetch-for-blob',
    resolveId(id, importer) {
      if (id === 'undici' && importer?.includes('/@vercel/blob/')) return '\0native-node-fetch';
    },
    load(id) {
      if (id === '\0native-node-fetch') return 'export const fetch = globalThis.fetch.bind(globalThis);';
    },
  }],
});
try {
  await bundle.write({
    file: output,
    format: 'esm',
    codeSplitting: false,
    banner: '/* eslint-disable -- Generated preview bundle, including the Vercel SDK. */',
  });
} finally {
  await bundle.close();
}
