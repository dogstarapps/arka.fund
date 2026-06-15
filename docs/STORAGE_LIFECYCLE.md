# Storage Lifecycle

Date: 2026-04-17

## Purpose

This runbook defines a reproducible lifecycle extension process for canonical contract instances on Stellar/Soroban.

It is designed to:

- keep canonical contract instance entries warm
- provide machine-consumable evidence for security/release workflows
- fail fast in strict mode when any extension command fails

## Entry Points

- Script: `scripts/storage_lifecycle_extend.py`
- Wrapper: `scripts/deploy-storage-lifecycle-extend.sh`
- E2E check: `scripts/e2e-storage-lifecycle.sh`

## Default Behavior

- reads canonical contract IDs from `deployments.testnet.json -> contracts`
- filters invalid/non-contract values
- de-duplicates repeated contract IDs
- executes `stellar contract extend --id <contract> ...` per target
- writes machine-consumable report to `tmp/storage-lifecycle-extend.json`
- optionally records validation evidence under `deployments.testnet.json -> validations.storageLifecycle`

## Soroban expiration model

Stellar/Soroban contract data has TTL and must be extended periodically.

- `temporary` storage is deleted permanently when TTL expires.
- `persistent` storage is archived when TTL expires and can be restored, but it is unavailable until restored.
- `instance` storage is tied to the contract instance lifecycle and is extended by extending the contract instance.
- Extending/restoring costs fees, so mainnet operations must budget XLM for lifecycle maintenance.

Official references:

- https://developers.stellar.org/docs/build/guides/storage/choosing-the-right-storage
- https://developers.stellar.org/docs/learn/fundamentals/contract-development/storage/state-archival

## Commands

Dry-run audit (no on-ledger mutation):

```bash
python3 scripts/storage_lifecycle_extend.py --dry-run --strict
```

Operator execution (extends instance TTL on target network):

```bash
bash scripts/deploy-storage-lifecycle-extend.sh
```

E2E check (dry-run + validation assertions on a temporary manifest copy):

```bash
bash scripts/e2e-storage-lifecycle.sh
```

## Release Gate Integration

`scripts/release_gate.py` includes `storage_lifecycle_audit` in the default gate plan, using strict dry-run mode so lifecycle inventory is checked on every full gate pass.

## Mainnet usage

The wrapper defaults to testnet. For mainnet, pass an explicit manifest and network configuration:

```bash
DEPLOYMENTS=/path/to/deployments.mainnet.json \
STORAGE_LIFECYCLE_NETWORK=mainnet \
STORAGE_LIFECYCLE_RPC_URL=https://mainnet.sorobanrpc.com \
STORAGE_LIFECYCLE_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015" \
STORAGE_LIFECYCLE_SOURCE_ACCOUNT=<stellar-cli-identity> \
bash scripts/deploy-storage-lifecycle-extend.sh
```

Before mainnet cutover:

- create the mainnet deployments manifest;
- run dry-run strict mode against that manifest;
- execute the live extension after deploy;
- commit or archive the generated evidence JSON;
- schedule recurring lifecycle extension before TTL reaches the warning threshold.

## Coverage and limitations

Current repository coverage:

- Contract dynamic persistent keys in `Arka`, `ArkaFactory`, `ArkaRegistry`, `OracleGuard`, token contracts and coverage modules extend TTL when they are read or written.
- `scripts/storage_lifecycle_extend.py` extends canonical contract instance TTLs listed in the deployments manifest.
- `scripts/e2e-storage-lifecycle.sh` validates the dry-run/report/update flow.
- `scripts/release_gate.py` includes a strict dry-run lifecycle audit.

Current limitation:

- The lifecycle script targets contract instances from the manifest. It does not enumerate every dynamic persistent key such as every user balance, every Arka balance key, every registry index key or every OracleGuard asset policy key.
- Those dynamic keys are refreshed when touched by contract code. Long-idle keys may still require a restore/extend operation if they approach or pass archival.

Operational requirement:

- Mainnet monitoring must track contract instance TTLs and high-value persistent entries.
- If a persistent entry is archived, run a restore flow before invoking functionality that depends on it.
- Do not rely on temporary storage for user balances, governance state, fee accounting, registry data or oracle policies.
