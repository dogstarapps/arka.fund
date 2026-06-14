# Coverage Model

This document describes the implemented coverage reserve model.

## Components

### `coverage-vault`

`coverage-vault` remains the manager first-loss layer.

- manager deposits reserve-capital collateral
- governed `lock_bps` keeps a minimum slice locked
- this capital is intended to absorb losses before community capital is touched

### `coverage-fund`

`coverage-fund` is now a reserve-aware community backstop, not only a staking pool.

It supports:

- reserve staking in the reserve asset
- covered-vault premium policies
- premium quotation from covered NAV and billing period
- premium routing into:
  - retained reserve capital
  - distributable reserve-asset yield for stakers
  - optional treasury share when reserve target is already satisfied
- bootstrap rewards in a second token stream
- solvency and utilization reporting

## Economic Model

### Assets

- `reserve_token`: claim-relevant reserve asset and staking asset
- `bootstrap_reward_token`: incentive token used for bootstrap emissions

### Premium Formula

Premiums are quoted per covered vault:

`premium = covered_nav * annual_premium_bps * coverage_period_bps / 10_000 / 10_000`

Where:

- `annual_premium_bps` is the governed annualized premium for that vault
- `coverage_period_bps` is the billed fraction of a year in basis points
- `covered_nav` is the reported covered NAV for the billing period

### Premium Routing

Each premium payment is routed by governed policy:

- `reserve_retention_bps`: mandatory retained share that increases reserve capital
- `treasury_share_bps`: optional treasury share, only released when reserve ratio already meets the target
- remainder: distributable reserve-asset yield for stakers

If the reserve target is not met, the treasury slice is retained in reserve instead of being paid out.

### Reward Streams

Stakers can earn from two explicit streams:

- reserve rewards funded by real premiums
- bootstrap rewards funded by protocol incentives

Both streams are accounted independently and can be claimed independently or together.

## Reporting

`coverage-fund.metrics()` returns:

- total staked reserve capital
- retained premium reserve
- total premiums paid
- total premiums retained
- premiums sent to treasury
- total covered NAV
- reserve capital
- reserve and bootstrap reward obligations outstanding
- reserve ratio
- reserve utilization
- solvency gap

## Main Contract Calls

### Policy

- `set_treasury`
- `set_economics_policy`
- `set_covered_vault_policy`
- `remove_covered_vault`

### Premium Operations

- `quote_premium`
- `pay_premium`

### Staker Operations

- `stake`
- `unstake`
- `claim_reserve_reward`
- `claim_bootstrap_reward`
- `claim_all`
- `pending_rewards`

## Test Coverage

The implemented test surface covers:

- unit tests for premium routing and bootstrap compatibility
- integration test for dual reward claiming
- end-to-end local scenario combining `coverage-vault` and `coverage-fund`

## Testnet Validation

Coverage economics now has a reproducible live-validation path on testnet through `scripts/deploy-coverage-claims-live-validation.sh`.

The recorded testnet evidence proves:

- governed premium policy on a covered vault
- premium routing into retained reserve plus reserve-asset rewards
- treasury gating while the reserve target is still unmet
- dual reward claiming by a real staker
- reserve-capital and solvency reporting after premium funding

The evidence is written to:

- `deployments.testnet.json` under `validations.coverageEconomics`
- `tmp/coverage-claims-live-validation.json`

## Claims Path

The reserve subsystem now includes a first-class claims path.

- `coverage-vault` pays manager first-loss capital through `claim_payout()`
- `coverage-fund` pays community reserve through `claim_from_community()`
- `claims-manager` coordinates trigger, freeze, approval, and execution

Community claims consume retained reserve first and then socialized staker principal.
