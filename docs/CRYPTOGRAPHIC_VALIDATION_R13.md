# R13: offline ephemeral-key cryptographic validation

The user authorizes local cryptographic tests using only runtime-random ephemeral keys, without real wallets, transaction submissions or production access. Noah remains V2, mainnet execution remains disabled and Curve is deferred. R13 changes tests, their acceptance inventory and release documentation only; all product runtime sources, 114 contract sources and 24 selected WASM files remain identical to R12. No product verification bypass or new financial mechanism is introduced.

## Qualification

The accepted matrix contains **58 identified cases**: the existing 18 cases plus 40 new mainnet execution/receipt cases. `release/cryptographic-cases.json` records every full test name and file. `release/signature-check.mjs` requires all names to pass, zero catalog/SDK signing skips, no unhandled frontend errors and only the two exact separately gated financial VM skips. The final seal checks the complete fresh run, not just the initial focused pass.

The complete frontend suite passes **1302 tests, 0 failures, 2 separate VM skips**. Catalog tests pass **162 unit and 42 integration** cases, the SDK passes **33** cases, and all 13 key-policy guards pass. Functional suites record **60 runtime-random-key signatures** (52 frontend, 2 catalog unit, 5 catalog integration, 1 SDK). The final policy guard run records 9 additional signatures. Default-profile regression passes 19 noncryptographic cases with all 40 new signing cases skipped and zero signatures. TypeScript checks pass.

The 40 new cases use native SDK Ed25519 signing and verification. They do not mock `Keypair.verify`. Actual backend review preparation produces the unsigned XDR; the client verifies the wallet response, and actual backend receipt inspection verifies the public source signature before catalog reconciliation. The positive matrix covers approve, protected deposit, request, instant withdrawal, cancellation, claim, prepare liquidity, settlement, portfolio swap, spot recovery and creation.

Adversarial cases reject another signer or network domain, unsigned/zero/corrupted/additional signatures, fee bumps, and valid signatures over changed fee, destination or authorization bytes. They also reject post-signing body changes, expiry, wallet/network/fund changes, disabled execution and stale plans before any wire call. Receipt cases cover genuine source signatures with synthetic successful/failed result metadata, invalid receipt identity/result/fee/ledger, forged verification flags, expired missing receipts, lagging catalog and confirmation after a lost reply/reload without another write.

## Containment and limits

- Only `Keypair.random()`-origin keys are authorized by the process-wide signature policy. Imported synthetic-key signing is deliberately rejected by policy tests; no real credentials are read. Event evidence records counters and key origin, not keys, signature bytes or payloads.
- Frontend cryptographic tests run with the macOS network-denial sandbox plus JS containment. Catalog HTTP tests permit loopback fixture servers only, with remote endpoints and known RPC ports blocked. The new 40-case fixture also fails any `fetch` attempt.
- The source-signature verifiers are real. Wallet UI, RPC wire, state/admission recheck, header/account/registry data, transaction-result metadata and catalog observations are synthetic. The wire double only captures XDR in RAM; it constructs no RPC client and submits nothing to a ledger. This does not qualify consensus inclusion, execution result correctness or an operational index.
- Policy tests cover SDK CJS/ESM variants, fresh-key acceptance, imported-key/default denial and evidence persistence when a worker is terminated. Their expected rejection subprocesses are not signing-suite failures. A separate default-profile run leaves all 40 new signing cases skipped, runs the 19 existing noncryptographic transport cases and creates zero signatures.
- This is single-source-account signature coverage. Actual Freighter/devices, hardware or multisignature authorities and an authorized submitted canary remain open. Local use of the public-network hash domain does not contact mainnet or authorize activation.

## Evidence and provenance

Evidence: `../artifacts/v3-cryptographic-validation-r13-20261031/` alongside the release checkout. Controllers: `../v3-cryptographic-validation-r13/`. `suite/signature-acceptance.json`, job receipts, native-policy JSONL counters and `accepted-results.json` contain final counts. `closeout.json` binds them to the final commit, source inventory, exact unchanged runtime/WASM identities and the preserved R12 seal. Initial focused/diagnostic results are retained separately.

The first aggregate command failed after its functional suites and 13 guards passed: the reporter names the two intentional VM omissions `skipped`, while the collector checked only `pending`. The collector now recognizes both spellings and accepts only the two exact file/name pairs, leaving all 58 required crypto cases mandatory. Its final `--verify-existing` pass validates the preserved job receipts, log hashes, dependency locks, named cases and unhandled-error reports, then runs fresh policy guards. The final seal additionally compares all tested source identities; no runtime or test changes are borrowed across this collection fix. No full-suite pass is claimed for the initial failed command.

`test-source-inventory.json` records the tested sources before final documentation/metadata changes. The seal verifies no tested runtime or test changes afterwards. The fixtures use synthetic profile identifiers; they do not prove the intended deployment identity. Backend/SDK outputs were freshly built with the normal disk guard and exact-lock dependencies, without new installations. Frontend runtime and its prior build/browser results are reused by exact unchanged source identity from R12; no new frontend build or browser pass is claimed in R13. The new frontend test code passes TypeScript checks.

R12's complete UI/backend/P29 RAM five-lot financial replay is preserved by hash and is not rerun or converted into consensus evidence. The separate VM test skips are intentional. Historical source-signature evidence is superseded by fresh R13 local qualification; historical production readiness is not inferred from it.

## Remaining launch gates

The local cryptographic matrix is closed when the final accepted run and seal pass. Actual wallet/device tests and an authorized canary remain separate from these local signatures. Current target identities, roles, complete index, protocol activation/deactivation, Sushi callers/routes/current depth, admission/budget/TTL/restore, hosted CI, independent audit and deployment authorization are still required. No production protocol is activated. See [current pending work](MAINNET_PENDING.md) and [the structured list](../release/mainnet-pending.json).
