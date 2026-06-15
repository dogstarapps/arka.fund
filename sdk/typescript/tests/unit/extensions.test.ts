import test from "node:test";
import assert from "node:assert/strict";

import { ArkafundSdk, type ArkafundSdkExtension } from "../../src/index.js";

test("extensions install once and are retrievable by id", () => {
  const sdk = new ArkafundSdk({
    rpcUrl: "https://example.invalid/rpc",
    networkPassphrase: "Test SDF Network ; September 2015",
  });

  const extension: ArkafundSdkExtension<{ featureFlag: string }> = {
    id: "sample.analytics",
    version: "1.0.0",
    install() {
      return { featureFlag: "enabled" };
    },
  };

  const installed = sdk.use(extension);
  assert.deepEqual(installed, { featureFlag: "enabled" });
  assert.equal(sdk.extensions.has("sample.analytics"), true);
  assert.deepEqual(sdk.getExtension("sample.analytics"), { featureFlag: "enabled" });
});

test("extensions reject duplicate registration", () => {
  const sdk = new ArkafundSdk({
    rpcUrl: "https://example.invalid/rpc",
    networkPassphrase: "Test SDF Network ; September 2015",
  });

  const extension: ArkafundSdkExtension<{}> = {
    id: "sample.duplicate",
    version: "1.0.0",
    install() {
      return {};
    },
  };

  sdk.use(extension);
  assert.throws(() => sdk.use(extension), /already registered/);
});
