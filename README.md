# Arka.fund

Arka.fund is a non-custodial asset-management protocol for Stellar/Soroban. Managers create configurable vaults ("Arkas"), depositors enter and exit through vault shares, and execution is constrained by on-chain policy, venue allowlists, oracle checks, fees, and governance.

Public product links:

- App: https://app.arka.fund/
- Landing: https://arka.fund/
- Demo video: https://arka.fund/arka-tranche-3-demo-openai-voice.mp4

## Current Status

This repository contains the contracts, deployment manifests, validation scripts, indexer/catalog service, and TypeScript SDK for the Arka.fund protocol.

The current mainnet release state is recorded in `deployments.mainnet.json`:

- Network: Stellar mainnet
- RPC: `https://mainnet.sorobanrpc.com`
- Release status: `mainnet_manual_release_ready`
- Mainnet release gate: passed on 2026-06-13
- Bootstrap admin: time-bounded operational admin, scheduled to expire on 2027-06-10
- Governance handoff target: DAO governor
- Creation mode: paid permissionless creation, with public creation fee configured as `10.00 USDC`

Do not commit private keys, wallet secrets, API keys, Vercel tokens, or local operator files. Deployment scripts read secrets from the local operator environment only.

## Key Features

- Configurable Arkas with denomination asset, manager, fees, allowed assets, swap policy, and credit policy.
- Per-Arka share tokens for deposit and redeem accounting.
- Arka Factory and Registry for creation, listing, curation, delisting, and indexer-ready events.
- Smart routing surface with governed venue registry and global protocol kill switches.
- Venue integrations for SoroSwap, Aquarius, Phoenix, Blend, and Balanced/SODAX.
- OracleGuard with primary, secondary, and fiat provider policy modes.
- Management/performance fee accounting, protocol fee split, and creation fee policy.
- Coverage Fund, Claims Manager, Manager Tier, ARKA token, locked ARKA, vesting, emissions, governance token, and governance executor modules.
- Storage lifecycle scripts and dry-run remediation for Soroban contract TTL maintenance.
- Catalog/indexer service and TypeScript SDK for public app and integrator use.

## Mainnet Contracts

The canonical mainnet contract IDs are in `deployments.mainnet.json`. Core IDs at the time of this release:

| Module | Contract ID |
| --- | --- |
| Arka Factory | `CAIVP3OKEPRAXCN5GRMNOZCVCF6VLI6DDDZ4X5NOIUUC73I5EGLG4CYK` |
| Arka Registry | `CCMCYADNUESGFRIJRZ2AOHUZBIPMRLVZCHB3BVIPHZCKGWFJSSJQBXAY` |
| Router | `CCZNPW4X62T3RM5L5ND6FEKYMCCC54PBCNOAWJNLCXL2RS66Q7VANX7D` |
| Venue Registry | `CAR5IEPAR3HQB6MSLTTMWCFWVEHTXAQ6J3FK5QNCEJS2OLXBUU6UUMYN` |
| OracleGuard | `CDHSFLLDLZ6H5X3ZPRXQ23BVWJWPINWIKJBJPKFW2DLTS4X4V6RR4AZ6` |
| Aquarius Adapter | `CAOJRRH3GL7UWTWYXJHHLMMMPD2FMNYLQO4W3DP5MSM27MHQPGTXQUIQ` |
| SoroSwap Adapter | `CCEBBWESKR2ZQJ6AKTA2BVSXU6ZNFVLBVPIOULA66IHBMQKIHGKZQYMI` |
| Phoenix Adapter | `CAZ7S7Z7PHFONWMOA4L3I256LEFDAE6YJCLI6N4UH5FJ7CROFQ2IJMOT` |
| Blend Fixed XLM-USDC Adapter | `CBTRFXTMNZ477YG2RTDSUFICQXURNGV6RLEVDOU3XUTXEQERIZHAWBZP` |
| Blend YieldBlox Adapter | `CB2HKKC3Z4H2R4YST2Z2WAE4MHSYFDVMRKDZQX3BTX7O55DJNBNN6VWT` |
| Coverage Fund | `CDVPSKOQT5PJABQZYYL3TLYDPF7OE2P2Q7LRL47F5JFUO4BV5HK6BFXA` |
| Claims Manager | `CBECEBUEIWLNNTZPNYIWO2YM2IO4HIMAXGOIZRR47OA2CUVJOMKMNLZY` |
| Governance Executor | `CCTJRPZP7WDJZAPMJVCKUX6TOOZKKSTEVQ66YP6KZ5N6TCHRXLKTNEAS` |

## Assets

The admitted launch asset catalog is:

`USDC`, `XLM`, `EURC`, `AQUA`, `XTAR`, `BLND`, `SHX`, `XRF`, `VELO`, `YBX`

Pricing is displayed in USD and denominated through USDC where applicable. Assets are cataloged and contract IDs are recorded in `deployments.mainnet.json`; protocol route support is not automatically universal for every asset pair.

Launch canaries validate the USDC/XLM route across the active swap venues. Additional pairs should be enabled only after quote, route, liquidity, oracle, and small-capital canary validation.

## Protocol Support

