# Mainnet Reality Check

Date: 2026-07-03

This document records the current mainnet facts verified against `deployments.mainnet.json`, Stellar mainnet RPC, and public Horizon transaction reads. It is the reference for current docs when older tranche, testnet, or predeploy notes conflict.

## Manifest Source

- Manifest: `deployments.mainnet.json`
- Network: Stellar mainnet
- RPC: `https://mainnet.sorobanrpc.com`
- Manifest status: `mainnet_manual_release_ready`
- Bootstrap admin: `GBHIT7TXZSRWT4QZXKINECMQWKC7NC7GBJAGK6XFOURI3T6ZHJDTHCMD`
- Bootstrap admin expiry: `2027-06-10T12:05:32Z`
- Creation mode: paid permissionless creation
- Creation fee: `10.00 USDC`

Interpretation:

- The manifest is a real deployed/configured mainnet manifest, not a predeploy placeholder.
- The product release still has publication blockers tracked in `docs/MAINNET_RELEASE_TASKS_2026-07-03.md`: commit/CI, mainnet upgrade/canary if adopting the local WASM set, Vercel production deploy and production smoke/E2E.
- Do not describe the product as clean for broad public capital until the dApp E2E, wallet/create flow and post-fix publication checks are green.

## RPC Contract Verification

On 2026-07-03, each `deploymentPlan.contracts[]` entry with `deploy=true` was checked with:

```bash
stellar contract info hash \
  --contract-id <CONTRACT_ID> \
  --rpc-url https://mainnet.sorobanrpc.com \
  --network-passphrase "Public Global Stellar Network ; September 2015"
```

Every deployed singleton/adapter returned the WASM hash recorded in `deployments.mainnet.json`:

| Module | Contract ID | WASM hash status |
| --- | --- | --- |
| Arka Factory | `CAIVP3OKEPRAXCN5GRMNOZCVCF6VLI6DDDZ4X5NOIUUC73I5EGLG4CYK` | matches manifest |
| Arka Registry | `CCMCYADNUESGFRIJRZ2AOHUZBIPMRLVZCHB3BVIPHZCKGWFJSSJQBXAY` | matches manifest |
| Router | `CCZNPW4X62T3RM5L5ND6FEKYMCCC54PBCNOAWJNLCXL2RS66Q7VANX7D` | matches manifest |
| Venue Registry | `CAR5IEPAR3HQB6MSLTTMWCFWVEHTXAQ6J3FK5QNCEJS2OLXBUU6UUMYN` | matches manifest |
| Aquarius Adapter | `CAOJRRH3GL7UWTWYXJHHLMMMPD2FMNYLQO4W3DP5MSM27MHQPGTXQUIQ` | matches manifest |
| Blend Fixed XLM-USDC Adapter | `CBTRFXTMNZ477YG2RTDSUFICQXURNGV6RLEVDOU3XUTXEQERIZHAWBZP` | matches manifest |
| Blend YieldBlox Adapter | `CB2HKKC3Z4H2R4YST2Z2WAE4MHSYFDVMRKDZQX3BTX7O55DJNBNN6VWT` | matches manifest |
| Phoenix Adapter | `CAZ7S7Z7PHFONWMOA4L3I256LEFDAE6YJCLI6N4UH5FJ7CROFQ2IJMOT` | matches manifest |
| SoroSwap Adapter | `CCEBBWESKR2ZQJ6AKTA2BVSXU6ZNFVLBVPIOULA66IHBMQKIHGKZQYMI` | matches manifest |
| OracleGuard | `CDHSFLLDLZ6H5X3ZPRXQ23BVWJWPINWIKJBJPKFW2DLTS4X4V6RR4AZ6` | matches manifest |
| Coverage Fund | `CDVPSKOQT5PJABQZYYL3TLYDPF7OE2P2Q7LRL47F5JFUO4BV5HK6BFXA` | matches manifest |
| Claims Manager | `CBECEBUEIWLNNTZPNYIWO2YM2IO4HIMAXGOIZRR47OA2CUVJOMKMNLZY` | matches manifest |
| Manager Tier | `CDJ7MR4GDXVXILTMYLAQWEU7DMRKPXNRUONBZ7F7ORMVBA72MAQLUPSD` | matches manifest |
| ARKA Token | `CDXCWYQZCLKS5EP4UFZLXVMNVMXPT33P3PDLGLFYA2FQQW6SZKKH5B5S` | matches manifest |
| Locked ARKA | `CAXJQAKJTEICXP3WBHP3YTJ24ZIJXTN5RFXX7OG7VNLE2P42UYOVE3WF` | matches manifest |
| Governance Token | `CCIAK7PL4EAIEPSYAAFE6BJOMLE27SOWTBFV6VUDGJEMMAT3D42U5CGH` | matches manifest |
| Governance Executor | `CCTJRPZP7WDJZAPMJVCKUX6TOOZKKSTEVQ66YP6KZ5N6TCHRXLKTNEAS` | matches manifest |
| Arka Vesting | `CBP5XCBCKV3QM3CRVTJP7TF3DXPB5NBAZ2NMVKACNT2TVQQI4RJGMN3X` | matches manifest |
| Emissions Controller | `CCLW4XWGNFXF4C4UAOSEYLKE24T2K65JMZQNNGGUWZAFUL7AYIGB5KFF` | matches manifest |

