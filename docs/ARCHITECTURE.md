# Arka.fund Architecture

This document describes the current contract architecture represented in this repository.

## Core Contracts

### ArkaFactory

`ArkaFactory` stores the active `Arka` implementation hash and creates new vault instances. It is also the target for governed implementation changes and governed migrations.

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
- `manager-tier`

These modules cover manager lock mechanics, community coverage staking, and tier-related policy flows.

## Strategy Execution

### Swap Integrations

The current validated swap and routing surface covers:

- Aquarius
- SoroSwap
- Balanced

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

- `votes`
- `governor`

The current model uses the Governor's execution delay parameter rather than a separate Timelock deployment. Governed targets include `ArkaFactory` and `Arka`.

## Experimental Modules

The workspace still contains `adapter-comet` and `adapter-phoenix`, but those modules are not part of the current validated public integration set.

## Repository Focus

This repository focuses on contracts, deployment scripts, and validation runbooks. Additional application and service layers may evolve separately from this codebase.
