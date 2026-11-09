# Arka.fund FE functional and mainnet readiness audit

Date: 2026-06-08

Current status note, 2026-07-03: this audit is a historical snapshot from before the current mainnet manifest and canary pass. For current cross-repository facts, use `<workspace>/arkafund/deployments.mainnet.json`, `<workspace>/arkafund/docs/MAINNET_REALITY_CHECK_2026-07-03.md`, `<workspace>/arkafund/docs/MAINNET_RELEASE_TASKS_2026-07-03.md`, and `<workspace>/arkafund/docs/MAINNET_OPEN_ITEMS_AND_INCIDENTS_2026-07-03.md`.

Scope:

- Dapp deployed to Vercel production.
- Frontend product coverage against the current Soroban contract surface.
- Functional coverage against the documented tranche commitments.
- UX/copy/data truthfulness for a product that wants to be the Enzyme-like asset management layer for Stellar.
- Mainnet readiness gaps.

This is not a visual pixel audit. The user explicitly de-prioritized strict Figma parity. This audit focuses on whether the application is understandable, functional, economically truthful and aligned with the contracts.

## 1. Deployment evidence

Production deployment completed.

| Item | Result |
| --- | --- |
| Vercel deployment id | `dpl_CG2Pz21jQNgWj3h8WrR1zTUWcp29` |
| Production deployment URL | `https://arka-dapp-eayg3irqd-dogstar.vercel.app` |
| Primary app alias | `https://app.arka.fund` |
| Legacy alias | `https://arka-dapp.vercel.app` |
| Vercel state | `READY` |
| `https://app.arka.fund` | HTTP 200 |
| `/api/health` | `app: ok`, catalog reachable |

The Vercel production build ran the project release gate before deployment:

- `npm run audit:prod`
- `npm run test:release-gate`
- `next build`

Historical note: at the time of this audit, the deployed lane was still a testnet-oriented production web deployment, not a mainnet contract cutover. Current mainnet contract status must be read from the mainnet manifest and the 2026-07-03 reality check.

## 2. Reference target: what "Enzyme of Stellar" implies

The Enzyme reference is useful because it defines the product category:

- users invest in vaults and receive vault shares;
- managers create and operate vaults;
- vaults expose economic information: gross asset value, net asset value, share price, fees, activity and portfolio holdings;
- vault policy and fee settings are visible and enforceable;
- trading/lending integrations are part of vault operation, not disconnected diagnostics;
- investor flows are clear: deposit, redeem/withdraw, monitor value and activity.

Reference docs used:

- Enzyme docs home: https://docs.enzyme.finance/
- Enzyme investor/vault pages: https://docs.enzyme.finance/user-documentation/blue-investor-experience/your-vault-page
- Enzyme deposit docs search target: https://docs.enzyme.finance/
- Enzyme policy/fees docs search target: https://docs.enzyme.finance/

For Arka, the equivalent product promise is:

- Arka vault creation with denomination, fees, manager and allowed assets;
- share-tokenized deposits and redemptions;
- manager execution against supported Stellar venues;
- real valuation, returns, profit, volume and rankings;
- DAO-governed policy and upgrades after the bootstrap window;
- coverage/risk surfaces where the protocol offers them;
- no fake TVL, fake profit, fake volume or fake route availability.

## 3. Current contract capability inventory

The frontend is not covering a tiny contract. The contract surface is broad.

### Vault and factory

Source evidence:

- `arkafund/contracts/arka/src/lib.rs`
- `arkafund/contracts/arka-factory/src/lib.rs`
- `arkafund/contracts/arka-token/src/lib.rs`

Contract capabilities found:

