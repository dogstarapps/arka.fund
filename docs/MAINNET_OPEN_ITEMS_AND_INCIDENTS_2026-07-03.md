# Mainnet Open Items and User Incidents

Date: 2026-07-03

This document records the current final blockers before treating Arka as clean for mainnet publication. It also records real user-reported incidents that must feed the product and release checklist.

## Current State

- Contracts build and test locally, but the current local contract changes are not committed, pushed or upgraded on mainnet.
- Release WASM has been rebuilt after the current contract diff; rerun it only if contract code changes again.
- Current mainnet WASM binaries for the five changed release-candidate artifacts were backed up locally under `tmp/mainnet-wasm-backups/2026-07-04-current`; rollback procedure is documented in `docs/MAINNET_WASM_ROLLBACK_2026-07-04.md`.
- dApp TypeScript, unit tests, integration tests and full Playwright E2E have passed locally in the current wallet/create-flow cycle.
- Latest full dApp E2E run on 2026-07-04: `367` passed in `9.6m`.
- Vercel production should still not be redeployed from an uncommitted local state. Commit/push, CI, environment review and production smoke/E2E are required first.
- The new mainnet WASM set should not be activated as a normal release until the contract and dApp changes are committed, CI is green, and the mainnet upgrade/canary runbook is followed.
- The frontend credit/lending path uses the canonical `credit_*` API.
- Legacy `blend_*` public entrypoints remain in the ABI for compatibility, but the dApp must not call them directly.
- The current Arka contract implementation centralizes the credit write logic behind private helpers, so canonical `credit_*` and compatibility `blend_*` paths do not maintain separate business logic.
- Contract API compatibility is now tracked by `scripts/contract_api_surface_gate.py`.
- Internal contract fields can keep `*_bps` names, but public and manager-facing UI must render percentages and token units, not raw BPS or base units.
- Phoenix, SoroSwap and Aquarius have mainnet canary evidence for the USDC/XLM launch route. Their AUTO/manual status must be read from `deployments.mainnet.json` and the governed venue registry.
- Balanced/SODAX has mainnet canary evidence through the SODAX intent driver. It must not be described as the retired Balanced/Comet AMM-router lane.
- Strict Figma/pixel-perfect parity is advisory only and is not a mainnet release blocker.

The cross-repository release task list is tracked in `docs/MAINNET_RELEASE_TASKS_2026-07-03.md`.

## Mainnet Blockers Before Public Capital

### 1. Harden legacy Blend entrypoints

Status: resolved locally; pending commit/push and mainnet upgrade.

Why it matters:

- The compatibility `blend_*` entrypoints still exist publicly.
- They are protected by manager auth, asset whitelist and global venue registry checks.
- However, they should also be forced through the same governed market/action policy as the canonical `credit_*` path.

Required change:

- Keep the `blend_*` ABI for compatibility.
- Inside each legacy `blend_*` entrypoint, require:
  - the `market_id` exists as a governed `CreditProtocol::Blend` market;
  - the supplied `adapter` equals the configured adapter for that market;
  - the requested action is allowed by the governed credit market capabilities;
  - the global venue registry still allows that adapter.

Acceptance evidence:

- Unit tests proving disabled global venue blocks both `credit_*` and direct `blend_*`.
- Unit tests proving unconfigured markets are rejected by direct `blend_*`.
- Unit tests proving wrong adapter is rejected by direct `blend_*`.
- Unit tests proving disallowed action is rejected by direct `blend_*`.
- Local evidence: `cargo test -p arka` passed on 2026-07-03.
- Local evidence: full `cargo test` for the contracts workspace passed on 2026-07-03.
- Local evidence: `python3 scripts/contract_api_surface_gate.py --strict` passed on 2026-07-03.
- Local evidence: `cargo build --release --target wasm32-unknown-unknown -p arka` passed on 2026-07-03.

### 2. Resolve share-token upgrade posture

Status: resolved locally; release WASM built and local artifact hashes refreshed; pending mainnet upload/upgrade decision.

Why it matters:

- Most production contracts expose an `upgrade(caller, new_wasm_hash)` path using `update_current_contract_wasm`.
- `share-token` represents depositor ownership in a specific Arka, so its upgrade authority must not be conflated with the Arka mint/burn admin.
- The previous implementation let the factory change the share-token implementation hash for future Arkas, but already-created share-token contracts did not expose a governed upgrade surface.

Decision:

- Add a governed/temporary-admin `upgrade` path to `share-token`.
- Keep `Admin` as the Arka address for `mint`/`burn`.
- Add separate `UpgradeAdmin`, `Governor`, `BootstrapAdminExpiresAt` and `LastWasmHash` state for upgrade control.
- Add `init_with_upgrade_authority(admin, upgrade_admin, governor, expires_at)` for newly factory-created share tokens while preserving `init(admin)` for compatibility.
- Update `arka-factory` so new share tokens inherit factory bootstrap admin/expiry and governor when configured.

