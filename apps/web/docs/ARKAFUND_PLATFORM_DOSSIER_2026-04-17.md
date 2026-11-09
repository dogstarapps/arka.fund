# Arka.fund Platform Master Dossier
Date: 2026-04-17  
Status: canonical consolidated dossier (contracts + dApp + operations)

## 1) Purpose and scope

This dossier is the single consolidated view of the platform across:

- functional features and protocol behavior
- contract architecture and on-chain governance
- token system and tokenomics
- oracle safety and release gating
- storage/rent lifecycle hardening
- registry/indexing/data plane
- frontend feature coverage
- routing and execution model
- security controls and audit status
- test evidence and operational status

It is intentionally explicit about what is complete vs partial vs pending.  
No section should be interpreted as mainnet-live unless explicitly marked as such.

## 1.1) Reading key: how to interpret claims in this dossier

To avoid overstating delivery, this dossier uses the following evidence grammar:

- `Documented target`:
  - the behavior or control is defined in docs/plans, but may not exist yet in code.
- `Implemented in contracts/code`:
  - the behavior exists in repository code.
- `Exposed in FE/API`:
  - the behavior is surfaced in the dApp, runtime API, SDK, or control room.
- `Locally tested`:
  - covered by unit, integration, or local end-to-end tests.
- `Testnet-validated`:
  - there is explicit testnet evidence in scripts, manifests, or recorded validation artifacts.
- `Mainnet-ready`:
  - should not be assumed from any of the above unless stated explicitly.

Default interpretation rules:

- `canonical` means "part of the intended supported architecture", not automatically "fully promoted in every environment".
- `validated` without qualifier in this dossier should be read as `testnet-validated`, not mainnet-live.
- `implemented` never means "fully closed as product objective" unless the surrounding text says so explicitly.
- `documented controls` are not the same thing as `active controls in contract`.

## 2) Canonical sources used

Contract-side sources:

- `../arkafund/docs/ARCHITECTURE.md`
- `../arkafund/docs/TOKENOMICS.md`
- `../arkafund/docs/PLATFORM_TOKENS_AND_TOKENOMICS_2026-04-11.md`
- `../arkafund/docs/GOVERNANCE.md`
- `../arkafund/docs/ORACLE_GUARD.md`
- `../arkafund/docs/SECURITY.md`
- `../arkafund/docs/SWAP_GUARDRAILS_DAO_2026-04-10.md`
- `../arkafund/docs/COVERAGE.md`
- `../arkafund/docs/CLAIMS.md`
- `../arkafund/docs/FEES.md`
- `../arkafund/docs/REGISTRY_AND_INDEXING_PLAN.md`
- `../arkafund/docs/INTERNAL_SECURITY_AUDIT_PLAN.md`
- `../arkafund/docs/STORAGE_LIFECYCLE.md`
- `../arkafund/deployments.testnet.json`

dApp-side sources:

- `docs/STATUS.md`
- `docs/FE_COVERAGE_MATRIX.md`
- `docs/CONTRACTS_SECURITY_AUDIT.md`
- `docs/DAPP_GUIDE.md`
- `src/lib/runtime/oracleCutoverGate.ts`
- `src/lib/runtime/balancedAutoSurfaceGate.ts`
- `src/lib/runtime/leaderboardSource.ts`

## 3) System architecture (high level)

### 3.1 On-chain core

- `ArkaFactory`: deploys/initializes vault instances and governs implementation lifecycle.
- `Arka`: managed vault contract with denomination config, fee logic, whitelist policy, deposits/redeems, share mint/burn, swap rebalance execution, and credit position accounting.
- `Arka share token`: per-vault share representation of ownership.
- `ArkaRegistry`: canonical vault discovery and listing.
- `ArkaRouter` + adapters: protocol execution bridge.

### 3.2 Governance and token-power layer

- `arka-token` (liquid ARKA)
- `locked-arka` (non-transferable locked voting power)
- `votes` + `governor`
- `governance-executor` (separate delayed execution lane)
- `arka-vesting` and `emissions-controller` for governed distribution programs.

### 3.3 Coverage and claims

- `coverage-vault` (manager first-loss capital)
- `coverage-fund` (community reserve, premiums, rewards, solvency metrics)
- `claims-manager` (incident trigger, freeze, approval, waterfall execution)
- `manager-tier` (manager scoring/tier policy support)

### 3.4 Oracle and risk safety

- `oracle-guard` exposes `lastprice(asset)` compatibility while supporting primary/secondary feed policies, staleness checks, divergence handling, and fail-closed modes.
- Swap guardrails in `Arka` are DAO-controlled and enforced pre-trade.

### 3.5 Off-chain and product layers

- `catalog-api` for product read models and rankings.
- dApp surfaces for operators, managers, governance and public exploration.
- Release gates exposed as operator-session protected machine-consumable API (`/api/release/gate`).

## 4) Functional feature map (what exists now)

### 4.1 Vault lifecycle

Current state by surface:

| Capability | Implemented in contracts/code | Exposed in FE/API | Testnet-validated | Notes |
| --- | --- | --- | --- | --- |
| Create Arka via factory + init | Yes | Yes | Yes | Wizard/build flow exists in dApp and contracts repo has live validation scripts. |
| Deposit | Yes | Yes | Yes | Core investor path. |
| Redeem / redeem-all | Yes | Yes | Yes | Live operational flow present. |
| Registry listing and vault discovery | Yes | Yes | Yes | Depends on canonical `ArkaRegistry` repair/migration work. |
| Manager-driven rebalance | Yes | Yes | Yes, with current lane model | Current orchestration still includes off-chain transaction assembly for some auth patterns. |

Important limitation:

- rebalance is not yet a pure, fully closed, single-shape on-chain execution story across every venue family and auth pattern.

### 4.2 Execution protocols

Current support posture:

| Venue | Implemented in contracts/code | Exposed in FE/API | Testnet-validated | Current claim ceiling |
| --- | --- | --- | --- | --- |
| `SoroSwap` | Yes | Yes | Yes | Supported swap venue |
| `Aquarius` | Yes | Yes | Yes | Supported swap venue |
| `Blend` | Yes | Yes | Yes | Supported credit/strategy venue, not swap venue |
| `Balanced / SODAX` | Yes, partially across driver/surface/readiness layers | Yes | Partial/readiness-gated | First-class target, but not yet honest to label as fully promoted AUTO venue |

Balanced/SODAX surface currently available in dApp/backend:

- `GET/POST /api/intents/balanced/quote`
- `POST /api/intents/balanced/status`
- `POST /api/intents/balanced/confirm`

Important limitation:

- Balanced currently has enough public/machine-consumable surface to be integrated honestly as an intent venue effort, but not enough repo truth to say that the AUTO lane is fully and unconditionally closed.

### 4.3 Governance operations

Current state by surface:

| Governance capability | Implemented in contracts/code | Exposed in FE/API | Testnet-validated | Notes |
| --- | --- | --- | --- | --- |
| Propose / vote / close / execute | Yes | Yes | Yes | Core governance lifecycle is live-validated on testnet. |
| Separate executor path | Yes | Partially surfaced via governance/control-room tooling | Yes | Delay-separated path exists and is validated. |
| Governed policy setters across vault/coverage domains | Yes | Yes | Yes for major priority lanes | Not every theoretical governance write should be assumed fully product-polished in FE. |

### 4.4 Fee engine