| Contract area | Functions found | Product implication |
| --- | --- | --- |
| Factory | `set_governor`, `set_implementation`, `set_share_token_implementation`, `set_registry`, `set_protocol_treasury`, `set_protocol_fee_splits`, `set_creation_fee`, `share_token_of`, `get_arkas`, `get_arkas_by_manager` | FE must support creation, creation-fee visibility, registry-backed discovery and share-token lookup. |
| Vault init/config | `init`, `set_governor`, `set_fees`, `set_protocol_fee_policy`, `set_whitelist`, `set_swap_risk_policy`, `set_swap_oracle`, `set_allowed_venues`, `set_manager`, `set_router`, `set_share_token`, `set_blend_risk_policy` | FE must expose manager/governance controls through safe workflows, not arbitrary hidden parameters. |
| Investor flow | `deposit`, `redeem`, `shares_of`, `share_token`, `nav` | FE must support deposit/redeem with wallet signing, share display and valuation. |
| Execution | `rebalance` | FE must expose protocol-agnostic smart routing and per-protocol execution controls. |
| Credit | `credit_supply`, `credit_borrow`, `credit_repay`, `credit_withdraw`, credit market/value/health reads | FE must expose Blend as credit/lending, not as a swap venue. |
| Fees | `preview_fee_settlement`, `settle_fees`, fee state reads | FE should show user-level fees and vault fee state where meaningful. |
| Upgrade/admin | `upgrade`, `set_bootstrap_admin`, `set_bootstrap_admin_expiry`, `bootstrap_admin_active` | FE/operator surface must support the temporary admin window and DAO/governed upgrade handoff. |

### Routing and adapters

Source evidence:

- `arkafund/contracts/router/src/lib.rs`
- `arkafund/contracts/adapter-soroswap/src/lib.rs`
- `arkafund/contracts/adapter-aquarius/src/lib.rs`
- `arkafund/contracts/adapter-phoenix/src/lib.rs`
- `arkafund/contracts/adapter-balanced/src/lib.rs`
- `arkafund/contracts/adapter-blend/src/lib.rs`

Contract capabilities found:

| Venue | Contract support | Current product status |
| --- | --- | --- |
| SoroSwap | Adapter with `set_router`, `set_path`, `set_path_for_pool`, `execute` | FE routing planner includes SoroSwap direct/live quote model. Mainnet requires final route config and canary. |
| Aquarius | Adapter with `set_router`, `set_pool_route`, `execute` | FE routing planner includes Aquarius direct/live quote model. Mainnet requires real pool route config and canary. |
| Phoenix | Adapter with `set_pool_route`, `execute` | Implemented in contracts and FE planner, but must not be claimed AUTO-ready until real Phoenix pool route and quotes are configured. |
| Balanced/SODAX | Legacy adapter exists; official surface modeled as SODAX intent venue | FE exposes quote/status/receipt/refund/expiry APIs, but deployed health blocks AUTO and manual execution on this testnet lane. Correctly not production-admitted. |
| Blend | Adapter with market asset config and execute methods; Arka has credit-specific methods | FE should present as credit/borrow/lending with health/oracle/risk, not as AMM swap. Current Arka detail page does this. |

### Governance, DAO, tokenomics and coverage

Source evidence:

- `arkafund/contracts/governance-executor/src/lib.rs`
- `arkafund/contracts/governance-token/src/lib.rs`
- `arkafund/contracts/locked-arka/src/lib.rs`
- `arkafund/contracts/coverage-fund/src/lib.rs`
- `arkafund/contracts/coverage-vault/src/lib.rs`
- `arkafund/contracts/claims-manager/src/lib.rs`
- `arkafund/contracts/manager-tier/src/lib.rs`
- `arkafund/contracts/oracle-guard/src/lib.rs`

Contract capabilities found:

| Area | Functions found | Product implication |
| --- | --- | --- |
| Governance executor | `schedule`, `execute`, `set_min_delay`, `set_grace_period`, `upgrade`, bootstrap expiry | FE must support proposal staging and executor review, but generic calldata batching is still documented as future. |
| Governance token | `mint`, `mint_governed`, admin/governor/bootstrap expiry | Tokenomics can start under temporary admin/governed mint, but final allocation/vesting must be explicit. |
| Locked ARKA | `create_lock`, `withdraw`, `get_votes`, `get_past_votes`, delegate reads | FE should support lock/voting power views for DAO readiness. |
| Coverage fund/vault | deposits, withdrawals, claim capacity, claims manager, rewards and policies | FE has coverage surfaces, but mainnet requires live evidence and governance handoff. |
| Claims manager | incident execution and risk operator authorization | Mostly operator/risk surface, should stay role-gated. |
| Manager tier | thresholds and points | FE can show manager reputation/tiers, but this should be productized as manager quality, not internal score jargon. |
| Oracle guard | primary/secondary source policies, staleness/divergence checks, guardian, governance/admin | Critical for USD valuation, routing guardrails and NAV truthfulness. Mainnet policy is not final. |

