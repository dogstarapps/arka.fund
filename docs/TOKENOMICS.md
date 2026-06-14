# Tokenomics

The repository now contains the first-release tokenomics stack for Arka.fund:

- `arka-token`: liquid `ARKA`
- `locked-arka`: non-transferable voting power derived from locked `ARKA`
- `arka-vesting`: governed vesting schedules funded in `ARKA`
- `emissions-controller`: governed emissions and treasury-distribution streams funded in `ARKA`

This intentionally keeps depositor voting out of the first release. `dARKA` remains a deferred governance extension, not part of the implemented tokenomics stack.

## Contract Roles

### Liquid token

`arka-token` is the market-facing and treasury-facing token layer.

Surface:

- metadata
- optional max supply cap
- mint / burn / admin burn
- admin rotation
- approve / allowance
- transfer / transfer_from

### Locked voting power

`locked-arka` escrows `ARKA` and exposes checkpointed vote history.

Surface:

- create lock
- increase amount
- extend lock
- withdraw after maturity
- delegate votes
- `get_votes`
- `get_past_votes`
- `get_past_total_supply`
- `set_vote_sequence`

The current model is lock-based and non-transferable. It is not a time-decaying vote-escrow model.

### Vesting

`arka-vesting` holds funded `ARKA` grants and releases them linearly over time.

Surface:

- `create_grant`
- `claim`
- `claim_all`
- `revoke`
- `grant`
- `grant_ids`
- `claimable`
- `vested_amount`

Properties:

- grants are funded up front by pulling approved `ARKA` into the vesting contract
- cliffs and end times are enforced on-chain
- revocable and non-revocable schedules are both supported
- unvested balances can be returned to treasury or another refund recipient on governed revoke

### Emissions and treasury distribution

`emissions-controller` manages funded linear emission streams.

Surface:

- `create_stream`
- `release`
- `release_all`
- `cancel_stream`
- `stream`
- `stream_ids`
- `releasable`

Properties:

- streams are funded up front by pulling approved `ARKA` into the controller
- recipients receive only accrued amounts
- canceled programs return unaccrued balances to the configured refund recipient
- the same engine can serve ecosystem incentives, team-approved budgets, and treasury-controlled distributions

## Governance Posture

Both `arka-vesting` and `emissions-controller` support:

- admin-controlled setup
- optional handoff to a governed executor path

That lets the protocol:

- bootstrap token programs under admin control
- migrate them to `Governor + executor` once governance authority is live

## Validation

Validation currently covers:

- unit tests for `arka-vesting`
- integration tests for multi-grant claim flows
- unit tests for `emissions-controller`
- integration tests for multi-stream release flows
- end-to-end governed scenario combining:
  - `arka-token`
  - `arka-vesting`
  - `emissions-controller`
  - `locked-arka`
  - `governance-executor`
- live testnet validation covering governed creation, partial accrual, claim/release, governed revoke/cancel, refund behavior, and relocking into voting power

Commands:

```bash
cargo test -p arka-vesting -p emissions-controller --tests
bash scripts/build-wasm.sh
bash scripts/deploy-tokenomics-live-validation.sh
```

Testnet evidence:

- validation report: `tmp/tokenomics-live-validation.json`
- deployment registry entry: `deployments.testnet.json` under `validations.tokenomics`

Current limitation:

- this tokenomics layer is now live-validated on testnet through an isolated validation stack
- the validated tokenomics contracts are not yet promoted into the top-level canonical `contracts` map
