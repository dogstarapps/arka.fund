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
- The product release still has publication blockers tracked in `docs/MAINNET_RELEASE_TASKS_2026-07-03.md`: indexer/catalog/frontend reflection, Vercel production deploy and production smoke/E2E.
- Do not describe the product as clean for broad public capital until the dApp E2E, wallet/create flow and post-fix publication checks are green.

## RPC Contract Verification

### 2026-07-10 Revalidation

Using Stellar CLI `26.1.0` against `https://mainnet.sorobanrpc.com`, the current
WASM hash for every one of the 19 contracts in `deployments.mainnet.json` was
read again and matched the manifest. The corresponding public Stellar Expert
contract pages also returned successfully. This confirms that the manifest
continues to describe the deployed mainnet contract set.

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

## 2026-07-04 Selective Upgrade and Accounting Patch

The 2026-07-04 release gate uploaded and activated the changed `arka`, `shareToken`, `arkaFactory`, `adapterPhoenix` and `adapterSoroswap` WASM artifacts. A follow-up Arka-only patch was then applied after a Blend canary found receive-side rounding drift.

Current Arka implementation hash:

- `75fae87d8eb058c51098d5a05c2b4e73e63c44c10930280ab9c53d9539e12701`

Post-upgrade contract canaries now recorded in `deployments.mainnet.json`:

| Flow | Transaction / evidence |
| --- | --- |
| Factory Create Arka | `60b47c66391d212a536da594e37cf69280ee62e7703739cc186d019ebf9b9194` |
| USDC deposit | `8e13e1ae846cf41c0b7f90086b1929dadca35c8d3cd81e04eb147b47922f6b27` |
| Partial redeem | `ae2cf79b693cfd4fa650674195cbbea92751d1a92ca8b9ac53463708ee932646` |
| Phoenix route after adapter upgrade | `e2d5b9052dcc8dca40938af630907d601d2cc79c8467c8abd16c90479b59e3b3` |
| Phoenix kill-switch disable | `c4535f90c270278cc9f0e287d053f30d729cab841c796101303e6bf4cb377271` |
| Phoenix kill-switch re-enable | `6141e400079f081467f614be0bb19c92e7f663400251bdbff270a54dc1af0e58` |
| Arka accounting patch upload | `90a20d220d7b330f12864af2a7efd93479aa4d918a1c8f305b22680d37361f3b` |
| Factory Arka implementation update | `083378cc16626e3281e321173d59ca71eb58bfca3b4ce9e1026d1aecad786e63` |
| Fresh Blend supply canary | `b93e5bbcf68f6b04687d88cacacca468c590e856d00a4010e4eef5a532f5fecf` |
| Fresh Blend withdraw canary | `5f74df2ce454d01d8ca2c9b44dee7f79be46f8ca65655b936ba580087bb953ff` |

Blend accounting result:

- Fresh post-fix Arka: `CDWJWFXS6IHMKTCJJR6U5DXYHY5FF2GW33JULLSRHHIXZ4ZKW6XTMLS7`.
- Withdraw requested `100000` USDC base units and received `99998`.
- Internal Arka accounting and actual token balance both ended at `999998`, so the patch handles pool rounding correctly.

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

- post-upgrade contract canaries have passed, but indexer/catalog/frontend reflection is still pending;
- post-fix Vercel deployment and production E2E are pending.

Local quality evidence now available:

- full dApp Playwright E2E passed on 2026-07-04 with `367` tests in `9.6m`;
- wallet/create/routing/contract mutation paths are covered locally, including wallet-backed Create Arka and live testnet Aquarius, SoroSwap and best-execution rebalance flows.
- contracts CI passed on GitHub for release-gate commit `ce32021`.

Mainnet upgrade evidence now available:

- selective upload/upgrade completed on 2026-07-04 for `arka`, `shareToken`, `arkaFactory`, `adapterPhoenix` and `adapterSoroswap`;
- follow-up Arka accounting patch completed on 2026-07-04 and recorded under `validations.mainnetArkaAccountingPatch`;
- `arkaFactory`, `adapterPhoenix` and `adapterSoroswap` on-chain WASM hashes match the planned hashes in `deployments.mainnet.json`;
- `arkaFactory.get_share_token_implementation` returns the new `shareToken` implementation hash.
- a newly created mainnet Arka `CBRNPZV73FV7OUS34LA57NHAPBVOEH37V22QLBXSG3UCZ25THBKV2QKE` deployed share token `CC2RE6UATO45JGZ4NCV4YHBWBDYHAOSGHEKFPYTV4R4KH5XLUBTNM2BD`, whose WASM hash matches the new `shareToken` implementation; deposit/redeem, Phoenix routing and kill-switch canary txs are recorded in `deployments.mainnet.json`.
- a fresh post-fix mainnet Arka `CDWJWFXS6IHMKTCJJR6U5DXYHY5FF2GW33JULLSRHHIXZ4ZKW6XTMLS7` validates Blend supply/withdraw accounting against actual SAC token balances.