## 4. FE coverage against contracts

### Create Arka

Source evidence:

- `src/app/factory/create/CreateArkaClient.tsx`
- `tests/unit/create-wizard-state.test.ts`
- `tests/unit/create-arka-mandate.test.ts`
- `e2e/create-wizard-matrix.spec.ts`

Coverage:

- Wallet connect step.
- Denomination selection through asset search/cards, not raw contract typing for normal users.
- Whitelist selection from known assets.
- Fee inputs: management, performance, deposit, redeem.
- Creation fee support.
- Preflight and wallet-signed create flow.
- Post-create profile link.
- Handoff to rebalance or Blend after create.

Assessment:

- Functionally strong for product create.
- Still has a few copy lines that describe transaction/config internals more than user benefit. Not a blocker, but should be softened before broad launch.
- Correctly avoids promising deposit limits/redemption rules that the create transaction does not install immediately.

Verdict: covered for testnet/product beta. Mainnet needs final asset registry, fee defaults, creation fee policy and mainnet factory/share-token implementations.

### Arka detail: deposit, redeem and portfolio state

Source evidence:

- `src/app/arkas/[id]/page.tsx`
- `tests/integration/arka-detail-page.test.tsx`
- `e2e/vault-profile.spec.ts`
- `e2e/vault-entrypoints.spec.ts`
- `e2e/wallet-backed.spec.ts`
- `e2e/wallet-backed-matrix.spec.ts`

Coverage:

- Deposit, redeem and redeem-all controls.
- Wallet-signed contract flow with amount validation.
- Asset selector based on known/whitelisted assets.
- Share display.
- NAV display from catalog/contract value where available.
- User operation state and error handling.

Assessment:

- Core investor flow exists.
- For an Enzyme-grade product, vault pages still need richer investor reporting: share price, personal P&L, entry value, current value, fees paid/accrued, deposit/redemption history and clean receipt history.
- Current data quality depends on catalog/indexer and oracle readiness. Without oracle-backed valuation, TVL must stay pending rather than fake.

Verdict: core flow covered; economic reporting not yet Enzyme-grade.

### Rebalance and smart routing

Source evidence:

- `src/app/arkas/[id]/page.tsx`
- `src/lib/workflows/rebalanceRouting.ts`
- `src/lib/runtime/rebalanceRoutingStatus.ts`
- `src/lib/runtime/rebalanceCanaryGate.ts`
- `tests/unit/rebalance-routing.test.ts`
- `tests/unit/rebalance-benchmark.test.ts`
- `tests/unit/rebalance-canary-gate.test.ts`
- `tests/integration/api-rebalance-route-plan-route.test.ts`
- `e2e/product-surfaces.spec.ts`
- `e2e/live-ops-surfaces.spec.ts`

Coverage:

- Protocol selector includes AUTO plus SoroSwap, Aquarius, Phoenix and Balanced.
- Asset in/out selectors.
- Amount input.
- Slippage input.
- Estimated receive/min-out.
- Price impact surfaced in the route summary.
- Route candidates, selected route, quote model and guardrail evaluation.
- Split-route optimizer logic exists for AUTO when enough live routes are available.
- Protocol blocking reasons are exposed.
- Wallet-signed rebalance handoff and receipt panel.

Assessment:

- The smart routing engine is materially more than a static UI. It scores route candidates and supports SoroSwap/Aquarius/Phoenix plus Balanced intent modeling.
- AUTO is only as strong as live quote/canary coverage. Mainnet needs route-by-route canaries and real pool config.
- Phoenix is implemented in contracts and planner, but should remain non-AUTO until real pool route config and quote readbacks are proven.
- Balanced/SODAX is correctly not treated like a normal AMM router. The server has quote/build/relay/submit/status/receipt/expiry/refund surfaces, but deployed health blocks AUTO because comparable execution/status is not admitted in this testnet lane.

Verdict: good testnet/beta smart-routing surface. Mainnet needs final canary evidence and venue admission records.

### Blend credit

Source evidence:

- `src/app/arkas/[id]/page.tsx`
- `src/lib/workflows/*`
- `arkafund/docs/BLEND_VAULT_INTEGRATION_PLAN.md`
- `tests/unit/arka-workspaces.test.ts`
- `tests/integration/workflow-surfaces.test.tsx`

Coverage:

