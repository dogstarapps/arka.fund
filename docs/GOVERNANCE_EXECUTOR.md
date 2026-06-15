# Governance Executor

`governance-executor` is the repository contract that separates queueing and delayed execution from the proposal lifecycle.

It is designed to sit behind the existing `votes + governor` stack:

- the Governor proposal executes a call into `governance-executor.schedule(...)`
- the executor stores the exact batch under an operation id
- the executor enforces its own delay and grace window
- anyone can later call `execute(...)` once the operation is ready

This gives Arka.fund a real `Governor -> queue -> execute` split without forking the vendored Governor implementation.

## Contract Surface

Configuration:

- `init(admin, min_delay, grace_period)`
- `set_admin(caller, admin)`
- `set_governor(caller, governor)`
- `set_min_delay(caller, min_delay)`
- `set_grace_period(caller, grace_period)`

Queueing and execution:

- `schedule(caller, operation_id, actions)`
- `cancel(caller, operation_id)`
- `execute(operation_id)`

Views:

- `config()`
- `operation(operation_id)`
- `current_operation_status(operation_id)`
- `is_ready(operation_id)`

## Authorization Model

- before a Governor is bound, the executor is administered directly by `admin`
- once a Governor address is set, scheduling and cancellation move to that Governor address
- admin or the current Governor can rotate the Governor binding and timing parameters
- execution is permissionless after the delay has passed

## Action Model

Each queued action stores:

- target contract id
- target function
- exact argument vector

For governed targets that expect the executor address as the logical caller, the queued args must include the executor address explicitly.

Examples:

- `Arka.set_fees(executor_id, ...)`
- `CoverageFund.set_treasury(executor_id, Some(treasury))`

The executor signs the subcall as the current contract before invoking the target, so existing governed contracts that rely on `require_auth()` continue to work.

## Current Validation

The contract is covered by:

- unit tests against the real `governance-token`
- integration tests against `coverage-fund` and `arka-factory`
- end-to-end local test covering `arka` plus `coverage-fund` after governance handoff

Validation commands:

```bash
cargo test -p governance-executor --tests
bash scripts/build-wasm.sh
```

Current validation status in this repository is local and artifact-based. A full live testnet handoff using the executor should be recorded before mainnet publication.
