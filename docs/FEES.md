# Fees Model and Governance

This document defines fee types, how they are represented on-chain, and what is governed by the DAO.

## Fee types
- Opening / creation fee: fixed token amount charged by `ArkaFactory` when a manager creates an Arka. This is an anti-spam and seriousness filter, not a vault percentage fee.
- Management fee: annual percentage on AUM (e.g., 2.00%/year), accrued pro‑rata and charged from the vault.
- Performance fee: percentage on profits, typically using a high‑water mark (e.g., 20%).
- Deposit fee: per‑deposit percentage (anti‑spam, optional).
- Redeem fee: per‑redeem percentage (optional).
- Protocol (platform) fee: the share of the above fees (or an overlay fee) routed to the protocol treasury.

Vault percentage fees are shown in the dApp UI as percentages (%) but are passed and stored on‑chain as basis points (bps). 1.00% = 100 bps. Valid range in the current contracts: 0–10,000 bps.

Basis points are ratios, not asset denominations. The asset or economic base depends on the operation:

- management/performance fees apply to NAV/profit and settle as newly minted vault shares;
- deposit fees apply to the deposited amount and mint fewer shares;
- redeem fees apply to the gross redemption value and reduce the denomination asset returned;
- the opening / creation fee is different: it is a fixed amount of the configured fee token, normally USDC.

## Governance control
The DAO governs the active fee surface through the Governor-based execution flow with delay:
- Protocol treasury address
- Protocol fee overlays and/or splits on each fee component
- Max caps per fee (ceilings)
- Enabling/disabling per‑operation fees (deposit/redeem)
- Defaults and allowed presets for new Arkas

Recommended initial policy (mainnet guidance, can evolve via DAO):
- Opening fee: fixed USDC amount, recommended default 25 USDC unless DAO chooses a different value
- Platform overlay: 0.25%/year on TVL to protocol treasury
- Performance split: if performance fee is 20%, 2% to protocol / 18% to manager
- Per‑op fees: 0–5 bps for deposit/redeem (optional)

Creation fee is only one anti-spam layer. Public product surfaces should also distinguish between an Arka that exists on-chain and an Arka that is listed in Discover/leaderboards. Listing should depend on indexed NAV, minimum TVL or deposit activity, manager verification, curator/DAO approval, or equivalent quality gates.

## On-chain representation

The current `Arka` contract includes:
- `FeeStructure { mgmt_bps, perf_bps, deposit_bps, redeem_bps }`
- `ProtocolFeePolicy { mgmt_protocol_bps, perf_protocol_bps }`
- `FeeState { last_settlement_ts, high_water_mark, cumulative_*_shares }`

Current governed contract surface:
- `set_fees(...)` on `Arka`
- `set_protocol_fee_policy(...)` on `Arka`
- Governor-controlled policy updates executed through the active governance lifecycle

Current implemented fee-engine behavior:
- management fees accrue over time and settle as newly minted vault shares
- performance fees settle as newly minted vault shares using a net-of-fees high-water mark
- protocol treasury participation is optional and receives a governed split of minted management/performance fee shares
- fee settlement is permissionless through `settle_fees()`
- fee previews are available through `preview_fee_settlement()`
- fee accounting state is queryable through `fee_state()`

Factory defaults:
- `ArkaFactory` can store protocol treasury defaults
- `ArkaFactory` can store default protocol fee splits
- `ArkaFactory` can store a fixed creation fee token and amount
- those defaults are propagated during `create_and_init(...)` when configured

## dApp behavior
- UI inputs in %; conversion to bps before submit
- Router/Denomination may be preset from env; Denomination can be optionally overridden in the wizard

## Testnet defaults
- For simplicity in Testnet: Management 0.0–0.5%, Performance 0–20%, Deposit 0.0%, Redeem 0.0–0.5%

## Testnet validation evidence
- The fee engine now has a reproducible live-validation path on testnet through `scripts/deploy-fee-engine-live-validation.sh`.
- The live proof records:
  - management-fee preview with positive accrued fee shares
  - permissionless settlement of accrued management fees
  - protocol treasury split after settlement
  - controlled profit realization through the router path
  - performance-fee crystallization after profit
  - full user redemption while manager and treasury fee ownership remains intact
- Canonical evidence is written to:
  - `deployments.testnet.json` under `validations.feeEngine`
  - `tmp/fee-engine-live-validation.json`
