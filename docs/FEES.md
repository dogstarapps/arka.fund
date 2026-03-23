# Fees Model and Governance

This document defines fee types, how they are represented on-chain, and what is governed by the DAO.

## Fee types
- Management fee: annual percentage on AUM (e.g., 2.00%/year), accrued pro‑rata and charged from the vault.
- Performance fee: percentage on profits, typically using a high‑water mark (e.g., 20%).
- Deposit fee: per‑deposit percentage (anti‑spam, optional).
- Redeem fee: per‑redeem percentage (optional).
- Protocol (platform) fee: the share of the above fees (or an overlay fee) routed to the protocol treasury.

All fee inputs are shown in the dApp UI as percentages (%) but are passed and stored on‑chain as basis points (bps). 1.00% = 100 bps. Valid range: 0–10,000 bps.

## Governance control
The DAO governs the active fee surface through the Governor-based execution flow with delay:
- Protocol treasury address
- Protocol fee overlays and/or splits on each fee component
- Max caps per fee (ceilings)
- Enabling/disabling per‑operation fees (deposit/redeem)
- Defaults and allowed presets for new Arkas

Recommended initial policy (mainnet guidance, can evolve via DAO):
- Platform overlay: 0.25%/year on TVL to protocol treasury
- Performance split: if performance fee is 20%, 2% to protocol / 18% to manager
- Per‑op fees: 0–5 bps for deposit/redeem (optional)

## On-chain representation

The current `Arka` contract includes:
- `FeeStructure { mgmt_bps, perf_bps, deposit_bps, redeem_bps }`

Current governed contract surface:
- `set_fees(...)` on `Arka`
- Governor-controlled policy updates executed through the active governance lifecycle

Planned protocol-wide additions:
- `protocol_treasury: Address`
- Policy fields for protocol splits/overlays (e.g., `mgmt_protocol_bps`, `perf_protocol_bps` or split bps)
- additional protocol-level governed fee settings

## dApp behavior
- UI inputs in %; conversion to bps before submit
- Router/Denomination may be preset from env; Denomination can be optionally overridden in the wizard

## Testnet defaults
- For simplicity in Testnet: Management 0.0–0.5%, Performance 0–20%, Deposit 0.0%, Redeem 0.0–0.5%