| Venue | Mainnet state | Notes |
| --- | --- | --- |
| Phoenix | Mainnet canary passed | USDC/XLM route validated through Phoenix pool route configuration. |
| SoroSwap | Mainnet canary passed | USDC/XLM route validated through the public SoroSwap router. |
| Aquarius | Mainnet canary passed | USDC/XLM route validated through the configured pool index. |
| Blend | Mainnet canary passed for supply/withdraw | Fixed XLM-USDC market supports supply and withdraw at launch; borrow and repay remain disabled until further risk validation. |
| Balanced/SODAX | Ready through server-side intent driver | Public SODAX SDK flow validates quote, build, relay, submit, status, receipt, expiry, and refund surfaces. |

Balanced/SODAX is intent-based. It is not modeled as a public Soroban AMM router adapter.

## Mainnet Evidence

Canary Arka:

- Arka: `CCHNBPXXVSNQPPSD5XO6XLJ4BPXCXECW7AJJEPP5CF23IT6CAJWBIV4M`
- Share token: `CA2XV4QZQVHJO6ORQ4EV74TJ2QHHVQY6IZMNH4SQTXLPMHHIHTMAWVIU`

Public transaction evidence:

- Create Arka: https://stellar.expert/explorer/public/tx/a192129691c11c19558fe304dbceb21d4b900873fe2c18cfb101e2abfc7798e4
- Deposit: https://stellar.expert/explorer/public/tx/01974eb4f6b9094ce922abf32acc52234fcdc823c146430fc96628cb995a6dcf
- Redeem: https://stellar.expert/explorer/public/tx/3578d26c7bde9a85352311b4318ccf9302734b000eb398ffc0ebd0b47195273c
- Seeded canary deposit: https://stellar.expert/explorer/public/tx/f1ad5618c0c296b69455d592651f84d315bcf272f477b9203d2e01553fec7fa0
- Phoenix canary: https://stellar.expert/explorer/public/tx/476e4ae93a552540d95f9ec72f9c5a8f174215ed94af32e7ceeffb49bd9c6d65
- SoroSwap canary: https://stellar.expert/explorer/public/tx/f63143010d65e357cff1642c537c9ac69f75f5f0d081fcf124fbe6bd50e3d418
- Aquarius canary: https://stellar.expert/explorer/public/tx/88e042fb4988943830f639f6cb66485d89efed77ed298b1260e81c287b0d9e0a
- Blend supply: https://stellar.expert/explorer/public/tx/312352574cda24f3b85bd7b58e4edff9b83bb01189d70b9836786b4ab47af212
- Blend withdraw: https://stellar.expert/explorer/public/tx/e834ff98dc057c0b1407248190b60e7666edb54924adeede90f89e48e9a33ebc
- Balanced/SODAX canary: https://stellar.expert/explorer/public/tx/a024f2303be2debdf608611c042f0f0e6e86d4d3496386b84df52e80940facdc
- Venue kill switch disable: https://stellar.expert/explorer/public/tx/cd859817ae5f6028a7c609d84087eb7831c5871cdbfcbca1acb639b2a104e14c
- Venue kill switch re-enable: https://stellar.expert/explorer/public/tx/3940548d2ffb297a8d6c3ea1ca53f5e6e63ad790502eef93bec9a66347422aa8

## Governance And Security

The release uses a time-bounded bootstrap admin so the team can respond quickly during audit, validation, and early production hardening. The intended target is DAO governance through the governance executor.

Implemented controls include:

- Bootstrap admin expiry checks across governed modules.
- Governor/executor handoff path for delayed governed actions.
- Global venue registry controls so a protocol can be disabled across Arkas.
- Per-Arka allowed venues and swap policy.
- Asset whitelist enforcement.
- Oracle freshness and divergence checks through OracleGuard.
- Price impact and trade-size caps for rebalance flows.
- Blend action capability controls.
- Fee accounting tests for management, performance, protocol split, and high-water mark behavior.
- Coverage and claims modules for incident accounting.
- Storage lifecycle extension tooling.

See:

- `docs/MAINNET_DEPLOY_SECURITY_READINESS_2026-06-10.md`
- `docs/ARKA_ECONOMICS_AND_SECURITY_SPEC_2026-06-10.md`
- `docs/ARKA_LISTING_AND_DISCOVERY_POLICY_2026-06-10.md`
- `docs/ORACLE_GUARD.md`
- `docs/GOVERNANCE_EXECUTOR.md`
- `docs/STORAGE_LIFECYCLE.md`
- `docs/SWAP_GUARDRAILS_DAO_2026-04-10.md`

## Validation

Core local checks:

```bash
cargo test --workspace
python3 -m unittest discover -s scripts/tests
```

Mainnet manifest and release checks:

```bash
python3 scripts/validate_mainnet_manifest.py --manifest deployments.mainnet.json --phase postdeploy
python3 scripts/mainnet_release_gate.py --manifest deployments.mainnet.json
```

Build production WASM:

```bash
BUILD_CONTRACT_SET=production bash scripts/build-wasm.sh
```

Mainnet deployment and configuration scripts are intentionally guarded:

```bash
bash scripts/deploy-mainnet-contracts.sh
bash scripts/configure-mainnet-contracts.sh
```

Run them only from a secured operator environment with the required confirmations and local secrets configured outside the repository.

## Repository Map

- `contracts/`: Soroban contracts and tests.
- `deployments.mainnet.json`: canonical mainnet manifest.
- `deployments.testnet.json`: canonical testnet validation manifest.
- `scripts/`: deployment, validation, release gate, storage lifecycle, and canary tooling.
- `services/catalog-api/`: indexer/catalog API service.
- `sdk/typescript/`: public TypeScript SDK and generated contract clients.
- `docs/`: architecture, security, economics, governance, storage, and release documentation.
