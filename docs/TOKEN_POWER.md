# Token Power

For the broader first-release tokenomics stack, including vesting and emissions/distribution, see [TOKENOMICS.md](./TOKENOMICS.md).

The repository now contains the first concrete token-power foundation for Arka.fund:

- `arka-token`: liquid transferable `ARKA`
- `locked-arka`: non-transferable voting-power escrow built on top of `ARKA`

## Current Model

### ARKA

`arka-token` is the liquid asset layer.

Current surface:

- metadata
- optional max supply cap
- mint
- burn
- admin burn
- admin rotation
- approve / allowance
- transfer / transfer_from

This is the market-facing and treasury-facing token layer.

### locked ARKA

`locked-arka` escrows `ARKA` and exposes voting power plus vote history:

- create lock
- increase amount
- extend lock
- withdraw after maturity
- delegate votes
- `get_votes`
- `get_past_votes`
- `get_past_total_supply`
- `set_vote_sequence`

The current implementation is intentionally:

- non-transferable
- checkpointed
- lock-based
- 1:1 voting power against locked principal

It is **not** a time-decaying vote-escrow model.

## Naming

Public naming should prefer:

- `ARKA`
- `locked ARKA`
- `Arka voting power`

The implementation does not require a public `veARKA` label.

## Why this model

This voting-power layer gives Arka.fund:

- liquid token economics
- locked governance participation
- delegation
- Governor-compatible vote history

without taking on the extra complexity of a full time-decay vote-escrow system.

If a future phase requires time-decaying voting power, that should be treated as a deliberate upgrade rather than implied by the current implementation.

## Validation

Current repository validation for token power covers:

- unit tests for `arka-token`
- unit tests for `locked-arka`
- integration test for lock lifecycle and underlying token round-trip
- end-to-end local scenario combining `arka-token`, `locked-arka`, and `governance-executor`
- live testnet governance-handoff validation against a real Governor + executor path

Commands:

```bash
cargo test -p arka-token -p locked-arka --tests
bash scripts/build-wasm.sh
bash scripts/deploy-governance-handoff-live-validation.sh
bash scripts/deploy-tokenomics-live-validation.sh
```

The compatibility handoff with the live Script3 governance deployment is now validated on testnet. The recorded evidence shows the governed executor minted liquid `ARKA`, and the holder finished with `220` locked votes and `0` liquid balance after relocking through the live path.

The broader token-power path is also now live-validated through `deploy-tokenomics-live-validation.sh`: a governed vesting grant is claimed, a governed emission stream is released, and the team account relocks `1000` liquid `ARKA` into `1000` units of voting power, with the evidence recorded under `validations.tokenomics`.
