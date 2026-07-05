# Mainnet Release Task List

Date: 2026-07-03

This is the current operational task list for bringing Arka to a clean mainnet release state. It replaces scattered "almost ready" notes, stale Figma/pixel gates, and older protocol-status language where those notes conflict with the mainnet manifest and canary evidence.

## Ground Truth

- Contracts repo: release-gate changes were committed and pushed to `dev` at `ce32021`; a follow-up manifest/docs commit records the 2026-07-04 selective mainnet upgrade evidence.
- dApp repo: release-gate changes were committed and pushed to `dev` at `12de3f1`; TypeScript, unit, integration and full Playwright E2E gates have passed locally in the latest wallet/create/routing closure cycle.
- Latest full dApp E2E run on 2026-07-04: `367` passed in `9.6m`.
- Vercel production must still not be redeployed from an uncommitted local state. Commit/push, CI, environment review and production smoke/E2E are required first.
- The changed mainnet WASM set was uploaded/activated selectively on 2026-07-04 for `arka`, `shareToken`, `arkaFactory`, `adapterPhoenix` and `adapterSoroswap`. A follow-up Arka accounting patch was also uploaded/activated after the Blend canary exposed receive-side rounding drift. Post-upgrade contract canaries have passed for Create Arka, deposit/redeem, Phoenix routing, venue kill-switch and post-fix Blend supply/withdraw accounting. Indexer/catalog reflection, Vercel production deploy and production smoke/E2E are still required before broad public-capital claims.
- Figma/pixel-perfect parity is no longer a release blocker. Layout must still be usable, readable and non-overlapping.
- Phoenix was not removed. Phoenix has mainnet contract and canary evidence.
- Balanced/SODAX was not removed. It is supported through the server-side SODAX intent driver, not through the legacy Balanced AMM-router adapter.
- Deployed mainnet contract WASM hashes match `deployments.mainnet.json` as of the 2026-07-03 RPC check in `docs/MAINNET_REALITY_CHECK_2026-07-03.md`.

## Protocol State

| Protocol | Current state | Remaining decision/work |
| --- | --- | --- |
| Phoenix | Mainnet canary passed for USDC/XLM; adapter and pool routes are present in the manifest. | Decide whether to move from allowed/manual-only to AUTO in the governed venue registry and factory defaults. |
| SoroSwap | Mainnet canary passed for USDC/XLM. | Same AUTO/governance decision as Phoenix. |
| Aquarius | Mainnet canary passed for USDC/XLM. | Same AUTO/governance decision as Phoenix. |
| Blend | Mainnet canary passed for fixed XLM-USDC supply/withdraw. A post-fix canary confirms Arka credits actual token deltas when the pool rounds down a withdraw. Borrow/repay remain disabled. | Keep credit actions governed through `credit_*`; validate any future borrow/repay enablement separately. |
| Balanced/SODAX | Mainnet canary passed through SODAX intent driver: quote, build, relay, submit, status, receipt, expiry and refund surfaces are represented. | Keep it as intent-driver execution. Do not describe it as a Soroban AMM router adapter. |
| Comet / legacy Balanced lane | Retired. | Keep out of user-facing product claims. |

## Real Remaining Tasks

### 1. Contract release closure

Status: committed/pushed and selectively upgraded on mainnet; post-upgrade Create Arka/deposit/redeem, Phoenix routing, Phoenix kill-switch and post-fix Blend accounting canaries passed. Indexer/catalog/frontend reflection remains.

- Keep the refactor that moved duplicated test blocks into `src/test.rs` files.
- Keep the canonical `credit_*` API and the legacy `blend_*` compatibility surface blocked from direct frontend usage.
- Keep the hardened legacy Blend checks: governed market, adapter match, action allowed and global venue registry.
- Keep the local `share-token` upgrade posture fix: share mint/burn admin remains the Arka, while upgrade authority is separated into bootstrap admin/governor controls.
- Keep the internal audit REVIEW closure: SoroSwap/Phoenix adapter `execute` paths now require caller auth, `adapter-phoenix` is included in the active adapter audit set, and the remaining unauthenticated mutations are explicitly reviewed/accepted in the audit report.
- Release WASM and local artifact hashes were regenerated after the current contract changes on 2026-07-03.
- Current mainnet WASM rollback backups were fetched and documented on 2026-07-04.
- Contract repo release gate commit pushed: `ce32021`.
- Selective mainnet upload/upgrade completed on 2026-07-04 and recorded in `deployments.mainnet.json`.
- Follow-up Arka accounting patch uploaded/activated on 2026-07-04. Current Arka WASM hash: `75fae87d8eb058c51098d5a05c2b4e73e63c44c10930280ab9c53d9539e12701`.
- Fresh Blend accounting canary Arka: `CDWJWFXS6IHMKTCJJR6U5DXYHY5FF2GW33JULLSRHHIXZ4ZKW6XTMLS7`.

Acceptance evidence:

- `cargo test` for the full contracts workspace.
- `python3 scripts/contract_api_surface_gate.py --strict`.
- `python3 scripts/internal_security_audit.py --strict`.
- Release WASM build.
- Updated `deployments.mainnet.json` local artifact hashes.
- `docs/MAINNET_WASM_ROLLBACK_2026-07-04.md` and a copied off-repo backup of the current mainnet WASM set.
- Mainnet upload/upgrade txs recorded in `validations.mainnetSelectiveUpgrade`.
- Arka accounting patch and fresh Blend canary recorded in `validations.mainnetArkaAccountingPatch`.

### 2. Frontend wallet and create-flow closure

