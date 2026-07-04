# Balanced Official Surface

Date: 2026-04-07

Current status note, 2026-07-03: the mainnet manifest now records Balanced/SODAX as a server-side intent-driver venue with successful production canary evidence. This document remains useful for explaining why Balanced is not modeled as a public Soroban AMM router. For current release state, see `docs/MAINNET_REALITY_CHECK_2026-07-03.md`.

This report captures the official public Stellar surface that Balanced exposes today, and explains why Arka.fund should not keep assuming a public Soroban router cutover exists.

## Official findings

1. The official swap model on Stellar is `SODAX Intents`.
   - Source: `https://docs.balanced.network/swap-assets`
2. The official liquidity pool surface is legacy-only and no longer supported in the main app.
   - Source: `https://docs.balanced.network/supply-liquidity`
3. The official app exposes user-visible SODAX quotes plus `Recent Activity` status/cancel UX, and SODAX publishes a machine-consumable SDK surface for `quote` and `status`.
   - Sources:
     - `https://docs.sodax.com/developers/packages`
     - `https://docs.sodax.com/developers/how-to/wallet_providers`
     - `https://docs.sodax.com/developers/how-to/how_to_create_a_spoke_provider`
     - `https://news.sodax.com/posts/integrate-with-the-sodax-sdk`
4. The official app bundle exposes Stellar mainnet wiring, not a public Stellar testnet config.
5. No public Stellar router contract id was found in the official docs or in the official app bundle.

## Operational consequence for Arka.fund

- `Balanced` can remain a first-class protocol target.
- The old `router cutover` assumption is no longer sufficient as the source of truth.
- There is now enough mainnet evidence to model `Balanced/SODAX` as an intent venue through Arka's server-side SODAX driver.
- Until Balanced publishes a public Soroban execution interface that Arka can call directly, our support state should stay honest:
  - protocol is tracked and surfaced in product
  - the public product must not imply a Soroban AMM router exists
  - execution evidence is the SODAX intent lifecycle, not the retired Balanced/Comet adapter lane

## Repository implementation

- `scripts/verify_balanced_official_surface.py`
- `scripts/deploy-balanced-official-surface-validation.sh`
- `deployments.testnet.json -> validations.balancedOfficialSurface`
- `/api/health -> protocols.balanced.officialSurface`

The generated runtime artifact is:

- `tmp/balanced-official-surface.json`
