# Catalog → review backend → dapp, R20

Mainnet remains unapproved. Noah stays V2. Sushi is unactivated, Phoenix is retired only for new routes and Curve is deferred. No real wallet, signature, chain submission, deployment, production read/write or external sending occurred.

## Changes

The optional managed catalog runtime now joins actual read-only RPC getters, complete holder event history, resumable withdrawal-request history and immutable observation storage. A persistent registry scan establishes exactly one factory register event matching factory, manager and child; missing, ambiguous or retention-gapped birth history fails closed. Coverage may begin before birth and must cover birth through the observation ledger. Published birth cannot move or disappear.

The review backend consumes the actual catalog HTTP owner-position endpoint instead of hand-authored observation files. It checks network/fund/owner/code/observation/clock/coverage, then compares shares, supply, NAV, queue and cash with live getters through the existing verified RPC session. Failed or stale reads never become zero balances. NAV can remain unavailable while fixed withdrawal rights remain visible. The backend remains read/simulate-only.

R20-01: real replay exposed double subtraction of fixed reserves. The contract removes settled amounts from liquid_balance. The catalog must retain that available cash and net managed amount, reconstruct gross accounted cash once as available + reserve, and report the reserve separately. Both source and review loader require physical denomination balance >= available + reserves. Donations do not become accounted cash. Aggregate managed USD estimates also exclude fixed reserves through the existing available-cash helper. Contract accounting, queue, requests, planner, lot sizing and financial ABI are unchanged.

The existing dapp/proxy/receipt flow consumes the backend without a new product panel, planner, signer, retry loop, automatic restore or keeper.

## Fresh local validation

- Catalog TypeScript build; 170 unsigned unit passes with two signing skips; 41 HTTP/catalog integration passes with one signing skip.
- 98 review/canonical/withdrawal/fee/catalog cases; frontend type check.
- Factory-born React/jsdom flow: actual factory and share deployment, two Sushi routes, exact 5 USDC atomic creation fee, 1000 XLM investment, manager swap, three raw USDC residual units, full share request, five contract-planned lots, settlement and full 999.4009043 XLM collection while paused. Fourteen unique financial actions; zero final vault/share/queue/router/adapter residual.
- Actual registry/holder events and request getters produce durable canonical observations through catalog HTTP. Catalog is explicitly synchronized after local ledger progress; receipt delivery remains a test double.
- Incomplete, stale, wrong-owner, missing-coverage, contradictory-share and behind-ledger catalog responses are rejected. A fresh dapp load shows unavailable data and offers no confirmation; restoring the response permits reading again without an extra financial operation.
- Real catalog/review process restart preserves observation identity, paid withdrawal rights, fourteen review archives and receipt recovery, with no repeated financial operation. Unit cases cover bounded registry pagination/restart, wrong registrar, ambiguous birth, retention gaps and immutable birth.

Evidence: artifacts/v3-catalog-review-bridge-r20-20261031 contains ui-final-proof.json, gateway-r8-restart-proof.json, qualification-final.json, closeout.json, native gzip receipts and all diagnostic attempts. The accepted replay binds the final source release and test hash. Detailed native run/cache counts are recorded in the accepted proof.

## Boundaries and retained evidence

The only market input is the already authorized frozen Sushi capture at ledger 65206504. Actual selected WASM and contract events/getters run in a network-denied native P29 RAM host. Actors/funding/oracle/governance, ledger header/empty close metadata, sequence, pagination transport and wallet/verifier/wire/receipt delivery are synthetic. React/jsdom is not real-browser/device qualification or consensus. Exact-source/invocation/committed-prefix/clock read results may reuse their first measured native receipt only in this test driver; product live readers never use this cache. Financial operations are not cached.

Diagnostic failures remain preserved: SDK metadata required a complete local getLedgers response; local actions initially emitted events into an already closed ledger; the ui-r5 diagnostic settlement found R20-01. The corrected clock applies each action in the next ledger. Coverage, identity, owner, queue, share and monetary guards were not relaxed.

All 114 contract-tree files and 24 selected WASM identities, dependency manifests/locks and Noah configuration match R19. R15 full-platform/native/WASM/crypto and R17 resource evidence are retained by verified identity, not fresh R20 executions. R19 full npm/RustSec reports remain red for minimatch and crypto-bigint; this bridge does not repair or waive them.

## Explicit configuration

Catalog uses its existing RPC/network/registry configuration and CATALOG_API_READ_SOURCE (public account only). Managed activation additionally requires CATALOG_API_MANAGED_V3_HASH, CATALOG_API_MANAGED_STATE_DIRECTORY, CATALOG_API_FACTORY_CONTRACT_ID and CATALOG_API_HOLDER_INITIAL_LEDGER; optional CATALOG_API_MANAGED_LEGACY_HASHES distinguishes known legacy code. Preserve the existing holder archive and all managed creation/request/observation stores. No managed flag leaves the legacy runtime path unchanged.

The read-only review service requires --config, --state, --port, --web-origin and --catalog-url. Use an explicit trusted HTTPS catalog (HTTP only on 127.0.0.1). No observation-file path, secret account or signer is required. Execution approval remains false in release/product configuration; true flags in the replay are isolated test configuration.

## Still required before mainnet

Resolve compatible dependency advisories; reconcile newly authorized current target identities, complete historical index, roles/oracles/Sushi callers and routes; validate governed activation/deactivation and current liquidity; qualify actual wallet/device and authorized canary; reprice admission/storage/TTL/restore/inclusion; run exact-candidate hosted CI; obtain independent review and final deployment authorization. No production gate is closed by a frozen local replay. See MAINNET_PENDING.md and release/mainnet-pending.json.
