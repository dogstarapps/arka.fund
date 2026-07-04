# Mainnet deployment manifest audit

Date: 2026-06-10

Current status note, 2026-07-03: this document started as a predeploy audit. The manifest has since moved to deployed/configured mainnet state. For current facts verified against Stellar mainnet RPC and Horizon, use `docs/MAINNET_REALITY_CHECK_2026-07-03.md`.

This audit checks whether `deployments.mainnet.json` contains the information needed to deploy and operate Arka on Stellar mainnet.

## Verdict

`deployments.mainnet.json` was **predeploy-ready** on 2026-06-10 and is now a deployed/configured mainnet manifest.

As of 2026-07-03, deployed singleton/adapter contract IDs in the manifest have been checked against `https://mainnet.sorobanrpc.com`; every `deploy=true` contract returns the WASM hash recorded in the manifest.

It does **not** mean broad public capital should open immediately. The remaining product blockers are dApp E2E, wallet/create-flow verification, UI copy/data cleanup, commit/CI, post-fix Vercel deployment, and production E2E.

## Current manifest status

- Network is Stellar public mainnet.
- Bootstrap admin is time-bounded to `2027-06-10T12:05:32Z`.
- Public creation is paid permissionless with a `10.00 USDC` creation fee.
- `share-token` has been added as a production artefact for per-Arka shares; `test-token` is no longer part of mainnet production.
- `arka` and `share-token` are uploaded as implementation templates, not deployed as global singletons.
- `coverage-vault` is kept as a per-manager template, not a global singleton.
- `venue-registry` is a global governed execution venue registry. It gives Arka a protocol-level kill switch while preserving per-Arka allowlists.
- New Arkas inherit factory defaults for `venueRegistry`, `swapOracle`, `allowed_venues` and `swapRiskPolicy`.
- Blend deploys one adapter instance per admitted pool.
- Balanced/SODAX is an intents/SDK flow, not the old AMM-router adapter. It is not deployed as an AMM adapter; server-side execution remains separate from the on-chain adapter registry.

## Required commands before the actual mainnet deploy

```bash
BUILD_CONTRACT_SET=production bash scripts/build-wasm.sh
python3 scripts/validate_mainnet_manifest.py --manifest deployments.mainnet.json --phase predeploy --check-env
```

The actual deploy is intentionally gated:

```bash
CONFIRM_MAINNET_DEPLOY=deploy-arka-mainnet scripts/deploy-mainnet-contracts.sh
CONFIRM_MAINNET_CONFIGURE=configure-arka-mainnet scripts/configure-mainnet-contracts.sh
```

Do not run those until the operator explicitly decides to start mainnet.

## Production artefacts

The mainnet plan includes these production artefacts:

- `arka.wasm`
- `share-token.wasm`
- `arka-factory.wasm`
- `arka-registry.wasm`
- `router.wasm`
- `venue-registry.wasm`
- `adapter-aquarius.wasm`
- `adapter-balanced.wasm` as artifact-only, not deployed/configured for AUTO
- `adapter-blend.wasm`
- `adapter-phoenix.wasm`
- `adapter-soroswap.wasm`
- `oracle-guard.wasm`
- `coverage-vault.wasm` as per-manager template
- `coverage-fund.wasm`
- `claims-manager.wasm`
- `manager-tier.wasm`
- `arka-token.wasm`
- `locked-arka.wasm`
- `governance-token.wasm`
- `governance-executor.wasm`
- `arka-vesting.wasm`
- `emissions-controller.wasm`

Forbidden in the mainnet plan:

- `test-token`
- `test-oracle`
- `test-profit-adapter`
- mocks
- retired Comet adapter

## External venue evidence

### SoroSwap

Mainnet router and factory are publicly documented by SoroSwap:

- factory: `CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2`
- router: `CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH`

Source: https://raw.githubusercontent.com/soroswap/core/main/public/mainnet.contracts.json

Initial candidate paths are XLM/USDC and USDC/XLM. The adapter is deployed and the USDC/XLM mainnet canary has passed. The manifest still records `autoEnabled=false`; do not describe SoroSwap as AUTO until venue governance enables it.

### Aquarius

Aquarius mainnet AMM entry-point contract:

- `CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK`

Aquarius pools are identified by `pool_index` (`BytesN<32>`) derived from ordered token addresses, and pool info should be resolved with `get_pools`.

Source: https://docs.aqua.network/developers/aquarius-soroban-functions.md

