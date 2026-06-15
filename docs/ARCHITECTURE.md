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

The current validated swap and routing surface covers:

- Aquarius
- SoroSwap

The Router and adapters enforce per-step slippage constraints and protocol-specific execution wiring.

### Credit Integrations

The current validated credit surface is built around Blend:

- supply collateral
- borrow
- repay
- withdraw collateral
- market status and risk-policy reads
- position valuation hooks used by the vault

The generic credit-position interface in `Arka` is currently backed by Blend in the current validation matrix.

## Governance

The active governance stack is:

- `arka-token`
- `locked-arka`
- `votes`
- `governor`
- `governance-executor`

The current live testnet model still uses the Governor's execution delay parameter, but the repository now includes a separate executor contract for the target queued-execution architecture. Governed targets include `ArkaFactory`, `Arka`, and the coverage stack.

## Experimental and Historical Modules

`adapter-phoenix` is implemented and deployed on testnet as a vault-internal Phoenix pool adapter. It remains outside the public AUTO allowlist until a real Phoenix pool route is configured with `set_pool_route` and the Arka `allowed_adapters` whitelist is updated through the normal policy path.

`adapter-balanced` is back in the active build/test matrix as the canonical generic Balanced adapter shape. The new source contract no longer carries Comet-specific pair semantics; it now relies on generic `pool_supported(pool_id)` gating plus `router.swap(...)`. The currently deployed testnet lane is still audited separately through `scripts/deploy-balanced-readiness-validation.sh`, because that live deployment remains legacy and Comet-coupled until a clean redeploy happens.

## Repository Focus

This repository focuses on contracts, deployment scripts, and validation runbooks. Additional application and service layers may evolve separately from this codebase.