Current state:

- Documented target:
  - management fee accrual
  - performance fee with high-water mark
  - protocol split / treasury routing
  - fee preview and settlement
- Implemented in `Arka`:
  - management fee accrual
  - performance fee with high-water mark
  - protocol split policy
  - `preview_fee_settlement`
  - `settle_fees`
- Exposed in FE/API:
  - fee reads and control-room mutation surfaces
  - related runtime status and policy views
- Testnet-validated:
  - yes, via `validations.feeEngine`

### 4.5 Coverage economics and claims

Current state:

- Implemented in contracts/code:
  - reserve-aware premium policy and routing
  - dual reward streams (reserve + bootstrap)
  - solvency/utilization metrics
  - claims incident lifecycle with waterfall payout
- Exposed in FE/API:
  - coverage operation screens
  - control-room mutation/read surfaces
- Testnet-validated:
  - yes, through `validations.coverageEconomics` and `validations.claimsCircuit`
- Important limitation:
  - product polish and exhaustive FE coverage should not be assumed equivalent to contract completeness.

### 4.6 Frontend product/control surfaces

Current state:

- Implemented routes include:
  - Product: dashboard/discover/vaults/managers/assets and vault detail surfaces.
  - Operations: `/contracts`, `/integrations`, `/status`, `/coverage`, `/governance`, `/factory/create`, `/arkas`, `/arkas/[id]`.
  - Control room can perform typed reads/writes and raw invokes for governance/policy domains.
- Exposed in FE/API:
  - broad operational and product coverage exists.
- Test coverage:
  - unit, integration, Playwright, and wallet-backed flows exist.

Known remaining frontend work:

- pixel-tight Figma parity is heavily advanced but not formally closed as 100% for every derived/new screen.
- coverage matrix indicates broad coverage, but also records residual expansion work for exhaustive wallet-backed mutation matrix and final responsive polish across all surfaces.

## 5) Token system and tokenomics

## 5.1 Protocol and governance tokens

- `ARKA` (`arka-token`): liquid token with optional max supply cap.
- `locked ARKA` (`locked-arka`): lock-based non-transferable voting power and delegation/checkpoints.

## 5.2 Distribution engines

- `arka-vesting`: governed vesting grants funded in ARKA.
- `emissions-controller`: governed linear streams funded in ARKA.

These are token distribution engines, not new token assets.

## 5.3 Vault tokenization

- Each Arka has a share token.
- Shares are minted on deposit and burned on redeem.
- Fee settlement can mint additional shares to manager/treasury according to policy.

## 5.4 Coverage token economics

- `reserve_token`: reserve capital, staking and claim asset.
- `bootstrap_reward_token`: incentive stream.
- Premiums route to retained reserve, staker rewards, and optionally treasury (under policy).

## 5.5 Explicit non-canonical/deferred items

- `dARKA` is deferred and not part of first-release tokenomics.
- Legacy Balanced/Comet shape is not canonical tokenomics.

## 6) Oracle model and data provenance

### 6.1 Pricing safety model

Current state:

- Implemented in contracts/code:
  - `oracle-guard`
  - primary/secondary feed policy
  - divergence handling
  - stale/future/invalid feed rejection modes
- Exposed in FE/API:
  - runtime provenance and effective provider surfaces
  - cutover gate and health/status reporting
- Testnet-validated:
  - yes, for the testnet oracle-guard lane
- Important limitation:
  - runtime can still fall back to `unverified` mode in environments without canonical manifest truth.

### 6.2 Provider naming and runtime resolution

Provider provenance for leaderboard/profit/NAV data is machine-consumable via `GET /api/leaderboard/source` and runtime snapshots.

Resolution order:

1. `deployments.*.json` validated module/provider fields
2. environment fallback:
   - `ARKAFUND_ORACLE_PROVIDER_MAINNET` / `ARKAFUND_ORACLE_PROVIDER_TESTNET`
   - `ARKAFUND_ORACLE_PROVIDER_PRIMARY_*`
   - `ARKAFUND_ORACLE_PROVIDER_SECONDARY_*`
   - public `NEXT_PUBLIC_*` variants

Important operational truth:

- no canonical `deployments.mainnet.json` is committed in this workspace at this time.
- therefore, mainnet oracle cutover is not declared complete in-repo.
- effective provider in any environment is whatever the resolved deployment/env source declares at runtime.

## 7) Routing and best execution

Current implemented behavior:

- backend route planner at `POST /api/routing/rebalance/plan`
- candidate exploration includes SoroSwap direct + bounded multi-hop (2-hop, 3-hop) and Aquarius lane.
- scoring is explicit/machine-readable (`price`, `slippage`, `fee`, `fill-risk`, hop penalties).
- dApp consumes planner response first and has deterministic fallback logic.

Current evidence split:

- Implemented in code:
  - planner API
  - route candidate scoring
  - bounded multi-hop exploration
- Exposed in FE/API:
  - Arka execution UI uses backend planner first
  - route payload and status are surfaced through runtime APIs
- Test coverage:
  - unit and integration coverage exists for route planning
- Important limitation:
  - this is not yet the same thing as a formally closed global best-execution engine across all current and future venue families.

Not yet fully closed as global optimizer:

- no formally closed split-routing production lane across all venues.
- no full proof of exhaustive global optimizer parity against all future venue families.
- Balanced AUTO admission remains governed by lane readiness + machine-consumable quote/status/confirm completeness.

## 8) Security posture and guardrails

### 8.1 Guardrail catalog

The documented DAO policy defines a target catalog of 15 swap guardrails, but those 15 should not be read as "all 15 are already active in contracts today".

Current truthful split:

- target swap-guardrail catalog documented: 15
- phase-1 swap guardrails implemented in `Arka`: first 7 contract-level controls
- phase-2 swap guardrails implemented in the dApp/API/planner runtime: the 8 controls that were formerly pending
- phase-2 contract-level/DAO-mutated storage fields: not yet added to Soroban contracts

The current phase-1 implementation covers:

- `allowed_assets` through the vault whitelist
- `allowed_venues`
- `max_trade_size_bps` proxy
- `max_oracle_age_seconds`
- `max_price_impact_bps`
- `max_slippage_bps`
- `max_twap_deviation_bps`

The phase-2 runtime implementation now covers:

- `max_notional_per_swap`
- `max_path_length`
- `forbid_route_cycles`
- `chunking_threshold`
- `max_chunk_size`
- `post_trade_deviation_bps`
- `daily_turnover_cap_bps`
- `emergency_pause_swap`

Phase-2 runtime behavior:

- Rebalance AUTO/Aquarius/SoroSwap/Balanced plans are evaluated before execution.
- Blocking guardrails remove the selected route and return a machine-readable blocked plan instead of allowing a transaction to be signed.
- Stateful guardrails (`post_trade_deviation_bps`, `daily_turnover_cap_bps`) block when state is supplied and violates policy; if the relevant state source is absent, the check reports `requires_state` rather than pretending a pass.
- Settings exposes the active phase-2 values from runtime configuration so operators can see what the planner enforces.

Important distinction:

- These phase-2 controls are real runtime/API/planner controls, not placeholders.
- They do not replace an eventual Soroban-level DAO policy extension if the project decides that all eight values must be stored and mutated directly on-chain.

### 8.2 Current priority implementation state

