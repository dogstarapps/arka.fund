# Arka.fund Governance

This repository uses the vendored `soroban-governor` implementation for proposals and voting, and now also includes a separate `governance-executor` contract for queued delayed execution.

Important distinction:

- the repository still supports the Governor's internal delay parameter for legacy flows
- the separated executor path is now implemented and live-validated on testnet
- the latest testnet evidence is recorded under `validations.governanceHandoff` in `deployments.testnet.json`

## Governance Components

- `votes`: voting-power contract used by the governor.
- `locked-arka`: repository-native locked voting-power escrow for `ARKA`.
- `governor`: proposal, voting, close, and execute lifecycle.
- `governance-executor`: separate queueing and delayed execution contract for post-vote actions.
- `ArkaFactory` and `Arka`: governed targets for implementation updates, policy updates, and migrations.

## Execution Lifecycle

The current repository supports two governance lifecycles:

Current validated live flow:

1. `propose`
2. `vote`
3. `close`
4. wait for the configured Governor execution delay
5. `execute`

Target separated flow:

1. `propose`
2. `vote`
3. `close`
4. Governor executes `governance-executor.schedule(...)`
5. wait for executor delay
6. permissionless `governance-executor.execute(...)`

In legacy flows, the `timelock` setting in Governor configuration remains an execution-delay parameter. In the separated flow, the executor becomes the delayed-execution layer, and that path is now validated on testnet with live contracts.

## Governed Actions

The current flow covers:

- `ArkaFactory` implementation updates
- governed `Arka` policy setters such as fee and whitelist updates
- governed migrations for existing Arkas
- registry curation and protocol-level operational settings where exposed by the contracts
- queued delayed execution of governed batches through `governance-executor`
- repository-native token-power primitives through `arka-token` and `locked-arka`

See also: `docs/FEES.md` for the current fee-model surface and governance boundaries.
See also: `docs/GOVERNANCE_EXECUTOR.md` for the queueing and execution contract.
See also: `docs/TOKEN_POWER.md` for the liquid token and locked voting-power model.

## Testnet Bootstrap

The current bootstrap and validation flow is scripted through:

- `scripts/build-wasm.sh`
- `scripts/deploy.sh`
- `scripts/bootstrap-governance-user-admin.sh`
- `scripts/e2e-governed-policy.sh`
- `scripts/e2e-arka-migration.sh`
- `scripts/deploy-governance-live-validation.sh`
- `scripts/deploy-governance-handoff-live-validation.sh`
- `scripts/resume-governance-handoff-live-validation.sh`

Typical environment variables:

```bash
export NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
export RPC_URL="https://soroban-testnet.stellar.org"
export ADMIN_ADDRESS="G..."
export ADMIN_SECRET="S..."
```

Bootstrap and validation:

```bash
bash scripts/build-wasm.sh
bash scripts/deploy.sh
bash scripts/bootstrap-governance-user-admin.sh
bash scripts/e2e-governed-policy.sh
bash scripts/e2e-arka-migration.sh
bash scripts/deploy-governance-handoff-live-validation.sh
```

## Compatibility Note

Earlier repository notes referenced a separate `Governor + Timelock` architecture based on external Script3 material. The repository now contains that executor layer as `governance-executor`, and the separated handoff path has been validated on testnet with:

- governor: `CDCA57KK24PZ7CWGSPPSVZMOF6HJXCDHZWV5USWBVANYAR6OCAXL777F`
- executor: `CBBGX752SGBIOZZMG7DHGG37YFLVP4W7KGIO2UWFNBKFNXEMYESUYCDY`
- liquid token: `CBPF7F3PNQ567JKZAKIJIGGSP3CLBA7VPK7IJAHI2FPBR7KGAWQGOYMU`
- locked voting power: `CAUE46HQDGXCP5RUFN4CEU7KOSOWG2UGJIXZRNAPXZFYBC55PH4NGZAC`

The validation report is written to `tmp/governance-handoff-live-validation.json` and persisted into `deployments.testnet.json`.
