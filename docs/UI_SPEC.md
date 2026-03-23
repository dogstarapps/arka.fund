## Arka.fund Product Surface Reference

This file describes the user-facing surface aligned with the current validated contract set.

## Current User Flows

### Arkas

- list available Arkas
- open an Arka detail page
- inspect denomination, fee policy, whitelist, shares, and recent activity

### Create Arka

Manager flow for creating a new vault with:

- denomination asset
- fee structure
- asset whitelist
- manager-controlled settings exposed by the current flow

### Deposit and Redeem

Depositors can:

- deposit supported assets
- receive Arka shares
- redeem shares back into the vault denomination flow

### Rebalance

The current validated rebalance surface covers:

- SoroSwap
- Aquarius
- Balanced

These flows are reflected in the Arka detail view and use the contract-layer adapters and router wiring exposed by this repository.

### Credit Positions

The current validated credit-position surface is backed by Blend and includes:

- supply collateral
- borrow
- repay
- withdraw collateral
- read market status and risk-policy information

### Coverage

The current product surface includes:

- coverage-vault manager lock mechanics
- community coverage-fund staking and claiming flows

### Governance

The current governance UI surface is aligned with:

- `votes`
- `governor`
- Governor execution delay

The validated flow is `propose -> vote -> close -> execute`.

## Related Capabilities Not Covered Here

The following items may appear in planning material, but they are not part of the current surface described here:

- indexer-backed leaderboards
- profit ranking across Arkas
- public NAV API
- broad protocol coverage beyond the validated set
- a separate Timelock deployment model