The internal contracts security audit in dApp (`docs/CONTRACTS_SECURITY_AUDIT.md`) confirms priority controls implemented and verified for:

- swap oracle pinning
- allowed venues
- swap risk policy tuple
- protocol fee policy
- fee tuple mutation
- governance delay and grace-period mutations

Important distinction:

- this priority audit list is not the same thing as "all documented safety controls in the whole platform are complete".
- it is the currently implemented and verified high-priority control subset.

### 8.3 Internal audit workflow

Contract repo includes rerunnable audit pipeline:

- `scripts/internal_security_audit.py`
- `scripts/run-internal-security-audit.sh`
- `scripts/storage_lifecycle_extend.py`

Artifacts:

- `tmp/internal-security-audit.json`
- `tmp/internal-security-audit.md`
- `tmp/storage-lifecycle-extend.json`

## 9) Storage/rent lifecycle hardening

Implemented runbook/lifecycle:

- dry-run + strict extension planning
- deterministic per-contract extend commands
- machine-consumable reporting
- release gate integration

dApp operational surface:

- `GET /api/contracts/storage-lifecycle`
- `/contracts` storage lifecycle matrix
- `scripts/contracts_storage_extend.mjs`

Current truth:

- implemented as operator tooling and dApp visibility
- validated as release-gate/lifecycle audit support
- not equivalent to "all deployed contracts have already been extended everywhere at all times"

## 10) Registry, indexing, leaderboard data model

Current model:

- canonical on-chain registry remains discovery source.
- ingestion layer is abstracted (native and GraphQL profiles).
- product read model exposed by catalog APIs.

Current evidence split:

- implemented in code:
  - registry-backed discovery
  - pluggable ingestion abstraction
  - indexed read model via catalog API
- exposed in FE/API:
  - leaderboard, dashboard, manager and asset surfaces
- testnet-validated:
  - registry migration and off-chain stack have explicit evidence

Leaderboard provenance:

- ranking/NAV from indexed catalog snapshots.
- profit/volume from indexed fields with activity fallback when fields are missing.
- oracle provenance and selected source are exposed in runtime API.

## 11) Frontend coverage and UX status

Coverage delivered:

- contract control surface with typed and raw lanes.
- governance, coverage, integration, routing, and vault operation screens.
- wallet-backed contract mutation and flow validation lanes.

Quality status:

- major UI/fidelity improvements and responsive hardening are implemented.
- still tracked as an active closure item for absolute pixel-tight parity and exhaustive responsive pass on all non-canonical/new frames.

## 12) Test and validation evidence

### 12.1 Contract repo evidence (testnet)

`deployments.testnet.json` contains validation entries for:

- governance handoff
- oracle guard
- fee engine
- coverage economics
- claims circuit
- tokenomics
- release gate

### 12.2 dApp test layers

- unit tests
- integration tests
- Playwright e2e flows
- wallet-backed mutation matrix (`/contracts` critical write/read paths)
- design-audit capture and pixel diff tooling

## 13) Implementation status matrix (truthful)

Status keys:

- `Complete (testnet-validated)`: implemented + validated in current testnet evidence path.
- `Partial`: implemented in code and/or dApp but not yet fully closed as production/mainnet-ready objective.
- `Deferred`: intentionally out of current release scope.

| Domain | Status | Notes |
| --- | --- | --- |
| Core vault lifecycle (create/deposit/redeem/rebalance) | Complete (testnet-validated) | Live validated in contract and dApp flows. |
| Governance foundation + executor handoff | Complete (testnet-validated) | Governed path exists and is validated in `validations.governanceHandoff`. |
| Oracle guard architecture (testnet) | Complete (testnet-validated) | Mainnet cutover still separate. |
| Fee engine | Complete (testnet-validated) | HWM + protocol split validated. |
| Coverage economics + claims | Complete (testnet-validated) | Premium routing + incident waterfall validated. |
| Tokenomics foundation (ARKA/locked/vesting/emissions) | Complete (testnet-validated) | Depositor voting extension remains deferred. |
| Balanced/SODAX AUTO canonical admission | Partial | Public quote/status/confirm surface exists; AUTO readiness still gate-driven and environment-dependent. |
| Smart Routing V2 as global multi-venue optimizer | Partial | Multi-hop/scoring implemented; full global split-routing closure not marked complete. |
| Frontend 100% contract-operable coverage | Partial | Broad coverage delivered, but residual closure work remains in matrix. |
| Wallet-backed exhaustive mutation matrix for all critical combinations | Partial | Expanded significantly; still tracked as non-final exhaustive closure. |
| Governed third-party protocol onboarding | Deferred | Explicitly deferred in runbook. |
| Mainnet oracle cutover + canonical mainnet manifest | Partial / pending ops cutover | No committed `deployments.mainnet.json` in current workspace. |

## 14) Open risks and pending closure items

1. Mainnet cutover evidence is still missing in-repo (`deployments.mainnet.json` not present).
2. Balanced AUTO should only be considered fully closed when lane readiness and public machine-consumable surface are simultaneously green in enforced gate mode.
3. Smart routing can be strengthened further toward full global optimization across venue families.
4. Frontend still requires final formal closure pass for strict pixel fidelity and exhaustive responsive behavior across all new/non-canonical screens.
5. Wallet-backed e2e matrix should continue expanding to guarantee deterministic coverage of all critical policy mutations and cross-domain combinations.

## 15) Canonical machine-readable companion

Machine-consumable index for this dossier:

- `docs/ARKAFUND_PLATFORM_DOSSIER_INDEX_2026-04-17.json`

This index is intended for CI/release checks and tooling automation.

## 16) Detailed operating model and actor map

This section makes the runtime model explicit, because Arka.fund is not a single contract or a simple dApp. It is a coordinated system with several distinct actors and trust boundaries.

### 16.1 Depositor / investor

Capabilities:

- deposits into an Arka
- receives vault shares
- redeems all or part of the position
- consumes public discovery, leaderboard and manager/product surfaces

What the depositor does not do directly:

- does not execute protocol routing logic by hand in the intended product model
- does not set vault policy, risk thresholds or venue allowlists
- does not directly own protocol positions created by the vault

### 16.2 Manager

Capabilities:

- operates the vault strategy through approved surfaces
- executes rebalance and supported protocol actions where policy allows
- can hold first-loss capital in the coverage stack
- accumulates score/tier in `manager-tier`

Limits:

- cannot loosen DAO-level guardrails once governance owns policy
- is bounded by whitelist, venue allowlist, fee policy, oracle safety and swap risk policy
- cannot arbitrarily onboard new protocols if they are not present in the supported contract/runtime surface

### 16.3 Protocol governance / DAO

Capabilities:

- owns the high-impact policy surfaces
- can rotate governors and executors
- can change fee policies, venue allowlists, swap risk policy, premium policies and other protocol-wide controls
- can schedule and later execute delayed batches through `governance-executor`

Design principle:

- managers may operate within policy
- governance defines and tightens policy
- safety rails are intentionally DAO-controlled and not manager-loosenable

### 16.4 Risk / claims operator

Capabilities:

- can participate in incident workflow depending on configured permissions
- can trigger claims incidents, freeze paths, and move incidents toward approval/execution through the proper controller path

### 16.5 Coverage staker

Capabilities:

- stakes reserve asset
- earns reserve rewards and bootstrap rewards
- indirectly backs covered vaults through the community reserve

Risks:

- retained reserve is consumed first in claims
- community principal can be socialized after retained reserve is exhausted

### 16.6 Treasury / protocol operator

Capabilities:

- receives protocol fee flows when policy allows
- may participate in treasury top-up path for claims
- funds vesting/emissions streams and can be refund recipient on revoke/cancel flows

### 16.7 Integrator / developer

Capabilities:

- reads catalog APIs and leaderboard source provenance
- can consume the public TypeScript SDK
- can extend via SDK extension registry without mutating core SDK surface

Limits:

- governed third-party protocol onboarding is still deferred
- no claim should be made that arbitrary protocols can be activated by external integrators today

### 16.8 Operator / release engineer

Capabilities:

- deploys testnet stacks
- runs validation scripts
- runs storage lifecycle and release gate
- interprets readiness gates for oracle cutover and Balanced AUTO readiness

## 17) Repository topology and bounded contexts

The platform spans multiple bounded contexts. Treating them as one monolith hides where truth actually lives.

### 17.1 `arkafund/` contract repository

Primary responsibilities:

- Soroban contracts
- deployment manifests
- validation scripts
- live testnet evidence
- architecture/runbook docs

Key folders:

- `contracts/`
- `scripts/`
- `docs/`
- `deployments.testnet.json`
- `tmp/` validation artifacts generated by scripts

### 17.2 `arkafund-dapp/`

Primary responsibilities:

- product and operations frontend
- runtime API layer for UI
- routing planner exposure
- balanced intent API exposure
- release gate display and control room surfaces
- wallet-backed E2E and design-audit tests

Key folders:

- `src/app/`
- `src/components/`
- `src/lib/`
- `tests/`
- `e2e/`
- `docs/`
- `scripts/`

### 17.3 `arkafund/services/catalog-api`

Primary responsibilities:

- indexed read model
- discovery and leaderboard data
- dashboard metrics
- activity/history/monitoring surfaces
- ingestion abstraction

Key folders:

- `src/`
- `tests/`
- `scripts/`

### 17.4 `arkafund/sdk/typescript`

Primary responsibilities:

- public TypeScript bindings and helper builders
- extension registry for partner-specific modules

### 17.5 `arkafund-assets/`

Primary responsibilities:

- visual reference material used by design audit/fidelity work

## 18) Detailed contract inventory

The contract workspace currently contains 27 contract packages. Not all of them are part of the canonical public support surface. This section distinguishes canonical protocol modules from mocks, historical artifacts and test support packages.

Interpretation note:

- in the tables below, `Canonical` means "part of intended supported architecture".
- it does not automatically mean "fully promoted, fully surfaced in FE, or fully validated in every runtime lane".

### 18.1 Core vault and registry packages

| Package | Role | Canonical posture | Notes |
| --- | --- | --- | --- |
| `arka` | Main managed vault | Canonical | Denomination, shares, fees, whitelist, routing, credit position accounting, NAV |
| `arka-factory` | Vault creation and implementation governance | Canonical | Creates/initializes Arkas and governs implementation/share-token defaults |
| `arka-registry` | On-chain discovery source | Canonical | Vault listing, manager listing, curation/delisting surface |
| `router` | Multi-step execution router | Canonical | Contract-side execution bridge used by Arka workflows |

### 18.2 Swap / execution adapter packages

| Package | Venue family | Canonical posture | Notes |
| --- | --- | --- | --- |
| `adapter-soroswap` | AMM router | Canonical validated venue | Live swap/rebalance support surface |
| `adapter-aquarius` | AMM / pool venue | Canonical validated venue | Live swap/rebalance support surface |
| `adapter-blend` | Credit / strategy adapter | Canonical validated credit lane | Not a swap venue |
| `adapter-balanced` | Intent / Balanced lane | Canonical code shape, readiness gated | Canonical source decoupled from Comet; live lane promotion depends on readiness |
| `adapter-phoenix` | Historical/experimental | Non-canonical | Kept in workspace but not active public surface |

### 18.3 Governance and token-power packages

| Package | Role | Canonical posture | Notes |
| --- | --- | --- | --- |
| `arka-token` | Liquid ARKA token | Canonical | Optional max supply, mint/burn/admin rotation |
| `locked-arka` | Locked voting power | Canonical | Lock, extend, delegate, checkpoints |
| `arka-vesting` | Governed vesting schedules | Canonical | Funded grants in ARKA |
| `emissions-controller` | Governed distribution streams | Canonical | Funded linear streams in ARKA |
| `governance-executor` | Queue + delayed execution | Canonical | Timelock-style split from proposal lifecycle |
| `governance-token` | Minimal legacy governance token | Historical/demo | Not canonical tokenomics basis |

Important note:

- `votes` and `governor` are part of the active governance architecture, but they are vendored/external rather than first-class packages in this `contracts/` directory inventory.

### 18.4 Coverage, claims and manager packages

| Package | Role | Canonical posture | Notes |
| --- | --- | --- | --- |
| `coverage-vault` | Manager first-loss capital layer | Canonical | Lock-bps, claim-capacity and claim-payout path |
| `coverage-fund` | Community reserve / premiums / rewards | Canonical | Premium routing, reserve metrics, claims from community |
| `claims-manager` | Incident registry and waterfall executor | Canonical | Freeze, approve, execute claims |
| `manager-tier` | Manager score/tier policy module | Canonical | Thresholds, points, tier reads |

### 18.5 Oracle and pricing packages

| Package | Role | Canonical posture | Notes |
| --- | --- | --- | --- |
| `oracle-guard` | Provider-agnostic price guard | Canonical | Supports primary/secondary policy and `lastprice` compatibility |
| `test-oracle` | Test oracle provider | Test support | Used for local and live validation harnesses |

### 18.6 Mocks and harness packages

| Package | Role | Posture | Notes |
| --- | --- | --- | --- |
| `balanced-router-mock` | Deterministic Balanced-like router | Test support | Used for adapter/integration verification |
| `blend-router-mock` | Deterministic Blend-like router | Test support | Used for adapter and accounting verification |
| `test-token` | Utility token | Test support | Also used in some share-token validation flows |
| `test-profit-adapter` | Profit-path harness | Test support | Used in fee engine / profit realization validation |

### 18.7 Contract-level capability summary

This is the practical capability view of the canonical packages:

- `arka`:
  - deposit/redeem/share issuance
  - fee accrual/settlement
  - swap guardrails
  - blend/credit market status and actions
  - whitelist enforcement
  - vault-level NAV and liquidity views
- `arka-factory`:
  - implementation hash governance
  - governed migrations
  - share-token implementation defaults
  - protocol fee defaults
- `arka-registry`:
  - authorized registration
  - discovery counts
  - manager filtering
  - curation/delist state
- `coverage-fund` / `coverage-vault` / `claims-manager`:
  - reserve capital
  - premium quote/pay flows
  - claims waterfall
  - freeze/reject/retrigger/execution path
- `governance-executor`:
  - schedule/cancel/execute delayed action batches
- `oracle-guard`:
  - asset policy
  - stale feed rejection
  - divergence behavior
  - provider abstraction behind stable surface

## 19) Detailed protocol and venue matrix

The platform currently spans several protocol families. Treating every venue as “just another swap router” is architecturally wrong and is one of the main truths the dossier needs to preserve.

