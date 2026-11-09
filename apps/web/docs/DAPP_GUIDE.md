# Arka.fund dApp Guide

Current status note, 2026-07-03: this guide still contains historical testnet setup notes. For the current mainnet release state, use `../../arkafund/deployments.mainnet.json`, `../../arkafund/docs/MAINNET_REALITY_CHECK_2026-07-03.md`, and `../../arkafund/docs/MAINNET_RELEASE_TASKS_2026-07-03.md`.

For the full screen-by-screen manual, see [DAPP_SCREEN_MANUAL_2026-04-23.md](./DAPP_SCREEN_MANUAL_2026-04-23.md).

For the visual manual with current screenshots beside each route explanation, see [DAPP_VISUAL_MANUAL_2026-04-24.md](./DAPP_VISUAL_MANUAL_2026-04-24.md).

For the honest Playwright/browser coverage status, see [E2E_AUDIT_MATRIX_2026-04-24.md](./E2E_AUDIT_MATRIX_2026-04-24.md).

For the DAO/governance operational explanation, see [DAO_GOVERNANCE_OPERATIONS_2026-04-24.md](./DAO_GOVERNANCE_OPERATIONS_2026-04-24.md).

For the economic product UI and selector/dropdown requirements, see [PRODUCT_ECONOMIC_UI_REQUIREMENTS_2026-06-02.md](./PRODUCT_ECONOMIC_UI_REQUIREMENTS_2026-06-02.md).

For the implementation plan covering governance composer, migration workspace, Advanced Console access model and exhaustive E2E, see [GOVERNANCE_MIGRATION_E2E_PLAN_2026-04-24.md](./GOVERNANCE_MIGRATION_E2E_PLAN_2026-04-24.md).

## Routes
- /arkas: list Arkas from on-chain `ArkaRegistry`
- /arkas/[id]: Arka detail, Deposit/Redeem; Rebalance (manager only)
- /factory/create: create Arka via `ArkaFactory`, post-init setters
- /settings: show contract IDs and network config

## Environment
- .env.local (in `arkafund-dapp/`):
  - NEXT_PUBLIC_TESTNET=true for testnet/local preview, or false/omitted with mainnet network vars for production
  - NEXT_PUBLIC_ARKAFUND_NETWORK_TARGET=testnet|mainnet
  - NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org for testnet or https://mainnet.sorobanrpc.com for mainnet
  - NEXT_PUBLIC_ARKA_FACTORY=<ID>
  - NEXT_PUBLIC_ARKA_REGISTRY=<ID>
  - NEXT_PUBLIC_SOROSWAP_ADAPTER=<ID>
  - NEXT_PUBLIC_AQUARIUS_ADAPTER=<ID>
  - NEXT_PUBLIC_SOROSWAP_ROUTER=<ID> (protocol router)
  - NEXT_PUBLIC_ARKA_ROUTER=<ID> (internal router with `execute()`)
  - optional: NEXT_PUBLIC_REBALANCE_SLIPPAGE_PROFILE=standard|micro_liquidity
  - optional: NEXT_PUBLIC_DEFAULT_REBALANCE_SLIPPAGE_PCT / NEXT_PUBLIC_MAX_REBALANCE_SLIPPAGE_PCT / NEXT_PUBLIC_REBALANCE_EXTRA_BUFFER_PCT / NEXT_PUBLIC_REBALANCE_FALLBACK_EXTRA_PCT
  - optional: NEXT_PUBLIC_ARKA_ID=<ID> for quick access

## Wallets & Auth
- Connect via Stellar Wallets Kit (Freighter/Albedo/xBull)
- Soroban auth model:
  - Adapter→Router nested calls require non-invoker auth entries
  - The dApp simulates (rpc.Api), assembles (rpc.assembleTransaction), collects required auth entries, then asks wallet to sign both entries and tx
  - Approvals must land before swap simulation; dApp waits on approve hash (`waitForSorobanTx`)

## Flows
- Deposit:
  1) Approve Arka to spend input token
  2) Wait for approval confirmation
  3) Call Arka.deposit
- Redeem:
  - Call Arka.redeem(shares)
- Rebalance (manager):
  - Build steps (buildSwapStepScVal) referencing adapters (SoroSwap/Aquarius), set min_out and amount
  - Quick path (current): funds can be received by manager and forwarded to Arka within the same tx to bypass nested `require_auth` on SoroSwap
  - Definitive (next): simulate and assemble non-root auth entries so receiver is Arka; single signature from manager
- Create Arka:
  - ArkaFactory.create_arka(salt) → record ID
  - Post-init: Arka.init (fees/whitelist), Arka.set_router

## Registry
- On-chain ArkaRegistry lists Arkas and Arkas by manager
- UI /arkas loads via read helpers; after factory create, the dApp can auto-register if factory didn’t

## Known issues & fixes
- Missing trustlines for SACs → create classic trustline when SAC wraps classic asset
- Insufficient balances for swaps → fund test account
- Simulation fails after approve → ensure wait for approve tx confirmation
- Wallet prompts twice on adapter swaps → expected (auth entry + tx)

## Dev tips
- Node 20 LTS, @stellar/stellar-sdk v14
- Use rpc.Api.isSimulationError guards; always return base64 XDR from assembly
- Favor client-only wallet init (useEffect) to avoid SSR window access
- Keep `micro_liquidity` slippage only for local/dev smoke runs; production-like testnet demos should stay on the `standard` preset or explicit tighter env overrides
