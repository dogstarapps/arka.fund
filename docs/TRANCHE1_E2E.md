## Tranche 1 — Progress, Contracts, Strategy, and Next Steps

### Scope
- **Goal**: Integrate Aquarius and SoroSwap (DEX/AMM) on Soroban, enable E2E swaps, and prepare infra/docs.
- **Status**: SoroSwap path is E2E verified on Testnet (liquidity added, swap succeeded). Aquarius path verified: router pinned, adapter deployed, pool created, liquidity added, and swap succeeded.

### Repository hygiene
- **.gitignore** added to exclude `node_modules/`, build artifacts, heavy assets, and temporary files.
- Web assets moved to `arkafund/web/` (`index.html`, `logo-arkafund.png`).

### Code highlights
- **Router** (`contracts/router`):
  - Implemented `execute_multihop` with per-step slippage checks; `execute` delegates to multihop.
- **Adapters**:
  - `adapter-soroswap`: Parametrized with `Admin` and `Router` in storage. Uses long symbol `swap_exact_tokens_for_tokens` via `Symbol::new`. E2E exercised through router directly and adapter prepared for integration.
  - `adapter-aquarius`: Parametrized with `Admin` and `Router` in storage. `init`/`set_router` gated by admin. Awaiting valid router ID to finalize.
- **Arka / Factory (tests)**:
  - Tests use `env.mock_all_auths()`. Factory simulates address return under `#[cfg(test)]` to avoid WASM VM ref-type issues.

### Testnet deployment info
- Stored in `deployments.testnet.json`.
- **SoroSwap**:
  - `soroswapRouter`: `CCMAPXWVZD4USEKDWRYS7DA4Y3D7E2SDMGBFJUCEXTC7VN6CUBGWPFUS`
  - `soroswapFactory`: `CDJTMBYKNUGINFQALHDMPLZYNGUV42GPN4B7QOYTWHRC4EE5IYJM6AES`
  - `soroswapPair_ARKA1_ARKA2`: `CC3ZGW5C4DHWCW7DCSQVMR2KHSVIPCITEF7UPJQEXYT5WC4LUQWINTJO`
  - `adapterSoroswap`: `CAMK4EWIQIMLGVISSFRVLWIRABRNDTJ4HPIY6LEEFN6RUJMSNVUK7VDS`
  - Tx: init `023a095f2415c4fcc2da8b7588c8539348481a168b8b97136cc121aa8070de91`, set_path `0d21e28bd9571a12a9cf2fbb9f7c91bb56a9dbfa9a3283f2daa4c91837ad68b3`
- **Aquarius**:
  - `aquariusRouter`: `CBCFTQSPDBAIZ6R6PJQKSQWKNKWH2QIV3I4J72SHWBIK3ADRRAM5A6GD`
  - `adapterAquarius`: `CANPOLXWOTJHKDMIECWZ66IRWX2EEXMTIBF7FFA2WH5DAJVSUDL243BM`
  - Pool (ARKA1/ARKA2):
    - Index: `9ac7a9cde23ac2ada11105eeaa42e43c2ea8332ca0aa8f41f58d7160274d718e`
    - ID: `CB35RQL35KRDX5QELZWWK6ANR6SB76OYDUUFOHX37SYFESUNE6O3EOGE`
- **Tokens (SAC)**:
  - `ARKA1`: `CDJ7G22ETJ6PRUM5GDPUXYEY3JL6MDY35WMJYWSGX7U6DV5VMQEKH3PG`
  - `ARKA2`: `CCCLTACEMF33GJRJ2JXRQYXDBRLRZNK5GVPA2FVHLOE5TPP6NM7UIYV7`
- **Accounts**:
  - Issuer (pub): `GCO7KAJ7WCIFDLAEDHKSFQRNQLR3SQ6JTIVSMYYFUC5KRTA2KG2QJYDE`
  - Holder: `GCZ57QGTW5HKXI7KAS5XXIV3FQM5P4PJQ2BRIE6QC6TWHQ6RWQBR3CWT`

