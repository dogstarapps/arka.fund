## Arka.fund Governance Wiring (Script3 Governor + Timelock)

High-level goal: Use our own governance token to power voting in Script3 Soroban Governor, execute via Timelock, and gate `arka-factory` admin functions behind Timelock auth.

### Components
- `governance-token`: Custom token for voting power (can be replaced with staking/lock wrapper later).
- `soroban-governor`: Script3 Governor contract (external deployment).
- `soroban-timelock`: Script3 Timelock contract (external deployment).
- `arka-factory`: Admin calls (`set_implementation`, `create_arka`) are restricted to an admin Address (set to Timelock).

### Steps
1) Deploy Governance Token
   - Deploy `governance-token` WASM
   - Call `init(admin = deployer)`
   - Mint initial supply to treasury/multisig wallets

2) Deploy Governor + Timelock (from Script3 repo)
   - Governor config: quorum, voting delays/periods, proposal threshold
   - Point Governor to governance-token for voting power
   - Deploy Timelock, set Governor as proposer/executor as per Script3 docs

3) Wire Factory Admin to Timelock
   - Deploy `arka-factory` WASM
   - Call `set_governor(timelock_address)` (admin = Timelock)
   - Upload `arka` logic WASM; obtain `wasm_hash`
   - From Governor → queue to Timelock → execute `set_implementation(wasm_hash)` on Factory

4) Use Governance to manage upgrades/creations
   - Propose `create_arka(salt)` via Governor → Timelock executes on Factory
   - Propose upgrades with new `wasm_hash`

Notes
- In `arka-factory`, admin functions require `require_auth(admin)`, so only the Timelock can call them.
- For staking/escrow voting, replace `governance-token` with a wrapper contract and point Governor to that.



