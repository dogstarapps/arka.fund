# R4 release with R6 offline signature validation

Status: **LOCAL CANDIDATE; MAINNET NOT APPROVED**. Noah remains V2. R6 authorizes only local cryptographic tests with runtime-random synthetic keys; no real wallet secrets, production access, transaction broadcasts or financial automation are used.

## Current result and scope

The original 18 omitted cryptographic cases are inventoried in [cryptographic-cases.json](../release/cryptographic-cases.json). The explicit signature profile runs them: 14 frontend, 3 catalog and 1 SDK. The SDK case verifies the actual Ed25519 signature, the exact transaction body, and rejection under a different key or network.

Fresh complete suites cover 1,179 frontend, 161 catalog unit, 42 catalog integration and 33 SDK tests, with no signature cases omitted in the explicit profile. Release/review invariants and the signature policy have separate checks. Execution receipts, exit status, unhandled-error reports and signature events determine acceptance; a green assertion count alone is insufficient.

The Node/Vitest signing policy covers SDK 14 and 16, CommonJS and ESM, and registers the actual SDK in the Vitest test realm. It accepts only keys generated with Keypair.random during that test process. Imported fixed keys are refused even if their error is caught. Append-only events persist signatures and denials immediately, including when a worker is terminated before exit. No signature bytes, envelopes or private keys are written to those event logs.

Default invocation continues to prohibit cryptographic signing. Test signing requires an explicit flag and a contained network profile. The combined release check and CI now invoke that profile deliberately.

The product contract, frontend runtime, catalog runtime, SDK runtime, lockfiles, wallet vendor and 23 WASM bytes remain unchanged from R5. R5's 236 native library tests, 23 reproducible WASM builds, 4 browser checks and dependency audits are **retained evidence**, not fresh R6 executions. R6 builds/types and crypto suites are new. The SDK source baseline remains 0.4.1; unrelated dirty 0.5.0 work is preserved.

## Reproduce

Use Node 22.15.0. Install only from the committed locks after checking the destination disk budget; the local R6 run reuses the exact R5 installations because all three locks and installed identities match. No node_modules or targets are copied into the worktree.

```sh
npm ci --prefix apps/web --legacy-peer-deps --ignore-scripts --no-audit --no-fund
npm ci --prefix services/catalog-api --ignore-scripts --no-audit --no-fund
npm ci --prefix sdk/typescript --ignore-scripts --no-audit --no-fund
ARKA_RELEASE_EVIDENCE_DIR=/absolute/new/evidence npm run release:signatures
```

That command builds the catalog and SDK before running all four suites and the signature policy tests. Use a fresh evidence directory: accepted receipts are not overwritten.

For one suite: `node release/run-local.mjs web-test|catalog-unit|catalog-integration|sdk-unit --ephemeral-signatures`. Build the catalog/SDK first. Without the flag, the 18 cryptographic cases remain deliberately omitted and signing is denied.

`npm run release:check` verifies source identity and runs contained builds, the full suites with explicit ephemeral signing, review/parser/source checks, policy checks and the local browser fixture. Chromium and ffmpeg are required for browser/media checks. Hosted CI is configured but has not been run or pushed by this task.

On the Mac, run the prescribed `$HOME/Documents/Codex/mac-maintenance/disk-budget.mjs` guard before each install, heavy build, worktree copy or package; reserve at least 20 GiB plus conservative growth.

## Preserved deployment constraints

[R4 binary provenance](../release/r4-import.json), [factory constructor profile](../release/factory-constructor-profile.json), [initialization matrix](../release/initialization-matrix.json) and [wallet provenance/license](../release/wallet-provenance.json) remain binding. Do not mix the new factory with legacy guard/share/venue-registry/Aquarius code. Auxiliary legacy init aliases reject reinitialization.

The vault remains 131,070 bytes, 2 bytes below the selected 131,072-byte admission limit. A source/binary change requires a new build and current admission check.

The read/review service remains loopback and GET-only with explicit configuration. Public frontend access requires trusted HTTPS origins and a trusted backend. There is no production target configuration or complete live index supplied by this revision.

`node release/source-gate.mjs` verifies exact source/lock/binary inventory, release ID and Noah V2. Its optional mainnet evidence parser checks structure/freshness only and cannot authenticate observations or authorize deployment.

## Actual remaining work

The authoritative current list is [MAINNET_PENDING.md](MAINNET_PENDING.md), also available as [mainnet-pending.json](../release/mainnet-pending.json). Local ephemeral signatures do not close the real wallet/device and submitted-canary work.

Protocol activation/deactivation is explicitly pending across governance, registry, fund policies, routing, API and frontend, including existing positions, debt, valuation and withdrawal/recovery behavior. Existing unit tests do not establish the complete lifecycle or current target configuration.

Sushi, RWA/Spiko and additional assets require their own eligibility, liquidity and real integration validation before activation. Hardening the retained Phoenix module does not approve it for launch.

Four inherited lint warnings and inherited import-formatting diagnostics remain maintenance items. They are not the npm dependency advisories and are not claimed fixed.