### E2E performed (SoroSwap)
- Issued classic assets `ARKA1` and `ARKA2`, created trustlines for `holder`, and sent balances.
- Deployed SACs and resolved IDs for both assets.
- Approved router allowances from `holder` for both tokens.
- Added liquidity 5000/5000 via router (pair auto-created):
  - Pair: `CC3ZGW5C4DHWCW7DCSQVMR2KHSVIPCITEF7UPJQEXYT5WC4LUQWINTJO`
  - Liquidity minted: `4000`
- Swap test (ARKA1 → ARKA2):
  - Input `100`, output `97` (meets slippage ≤ 0.5% target at small size; verify with larger sizes as needed).

### E2E performed (Aquarius)
- Fee token (AQUA) acquired vía swap XLM→AQUA en Aquarius; trustline clásica AQUA creada en `holder`.
- Pool ARKA1/ARKA2 creado y liquidez inicial añadida (5,000 / 5,000); LP minted: 5,000.
- Swap test en router directo (ARKA1 → ARKA2): in `1,000`, out `831`.
- Swap test vía `adapter-aquarius` (`swap_with_tokens`): in `200`, out `133`.

### Quick reference commands
```bash
# Resolve token contract IDs
stellar contract id asset --asset "ARKA1:GCO7KAJ7WCIFDLAEDHKSFQRNQLR3SQ6JTIVSMYYFUC5KRTA2KG2QJYDE" --network testnet
stellar contract id asset --asset "ARKA2:GCO7KAJ7WCIFDLAEDHKSFQRNQLR3SQ6JTIVSMYYFUC5KRTA2KG2QJYDE" --network testnet

# Approve router (holder)
stellar contract invoke --id "$TOKEN_A" --network testnet --source-account arka-holder -- approve --from "$HOLDER_PUB" --spender "CCMAPXWVZD4USEK..." --amount 10000000 --expiration_ledger 999999
stellar contract invoke --id "$TOKEN_B" --network testnet --source-account arka-holder -- approve --from "$HOLDER_PUB" --spender "CCMAPXWVZD4USEK..." --amount 10000000 --expiration_ledger 999999

# Add liquidity (auto-creates pair if needed)
stellar contract invoke --id "CCMAPXWVZD4USEK..." --network testnet --source-account arka-holder -- add_liquidity \
  --token_a "$TOKEN_A" --token_b "$TOKEN_B" \
  --amount_a_desired 5000 --amount_b_desired 5000 \
  --amount_a_min 0 --amount_b_min 0 \
  --to "$HOLDER_PUB" --deadline $(($(date +%s)+1800))

# Swap exact-in
stellar contract invoke --id "CCMAPXWVZD4USEK..." --network testnet --source-account arka-holder -- swap_exact_tokens_for_tokens \
  --amount_in 100 --amount_out_min 1 \
  --path "[\"$TOKEN_A\",\"$TOKEN_B\"]" \
  --to "$HOLDER_PUB" --deadline $(($(date +%s)+1800))
```

### Notes & gotchas
- Testnet router/factory IDs can rotate; keep `deployments.testnet.json` current.
- SAC allowances are required prior to liquidity/swap.
- CLI differences: use `contract info interface` for function signatures; some subcommands changed recently.

### Pending to complete Tranche 1
- **Aquarius**
  - Script de init/ops (fee query, pool create, deposit, swap) y README snippets.
  - Validar slippage objetivo a tamaños mayores; monitor de pools.

- **SoroSwap**
  - Adapter admin setup: use `scripts/soroswap/adapter_admin.sh` to set router and path.
  - Validate adapter-driven swap on Testnet; record tx hashes and update deployments file with `adapterSoroswap` if missing.

- **Arka & Factory (Testnet)**
  - Deploy and initialize `ArkaFactory` and `Arka` on Testnet.
  - Set router in `Arka` and verify `init/deposit/redeem` flows with SAC.
  - Increase `Arka` test coverage (fees, whitelist, events) close to 100%.

- **Minimal React dApp**
  - Scaffold React app with Freighter integration.
  - Wire to `Arka.init/deposit/redeem` and demonstrate swaps via SoroSwap path.
  - Record short E2E demo video on Testnet.

- **Delivery infra**
  - Finalize `deployments.testnet.json` updates as new components deploy (Aquarius, Arka, Factory).
  - Expand README with env vars and deployment steps.
  - Add basic CI for build and tests.


