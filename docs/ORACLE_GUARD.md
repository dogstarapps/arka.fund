# Oracle Guard

`oracle-guard` is an on-chain price guard compatible with the SEP-40-style `lastprice` interface already consumed by the vault and Blend router flows.

## Purpose

- decouple vault-safe pricing from any single oracle provider
- support primary and secondary providers per asset
- reject stale, future-dated, zero, or divergent feeds
- preserve compatibility with existing contracts by exposing the same `lastprice(asset)` surface

## Asset Policy

Each asset policy defines:

- primary oracle contract
- optional secondary oracle contract
- maximum accepted feed age
- maximum accepted deviation between primary and secondary prices
- whether secondary confirmation is mandatory
- divergence handling mode

Supported divergence handling modes:

- `0`: fail closed
- `1`: use secondary
- `2`: use lower price

## Contract Surface

Administrative methods:

- `init(admin)`
- `set_admin(caller, admin)`
- `set_stellar_asset_policy(...)`
- `set_symbol_asset_policy(...)`
- `clear_stellar_asset_policy(...)`
- `clear_symbol_asset_policy(...)`

Read methods:

- `lastprice(asset)`
- `inspect_stellar(asset)`
- `inspect_symbol(symbol)`
- `stellar_asset_policy(asset)`
- `symbol_asset_policy(symbol)`

## Integration Pattern

The intended integration pattern is:

1. configure asset policies on `oracle-guard`
2. point the downstream protocol or pool oracle to `oracle-guard`
3. keep vault-side risk policy checks enabled

This keeps provider routing and divergence handling in one place while preserving existing fail-close behavior in the vault.

## Validation

Local validation:

```bash
bash scripts/e2e-oracle-guard.sh
```

Canonical live validation on testnet:

```bash
bash scripts/deploy-oracle-guard-live-validation.sh
```

That script:

- deploys an isolated `oracle-guard`
- deploys primary and secondary `test-oracle` providers
- deploys an isolated test asset used as the policy key
- validates secondary-selection on divergence
- validates fallback to secondary when the primary feed is stale
- validates fail-closed behavior on divergence
- records the resulting contract ID under `contracts.oracleGuard` in `deployments.testnet.json`
- records the validation evidence under `validations.oracleGuard`
