# Mainnet Cutover And Product Validation Next Steps

Date: 2026-06-05

Status: working runbook for the next implementation prompts.

This document records the next validation and implementation sequence before Arka.fund can be treated as a mainnet product. It consolidates the previous mainnet cutover answer with the current product concerns: execution UI quality, smart routing quality, real economic data, ranking truthfulness, and user-facing copy.

This is not a claim that mainnet is already published. It is the queue of work and evidence required before that claim is safe.

## 1. Product Principles

Arka.fund must read as a financial product, not as an internal validation console.

Public and manager-facing screens must:

- show real economic information, or explicitly say that the value is unavailable because a required source is missing;
- use dropdowns, searchable selects, segmented controls, card selectors or typeaheads for known assets, Arkas, venues, managers, markets and oracle feeds;
- show token amounts in user denominations, not base units;
- expose contract IDs, XDR, raw hashes and method names only inside Advanced Console/operator surfaces;
- avoid repeated non-interactive boxes that only say blocked, unavailable, pending or internal status without a user action or useful drill-down;
- make it clear whether a venue is executable in AUTO, manually executable, read-only, or blocked from execution;
- never rank, sort or summarize Arkas using fake TVL, fake profit, fake volume, fake time series or mixed-denomination totals without an oracle-backed conversion.

Related existing requirement: `docs/PRODUCT_ECONOMIC_UI_REQUIREMENTS_2026-06-02.md`.

## 2. Execution UI Validation

Every execution family needs a professional, product-grade interface.

### 2.1 Swap Venues

Applies to SoroSwap, Aquarius, Phoenix when admitted, and any future AMM/router venue.

The user interface must expose:

- input asset selector;
- output asset selector;
- amount input using decimal token units;
- slippage control or policy-bound slippage display;
- quote output;
- minimum received;
- estimated fees;
- price impact;
- route path and venue;
- route confidence or execution state;
- quote freshness;
- wallet-backed transaction preview/build;
- execution receipt/status after submit.

Acceptance:

- no manual asset contract input in normal manager/product flow;
- no base-unit labels in normal manager/product flow;
- route plan comes from the backend planner/API or a clearly identified live venue quote;
- blocked routes explain the exact user-relevant reason, such as missing liquidity, stale oracle, price impact over policy, venue paused, asset not whitelisted or quote unavailable.

### 2.2 Blend Credit Venue

Blend is not a swap venue. It must be presented as lending/borrowing and strategy execution.

The user interface must expose:

- market selector;
- action selector: supply, borrow, repay, withdraw;
- asset selector from the configured market assets;
- amount input in token units;
- collateral, debt and net exposure;
- health factor or equivalent risk metric;
- borrow capacity and liquidation threshold where available;
- oracle source and freshness/integrity;
- policy limits;
- wallet-backed transaction preview/build;
- execution receipt/status after submit.

Acceptance:

- Blend must not appear inside swap best-execution comparisons;
- Blend positions must be reflected in Arka NAV only when the value is supported by live market and oracle reads;
- dangerous actions must be blocked when health factor, oracle integrity or policy checks fail.

### 2.3 Balanced / SODAX Intent Venue

Balanced/SODAX must remain modeled as an intent venue, not as a fake AMM router.

Before admitting it into AUTO, the product must have machine-consumable support for:

- quote;
- status;
- receipt/confirmation;
- expiry;
- refund/failure handling;
- fee/rate-limit assumptions;
- wallet-backed submit or explicit handoff.

Acceptance:

- if the full lane is not production-grade, Balanced/SODAX is visible as pending/manual/evidence-backed, not as AUTO executable;
- the UI must not imply that a public Soroban router exists if execution is intent-based.

## 3. Smart Routing Validation

The routing layer must be evaluated as a serious best-execution component, not just as a route picker.

Required validation dimensions:

- venue coverage: SoroSwap, Aquarius, Phoenix after configured, and future intent venues only when comparable;
- asset coverage: USDC, XLM, EURC, AQUA, XTAR, BLND, SHX, XRF, VELO and YBX when mainnet asset IDs and venue coverage are confirmed;
- route types: direct, bounded multi-hop, route-disabled, route-paused and policy-blocked;
- scoring: output, fees, slippage, price impact, quote freshness, fill risk, hop penalty, confidence and venue status;
- guardrails: whitelisted assets, allowed venues, max slippage, max price impact, max trade size, oracle freshness, daily turnover/runtime state where available;
- latency: quote/planner response must be fast enough for product use, with timeouts and fail-closed behavior;
- determinism: the selected route and rejected alternatives must be reproducible in tests and inspectable by the UI;
- benchmark posture: compare against known Stellar routing surfaces where applicable, while explicitly tracking that Stellar classic SDEX routing is not included unless implemented.

Acceptance:

- route planner unit and integration tests cover success, blocked, stale, missing liquidity, high price impact, multi-hop and venue failure cases;
- browser E2E verifies that managers can select assets, request quote, review route, and build/submit the wallet-backed transaction path;
- routing canary evidence exists before mainnet release.

Update 2026-06-05:

