# Arka.fund Production Environment and Vercel Gate

Date: 2026-05-21

Status: implemented for T24. This document does **not** authorize mainnet deployment. It defines the production environment gate that must pass before a later final cutover can publish the dApp on the canonical production domain.

## Purpose

The dApp can be deployed to Vercel in preview/testnet lanes today, but production must not accidentally ship with:

- testnet configuration on a production domain,
- mainnet configuration inside an unreviewed preview deployment,
- E2E wallet mode enabled,
- missing operator access control,
- a Vercel build that bypasses release gates,
- a missing deployments manifest,
- stale vulnerable dependency posture.

T24 closes that gap by adding a machine-consumable `productionEnvironment` gate to `/api/release/gate` and by wiring Vercel to execute the release command before build output is accepted.

## Canonical Domains

The gate accepts these production hostnames by default:

- `arka.fund`
- `www.arka.fund`
- `app.arka.fund`

If the production app is moved to another hostname, set:

```bash
ARKAFUND_PRODUCTION_DOMAINS=arka.fund,www.arka.fund,app.arka.fund
```

Recommended deployment topology:

- `arka.fund`: public marketing/home domain. This can remain on CDMon until the full app replaces it.
- `app.arka.fund`: canonical Vercel dApp domain.
- Vercel preview domains: branch/testing only; they must remain on testnet unless `ARKAFUND_ALLOW_PREVIEW_MAINNET=1` is explicitly set for a controlled rehearsal.

## Required Vercel Environment Separation

Production lane:

```bash
VERCEL_ENV=production
ARKAFUND_NETWORK_TARGET=mainnet
NEXT_PUBLIC_ARKAFUND_NETWORK_TARGET=mainnet
VERCEL_PROJECT_PRODUCTION_URL=app.arka.fund
OPERATOR_ACCESS_SECRET=<configured in Vercel secret store>
NEXT_PUBLIC_E2E_WALLET=0
E2E_WALLET_ENABLED=0
```

Preview lane:

```bash
VERCEL_ENV=preview
ARKAFUND_NETWORK_TARGET=testnet
NEXT_PUBLIC_ARKAFUND_NETWORK_TARGET=testnet
NEXT_PUBLIC_E2E_WALLET=0
E2E_WALLET_ENABLED=0
```

Local/E2E test lane may enable the test wallet only for Playwright-controlled runs. The production gate treats E2E wallet mode as a hard production blocker.

## Release Build Wiring

`vercel.json` now defines:

```json
{
  "buildCommand": "npm run release:gate"
}
```

`npm run release:gate` runs:

```bash
npm run audit:prod && npm run test:release-gate && npm run build
```

That means a Vercel production build fails before `next build` if:

- `scripts/production_dependency_audit.mjs` finds any unapproved high/critical production dependency vulnerability,
- the production environment gate or release-gate API tests fail,
- the Next.js production build fails.

The dependency audit policy lives in `config/production-audit-policy.json`. It is intentionally strict: raw npm audit output is still parsed on every release build, and only documented, expiring SODAX cross-chain transitive exceptions are allowed. New high/critical findings fail the build by default.

## Machine-Consumable Gate

`GET /api/release/gate` now includes:

```json
{
  "gates": {
    "productionEnvironment": {
      "ready": true,
      "status": "ready",
      "code": "ready",
      "target": "production_environment"
    }
  }
}
```

Production blockers include:

- `production_network_mismatch`: production is not resolving mainnet.
- `production_domain_missing`: no production domain is visible to runtime.
- `production_domain_not_allowed`: runtime domain is not in `ARKAFUND_PRODUCTION_DOMAINS`.
- `preview_mainnet_blocked`: a preview deployment points at mainnet without explicit override.
- `e2e_wallet_enabled`: E2E wallet mode is enabled in production.
- `operator_secret_missing`: operator API access cannot be verified in production.
- `release_script_missing`: `release:gate` or `test:release-gate` is absent.
- `vercel_build_gate_missing`: Vercel is not configured to run the release gate.
- `deployment_manifest_missing`: the resolved deployment manifest path does not exist.

## What This Does Not Do

This gate does not deploy contracts, does not mutate Vercel settings remotely, and does not perform final mainnet cutover. It prevents unsafe publication paths from passing once the production environment variables are set.

It also does not pretend npm has zero advisories. The current policy accepts only the known `@sodax/sdk` transitive high-severity chain for Solana/Pancake packages that Arka does not import directly, with expiry on 2026-08-31. If SODAX publishes a clean Stellar-scoped package before mainnet cutover, that package should replace the exception.

The strict Figma pixel audit remains available as visual QA evidence through `/api/qa/figma-pixel-audit` and is still reported by `/api/release/gate`, but it is **not** a release-blocking mainnet gate. Mainnet readiness is blocked by functional, contract, oracle, routing, security, environment and canary evidence rather than absolute Figma pixel parity.

Final mainnet cutover remains T27 and must include:

- final mainnet deployment manifests,
- live oracle and routing canary evidence,
- production-domain release gate response,
- post-deploy smoke checks.
