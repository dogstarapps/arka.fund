# Claims Circuit

This document describes the implemented incident and payout workflow.

## Contracts

### `claims-manager`

`claims-manager` is the incident registry and waterfall executor.

It supports:

- covered-vault registration
- risk-operator permissions
- incident trigger and active freeze state per covered vault
- incident approval by policy authority
- permissionless execution after approval
- waterfall ordering across:
  - `coverage-vault` manager first-loss capital
  - `coverage-fund` community reserve
  - optional treasury top-up in reserve token

### `coverage-vault`

`coverage-vault` now exposes a claims path:

- `claim_capacity()`
- `claim_payout()`

This path bypasses the normal withdrawal lock and is restricted to the configured claims manager, governor, or manager.

### `coverage-fund`

`coverage-fund` now exposes a community claims path:

- `claim_capacity()`
- `claim_from_community()`

Community capital is modeled as staker principal plus retained reserve. Claims consume retained reserve first and then haircut staker principal.

## Incident Lifecycle

1. Trigger
- governor, admin, or approved risk operator opens an incident
- the vault becomes frozen at the claims-controller level while active
- the incident stores immutable snapshots of manager first-loss capacity and community reserve capacity

2. Approval
- policy authority sets the approved payout amount
- the contract derives the waterfall automatically from live capacities
- recipient and reason code are recorded on-chain

3. Execution
- any caller can execute an approved incident
- payout order is manager first-loss, then community reserve, then optional treasury support
- execution clears the active freeze flag and leaves the incident in permanent history

4. Rejection
- policy authority can reject a triggered incident
- rejection clears the freeze flag but preserves incident history

## Treasury Support

Treasury support is optional.

When used, the treasury address must pre-approve `claims-manager` as spender on the reserve token.

## Test Surface

The implemented tests cover:

- unit test for trigger/approve/execute in `claims-manager`
- integration test with treasury top-up
- end-to-end test with freeze, reject, re-trigger, and execution
- regression tests on `coverage-vault` and `coverage-fund` after adding claim paths

## Testnet Validation

The claims circuit now has a reproducible live-validation path on testnet through `scripts/deploy-coverage-claims-live-validation.sh`.

The recorded testnet evidence covers:

- incident trigger and active freeze state
- rejection and freeze release
- re-trigger of a live incident
- governed approval with an on-chain waterfall plan
- execution across manager first-loss capital, community reserve, and treasury top-up
- permanent incident history plus post-execution reserve-state reporting

The evidence is written to:

- `deployments.testnet.json` under `validations.claimsCircuit`
- `tmp/coverage-claims-live-validation.json`
