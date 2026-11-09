# R16 compatible dependency review

**Mainnet is not approved. Both dependency findings remain open. Noah stays V2; Sushi is unactivated; Phoenix is retired only for new routes; Curve is deferred.** No production access, real wallet, chain submission, deployment, push or external sending occurred. Fresh signatures are limited to contained runtime-random SDK/policy tests.

## Applied changes

The SDK takes minimatch 10.2.5 → 10.2.6 within TypeDoc's existing ^10.2.5 range. Only this package-lock entry changes; no package.json override or runtime dependency changes. The upstream patch tightens brace-expansion requirements and updates tests/tooling; it **does not fix GHSA-g3hv-75wg-m249**. Old/shared dependencies and R15 evidence are preserved; the SDK receives its own exact-lock install without lifecycle scripts.

The new [exposure checker](../release/dependency-scope.mjs) rejects known affected minimatch instances in production lock scope and affected crypto-bigint versions in actual wasm guest normal/build graphs. It fails on missing graph evidence. These checks supplement full audits; they are not a general advisory scan or an exception list.

CI previously stopped after the first failing npm workspace, losing later audit reports. It now collects all three raw full reports and returns failure if any failed. Both unsuppressed RustSec checks remain. Local Bash execution with a fake npm command proves all three are called when the first and last fail, all JSON reports are written and the final status stays 1. This is a collector test, not hosted CI execution.

## Fresh local evidence

| Check | R16 result |
| --- | --- |
| SDK build/unit suite | Pass; 35 unit tests, including one runtime-random signature |
| Signature policy | 13 guards pass; default denial and real/imported-key rejection retained |
| ESLint on product source | 208 files, 0 errors, 0 warnings |
| Actual TypeDoc build | Pass on the compatible patched SDK dependency tree; fresh local output, no cleanup of prior docs |
| Exposure / CI regressions | 8 exposure cases + 7 CI cases pass; injected production/guest promotions are rejected |
| Native V8 coverage | No firstPhasePreProcess execution in the exercised lint/docs runs; no dependency source/options/exports modified |
| Bounded positive control | Same minimatch 10.2.6 method is reached once at optimizationLevel=2, zero times at level 1; 32-character synthetic input, 128 MiB heap and 3-second timeout |
| Current minimatch 11.0.3 / TypeDoc probe | Expected failure: matchOne is not a function; isolated probe only, never installed into the release |
| Full npm audit | Still red: 14 web + 2 SDK affected nodes for one advisory; catalog clean |
| Production-only npm audit | All three workspaces clean |
| Full RustSec audit | Both still red: crypto-bigint 0.5.5 plus two unmaintained warnings (derivative/paste) in each lock |
| Guest normal + build dependency graphs | Whole workspace and quote adapter exclude crypto-bigint; native inverse graphs include it |

The 16 npm affected nodes include dependent packages; they are not 16 copies of minimatch. Current locks contain two affected minimatch copies in web tooling (3.1.5 and 10.2.6) and one in SDK docs tooling (10.2.6). The old 3.x implementation has no firstPhasePreProcess algorithm. A 10.x lint dependency is loaded without exercising that constructor on this configuration. TypeDoc's 10.x preprocessing method is present and has zero native-coverage calls. This narrows observed exposure; it does not establish safety for every future glob, configuration or untrusted repository and does not override the advisory's version range.

## Why the advisories remain open

**Minimatch:** current ESLint/eslintrc/typescript-eslint and TypeDoc published versions still require 3.x/10.x. TypeDoc 0.28.20 uses matchOne, removed in 11.x; a real documentation run with 11.0.3 fails. No compatibility shim, local security fork, forced major or audit suppression was introduced. Closure requires a maintained compatible consumer/backport and real lint/docs/full-audit validation, or a separately justified policy decision. See the [upstream advisory](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249).

**Crypto-bigint:** locked host 23.0.1 depends on elliptic-curve 0.13.8 → crypto-bigint ^0.5. The latest compatible SDK 23.5.3 still pins host =23.0.1. Host 23.0.2 and even latest stable host 30.0.0 retain older RustCrypto ranges; an SDK upgrade alone does not close this finding. The fixed >=0.7.6 branch cannot satisfy ^0.5. We did not change Rust dependencies, force a major version, backport cryptographic arithmetic or migrate the SDK just to change an audit result. See [RustSec](https://rustsec.org/advisories/RUSTSEC-2026-0387.html).

The reviewed host interface exposes secp256k1 signature recovery and secp256r1 verification using digest/signature/recovery ID/public key inputs, rather than a signing-secret argument. The three reviewed host source files match the checksum-verified cached published crate byte for byte. This is a scoped input review, not a proof of all library call paths or constant-time behavior. It does not qualify the current production validator host. A compatible upstream fix and requalification, or an explicit independently reviewed native-tooling risk decision, remains necessary; raw RustSec stays red.

The retained native P29 financial-test-host lock was also freshly audited: the same crypto-bigint 0.5.5 vulnerability and one paste maintenance warning remain. Its exact lock and executable are preserved; it is not a shipping guest or a new validator-host qualification. This remains part of the native-tooling risk decision.

## Retained evidence and boundaries

All 114 contract source/lock files, both Rust locks, all 24 selected WASM and application/SDK runtime sources remain identical to sealed R15 6e405533809a5ed172fca573b7cefaf2439451b3. Every SDK lock entry except development minimatch is also identical. R15's 282 native tests, 1,315 frontend tests, full 58-case crypto matrix, 73-step financial replay, actual-guest creation and dapp/backend five-lot exit are **retained by identity**, not claimed as fresh R16 runs. No native/WASM recompilation or repeated financial replay is necessary for this dev-tooling patch.

The first constructor-source observer experiment failed under CommonJS loading. It remains preserved and is not a product change or accepted coverage proof. Accepted runs use unmodified dependency code with native V8 coverage and a positive control. The initial CI assertion assumed every action had a name; it was corrected and the failed log is preserved. No project, target, cache or evidence was deleted.

The [structured audit](../release/internal-audit.json), [mainnet pending](MAINNET_PENDING.md) and R16 local seal separate compatible remediation, exposure evidence and unresolved launch gates. No external audit handoff has occurred.
