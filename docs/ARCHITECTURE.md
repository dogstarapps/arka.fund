# Arka.fund Architecture

This document describes the current contract architecture represented in this repository.

## Core Contracts

### ArkaFactory

`ArkaFactory` stores the active `Arka` implementation hash and creates new vault instances. It is also the target for governed implementation changes and governed migrations.

### ARKA Token Layer

The token-power foundation now includes:

- `arka-token` for liquid `ARKA`
- `locked-arka` for non-transferable locked voting power

### Arka

`Arka` is the managed vault contract. It is responsible for:

- denomination asset configuration
- fee configuration
- asset whitelist enforcement
- manager assignment
- deposit and redeem flows
- share-token mint and burn flows
- rebalance execution across approved integrations
- credit-position accounting for supported lending integrations

### Share Token

Each Arka can be paired with a dedicated share token that represents depositor ownership and is minted or burned during deposit and redeem flows.

The share-token admin is the Arka contract itself, limited to share mint/burn accounting. Upgrade authority is separate: new share-token implementations can be initialized with a bootstrap upgrade admin, a governor and a bounded bootstrap expiry so WASM upgrades move to DAO/governor control instead of using the share mint/burn admin.

### Coverage Modules

The repository includes:

- `coverage-vault`
- `coverage-fund`
- `claims-manager`
- `manager-tier`

These modules cover manager lock mechanics, community coverage staking, incident registry and payout execution, and tier-related policy flows.

`coverage-fund` now also acts as a reserve-aware economic layer with:

- covered-vault premium policies
- premium quotation and routing
- retained reserve capital
- reserve-asset yield for stakers
- bootstrap reward accounting
- solvency and utilization metrics

## Strategy Execution

### Swap Integrations

The current mainnet-manifest swap and routing surface covers:

- Aquarius
- SoroSwap
- Phoenix

The Router and adapters enforce per-step slippage constraints and protocol-specific execution wiring.

As of the 2026-07-03 mainnet reality check, SoroSwap, Aquarius and Phoenix have deployed adapters and successful USDC/XLM mainnet canaries. The manifest records `autoEnabled=false` for those AMM venues, so product docs and UI should describe them as canaried/manual unless governance enables AUTO.

Balanced/SODAX is tracked as an intent venue through the server-side SODAX driver. It is not the retired Balanced/Comet AMM-router lane.

### Credit Integrations

The current validated credit surface is built around Blend:

- supply collateral
- withdraw collateral
- market status and risk-policy reads
- position valuation hooks used by the vault

The fixed XLM-USDC Blend market has mainnet canary evidence for supply and withdraw. Borrow and repay remain disabled in the launch manifest until separate risk validation.

## Governance

The active governance stack is:

- `arka-token`
- `locked-arka`
- `votes`
- `governor`
- `governance-executor`

The mainnet manifest includes the governance executor and a time-bounded bootstrap admin scheduled to expire on 2027-06-10. Governed targets include `ArkaFactory`, `Arka`, and the coverage stack.

## Experimental and Historical Modules

`adapter-phoenix` is implemented and deployed on mainnet as a vault-internal Phoenix pool adapter. It has canaried USDC/XLM route evidence, but remains outside AUTO while `deployments.mainnet.json` records `autoEnabled=false`.

`adapter-balanced` remains in the source/build matrix as a generic adapter artifact, but the current mainnet product surface for Balanced is SODAX intents. The retired Balanced/Comet AMM-router lane is historical only.

## Repository Focus

This repository focuses on contracts, deployment scripts, and validation runbooks. Additional application and service layers may evolve separately from this codebase.