Status: closed locally by full E2E; pending commit/push, production deploy and production-like canary.

- Ensure the selected wallet provider signs. A user who connected xBull must not be silently routed to Freighter.
- Keep a visible disconnect path in the header/chrome.
- The Create Arka flow must show the creation fee before signing: `10.00 USDC`, fee-token balance, allowance/approval state and separate XLM reserve/network-fee note.
- Reproduce the user incident where an account with XLM but insufficient USDC was blocked by the creation fee.
- Reproduce enough USDC but missing allowance.
- Run a wallet-backed create canary after the fix on the final production/mainnet build.

Acceptance evidence:

- Unit and integration tests for wallet provider persistence/disconnect and creation-fee state.
- Wallet-backed E2E create flow. Local evidence: full `npm run test:e2e` passed on 2026-07-04 with `367` tests.
- Mainnet or production-like canary evidence after deployment.

### 3. Full E2E red-to-green

Status: green locally; production-target run still pending after Vercel deploy.

- The previous red run (`292` passed, `59` failed, `16` did not run) has been superseded.
- Current local evidence: `npm run test:e2e` passed on 2026-07-04 with `367` tests in `9.6m`.
- The run covers public product routes, responsive/layout checks, Create Arka, wallet provider rejection paths, live testnet wallet-backed create/deposit/redeem, Blend, Aquarius, SoroSwap, best-execution rebalance, contracts mutation/readback/rollback, operator access, governance and screenshots.
- Rerun production-target E2E against `app.arka.fund` after deploy.

Acceptance evidence:

- `npm run test:e2e` green locally: `367` passed on 2026-07-04.
- Production smoke/E2E green after Vercel deploy.

### 4. User-facing copy and data cleanup

Status: closed locally for public/manager product surfaces by E2E; keep operator-console raw fields scoped to advanced diagnostics.

- Public and manager-facing UI must continue to hide raw `BPS`, `bps`, `basis points`, `*_bps` labels and base-unit amounts.
- Raw method names and internal fields remain acceptable only inside advanced operator/contract consoles, where the purpose is transaction construction, audit or rollback validation.
- Product copy must stay free of development-plan language.
- Protocol cards must reflect manifest/governed policy using precise language such as `Manual venue`, `AUTO enabled`, `Credit supply/withdraw`, or `Intent driver ready`.
- TVL/profit/volume/ranking copy must be based on indexed/oracle-backed data or clearly say valuation/pricing is unavailable.

Acceptance evidence:

- Search audit over public/manager routes. Internal source/test keys may still contain `*_bps` and base-unit attributes for contract encoding and assertions.
- Unit tests for percent/token formatting.
- E2E assertions for Create, Discover, Dashboard, Assets, Integrations, Governance and Arka detail copy. Local evidence: full `npm run test:e2e` passed on 2026-07-04.

### 5. Mainnet protocol activation policy

Status: decision needed.

- The manifest currently records Phoenix, SoroSwap and Aquarius as mainnet-canary passed but not AUTO-enabled in the manual launch gate.
- If the product claim is "smart routing uses these venues automatically", the venue registry/factory defaults must be moved to AUTO through the governed/admin path and then canaried again.
- If the launch remains guarded/manual, the frontend must say that clearly and must not imply automatic routing across a venue that is not admitted to AUTO.

Acceptance evidence:

- Manifest and frontend agree on each venue state.
- Venue kill-switch can disable and re-enable a venue.
- Smart-routing output only includes venues admitted by the current policy.

### 6. Indexer/catalog verification

Status: not closed for the final release state.

- After any mainnet upgrade or venue-policy change, verify the indexer/catalog reflects:
  - newly created Arkas;
  - deposits and redemptions;
  - share token balances;
  - TVL/pricing state;
  - manager and Arka rankings;
  - protocol canary activity.
- Do not use fake TVL/profit/volume data to hide missing indexing or pricing.

Acceptance evidence:

- Production catalog/API snapshots.
- Frontend views showing the same state as the registry and canary transactions.

### 7. Documentation alignment

Status: this document is aligned with the 2026-07-04 local E2E green state; broader docs still need a final pre-commit scan.

- Keep README, mainnet manifest, release gate, security audit output and dApp status docs aligned with the real protocol state.
- Remove or clearly mark stale testnet/demo docs that still mention routing asset A/B or old limitations as current production state.
- Keep Figma/pixel audit documented as advisory only, not a mainnet release blocker.
- Keep all user-reported incidents in the incident log until verified fixed.

Acceptance evidence:

- No current release doc claims Phoenix/Balanced are inactive when the manifest/canaries say otherwise.
- No current release doc claims E2E is red after the 2026-07-04 `367`-test green run.

### 8. Final publication sequence

Status: local gates, selective mainnet upgrade and post-upgrade contract canaries are complete; publication sequence is pending indexer/catalog/frontend reflection, Vercel and production E2E.

1. Commit and push the post-upgrade manifest/docs evidence, including the Arka accounting patch.
2. Verify indexer/catalog/frontend reflection against the post-upgrade mainnet canary state.
3. Sync dApp mainnet config if the manifest output consumed by Vercel changed.
4. Deploy Vercel production.
5. Run production E2E and smoke tests.
6. Update docs with final canary txs and production URLs.

## Explicitly Not Release Blockers

- Strict Figma/pixel-perfect parity.
- Historical Comet/Balanced AMM-router lane.
- Free Arka creation and registry pagination redesign. These are future product decisions, not the current paid-creation launch path.
- Broad new asset/pair expansion beyond the canaried launch routes. Additional assets need separate liquidity, oracle and routing validation.
