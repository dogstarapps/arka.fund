# R19 compatible dependency remediation recheck

**Neither advisory is closed. No supported published fix was found within the current dependency chains.** No package/lock version is changed, no incompatible override is forced, and no local fork, compatibility shim, tool removal, advisory suppression or risk waiver is introduced. Mainnet remains unapproved, Sushi unactivated, Noah V2 and Curve deferred. There are no real wallets, signatures, chain submissions, production queries/writes, deployments, push or external sending.

This is a fresh registry/upstream/audit and local-tool validation follow-up to R16, on the sealed R18 candidate. It does not claim another platform/financial/cryptographic audit. Earlier evidence and controllers remain intact.

## Minimatch: compatible published consumers still need a fix

The [official advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249) identifies the fixed branch from **11.0.1**. The current registry publishes **11.0.3**, while the observed latest 3.x/9.x/10.x branches remain 3.1.5, 9.0.9 and 10.2.6. These old branches are still reported by the raw advisory range; no compatible published backport is observed.

| Consumer reviewed | Observed version | Declared minimatch range | Finding |
| --- | --- | --- | --- |
| TypeDoc | 0.28.20 | ^10.2.5 | Cannot resolve to the fixed 11.x branch. The current master manifest still has this range. |
| ESLint, allowed major | 9.39.5 | ^3.1.5 | No fixed version in its range. |
| ESLint, latest major | 10.14.0 | ^10.2.6 | Still affected; current Next lint config 15.5.28 only admits ESLint 7/8/9. A major upgrade alone does not solve this. |
| @eslint/eslintrc | 3.3.7 | ^3.1.5 | Still outside the patched range. |
| @eslint/config-array | 0.23.5 | ^10.2.4 | The newer consumer still requires the old branch. |
| @typescript-eslint/typescript-estree | 8.72.1 | ^10.2.2 | Updating the parser chain from its locked 8.71.1 would not fix the advisory. |
| glob, positive comparison | 14.0.3 | ^11.0.2 | A maintained consumer can use the fixed branch, but replacing unrelated lint/docs consumers with glob is not an equivalent solution. |

The compatibility analysis intersects published fixed versions with each consumer range and finds no match for the current lint/docs chain. This is stronger than assuming that a newer top-level version fixes its transitive dependencies. R16's isolated real TypeDoc run with 11.0.3 failed because its `matchOne` API was removed; that historical negative evidence is retained by identity and is **not rerun or installed into R19**. No loader override is used in the fresh local runs.

The next compatible closure is a maintained consumer release that supports the fixed API/range, or an official compatible security backport, followed by real lint, SDK documentation and full audit validation. This work does not substitute a different linter/doc generator or maintain a private minimatch fork merely to change an audit result.

## Crypto-bigint: the compatible host chain has not migrated

[RustSec RUSTSEC-2026-0387](https://rustsec.org/advisories/RUSTSEC-2026-0387.html) specifies the corrected branch from **0.7.6**. The registry currently publishes 0.7.10; the newest observed 0.5.x remains **0.5.5**. The old curve chain requires **crypto-bigint ^0.5**, which cannot select 0.7.10.

- Latest compatible SDK **23.5.3** still pins native host **=23.0.1**. Changing the SDK within that supported branch does not remove the affected library.
- Reviewed host releases **23.0.2, 29.0.2 and 30.0.0** still require elliptic-curve ^0.13.5, k256 ^0.13.x and p256 ^0.13.x. The current host master manifest also retains those ranges.
- Maintained elliptic-curve **0.14.3** uses crypto-bigint ^0.7.8; k256/p256 **0.14.0** use the newer curve branch. They form a newer coherent chain, but the reviewed Soroban hosts have not adopted it. They cannot be dropped into the old host's declared ranges.

Closure requires a supported Soroban host/SDK integration of the fixed RustCrypto chain and native/guest/WASM/protocol requalification, or a separately authorized independent risk decision for native tooling. No cryptographic arithmetic backport, host fork, forced Cargo patch or SDK/protocol migration is applied. A scoped public-verification-input review is not a constant-time proof or a library repair.

## Fresh local validation and raw results

| Check | Result |
| --- | --- |
| SDK compilation | Pass, new output from unchanged source/lock |
| SDK tests without signing | **34 pass, one cryptographic signing case skipped**, zero failures; default signing-denied profile |
| Actual ESLint execution | **208 product-source files**, zero errors/warnings |
| Actual TypeDoc build | Pass, new standalone output; no dependency modification or forced minimatch version |
| Full npm audits | Web: **14 affected development nodes**; SDK: **2 affected development nodes**; catalog: clean. The counts include dependants and are not 16 separate minimatch copies. |
| Production-only npm audits | All three workspaces clean |
| RustSec, contract workspace | **One vulnerability**, crypto-bigint 0.5.5, plus derivative/paste maintenance warnings; raw exit 1 |
| RustSec, isolated quote adapter | Same vulnerability and two maintenance warnings; raw exit 1 |
| RustSec, R18 P29 test host | Same vulnerability and one paste maintenance warning; raw exit 1 |
| Guest normal/build graphs | Workspace and quote adapter exclude crypto-bigint; native inverse graphs include it |

The RustSec database is reused read-only only after its pinned HEAD matches the freshly read official remote HEAD. Audit reports are collected without ignore lists, and their failing statuses are retained. The native harness audit does not qualify Stellar's production validator host. Production-only npm cleanliness and guest exclusion are exposure boundaries, **not advisory closures**.

All three npm locks, both repository Rust locks, 114 contract-tree files, application/SDK runtime and 24 selected WASM remain unchanged. Exact-lock dependency environments are reused; there are no new installs, native builds or WASM compilations. Prior R18's 171 RAM runs/14 UI-backend actions, R17's resource/maintenance findings and the older full platform/cryptographic matrices are retained by identity, not claimed as fresh R19 executions. No signing opt-in is enabled.

Evidence is in local area `v3-compatible-remediation-r19-20261031`: `npm-registry-review.json`, `crate-registry-review.json`, pinned `upstream-review.json` manifests, `compatibility-analysis.json`, all six `npm-audits` JSON reports, all three `rustsec` reports/graphs, `tooling`, `sdk-validation`, release verification and the closeout seal. Public upstream manifests are inspected, not executed. No issue, PR, email or external audit package is sent.

The [mainnet pending list](MAINNET_PENDING.md) and structured audit keep **R14-07** and **R14-09** open. The closed R18 local factory/dapp/backend flow is preserved. Current target identity/index/roles/oracles/routes, live order-size liquidity, full admission/maintenance budgets, real wallet/device and submitted canary, hosted CI, independent review and deployment authorization remain separate pending launch gates. None is waived by these local checks.