- Blend shown as credit, not swap.
- Action selector for supply/borrow/repay/withdraw.
- Market selector.
- Asset selector.
- Amount input.
- Live collateral/debt/net value fields.
- Health factor and liquidation/risk indicators.
- Oracle freshness/integrity and policy fail-close messaging.
- Manager-only execution.

Assessment:

- Directionally correct and aligned with the contracts.
- Mainnet needs evidence that the deployed Blend ABI is the upgraded multi-asset vault-owned version and that all selected markets/assets have oracle coverage.
- Some copy still mentions internals like NAV fail-close. It is accurate, but should be translated to user language for public mode.

Verdict: covered at functional level; production needs mainnet market/oracle evidence.

### Governance and contracts administration

Source evidence:

- `src/app/governance/page.tsx`
- `src/app/governance/console/page.tsx`
- `src/app/contracts/page.tsx`
- `src/lib/workflows/governanceComposer.ts`
- `src/lib/contracts/mutationMatrix.ts`
- `tests/unit/governance-composer.test.ts`
- `tests/unit/contracts-mutation-matrix.test.ts`
- `tests/integration/contracts-page.test.tsx`
- `e2e/contracts-surface.spec.ts`

Coverage:

- Governance proposal staging.
- Executor status and action review.
- Mutation matrix for governed/admin actions.
- Bootstrap admin expiry and upgrade rows are represented.
- Contract WASM upgrade support is modeled as bootstrap-admin-or-DAO governed action.
- Storage lifecycle and security audit surfaces exist.

Assessment:

- The temporary EOA/bootstrap-admin model is implemented in contracts and represented in FE/operator surfaces.
- The DAO path exists through governance executor and governed setters, but the final deployment policy still must decide exact bootstrap duration, admin account, or multisig.
- Some governance composer actions still require raw contract IDs or CSV contract lists. For public/product usage, these must become selectors from known assets, venues, or contracts.
- Generic executable-batch governance is documented as not fully exposed by the contract. That is honest and should remain clear.

Verdict: strong operator coverage; public DAO UX and selector-backed governance still need productization before mainnet launch.

### Coverage, claims and manager tier

Source evidence:

- `src/app/coverage/page.tsx`
- `src/app/managers/page.tsx`
- `src/lib/contracts/mutationMatrix.ts`
- `tests/unit/coverage-workspaces.test.ts`
- `tests/unit/manager-leaderboard-ranking.test.ts`
- `tests/integration/manager-asset-surfaces.test.tsx`

Coverage:

- Coverage surfaces exist.
- Claim/fund/vault policy rows exist.
- Manager ranking/tier data is surfaced.

Assessment:

- Contract capability exists, but public product meaning must be clearer: what is covered, who funds coverage, what incidents can be claimed, how payouts work, and what limits apply.
- Claims manager/risk operator controls should remain operator-only.

Verdict: functionally represented; product copy and live evidence need work.

### Assets, Discover, Dashboard and rankings

Source evidence:

- `src/app/discover/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/assets/page.tsx`
- `src/app/managers/page.tsx`
- `src/lib/runtime/leaderboardSource.ts`
- `src/lib/catalog/*`
- `tests/unit/dashboard-discover-surfaces.test.ts`
- `tests/integration/dashboard-surface.test.tsx`
- `tests/integration/discover-surface.test.tsx`
- `tests/unit/asset-presentation.test.ts`

Coverage:

- Catalog-backed discovery and ranking surfaces.
- Real price/TLV/valuation states where catalog/oracle data exists.
- Missing USD pricing shown as pending instead of fake totals.
- Assets and managers pages exist.
- Public truthfulness tests exist.

Assessment:

- The app now correctly avoids fake `1B`/base-unit style values.
- The weak point is not lack of pages. It is data depth: for a real public product, users expect TVL/AUM, return, profit, volume, fees, holdings, manager track record and activity to be credible and consistently available.
- `Pricing pending` is acceptable as a safety state, but commercially weak. Mainnet launch needs oracle-backed USD valuation for the selected initial assets.

Verdict: structurally covered; economic data readiness is the biggest public-product gap.

## 5. FE coverage against documented tranche commitments

