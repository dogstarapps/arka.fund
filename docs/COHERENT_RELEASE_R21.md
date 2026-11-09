# Coherent local candidate R21 — 3 November 2026

R21 integrates the existing R20 reserve/accounting and reviewed-transaction SDK corrections in one candidate. It adds no dependency, override, second implementation, financial planner, automatic restore, signer or broadcaster. Noah stays V2. The running platform is not assessed or modified here; the candidate approval flag does not revoke its earlier approval.

## Exact delta

The local Next production build now sets both read-only flags required by the actual proxy. Next 15.5.28 normalizes 127.0.0.1 to localhost in NextRequest.url; strict URL/Host equality therefore rejected legitimate local requests. The existing skipMiddlewareUrlNormalize setting preserves the original request URL. Proxy validation remains unchanged: exact Host/Origin, explicit HTTPS public origins, loopback-only HTTP, explicit backend URL, bounded inputs and read-only methods. No hostname alias exception or relaxed financial guard is added.

R21-01 is a local configuration defect found by starting the compiled application. It is not evidence that the deployed platform is broken. Native NextRequest tests now exercise the framework boundary rather than only plain Request objects.

## Fresh validation

- Catalog, SDK and Next production builds pass after normal per-operation disk checks. Node 22.15.0; exact prepared dependency locks reused, zero installations.
- Frontend: 1266 passes, 57 signature/explicit-VM cases skipped, zero failures or unhandled errors. The jsdom navigation warning remains a test-environment limitation.
- Catalog: 170 unsigned unit passes with two signing skips; 41 integration passes with one signing skip.
- SDK: 34 unsigned passes with one signing case skipped. Review/backend: 98 passes. Native NextRequest proxy cases: 13, included in the frontend count. Frontend type checking passes.
- The compiled dapp connects over actual loopback HTTP to the canonical catalog and review service. Browser API responses are not replaced. Invalid Origin/Host requests fail; a valid origin succeeds.
- Chromium checks the actual factory-born investment, owner portfolio, contextual-help keyboard focus, unsigned withdrawal review/preparation, unavailable coverage and recovery, contract-generated liquidation preparation, paused reserved-only rights, mobile review and final paid history.
- Fourteen R20 accepted unsigned bodies are input to fresh actual-WASM RAM execution: factory creation, protected investment, Sushi trade, tiny residual deposit, request, five lots, settlement and full 999.4009043 XLM claim. The browser does not sign or execute financial operations. The driver inputs are retained evidence; browser HTTP reads/preparations and RAM invocations are fresh. Final NAV, shares, queue, cash, router and adapter residuals are zero.

## Evidence and boundaries

artifacts/v3-coherent-release-r21-20261103 contains browser-final/result.json, screenshots, native input/output receipts, build/test logs, qualification.json and the final source seal. The accepted browser binds the final candidate identity and compiled build ID.

Only the authorized frozen Sushi capture at ledger 65206504 is used. Native harness and 24 selected WASM are reused only by verified identity. Actors/funding/oracle/governance, header/metadata/sequence/event transport and receipt delivery remain test boundaries. The browser uses a synthetic public account identifier and a frozen test clock; no wallet interface, real account, secret or cryptographic signature is used. This is not current market, admission, validator consensus, actual wallet/device or submitted-canary qualification.

The diagnostic attempts are preserved. R1 exposed Next URL normalization. A fetch-based Host probe did not transmit the requested override; raw HTTP probes verify actual changed Host rejection. A display assertion initially expected 1000 instead of the correct formatted 1,000; raw financial values were already correct. These are separated from product findings. Screenshots are visually inspected on desktop and mobile.

All 114 contract-tree files, 24 selected WASM, dependency manifests/locks and Noah configuration match R20. No new native product/WASM compilation is claimed. R15/R17/R20 contract, financial, resource and cryptographic evidence remains retained by identity. No old controller, project, uncommitted change or evidence is deleted or overwritten.

## Candidate scope and remaining work

mainnetApproved=false means this new candidate has no deployment authorization. It is not a finding that the running platform lost its previous approval. The two R19 dependency findings remain open: minimatch in development tooling and crypto-bigint in native host/test tooling. Raw audit failures are retained, not suppressed or represented as new deployed functional failures.

Current target identities/history, governed protocol activation/deactivation, Sushi liquidity and admission/storage costs, actual wallet/canary, hosted CI, independent review and deployment authorization remain requirements for a new deployment. Sushi is unactivated; Phoenix remains retired only for new routes; Curve is deferred. Existing production maintenance need not incorporate new V3 functionality.

No wallets, signatures, chain submissions, production reads/writes, external sending, deployment or automation occurred.