| Venue / protocol | Family | What Arka uses it for | Current status | Important truth |
| --- | --- | --- | --- | --- |
| `SoroSwap` | AMM router | Spot rebalance / swaps | Active and validated | Standard router/path execution model |
| `Aquarius` | AMM / pool venue | Spot rebalance / swaps | Active and validated | Pool-oriented quote/execution lane |
| `Blend` | Credit / strategy | Supply, borrow, repay, withdraw, live-valued positions | Active and validated | Must not be modeled as a swap venue |
| `Balanced / SODAX` | Intent execution venue | Quote/status/confirm surface and gated routing effort | Partial, first-class target | Must not be modeled as fake router + pool like old Comet lane |
| `Phoenix` | Historical adapter | None in public support surface | Non-canonical | Workspace artifact only |

Interpretation note:

- `Active and validated` here means the repo has real support plus test/testnet evidence for the current supported lane.
- it does not mean every possible advanced strategy or route shape over that venue is already fully closed.

### 19.1 SoroSwap

Supported semantics:

- direct or routed execution through adapter/router lane
- used in rebalance planner
- supports bounded multi-hop candidate exploration in current Smart Routing V2 implementation

### 19.2 Aquarius

Supported semantics:

- direct pool discovery/execution lane
- included in rebalance planner alongside SoroSwap

### 19.3 Blend

Supported semantics:

- vault-owned credit positions
- persisted `(market_id, asset)` position state
- position value included in vault NAV
- risk policy and market-status reads

Important architectural point:

- Blend is strategy infrastructure, not swap routing.
- If future expansion uses more of Blend, it should likely enter through strategy primitives, fee-vaults, backstop or other strategy modules, not by forcing it into AMM-like routing abstractions.

### 19.4 Balanced / SODAX

Supported truths today:

- official surface is intent-oriented
- public surface proves quote/status style operations exist
- no public Stellar router contract id has been established as canonical in repo truth
- dApp/backend already expose quote/status/confirm endpoints

What is not yet honest to claim:

- that Balanced is a fully promoted AUTO venue in all environments
- that it is equivalent to a public Soroban router venue
- that historical Comet-linked testnet lane equals canonical Balanced support

### 19.5 Why Comet and Balanced must remain separated

The codebase intentionally moved away from the false assumption that “Balanced equals Comet pool wiring.”

That separation matters because:

- the protocol surface is different
- the planning model is different
- the execution semantics are different
- claiming public support too early would be misleading

## 20) Governance-controlled parameter matrix

This section answers the practical operator question: which parts of the protocol are meant to be controlled by governance, and what surface exists for that control.

| Domain | Controlled object | Typical setter / surface | Control owner | Notes |
| --- | --- | --- | --- | --- |
| Vault fees | `Arka` | `set_fees` | Governor / executor | Mgmt, perf, deposit, redeem bps |
| Protocol fee split | `Arka` | `set_protocol_fee_policy` | Governor / executor | Treasury participation in fee settlement |
| Vault whitelist | `Arka` | `set_whitelist` | Governor / executor | Also acts as allowed-asset baseline |
| Router binding | `Arka` | `set_router` | Governor / executor | Governs execution lane at vault level |
| Manager rotation | `Arka` | `set_manager` | Governor / executor | Old manager settlement semantics matter |
| Swap risk policy | `Arka` | `set_swap_risk_policy` | Governor / executor | Includes price impact, slippage, oracle age, trade size caps |
| Swap oracle pinning | `Arka` | `set_swap_oracle` | Governor / executor | Explicit oracle used for swap safety checks |
| Venue allowlist | `Arka` | `set_allowed_venues` | Governor / executor | Routers/adapters allowed for rebalance |
| Coverage treasury/policy | `CoverageFund` | treasury and economics setters | Governor / executor | Premium routing and reserve retention |
| Covered vault policy | `CoverageFund` | `set_covered_vault_policy` | Governor / executor | Premium/limit policy per covered vault |
| Coverage lock | `CoverageVault` | `set_lock_bps` | Governor / executor | Minimum locked manager first-loss capital |
| Claims manager binding | coverage contracts | `set_claims_manager` | Governor / executor | Claims controller boundary |
| Factory implementation | `ArkaFactory` | `set_implementation` | Governor / executor | Core upgrade surface |
| Factory share token default | `ArkaFactory` | `set_share_token_implementation` | Governor / executor | Per-vault share-token backend |
| Executor delay/grace | `governance-executor` | `set_min_delay`, `set_grace_period` | Governor / admin | Delayed execution policy |
| Tokenomics programs | `arka-vesting`, `emissions-controller` | create/revoke/cancel through governed path | Governor / executor | Funded program control |

Critical policy stance:

- managers are expected to operate within these controls
- they are not expected to relax them below governance policy

## 21) Frontend route inventory

This is the actual route inventory present under `arkafund-dapp/src/app`.

### 21.1 Product and public-exploration routes

| Route | Primary role | Main data source | Key user actions |
| --- | --- | --- | --- |
| `/` | Entry shell / landing | runtime shell and product navigation | navigation, wallet connect |
| `/dashboard` | Portfolio and product overview | catalog + runtime summaries | browse activity, review positions |
| `/discover` | Product discovery | catalog snapshots | search/filter, move into detail routes |
| `/vaults` | Arka leaderboard | leaderboard APIs + catalog | sort by rank/profit/volume/managed NAV |
| `/vaults/[id]` | Product-facing vault detail | catalog + runtime views | inspect vault composition and metadata |
| `/assets` | Asset explorer | catalog asset aggregation | search/filter assets |
| `/assets/[id]` | Asset detail | catalog asset history/detail | inspect asset-centric views |
| `/managers` | Manager leaderboard | leaderboard APIs + catalog | sort/browse manager landscape |
| `/managers/[id]` | Manager detail | catalog manager history/detail | inspect manager-specific product surface |

### 21.2 Operational vault routes

| Route | Primary role | Main data source | Key user actions |
| --- | --- | --- | --- |
| `/arkas` | On-chain/operator vault list | registry/runtime reads | browse operational Arkas |
| `/arkas/[id]` | Live operational vault detail | direct contract/runtime reads | deposit, redeem, rebalance, credit actions |
| `/factory/create` | New Arka creation wizard | factory build endpoint + wallet tx | create and initialize Arka |

### 21.3 Control-room and governance routes

| Route | Primary role | Main data source | Key user actions |
| --- | --- | --- | --- |
| `/contracts` | Governance/control room | mutation matrix, storage lifecycle, runtime contract reads | typed reads/writes, raw invocations |
| `/governance` | Governance lifecycle UI | governor/executor reads | propose, vote, close, execute |
| `/coverage` | Coverage operations | coverage-fund/vault reads | stake, unstake, claim |
| `/integrations` | Protocol integration visibility and direct lanes | runtime health + intent APIs | inspect adapters, run direct protocol flows |
| `/status` | System status and cutover visibility | `/api/health` + release gate | inspect protocol/oracle readiness |
| `/ops` | Live operations surface | runtime and contract reads | operational visibility |
| `/settings` | Environment and contract ids | runtime config | inspect active environment |
| `/tiers` | Manager tier surface | manager-tier reads/builders | inspect points/tiers, add points where allowed |

### 21.4 Design and UX reality

What these routes are trying to do:

- unify product browsing and operator execution into one dApp
- avoid splitting the system into a “marketing frontend” and a separate unsafe operator shell
- keep real contract-backed actions exposed while also converging toward the product visual language