Acceptance evidence now available:

- `cargo test -p share-token`
- `cargo test -p arka-factory`

Still required before mainnet claims:

- Mainnet upload/upgrade transaction if the new share-token implementation is adopted.
- Mainnet manifest/runbook explicitly states how share-token implementation changes are handled.

### 2b. Close internal security audit REVIEW findings

Status: resolved locally; release WASM built and local artifact hashes refreshed; pending commit/push and mainnet upload/upgrade.

Original review findings:

- `adapter-soroswap::execute` appeared twice: active adapter execute without explicit auth, and mutating/external entrypoint without explicit auth.
- `arka::settle_fees` was flagged as mutating without local auth.
- `arka-token::allowance` was flagged as mutating without local auth.
- `arka-token::balance` was flagged as mutating without local auth.

Resolution:

- `adapter-soroswap::execute` now requires caller auth before approving/router execution.
- `adapter-phoenix::execute` was hardened in the same pass, because Phoenix is part of the active mainnet canary surface.
- `scripts/internal_security_audit.py` now includes `adapter-phoenix` in the active adapter audit set.
- `arka::settle_fees` is explicitly accepted as permissionless deterministic fee settlement: it applies already-configured fee policy and updates fee state/high-water marks.
- `arka-token::allowance` and `arka-token::balance` are explicitly accepted as read-through compatibility getters: they may migrate legacy instance storage to persistent storage and bump TTL, but they do not grant allowance, mint, burn, transfer or move value.

Acceptance evidence now available:

- `cargo test -p adapter-soroswap`
- `cargo test -p adapter-phoenix`
- Full contracts workspace `cargo test --quiet` passed on 2026-07-03.
- `python3 scripts/internal_security_audit.py --strict --report-json tmp/internal-security-audit-review-closure.json --report-md tmp/internal-security-audit-review-closure.md`
- `python3 scripts/contract_api_surface_gate.py --strict --report-json tmp/contract-api-surface-review-closure.json --report-md tmp/contract-api-surface-review-closure.md`
- `python3 scripts/validate_mainnet_manifest.py --manifest deployments.mainnet.json --phase postdeploy`
- `python3 scripts/mainnet_release_gate.py --manifest deployments.mainnet.json --report tmp/mainnet-release-gate-review-closure.json`
- `git diff --check`
- Audit result: `0` high findings, `0` review findings.

Release candidate evidence:

- `BUILD_CONTRACT_SET=production bash scripts/build-wasm.sh` passed on 2026-07-03 with Stellar CLI `26.1.0`.
- Local `deploymentPlan.contracts[].sha256` hashes were refreshed for `arka`, `shareToken`, `arkaFactory`, `adapterPhoenix` and `adapterSoroswap`.
- The corresponding `uploadedArtifacts` entries were cleared so the next mainnet deploy/upgrade script must upload the changed WASM instead of reusing prior ledger hashes.
- `wasmHashes` still represent the currently deployed mainnet hashes until upload/upgrade transactions are executed.
- Current mainnet WASM rollback backups were fetched and SHA-256 verified for `arka`, `shareToken`, `arkaFactory`, `adapterPhoenix` and `adapterSoroswap`.

### 3. Remove raw BPS/base-unit display from public and manager UI

Status: closed locally for public/manager product surfaces by full E2E; keep scoped as a regression watch item.

Why it matters:

- BPS are an internal contract/accounting unit, not user-facing finance copy.
- A user expects `2.00% management fee`, `10.00% max slippage`, `30.00% coverage lock`, or token-denominated amounts.
- Showing `bps`, `basis points`, raw `*_bps` field labels, or base units in product flows makes the product look unfinished and increases the risk of a user approving the wrong operation.

Required change:

- Public and manager-facing pages must not display:
  - `BPS`, `bps`, or `basis points`;
  - raw field labels such as `mgmt_bps`, `max_slippage_bps`, `lock_bps`;
  - base-unit amounts such as `100000000`;
  - raw method names unless the user is explicitly inside an advanced operator/contract console.
- Render those values as:
  - percentages for fee, slippage, impact, coverage, governance and policy ratios;
  - human token denominations for token amounts;
  - concise user copy that explains the outcome, not the internal field name.

Scope note:

- Advanced operator diagnostics may keep raw contract method names and keys when the purpose is transaction construction or rollback validation.
- Even there, helper text should show the human equivalent where possible.

Acceptance evidence:

- UI audit proving no public/manager product flow renders `bps`, `basis points`, `base units`, or raw `*_bps` labels. Internal source/test keys may still contain `*_bps` and base-unit attributes for contract encoding and assertions.
- Unit tests for percentage rendering of fee policy, swap risk policy and coverage lock values.
- E2E coverage for Create Arka, Governance/DAO composer, Arka detail swap/rebalance, Dashboard/Discover/Assets and Contracts operator surfaces. Local evidence: full `npm run test:e2e` passed on 2026-07-04 with `367` tests.