| Commitment | Evidence | FE status | Mainnet status |
| --- | --- | --- | --- |
| Configurable vaults | Create wizard, factory API, Arka detail | Covered | Mainnet manifest exists; current product blockers are tracked in the 2026-07-03 release task list |
| Share-tokenized deposits/redeems | Arka detail, factory share token lookup, contract share token support | Covered | Mainnet evidence exists for canary lifecycle; remaining issues are tracked in release tasks/incidents |
| Fee configuration | Create wizard, governance mutation matrix, fee settlement reads | Mostly covered | Needs fee policy signoff and reporting UX |
| Whitelist/allowed assets | Create wizard, governance matrix, asset registry | Covered for known assets | Needs final mainnet asset IDs and oracle coverage |
| Smart routing | Rebalance UI, route planner, benchmark/canary gates | Covered | SoroSwap/Aquarius/Phoenix have successful USDC-XLM mainnet canaries but remain `autoEnabled=false` in the current manifest |
| SoroSwap | Adapter and planner support | Covered | Mainnet canary passed; `autoEnabled=false` |
| Aquarius | Adapter and planner support | Covered | Mainnet canary passed; `autoEnabled=false` |
| Phoenix | Adapter and planner support | Implemented | Mainnet canary passed; `autoEnabled=false` |
| Balanced/SODAX | Server intent driver and health gate | Covered as server-side intent venue | Mainnet canary passed; `autoEnabled=true`; not the retired Balanced/Comet lane |
| Blend | Credit workspace | Covered | Supply/withdraw canary passed for fixed XLM-USDC market; borrow/repay disabled |
| DAO/governance | Governance pages, executor, mutation matrix | Covered for staging/operator control | Needs final bootstrap expiry/multisig/DAO policy and tx evidence |
| Coverage/claims | Coverage page and mutation matrix | Represented | Needs live funding/claims evidence |
| Oracle/indexed economic data | Catalog, OracleGuard, pricing pending states | Partially covered | Mainnet blocker until final provider/feed policies and canaries |
| Security/audit | Internal security audit route and docs | Covered internally | External audit still missing |
| Testnet dress rehearsal | Release gate docs/tests | Not complete as canonical evidence | Mainnet blocker |

## 6. Copy and UX audit

### Good corrections already in place

- Fake TVL/base-unit values have been removed from public cards.
- Discover cards no longer need raw manager/update text jammed into the chart area.
- Swap/rebalance UI now has price impact.
- Balanced/SODAX is only current as the SODAX server-side intent venue recorded in the manifest; the retired Balanced/Comet AMM-router lane must not be presented as current.
- Operator-only concepts are increasingly concentrated in `/contracts`, `/ops`, `/integrations/operator` and related surfaces.

### Remaining copy/product issues

| Severity | Area | Issue | Recommended correction |
| --- | --- | --- | --- |
| High | Public economic pages | `Pricing pending` is honest but appears too often and makes the app feel empty. | Finish oracle-backed pricing for initial mainnet assets. Use `Valuation pending` only when truly missing. |
| High | Governance/contracts | Some user-facing rows still read like internal runbooks. | Role-gate operator surfaces and keep public DAO UX focused on proposals, votes, treasury, policies and timeline. |
| High | Create Arka | Some explanatory copy describes transaction internals. | Keep the same truthfulness, but phrase around user choices: denomination, allowed assets, fees, launch review. |
| Medium | Blend | Terms like `NAV fail-close` are accurate but technical. | Public copy: "Actions are blocked while market pricing is stale." Advanced detail can remain expandable. |
| Medium | Routing | Route diagnostics are rich but can overwhelm. | Default to best route, receive amount, price impact, slippage, route path, reason if blocked. Hide solver internals under advanced. |
| Medium | Coverage | Coverage/claims need user-level meaning. | Explain covered vaults, available capacity, claim status and limits. Keep risk operator internals hidden. |

The latest deployed FE is cleaner than the older screenshots, but not all public copy is yet at consumer-grade polish.

## 7. Test coverage state

Evidence present in repo:

- 29 E2E spec files under `e2e/`.
- Unit/integration suites across catalog, dashboard, discover, routing, Balanced intents, governance, contracts matrix, operator access, layout, public surface truthfulness and wallet-backed flows.
- Release gate script: `npm run test:release-gate`.
- Full E2E entry: `npm run test:e2e`.

Tests recently run and passed during this work stream:

- `npx tsc --noEmit`
- focused Vitest suites for Arka detail, workflow surfaces and intent execution drivers
- `npx playwright test e2e/live-ops-surfaces.spec.ts --project=chromium --workers=1`
- `npx playwright test e2e/product-surfaces.spec.ts --project=chromium --workers=1`
- Vercel production release gate: `audit:prod`, `test:release-gate`, `next build`

Residual risk:

- The full `npm run test:e2e` matrix was not rerun in this audit pass after deployment.
- Wallet-backed E2E requires valid wallet/session assumptions and should be rerun during the formal testnet dress rehearsal.
- Contract test suites in the contracts repo should be rerun before any mainnet decision.

## 8. Mainnet readiness decision

The answer is: not yet ready for mainnet with real capital.

The FE is deployed and much of the product is functionally covered, but mainnet readiness requires evidence, not just code.

### Critical blockers

1. Mainnet deployment manifest is missing.
   - Need every final contract ID, WASM hash, admin/governor, bootstrap expiry and network.

2. Mainnet asset registry is not final.
   - Need USDC, XLM, EURC, AQUA, XTAR, BLND, SHX, XRF, VELO and YBX with issuer, SAC contract, decimals, symbols, venue support and oracle feed.

3. Oracle policy is not final.
   - Need provider decision, redundancy/divergence/staleness policy and canary evidence.
   - Given Reflector history concerns, Arka should not depend blindly on a single provider. OracleGuard/registry should be DAO-governed after the bootstrap window.

4. Economic data is incomplete.
   - Public TVL/AUM/ranking/profit/volume must be real and oracle-backed.
   - Pending states are honest but not good enough for launch positioning.

5. No external third-party audit.
   - Internal audit is closed, but docs explicitly say this is not an external audit or mainnet signoff.

6. Testnet dress rehearsal is not complete as canonical evidence.
   - Need tx hashes for create, deposit, redeem, rebalance, Blend action if enabled, governance queue/execute, coverage/storage lifecycle and oracle/routing canaries.

7. Smart-routing mainnet canaries are no longer missing for the initial USDC-XLM evidence set.
   - SoroSwap, Aquarius and Phoenix route canaries are recorded in the current mainnet manifest, with `autoEnabled=false`.
   - Balanced/SODAX is recorded through the SODAX server-side intent driver, with `autoEnabled=true`.
   - Broader route/asset coverage still needs expansion before public claims are widened beyond the validated scope.

8. Governance/admin cutover needs final operational policy.
   - Temporary EOA/admin exists in contract design.
   - For launch, define exact expiry, whether it is EOA or multisig, and DAO handoff timeline.

### High-priority non-blocking product gaps

1. Public DAO UX should be simplified.
2. Remaining raw contract/CSV inputs should become selectors where the value already exists.
3. Dashboard/Discover/Assets need richer real economic data.
4. Coverage/claims need user-level explanations.
5. Bundle/page weight can be improved later, but it is not the main blocker.

## 9. Recommended next work order

1. Create a mainnet manifest draft.
   - Contracts, WASM hashes, deploy order, init args, admin/governor, bootstrap expiry.

2. Finalize the mainnet asset and oracle registry.
   - Include the initial asset list and feed/provider policy.

3. Run contracts test gate in `arkafund`.
   - Full cargo/Soroban suite, adapter tests, governance/coverage/oracle tests.

4. Run full FE gate locally.
   - `npm run release:gate`
   - `npm run test:e2e`

5. Execute a final testnet dress rehearsal.
   - Record tx hashes and screenshots for each critical flow.

6. Route canary batch.
   - SoroSwap, Aquarius, Phoenix.
   - Balanced/SODAX stays visible as pending unless evidence upgrades it.

7. Mainnet deploy simulation.
   - Use Stellar CLI dry/simulate paths where possible.
   - Estimate XLM fees/storage from actual deploy artifacts.

8. External audit or at least independent audit review before real capital.

9. Deploy mainnet contracts.

10. Update Vercel env to mainnet and redeploy.

11. Run post-mainnet canaries and publish the final manifest.

## 10. Bottom line

Arka.fund now has a real deployed frontend and a broad contract-aligned product surface. It is much closer to a product than a pure validation console.

But the honest status is:

- FE: production deployed and functionally broad.
- Testnet product: usable for further validation.
- Mainnet with real capital: not ready until manifest, oracle, economic data, canaries, governance handoff and external audit evidence are complete.