What remains open:

- some routes have close Figma analogues, some do not
- derived routes need visual fidelity by reference family rather than exact frame match

## 22) dApp API route inventory

This is the explicit route inventory under `arkafund-dapp/src/app/api`.

| API route | Methods | Purpose | Main consumer |
| --- | --- | --- | --- |
| `/api/catalog/[...path]` | proxy | Catalog API pass-through | public/product pages |
| `/api/e2e-wallet` | read | Wallet-backed E2E support surface | Playwright wallet-backed suite |
| `/api/health` | read | Runtime health and protocol snapshot | `/status`, `/integrations`, ops surfaces |
| `/api/leaderboard/arkas` | read | Arka leaderboard payload | `/vaults` |
| `/api/leaderboard/managers` | read | Manager leaderboard payload | `/managers` |
| `/api/leaderboard/source` | read | Provenance for ranking/NAV/profit/volume/oracle | leaderboard and status surfaces |
| `/api/contracts/storage-lifecycle` | read | Machine-consumable storage/rent audit | Operator console and wallet-backed tests; requires verified operator session |
| `/api/contracts/mutation-matrix` | read | Mutation/read matrix definition | Operator console and wallet-backed tests; requires verified operator session |
| `/api/factory/create/build` | build | Create-Arka transaction planning/build surface | `/factory/create` |
| `/api/routing/rebalance/plan` | build/read | Backend best-execution planner | `/arkas/[id]` execution UI |
| `/api/routing/rebalance/status` | read | Rebalance route/execution status surface | execution workflows |
| `/api/release/gate` | read | Machine-consumable release readiness gates | CI/CD and ops; requires verified operator session |
| `/api/intents/balanced/quote` | read/build | Balanced/SODAX quote surface | integrations and planner |
| `/api/intents/balanced/status` | read | Balanced/SODAX status surface | integrations and planner |
| `/api/intents/balanced/confirm` | read | Balanced/SODAX confirm/receipt surface | integrations and planner |

### 22.1 Why this API layer exists

The frontend is intentionally not a pure static client. This intermediate API layer provides:

- stable payloads for the UI
- release and readiness gating
- planner encapsulation
- provenance and environment reporting
- a safer boundary for machine-consumable operations and health surfaces

## 23) Catalog API and data-plane inventory

The catalog API is part of the platform, not just a convenience service.

### 23.1 Functional responsibilities

It provides:

- Arka snapshots
- asset aggregates
- manager aggregates
- metrics
- activity feed
- history archive
- monitoring archive
- dashboard overview and composition

### 23.2 Endpoint inventory

From the contract repo documentation, the service exposes:

- `GET /health`
- `POST /v1/sync`
- `GET /v1/metrics`
- `GET /v1/dashboard/overview`
- `GET /v1/dashboard/composition`
- `GET /v1/monitoring/status`
- `GET /v1/monitoring/runs`
- `GET /v1/monitoring/alerts`
- `GET /v1/activity`
- `GET /v1/history`
- `GET /v1/arkas`
- `GET /v1/arkas/:id`
- `GET /v1/arkas/:id/history`
- `GET /v1/arkas/:id/portfolio`
- `GET /v1/arkas/:id/assets`
- `GET /v1/arkas/:id/assets/:assetId/history`
- `GET /v1/arkas/:id/activity`
- `GET /v1/assets`
- `GET /v1/assets/:id`
- `GET /v1/assets/:id/history`
- `GET /v1/managers`
- `GET /v1/managers/:id`
- `GET /v1/managers/:id/history`

### 23.3 Ingestion model

Supported backends:

- `native`
- `graphql`

GraphQL profiles:

- `generic`
- `subquery`

Activity backend:

- `rpc`
- `none`

### 23.4 Why this matters to platform truth

Without this layer:

- ranking and discovery would degrade into direct RPC fan-out
- historical views would be weak
- monitoring would be fragmented
- product routes would not have a stable read model

### 23.5 Current truth about provenance

- leaderboard rank and NAV come from indexed snapshots
- profit/volume use indexed fields with activity fallback
- oracle provenance is exposed separately rather than hidden

## 24) SDK and developer platform inventory

The public TypeScript SDK is a real platform surface, even if it is not yet treated as the main end-user interface.

### 24.1 Supported modules

Current documented modules:

- `registry(contractId)`
- `oracleGuard(contractId)`
- `vault(contractId)`

### 24.2 SDK module responsibilities

`registry(contractId)`:

- initialization/admin helpers
- registrar authorization
- registration and legacy registration
- curated/delisted state
- discovery reads and counts

`oracleGuard(contractId)`:

- feed policy management
- policy inspection
- SEP-40 style price reads

`vault(contractId)`:

- NAV, manager, router, share token, fees, whitelist reads
- deposit and redeem builders
- blend/credit market status reads

### 24.3 Extension model

The SDK includes a versioned extension registry:

- each extension has `id`, `version`, `install(sdk)`
- extensions can be retrieved via `sdk.getExtension(id)`

That matters because it is the chosen mechanism for partner-specific tooling, not mutation of core SDK packages.

### 24.4 Binding generation model

Bindings are generated from built WASM artifacts, not maintained by hand. That is important for trust and drift control.

### 24.5 Current limitation

The SDK is implemented and locally verified, but the earlier audit notes still distinguish between local verification and canonical public release proof. That should stay explicit in platform documentation.

## 25) Test inventory and quality surface

### 25.1 dApp test counts

Current `arkafund-dapp` inventory:

- 31 unit test files
- 21 integration test files
- 11 Playwright E2E specs

### 25.2 dApp unit test themes

The current unit layer covers areas such as:

- routing and rebalance planning
- Balanced AUTO gate behavior
- oracle cutover gate behavior
- runtime health and protocol support
- leaderboard ranking behavior
- contract mutation matrix generation
- storage lifecycle logic
- intent execution drivers and venue sources
- product navigation and workflow logic

Representative files:

- `tests/unit/rebalance-routing.test.ts`
- `tests/unit/balanced-auto-surface-gate.test.ts`
- `tests/unit/oracle-cutover-gate.test.ts`
- `tests/unit/contracts-storage-lifecycle.test.ts`
- `tests/unit/runtime-leaderboard-source.test.ts`
- `tests/unit/intent-execution-drivers.test.ts`

### 25.3 dApp integration test themes

The integration layer covers:

- API routes
- route/page rendering
- control-room surfaces
- workflow pages
- health and provenance payloads

Representative files:

- `tests/integration/api-release-gate-route.test.ts`
- `tests/integration/api-rebalance-route-plan-route.test.ts`
- `tests/integration/contracts-page.test.tsx`
- `tests/integration/control-room-surfaces.test.tsx`
- `tests/integration/vault-entrypoints.test.tsx`

### 25.4 dApp E2E themes

The Playwright suite covers:

- smoke and app entry
- product surfaces
- workflow IA
- vault entrypoints
- vault profile
- live ops surfaces
- contracts surface
- Balanced intent surface
- design audit
- wallet-backed mutation suite

Representative files:

- `e2e/smoke.spec.ts`
- `e2e/product-surfaces.spec.ts`
- `e2e/vault-entrypoints.spec.ts`
- `e2e/contracts-surface.spec.ts`
- `e2e/balanced-intent-surface.spec.ts`
- `e2e/wallet-backed.spec.ts`

### 25.5 Contract repo test and validation model