### 4. Commit and publish the final code state

Status: open.

Why it matters:

- The current local changes include contract refactors, API-surface documentation, dApp SDK cleanup and tests.
- The reviewable state must be committed and pushed before any external review, deploy or rollback planning.

Acceptance evidence:

- Clean git status in both repositories except intentional generated artifacts.
- No sensitive files committed.
- CI green on the pushed branches.
- Full dApp Playwright E2E green locally. Current evidence: `367` passed on 2026-07-04. CI and production-target E2E remain pending.

### 5. Mainnet upgrade/deploy and dApp cutover

Status: open.

Why it matters:

- Local green tests do not mean mainnet has the new WASM or config.
- Mainnet needs explicit deployment or `upgrade` transactions, updated manifest, and a dApp redeploy pointed at the final mainnet config.

Acceptance evidence:

- `deployments.mainnet.json` updated with final contract IDs and WASM hashes.
- Mainnet deployment or upgrade tx hashes recorded.
- Vercel production environment points to mainnet.
- `app.arka.fund` serves the intended production build.

### 6. Post-upgrade mainnet canary

Status: open.

Required canaries:

- Create Arka.
- Deposit.
- Redeem.
- Route execution with allowed venue.
- Venue kill-switch disables and re-enables a protocol.
- Credit/Blend path under the governed `credit_*` route.
- Direct legacy `blend_*` call is rejected when it violates governed market/action/adapter policy.
- Indexer/catalog/frontend reflects the resulting Arka and balances correctly.

### 7. Soroban deprecation warnings

Status: non-blocking cleanup.

Current warnings:

- `Events::publish` deprecation warnings.
- Test-only `Env::register_contract` deprecation warnings.

Decision:

- Not a blocker for this intervention.
- Should be cleaned before external audit or a long-lived mainnet release branch.

## User Incident Log

### INC-2026-07-03-001: Create Arka blocked by creation fee balance

Status: product copy fix implemented locally; wallet-backed reproduction still pending.

Reported by:

- Jordi Viladiu

Reported at:

- 2026-07-03 10:40 Europe/Madrid

User account:

- `GCWBC4RHJBDQWIZ2747BLJ35U5P6JPNXFAGKYWRNLDOIEBUPQ4AWSXEO`

User-reported message:

```text
Transaction blocked
Insufficient balance for the Arka creation fee.
```

User context:

```text
User says they have about 120 XLM and asks how much is required.
```

Current documented fee policy:

- The mainnet manifest records public creation as paid permissionless creation.
- Current manifest value: `10.00 USDC`.
- The creation fee is not paid in XLM unless the factory is configured with XLM as the creation-fee token.
- XLM is still required for network fees and account reserves, but XLM balance alone does not satisfy a USDC creation fee.

Preliminary assessment:

- This is probably not a pure balance problem in XLM.
- It is likely one of:
  - user has XLM but does not have enough USDC;
  - user lacks the USDC trustline / token balance required by the configured creation fee;
  - user did not approve the factory to transfer the USDC creation fee;
  - the UI error copy hides the required fee token and amount;
  - the dApp is checking or presenting the wrong asset balance.

Required product behavior:

- Before submission, the Create Arka review step must show:
  - creation fee token symbol and contract;
  - creation fee amount in human units;
  - user's balance in the fee token;
  - required allowance/approval state;
  - XLM reserve/network-fee requirement separately.
- If blocked, the message must be explicit:

```text
Creation fee requires 10.00 USDC. Your XLM balance only covers network fees and reserves. Add USDC or approve the factory before creating an Arka.
```

Local implementation note:

- The dApp now formats the creation fee in human token units, e.g. `10.00 USDC`, instead of raw base units or opaque contract IDs.
- The Create Arka preflight states that the fee is paid in the configured fee token and that XLM only covers network fees and account reserves.
- The insufficient-balance error now includes required amount, wallet balance in the fee token, and the XLM clarification.
- Local full E2E passed on 2026-07-04, including wallet-backed Create Arka coverage. A production/mainnet canary is still required after deployment.

Required engineering checks:

- Reproduce with an account that has XLM but no USDC.
- Reproduce with USDC balance but no allowance.
- Reproduce with enough USDC and allowance.
- Ensure the UI never says only "insufficient balance" without token, amount and next action.
- Ensure the API/server-side build response returns structured fields for `feeToken`, `feeAmount`, `feeBalance`, `allowance`, and `missingReason`.

Acceptance evidence:

- Unit test for creation-fee state labels. Current local evidence: `npx vitest run tests/unit/create-wizard-state.test.ts`.
- Integration test for XLM-only wallet showing a USDC-specific blocked reason.
- Integration test for USDC-without-allowance showing approval-specific blocked reason.
- Wallet-backed create canary after the fix.
