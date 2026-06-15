# Internal Security Audit Plan

This document defines the internal security-audit lane for Arkafund contracts before any external review or mainnet publication.

## Goals

- Keep a continuously updated inventory of public contract entrypoints.
- Track which entrypoints mutate storage, require explicit auth, or invoke external contracts.
- Surface high-risk modules first and keep their review evidence close to the release gate.
- Turn the internal audit into a rerunnable engineering workflow, not a one-off spreadsheet exercise.

## Scope Priority

1. `arka`
2. `arka-factory`
3. `coverage-fund`
4. `claims-manager`
5. `governance-executor`
6. `oracle-guard`
7. `arka-registry`
8. `adapter-aquarius`
9. `adapter-soroswap`
10. `adapter-blend`
11. `locked-arka`
12. `arka-token`
13. `manager-tier`

## Automated Evidence

The audit pipeline now generates:

- `tmp/internal-security-audit.json`
- `tmp/internal-security-audit.md`
- `tmp/storage-lifecycle-extend.json`

Those reports are produced by:

- `scripts/internal_security_audit.py`
- `scripts/run-internal-security-audit.sh`
- `scripts/storage_lifecycle_extend.py`
- `scripts/deploy-storage-lifecycle-extend.sh`

The automated pass captures:

- public entrypoint inventory
- explicit auth markers
- storage mutation markers
- external contract invocation markers
- active adapter checks for the validated public surface

## Manual Review Expectations

The automated report is not a substitute for human review. It is meant to concentrate manual effort on:

- privileged flows
- vault accounting and share issuance
- fee and claim settlement
- governance execution boundaries
- oracle freshness and fail-close behavior
- external protocol trust boundaries

Any `review` finding in the generated report must be triaged manually before mainnet release.

Storage lifecycle expectations:

- canonical contract instances in `deployments.testnet.json` keep a reproducible TTL-extend workflow
- dry-run storage lifecycle checks remain green in CI / release gate
- operator execution mode remains strict and machine-consumable for post-run evidence

## Release Gate

The release gate now includes both `internal_security_audit` and `storage_lifecycle_audit` steps so the reports are always regenerated together with build, tests, and live validations.

## Iteration Closure (2026-04-17)

- Internal audit analyzer hardened with transitive call-graph closure:
  - privileged/auth markers are now propagated across multi-hop internal call chains,
  - external invocation markers are now propagated across multi-hop internal call chains,
  - external symbol extraction now includes deep callees, not only direct callees.
- Report generation now accepts an explicit workspace manifest path for deterministic custom audits.
- Added dedicated tests to lock this behavior:
  - transitive auth/external/symbol propagation on nested helper calls,
  - custom-workspace manifest generation path.

## External Follow-up

After the internal audit report is stable and review findings are triaged, the next step should be an external Soroban-oriented audit or audit-bank engagement.