The manifest records the USDC/XLM pool route and the Aquarius mainnet canary has passed. The manifest still records `autoEnabled=false`; do not describe Aquarius as AUTO until venue governance enables it.

### Phoenix

Phoenix exposes a public pool dashboard/API with mainnet pool data:

- API: https://stats.phoenix-hub.io/api/pools

The manifest includes an explicit allowlist for the XLM/USDC pool in both directions. The Phoenix adapter is deployed and the USDC/XLM mainnet canary has passed. The manifest still records `autoEnabled=false`; do not describe Phoenix as AUTO until venue governance enables it.

### Blend

Blend V1 mainnet deployments are documented:

- BLND SAC: `CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY`
- pool factory: `CCZD6ESMOGMPWH2KRO4O7RGTAPGTUPFWFQBELQSS7ZUK63V3TZWETGAG`
- Fixed XLM-USDC pool: `CDVQVKOY2YSXS2IC7KN6MNASSHPAO7UN2UR2ON4OI2SKMFJNVAMDX6DP`
- YieldBlox pool: `CBP7NO6F7FRDHSOFQBT2L2UWYIZ2PU76JKVRYAQTG3KZSQLYAOKIF2WB`

Source: https://docs-v1.blend.capital/mainnet-deployments.md

The manifest deploys `adapterBlendFixedXlmUsdc` and `adapterBlendYieldBlox` separately because the Blend adapter stores one router/pool.

Both Blend pool adapters are registered as manual venues in the global registry so the guardian/governor can disable them immediately without changing each Arka's credit market config.

### Balanced/SODAX

SODAX documents an intent/solver SDK rather than a simple public Stellar AMM router:

- SDK methods include quote, submit, status, post-execution and cancel/expiry flows.
- Mainnet deployments are documented at https://docs.sodax.com/developers/deployments/mainnet.md

Balanced/SODAX is not handled by the AMM adapter registry. Its production readiness is proven through the server-side driver: quote, build, relay, submit, status, receipt/fill, refund/cancel, expiry and wallet-backed signing end to end. The mainnet canary recorded in `deployments.mainnet.json` is successful.

## Oracle evidence

Reflector public SEP-40 mainnet provider IDs are documented by Stellar:

- DEX provider: `CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M`
- External CEX/DEX provider: `CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN`
- Fiat exchange-rate provider: `CBKGPWGKSKZF52CFHMTRR23TBWTPMRDIYZ4O2P5VS65BMHYH4DXMCJZC`

Source: https://developers.stellar.org/docs/data/oracles/oracle-providers

The manifest includes per-asset policies. Assets with weaker coverage are marked as single-provider exceptions and should remain conservative until pricing depth improves.

## Asset verification

Launch asset SAC IDs in the manifest:

- USDC: `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75`
- XLM: `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA`
- EURC: `CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV`
- AQUA: `CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK`
- XTAR: `CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY`
- BLND: `CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY`
- SHX: `CCKCKCPHYVXQD4NECBFJTFSCU2AMSJGCNG4O6K4JVRE2BLPR7WNDBQIQ`
- XRF: `CBLLEW7HD2RWATVSMLAGWM4G3WCHSHDJ25ALP4DI6LULV5TU35N2CIZA`
- VELO: `CAESLMGW5LYTIEJI7FJHK6SFSWRELLNVX5Q4WR4UZEALMTRWQDBKDPAG`
- YBX: `CBRP2VD3CZLEQIQZ4JMBXGA5AC2U6JE26YU5CCIOICIZCVWPGBO2QRUB`

## Postdeploy gates

For broad public capital, do not proceed until:

- `scripts/storage_lifecycle_extend.py --dry-run --strict` passes against mainnet manifest.
- A canary Arka is created with a small deposit.
- Arka share-token mint/burn is verified through deposit/redeem.
- OracleGuard returns live prices for admitted launch assets or blocks them fail-closed.
- Venue canaries pass before enabling each AMM protocol in AUTO. Phoenix, SoroSwap and Aquarius have canary evidence; their manifest state remains `autoEnabled=false`.
- Frontend mainnet config points to the new deployed contracts.
- Vercel production is redeployed with the mainnet contract config.

## Verification command

Run:

```bash
python3 scripts/validate_mainnet_manifest.py --manifest deployments.mainnet.json --phase predeploy
```

After the deployment/configuration scripts have updated `contracts`, `wasmHashes` and validation flags, run:

```bash
python3 scripts/validate_mainnet_manifest.py --manifest deployments.mainnet.json --phase postdeploy
```
