# Arka.fund Support Matrix

This file summarizes the main reference documents, the validated modules, and the integrations that are still being developed.

## Main References

Use the following files as the main reference set:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/DEPLOYMENT.md`
- `docs/GOVERNANCE.md`
- `docs/FEES.md`
- `docs/SECURITY.md`
- `docs/UI_SPEC.md`
- `docs/TRANCHE2_EXECUTION.md`
- `deployments.testnet.json`

## Validated Contract Modules

The current testnet validation matrix covers:

- `contracts/arka`
- `contracts/arka-factory`
- `contracts/arka-registry`
- `contracts/test-token`
- `contracts/coverage-vault`
- `contracts/coverage-fund`
- `contracts/manager-tier`
- `contracts/adapter-aquarius`
- `contracts/adapter-soroswap`
- `contracts/adapter-blend`
- `contracts/blend-router-mock`

## Governance Model

The governance stack in this repository is:

- `votes` for voting power
- `governor` for proposals and execution
- non-zero `timelock` configured as an execution-delay parameter on the Governor

The current testnet flow does not rely on a separate Timelock deployment.

## Additional Adapters

The following contracts remain in the workspace for future integration work, but they are not part of the current validated matrix:

- `contracts/adapter-phoenix`

The following contracts remain in the repository only as retired historical harnesses and should not be treated as supported integrations:

- `contracts/adapter-balanced`
- `contracts/balanced-router-mock`

## Earlier Execution Notes

The following file remains useful as background:

- `docs/TRANCHE1_E2E.md`

It provides earlier execution context, while the files listed above reflect the current implementation and validation state.