Contract repo quality evidence spans:

- unit tests per package
- integration tests per package
- e2e/local scenarios
- dedicated live testnet validation scripts
- canonical promotion into `validatedModules`
- integrated release gate

### 25.6 Canonical validated module surface in `deployments.testnet.json`

The manifest records validated module stacks for:

- governance foundation
- oracle safety
- fee engine
- coverage claims
- tokenomics foundation

Those stacks matter because they represent canonical live-validated module truth, not just whatever is in the top-level long-lived `contracts` map.

## 26) Script and runbook inventory

The script surface is large and important. The platform is not only what contracts can do, but what can be repeatedly deployed, verified, repaired and audited.

### 26.1 Build and deploy scripts

Core build/deploy entrypoints include:

- `scripts/build-wasm.sh`
- `scripts/deploy.sh`
- `scripts/init-factory.sh`
- `scripts/bootstrap-governance-user-admin.sh`
- `scripts/deploy-governor.sh`
- `scripts/init-governor.sh`
- `scripts/init-governor-simple.sh`
- `scripts/init-governor-and-votes-admin.sh`

### 26.2 Testnet E2E and live-validation scripts

Key reproducible validation entrypoints include:

- `scripts/e2e-governed-policy.sh`
- `scripts/e2e-arka-migration.sh`
- `scripts/e2e-coverage-vault.sh`
- `scripts/e2e-coverage-fund.sh`
- `scripts/e2e-coverage-claims.sh`
- `scripts/e2e-manager-tier.sh`
- `scripts/e2e-oracle-guard.sh`
- `scripts/e2e-fee-engine.sh`
- `scripts/e2e-storage-lifecycle.sh`
- `scripts/e2e-blend-vault-position.sh`
- `scripts/e2e-registry-integrity.sh`
- `scripts/e2e-governor-snapshot.sh`
- `scripts/e2e-governor-executable-council.sh`

Dedicated live validation/deploy scripts include:

- `scripts/deploy-governance-live-validation.sh`
- `scripts/deploy-governance-handoff-live-validation.sh`
- `scripts/resume-governance-handoff-live-validation.sh`
- `scripts/deploy-oracle-guard-live-validation.sh`
- `scripts/deploy-fee-engine-live-validation.sh`
- `scripts/deploy-coverage-claims-live-validation.sh`
- `scripts/deploy-tokenomics-live-validation.sh`
- `scripts/deploy-blend-live-validation.sh`
- `scripts/deploy-create-live-validation.sh`
- `scripts/deploy-deposit-redeem-live-validation.sh`
- `scripts/deploy-rebalance-live-validation.sh`
- `scripts/deploy-offchain-testnet-stack.sh`

### 26.3 Registry and indexing scripts

- `scripts/deploy-canonical-registry-migration.sh`
- `scripts/e2e-canonical-registry-migration.sh`
- `scripts/promote-canonical-testnet-registry.sh`
- `scripts/verify-canonical-testnet-registry.sh`
- `scripts/deploy-indexer-event-surface-live-validation.sh`
- `scripts/deploy-graphql-backend-parity-validation.sh`
- `scripts/deploy-subquery-backend-parity-validation.sh`
- `scripts/canonical_registry_migration.py`
- `scripts/canonical_testnet_registry.py`

### 26.4 Balanced-specific scripts

- `scripts/deploy-balanced-readiness-validation.sh`
- `scripts/validate_balanced_readiness.py`
- `scripts/deploy-balanced-canonical-cutover.sh`
- `scripts/balanced_canonical_cutover.py`
- `scripts/deploy-balanced-official-surface-validation.sh`
- `scripts/verify_balanced_official_surface.py`

### 26.5 Security, release and storage scripts

- `scripts/release_gate.py`
- `scripts/run-release-gate.sh`
- `scripts/internal_security_audit.py`
- `scripts/run-internal-security-audit.sh`
- `scripts/storage_lifecycle_extend.py`
- `scripts/deploy-storage-lifecycle-extend.sh`
- `scripts/deploy-swap-guardrails-live-validation.sh`

### 26.6 Venue-specific utility folders

- `scripts/soroswap/`
- `scripts/aquarius/`

These hold venue-specific helpers such as adapter deployment, pool discovery and venue e2e flows.

### 26.7 JavaScript governance/operator helpers

`scripts/js/` contains governance and scheduling helpers such as:

- proposal builders
- executor scheduling helpers
- tokenomics scheduling helpers
- generated governor bindings

This is important because not every governed action is meant to be assembled manually by operators.

## 27) Configuration surface and environment inventory

The platform has a large environment surface. The point of this section is not to duplicate every line of every `.env`, but to document the important env families that shape runtime behavior.

### 27.1 dApp network and contract-id surface

Major `arkafund-dapp` config keys include:

- `NEXT_PUBLIC_STELLAR_NETWORK`
- `NEXT_PUBLIC_SOROBAN_RPC_URL`
- `NEXT_PUBLIC_ARKA_FACTORY`
- `NEXT_PUBLIC_ARKA_REGISTRY`
- `NEXT_PUBLIC_ARKA_ROUTER`
- `NEXT_PUBLIC_SOROSWAP_ROUTER`
- `NEXT_PUBLIC_SOROSWAP_ADAPTER`
- `NEXT_PUBLIC_AQUARIUS_ROUTER`
- `NEXT_PUBLIC_AQUARIUS_ADAPTER`
- `NEXT_PUBLIC_ADAPTER_BALANCED`
- `NEXT_PUBLIC_ADAPTER_BLEND`
- `NEXT_PUBLIC_COVERAGE_FUND`
- `NEXT_PUBLIC_COVERAGE_VAULT`
- `NEXT_PUBLIC_CLAIMS_MANAGER`
- `NEXT_PUBLIC_LOCKED_ARKA`
- `NEXT_PUBLIC_MANAGER_TIER`
- `NEXT_PUBLIC_GOVERNOR_ID`
- `NEXT_PUBLIC_VOTES_ID`
- `NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID`
- `NEXT_PUBLIC_ORACLE_GUARD`

### 27.2 Asset, denomination and label surface

Key UI and asset-label envs include:

- `NEXT_PUBLIC_ROUTING_ASSET_A`
- `NEXT_PUBLIC_ROUTING_ASSET_B`
- `NEXT_PUBLIC_ROUTING_ASSET_A_LABEL`
- `NEXT_PUBLIC_ROUTING_ASSET_B_LABEL`
- `NEXT_PUBLIC_DENOMINATION`
- `NEXT_PUBLIC_DENOMINATION_LABEL`
- `NEXT_PUBLIC_PRODUCT_SURFACE_LABEL`
- `NEXT_PUBLIC_CURATED_ONLY_LABEL`
- `NEXT_PUBLIC_ALL_ARKAS_LABEL`
- route/tab label envs for dashboard, vaults, assets, managers and status chips

This matters because the dApp intentionally moved away from some hardcoded labels and symbols during the fidelity/coverage iterations.

### 27.3 Routing and slippage tuning

Key envs:

