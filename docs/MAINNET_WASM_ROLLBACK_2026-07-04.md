# Mainnet WASM Backup and Rollback Runbook

Date: 2026-07-04

This runbook records the local backup taken before activating the current release-candidate WASM set on mainnet. It is intentionally separate from `deployments.mainnet.json`: the manifest records the planned release state and the deployed mainnet state, while this file records rollback preparation.

## Backup State

Local backup directory:

```bash
tmp/mainnet-wasm-backups/2026-07-04-current
```

The directory is ignored by git through `/tmp/`. Do not commit the WASM binaries. Before any mainnet upgrade, copy this backup directory to a secure operator-controlled artifact store.

Backed up current mainnet WASM hashes:

| Name | Contract ID | Current mainnet WASM hash | Verified |
| --- | --- | --- | --- |
| `arka` | factory template | `0891be5a00c8b3a9c171d167fd9dd97564e830f1681b98dc0846d245aef36c2b` | yes |
| `shareToken` | factory template | `09896cbf3c01d41adb5a06e989abe7e579c13b5e1b46d6a2badae929e442bd89` | yes |
| `arkaFactory` | `CAIVP3OKEPRAXCN5GRMNOZCVCF6VLI6DDDZ4X5NOIUUC73I5EGLG4CYK` | `444a7b05af7a6ff2aa04543a028f474459633249de7430063b1ad5b15f6a2608` | yes |
| `adapterPhoenix` | `CAZ7S7Z7PHFONWMOA4L3I256LEFDAE6YJCLI6N4UH5FJ7CROFQ2IJMOT` | `006a2161fc23ac23be06e3865b70ad7b0f7af511e156b2d7974c0b0720d9958f` | yes |
| `adapterSoroswap` | `CCEBBWESKR2ZQJ6AKTA2BVSXU6ZNFVLBVPIOULA66IHBMQKIHGKZQYMI` | `e18e011e907392ed12a46bb4cc2d13b32e42a5a5debcd21f33999d795a467920` | yes |

Verification manifest:

```bash
tmp/mainnet-wasm-backups/2026-07-04-current/manifest.json
```

## Restore From Ledger

If the local backup is missing but the old WASM still exists on the ledger, fetch it again by hash:

```bash
stellar contract fetch \
  --wasm-hash <OLD_WASM_HASH> \
  --out-file tmp/mainnet-wasm-backups/restore/<name>.<OLD_WASM_HASH>.wasm \
  --rpc-url https://mainnet.sorobanrpc.com \
  --network-passphrase "Public Global Stellar Network ; September 2015"
```

Verify the binary:

```bash
shasum -a 256 tmp/mainnet-wasm-backups/restore/<name>.<OLD_WASM_HASH>.wasm
```

## Rollback Paths

Singleton contracts with an `upgrade(caller, new_wasm_hash)` entrypoint can be rolled back by calling `upgrade` with the previous hash:

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source-account "$ARKA_MAINNET_ADMIN_SK" \
  --rpc-url https://mainnet.sorobanrpc.com \
  --network-passphrase "Public Global Stellar Network ; September 2015" \
  -- \
  upgrade \
  --caller <ADMIN_PUBLIC_KEY> \
  --new_wasm_hash <OLD_WASM_HASH>
```

This applies to:

- `arkaFactory`
- `adapterPhoenix`
- `adapterSoroswap`

Arka and share-token implementation templates are controlled through the factory:

```bash
stellar contract invoke \
  --id <ARKA_FACTORY_CONTRACT_ID> \
  --source-account "$ARKA_MAINNET_ADMIN_SK" \
  --rpc-url https://mainnet.sorobanrpc.com \
  --network-passphrase "Public Global Stellar Network ; September 2015" \
  -- \
  set_implementation_controlled \
  --caller <ADMIN_PUBLIC_KEY> \
  --impl_wasm_hash <OLD_ARKA_WASM_HASH>
```

```bash
stellar contract invoke \
  --id <ARKA_FACTORY_CONTRACT_ID> \
  --source-account "$ARKA_MAINNET_ADMIN_SK" \
  --rpc-url https://mainnet.sorobanrpc.com \
  --network-passphrase "Public Global Stellar Network ; September 2015" \
  -- \
  set_share_impl_controlled \
  --caller <ADMIN_PUBLIC_KEY> \
  --impl_wasm_hash <OLD_SHARE_TOKEN_WASM_HASH>
```

Existing Arka contracts can roll back through their own `upgrade` entrypoint if they were upgraded. Existing share-token contracts depend on the implementation version they currently run; the old live share-token implementation did not expose the new governed upgrade surface.

## Mainnet Upgrade Gate

Do not activate the new release-candidate WASM set until:

- contracts local gate is green;
- frontend unit and integration tests are green;
- full Playwright E2E is green;
- production dApp configuration is synchronized with the final `deployments.mainnet.json`;
- current WASM backup has been copied outside the ignored `tmp/` directory;
- rollback commands have been dry-run/simulated where possible.

Uploading WASM to the ledger is not itself an activation. Calling `upgrade`, changing factory implementation hashes, or changing adapter/router policy is activation.
