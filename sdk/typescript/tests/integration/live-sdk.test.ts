import test from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@stellar/stellar-sdk";

import { DivergenceMode } from "../../src/index.js";
import { loadLiveTestContext, makeSdk } from "../support/liveEnv.js";

test("registry module enforces writers and lists registered Arkas", async () => {
  const context = loadLiveTestContext();
  const adminSdk = makeSdk(
    context.adminSecret,
    context.rpcUrl,
    context.networkPassphrase,
  );
  const writerSdk = makeSdk(
    context.writerSecret,
    context.rpcUrl,
    context.networkPassphrase,
  );

  const registryAdmin = adminSdk.registry(context.registryContractId);
  const registryWriter = writerSdk.registry(context.registryContractId);

  await registryAdmin.initAdmin(context.adminPublicKey);
  assert.equal(await registryAdmin.count(), 0);

  const manager = Keypair.random().publicKey();
  const arka = Keypair.random().publicKey();

  await assert.rejects(
    registryWriter.registerArka({
      caller: context.writerPublicKey,
      manager,
      arka,
    }),
  );

  await registryAdmin.setRegistrar(
    context.adminPublicKey,
    context.writerPublicKey,
    true,
  );
  assert.equal(await registryAdmin.isRegistrar(context.writerPublicKey), true);

  await registryWriter.registerArka({
    caller: context.writerPublicKey,
    manager,
    arka,
  });

  assert.equal(await registryAdmin.count(), 1);
  assert.equal(await registryAdmin.countByManager(manager), 1);
  assert.deepEqual(await registryAdmin.listArkas(), [arka]);
  assert.deepEqual(await registryAdmin.listArkasByManager(manager), [arka]);
});

test("oracle guard module persists and clears per-asset policy", async () => {
  const context = loadLiveTestContext();
  const sdk = makeSdk(
    context.adminSecret,
    context.rpcUrl,
    context.networkPassphrase,
  );
  const guard = sdk.oracleGuard(context.oracleGuardContractId);

  await guard.init(context.adminPublicKey);
  assert.equal(await guard.admin(), context.adminPublicKey);

  const asset = Keypair.random().publicKey();
  const primary = Keypair.random().publicKey();
  const secondary = Keypair.random().publicKey();

  await guard.setStellarPolicy({
    caller: context.adminPublicKey,
    asset,
    primary,
    secondary,
    hasSecondary: true,
    maxPriceAge: 900,
    maxDeviationBps: 250,
    requireSecondary: false,
    divergenceMode: DivergenceMode.UseSecondary,
  });

  const policy = await guard.stellarAssetPolicy(asset);
  assert.ok(policy);
  assert.equal(policy?.primary, primary);
  assert.equal(policy?.secondary, secondary);
  assert.equal(Number(policy?.max_deviation_bps), 250);
  assert.equal(policy?.require_secondary, false);

  await guard.clearStellarPolicy(context.adminPublicKey, asset);
  assert.equal(await guard.stellarAssetPolicy(asset), null);
});