- `NEXT_PUBLIC_REBALANCE_SLIPPAGE_PROFILE`
- `NEXT_PUBLIC_DEFAULT_REBALANCE_SLIPPAGE_PCT`
- `NEXT_PUBLIC_MAX_REBALANCE_SLIPPAGE_PCT`
- `NEXT_PUBLIC_REBALANCE_EXTRA_BUFFER_PCT`
- `NEXT_PUBLIC_REBALANCE_FALLBACK_EXTRA_PCT`
- `NEXT_PUBLIC_REBALANCE_MAX_NOTIONAL_PER_SWAP_BASE`
- `NEXT_PUBLIC_REBALANCE_MAX_PATH_LENGTH`
- `NEXT_PUBLIC_REBALANCE_FORBID_ROUTE_CYCLES`
- `NEXT_PUBLIC_REBALANCE_CHUNKING_THRESHOLD_BASE`
- `NEXT_PUBLIC_REBALANCE_MAX_CHUNK_SIZE_BASE`
- `NEXT_PUBLIC_REBALANCE_POST_TRADE_DEVIATION_BPS`
- `NEXT_PUBLIC_REBALANCE_DAILY_TURNOVER_CAP_BPS`
- `NEXT_PUBLIC_REBALANCE_EMERGENCY_PAUSE_SWAP`

These govern client/API/planner runtime behavior, but they do not replace on-chain swap guardrails. Phase-2 values are enforced before rebalance execution in the dApp planner; a later contract extension would be required if governance must mutate and enforce every phase-2 field inside Soroban storage.

### 27.4 Balanced runtime envs

Key envs:

- `NEXT_PUBLIC_BALANCED_ROUTER_MOCK`
- `NEXT_PUBLIC_BALANCED_EXPECTED_ROUTER`
- `NEXT_PUBLIC_BALANCED_SUPPORT_STATUS`
- `NEXT_PUBLIC_BALANCED_LANE_MODE`
- `NEXT_PUBLIC_BALANCED_POOL_ID`
- `NEXT_PUBLIC_BALANCED_DEFAULT_TOKEN_IN_SYMBOL`
- `NEXT_PUBLIC_BALANCED_DEFAULT_TOKEN_OUT_SYMBOL`

### 27.5 Oracle provider and cutover envs

Key env families:

- `ARKAFUND_NETWORK_TARGET`
- `NEXT_PUBLIC_ARKAFUND_NETWORK_TARGET`
- `ARKAFUND_DEPLOYMENTS_PATH`
- `ARKAFUND_ORACLE_PROVIDER_MAINNET`
- `ARKAFUND_ORACLE_PROVIDER_TESTNET`
- `ARKAFUND_ORACLE_PROVIDER_PRIMARY_*`
- `ARKAFUND_ORACLE_PROVIDER_SECONDARY_*`
- `NEXT_PUBLIC_ORACLE_PROVIDER_*`

These matter because runtime provider provenance can come from manifest or env fallback.

### 27.6 Storage lifecycle envs

Key envs include:

- `ARKAFUND_STORAGE_EXTEND_SOURCE_ACCOUNT`
- `ARKAFUND_STORAGE_EXTEND_LEDGERS`

These determine whether the storage lifecycle matrix is only informational or ready for real operator execution.

### 27.7 E2E wallet envs

Key envs include:

- `NEXT_PUBLIC_E2E_WALLET`
- `E2E_WALLET_ENABLED`

These support wallet-backed E2E flows and should remain explicit in environment and CI setup.

### 27.8 Catalog API envs

Important `catalog-api` env families include:

- ingestion:
  - `CATALOG_API_INGESTION_BACKEND`
  - `CATALOG_API_REGISTRY_CONTRACT_ID`
  - `CATALOG_API_GRAPHQL_URL`
  - `CATALOG_API_GRAPHQL_PROFILE`
  - `CATALOG_API_GRAPHQL_AUTH_TOKEN`
  - `CATALOG_API_GRAPHQL_PAGE_SIZE`
  - `CATALOG_API_GRAPHQL_TIMEOUT_MS`
- activity:
  - `CATALOG_API_ACTIVITY_BACKEND`
  - `CATALOG_API_ACTIVITY_LOOKBACK_LEDGERS`
  - `CATALOG_API_ACTIVITY_PAGE_SIZE`
  - `CATALOG_API_ACTIVITY_MAX_PAGES`
- storage and monitoring:
  - `CATALOG_API_DATA_FILE`
  - `CATALOG_API_HISTORY_FILE`
  - `CATALOG_API_MONITORING_FILE`
  - `CATALOG_API_HISTORY_RETENTION_RUNS`
  - `CATALOG_API_MONITORING_RETENTION_RUNS`
  - `CATALOG_API_MAX_SNAPSHOT_AGE_SECONDS`
  - `CATALOG_API_MAX_SYNC_DURATION_MS`
  - `CATALOG_API_MAX_FAILURE_RATIO`
  - `CATALOG_API_MAX_CONSECUTIVE_FAILURES`
  - `CATALOG_API_ALERT_WEBHOOK_URL`
  - `CATALOG_API_ALERT_WEBHOOK_SECRET`
  - `CATALOG_API_ALERT_WEBHOOK_TIMEOUT_MS`

## 28) Detailed workstream status and what is still not complete

This section is deliberately blunt. The platform is large; some parts are complete in the current testnet-validated sense, and some parts are still partial. This avoids the earlier “100% vs not really 100%” confusion.

### 28.1 Complete in the current repo/testnet sense

These domains have strong evidence in code, tests and testnet validation:

- core vault lifecycle
- governance foundation and executor handoff
- oracle guard architecture on testnet
- fee engine
- coverage economics
- claims circuit
- first-release tokenomics foundation
- registry repair and canonical testnet discovery
- catalog API as indexed read model
- release gate framework
- storage lifecycle runbook and dApp surface

### 28.2 Partial but materially implemented

These areas are real and valuable today, but not honestly closed as final:

- Balanced/SODAX AUTO admission
  - quote/status/confirm surface exists
  - readiness gate exists
  - canonical always-green promotion is not yet truthful to claim
- Smart Routing V2
  - planner and scoring exist
  - multi-hop exploration exists
  - full global optimizer with split-routing and exhaustive venue-family parity is not formally closed
- Frontend full contract coverage
  - large coverage exists
  - not every possible on-chain operation is guaranteed to have a final polished user flow
- Wallet-backed E2E exhaustiveness
  - strong matrix exists
  - “all combinations fully exhausted” is still too strong to claim
- Mainnet oracle cutover
  - gating exists
  - manifest-driven truth exists
  - no committed canonical mainnet deployment manifest is present in this workspace today

### 28.3 Deferred by design

- third-party governed protocol onboarding
- depositor-voting `dARKA`

### 28.4 Historical but not canonical

- Balanced-via-Comet legacy lane
- `adapter-phoenix`
- `governance-token` as canonical tokenomics basis

## 29) What this dossier now gives the team

After this expansion, this dossier is intended to serve as:

- product reference
- contract/system reference
- operator runbook map
- protocol support truth table
- tokenomics and governance reference
- risk and security posture reference
- release-readiness reference

It should be used together with:

- `docs/ARKAFUND_PLATFORM_DOSSIER_INDEX_2026-04-17.json`
- `docs/STATUS.md`
- `../arkafund/deployments.testnet.json`

## 30) Recommended next documentation follow-up

If we want to take this one step further after this pass, the next useful addition would be a contract-entrypoint appendix that inventories each public method per canonical contract with:

- auth model
- storage mutation behavior
- external call behavior
- UI/API surface that consumes it
- test artifact that covers it

That would move the dossier from “super exhaustive platform document” to “platform plus method-level audit atlas.”
