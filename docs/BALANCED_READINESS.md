# Balanced Readiness

`Balanced` is being reopened deliberately, not by relabeling the old `Comet`-coupled lane.

The source `adapter-balanced` contract is now generic again:
- no `Comet`-specific pair pricing path in canonical code
- on-chain readiness is expressed as `pool_supported(pool_id)`
- execution goes through the configured router's generic `swap(...)` surface

The readiness audit remains dual-stack on purpose so it can read:
- the new canonical shape (`pool_supported`)
- the still-deployed legacy shape (`pair_of`)

When both shapes exist in the same repository state, the validator now prefers:
1. `contracts.adapterBalanced`
2. `contracts.balancedRouter`
3. legacy fallback under `legacyContracts.*`

## Current audit source

- runbook: `scripts/deploy-balanced-readiness-validation.sh`
- helper: `scripts/validate_balanced_readiness.py`
- canonical cutover: `scripts/deploy-balanced-canonical-cutover.sh`
- cutover helper: `scripts/balanced_canonical_cutover.py`
- output: `tmp/balanced-readiness-validation.json`
- persisted summary: `deployments.testnet.json -> validations.balancedReadiness`

## What the validation checks

1. the historical `adapterBalanced` contract can still be read on testnet
2. the observed on-chain `router()` is captured exactly
3. the configured on-chain pool activation is captured exactly:
   - `pool_supported(pool_id)` for the canonical adapter shape
   - `pair_of(pool_id)` for the historical legacy adapter
4. the lane is classified as:
   - `ready`
   - `blocked`
5. the report explains why the lane is blocked, for example:
   - still coupled to the retired `Comet` pool
   - still backed by the old mock router
   - missing on-chain pool activation
   - router mismatch versus an explicitly declared canonical Balanced router

## Current interpretation

Until `Balanced` has its own canonical router/addressing and no longer depends on the legacy `Comet` path, the readiness audit should be treated as operational evidence, not as a public support claim.

Once the readiness record flips to:
- `supportStatus = ready`
- `readyForDappExecution = true`
- a non-empty `expectedRouter`

the canonical promotion path can include `Balanced` automatically under:
- `deployments.testnet.json -> validatedModules.balancedExecution`

The canonical cutover helper now automates the full path:
1. deploy canonical `adapter-balanced`
2. `init` it against the declared router
3. activate the chosen pool via `set_supported_pool`
4. rerun readiness validation
5. promote `validatedModules` once the lane is truly ready

That module is intentionally withheld while the lane remains blocked, so `validatedModules` stays a truthful public support surface rather than a wish list.