- SoroSwap multi-hop planner/execution parity is closed in the dApp: a selected multi-hop route is no longer blocked in the Arka execution UI. It builds a single vault-owned `Arka.rebalance` step against the SoroSwap adapter using the route pool id, initial input asset and final output asset.
- Split-route allocations now preserve adapter and pool metadata so chunked AUTO execution does not silently fall back to the wrong pool id.
- Focused validation passed for planner unit tests, route-plan API tests, Arka detail wallet-backed build tests, browser rebalance UI tests and `tsc --noEmit`.

## 4. Economic Data And Ranking Validation

Discover, Dashboard, Assets, Managers, Vaults and Arka detail must rank and summarize using real indexed data.

Required product metrics:

- AUM/NAV in vault denomination;
- USD estimate only when oracle-backed;
- return windows: 1D, 7D, 30D, 1Y and ALL where history exists;
- profit/loss in denomination and USD where oracle-backed;
- routed volume;
- deposits, redemptions and net flow;
- asset weights and value contribution;
- fees and fee policy;
- manager identity and performance;
- oracle source, freshness and missing-price reasons.

Ranking and filters must support:

- NAV/AUM;
- return/profit;
- volume;
- fee level;
- asset count;
- denomination;
- manager;
- supported venue;
- status.

Acceptance:

- no card may show `1B`, base units, raw summed units or mixed-denomination aggregate as user-facing value;
- when USD conversion is unavailable, show grouped denomination totals or an unavailable state with the missing source;
- rankings must use indexed/catalog data or on-chain reads, not fixture/fallback values in production mode;
- every unavailable value must have a product reason, not internal wording such as `History pending` glued into charts.

## 5. Product Copy And Surface Audit

Before mainnet, run a route-by-route audit for:

- AI-like copy;
- internal implementation language;
- duplicated blocked/unavailable cards;
- diagnostic panels visible in public product screens;
- labels that expose process instead of user value;
- missing padding/spacing that makes data unreadable;
- outdated names such as legacy Arka labels or removed venues;
- repeated buttons or navigation actions.

Acceptance:

- public screens communicate value, risk, action and evidence;
- operator screens can remain technical, but are clearly separated;
- no route mixes product copy with raw diagnostics unless behind an Advanced disclosure.

## 6. Mainnet Cutover Inputs Needed

Before executing a mainnet deployment, the project needs:

- a dedicated Stellar mainnet deployer identity configured in Stellar CLI;
- the deployer public address and local identity name, without sharing the secret key in chat;
- funded XLM budget for deployment, storage rent, canaries and retries;
- a reliable mainnet Soroban RPC provider or self-hosted RPC;
- final admin/governance policy: temporary EOA with expiry plus guardian, DAO from day one, or staged handoff;
- guardian/multisig address if used;
- ARKA token supply, allocation, vesting, emissions and treasury recipients;
- exact mainnet asset identifiers for USDC, XLM, EURC, AQUA, XTAR, BLND, SHX, XRF, VELO and YBX;
- oracle policy per asset;
- SoroSwap, Aquarius and Phoenix mainnet route/pool/router configuration;
- Balanced/SODAX admission decision and evidence state;
- Vercel production environment variables and `app.arka.fund` domain readiness.

## 7. Mainnet Cutover Sequence

The safe order is:

1. Build optimized WASM artifacts.
2. Run full contract unit/integration tests.
3. Run dApp typecheck, build, unit/integration and browser E2E suites.
4. Configure mainnet Stellar CLI identity.
5. Run a mainnet preflight simulation for every deployment and initialization transaction.
6. Produce an XLM cost report before submitting live transactions.
7. Deploy core contracts and governance/tokenomics stack according to the selected admin model.
8. Deploy and configure adapters, OracleGuard, registry/factory, fee, coverage and claims components.
9. Record the final mainnet manifest.
10. Run live canaries: oracle, routing, create Arka, deposit, redeem, rebalance, Blend action if enabled, governance queue/execute, storage lifecycle.
11. Update the dApp mainnet manifest and production environment.
12. Run `/api/release/gate` against production.
13. Deploy Vercel production to `app.arka.fund`.
14. Monitor logs, canaries and incident controls.

## 8. Required Evidence Artifacts

The following artifacts must exist before declaring mainnet-ready:

- mainnet deployment manifest with every contract ID;
- mainnet asset registry with symbols, issuers, contract IDs, decimals and oracle feeds;
- XLM preflight cost report;
- oracle canary evidence;
- routing canary evidence;
- product economic data source evidence;
- wallet-backed execution evidence for manager flows;
- release gate response from the production domain;
- post-deploy smoke report;
- explicit unresolved risk list.

## 9. Suggested Next Prompt Order

Use this order in future prompts:

1. Product audit red-to-green: remove bad public copy, fake values and low-value diagnostic boxes.
2. Economic data audit: prove NAV, profit, volume and rankings are real and oracle-backed.
3. Execution UI audit: swap venues and Blend controls, selectors, slippage, price impact and wallet-backed flows.
4. Smart routing benchmark: route quality, latency, failure cases and canary design.
5. Mainnet preflight script: cost simulation and deployment manifest preparation.
6. Mainnet cutover runbook execution after explicit go/no-go.

## 10. Release Rule

Arka.fund can be called mainnet-ready only when the user-facing product, contract deployment, oracle/routing canaries, real economic data, wallet-backed execution flows and production release gate all agree.

If any of those disagree, the UI must state the limitation honestly and the release must remain gated.