## Mainnet Canary Verification

On 2026-07-03, these manifest canary transactions were checked through Horizon and returned HTTP 200 with `successful=true`:

| Flow | Transaction | Ledger |
| --- | --- | ---: |
| Phoenix USDC/XLM canary | `476e4ae93a552540d95f9ec72f9c5a8f174215ed94af32e7ceeffb49bd9c6d65` | 62992036 |
| SoroSwap USDC/XLM canary | `f63143010d65e357cff1642c537c9ac69f75f5f0d081fcf124fbe6bd50e3d418` | 62992061 |
| Aquarius USDC/XLM canary | `88e042fb4988943830f639f6cb66485d89efed77ed298b1260e81c287b0d9e0a` | 62992129 |
| Blend supply canary | `312352574cda24f3b85bd7b58e4edff9b83bb01189d70b9836786b4ab47af212` | 62994350 |
| Blend withdraw canary | `e834ff98dc057c0b1407248190b60e7666edb54924adeede90f89e48e9a33ebc` | 62994351 |
| Balanced/SODAX canary | `a024f2303be2debdf608611c042f0f0e6e86d4d3496386b84df52e80940facdc` | 62995595 |

## Protocol State

| Protocol | Mainnet fact | Product interpretation |
| --- | --- | --- |
| Phoenix | Contract deployed, WASM hash verified, USDC/XLM canary passed. Manifest has `autoEnabled=false`. | Available as a canaried AMM venue; not advertised as AUTO unless the governed venue policy enables it. |
| SoroSwap | Contract deployed, WASM hash verified, USDC/XLM canary passed. Manifest has `autoEnabled=false`. | Available as a canaried AMM venue; not advertised as AUTO unless the governed venue policy enables it. |
| Aquarius | Contract deployed, WASM hash verified, USDC/XLM canary passed. Manifest has `autoEnabled=false`. | Available as a canaried AMM venue; not advertised as AUTO unless the governed venue policy enables it. |
| Blend | Fixed XLM-USDC supply/withdraw canary passed. Borrow/repay disabled in manifest. | Governed credit venue for supply/withdraw only at launch. |
| Balanced/SODAX | Server-side SODAX intent driver canary passed. Manifest has `autoEnabled=true` for `balancedSodax`. | Intent-driver venue, not a legacy AMM-router adapter. |
| Legacy Balanced/Comet | Not part of the mainnet product surface. | Historical only. |

## Current Non-Docs Blockers

These are not contradictions in mainnet deployment, but they do block a clean product publication claim:

- local contract/dApp diffs are not committed and pushed;
- CI has not yet validated the pushed state;
- the changed local WASM set has not been uploaded/upgraded on mainnet;
- post-upgrade mainnet canaries are pending;
- post-fix Vercel deployment and production E2E are pending.

Local quality evidence now available:

- full dApp Playwright E2E passed on 2026-07-04 with `367` tests in `9.6m`;
- wallet/create/routing/contract mutation paths are covered locally, including wallet-backed Create Arka and live testnet Aquarius, SoroSwap and best-execution rebalance flows.
