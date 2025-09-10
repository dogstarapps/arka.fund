# Arka.fund dApp Guide (Testnet)

## Routes
- /arkas: list Arkas from on-chain `ArkaRegistry`
- /arkas/[id]: Arka detail, Deposit/Redeem; Rebalance (manager only)
- /factory/create: create Arka via `ArkaFactory`, post-init setters
- /settings: show contract IDs and network config

## Environment
- .env.local (in `arkafund-dapp/`):
  - NEXT_PUBLIC_TESTNET=true
  - NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
  - NEXT_PUBLIC_ARKA_FACTORY=<ID>
  - NEXT_PUBLIC_ARKA_REGISTRY=<ID>
  - NEXT_PUBLIC_SOROSWAP_ADAPTER=<ID>
  - NEXT_PUBLIC_AQUARIUS_ADAPTER=<ID>
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
  - Invoke Arka.rebalance(steps); the dApp handles auth entries
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
