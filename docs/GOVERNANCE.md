# Arka.fund Governance

This repository uses the vendored `soroban-governor` implementation with a non-zero execution delay configured on the Governor itself. The current testnet flow does not deploy a separate Timelock contract.

## Governance Components

- `votes`: voting-power contract used by the governor.
- `governor`: proposal, voting, close, and execute lifecycle.
- `ArkaFactory` and `Arka`: governed targets for implementation updates, policy updates, and migrations.

## Execution Lifecycle

The current lifecycle is:

1. `propose`
2. `vote`
3. `close`
4. wait for the configured Governor execution delay
5. `execute`

The `timelock` setting in Governor configuration is therefore an execution-delay parameter, not a standalone contract deployment.

## Governed Actions

The current flow covers:

- `ArkaFactory` implementation updates
- governed `Arka` policy setters such as fee and whitelist updates
- governed migrations for existing Arkas
- registry curation and protocol-level operational settings where exposed by the contracts

See also: `docs/FEES.md` for the current fee-model surface and governance boundaries.

## Testnet Bootstrap

The current bootstrap and validation flow is scripted through:

- `scripts/build-wasm.sh`
- `scripts/deploy.sh`
- `scripts/bootstrap-governance-user-admin.sh`
- `scripts/e2e-governed-policy.sh`
- `scripts/e2e-arka-migration.sh`
- `scripts/deploy-governance-live-validation.sh`

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
```

## Compatibility Note

Earlier repository notes referenced a separate `Governor + Timelock` architecture based on external Script3 material. The current testnet flow uses Governor execution delay instead.
