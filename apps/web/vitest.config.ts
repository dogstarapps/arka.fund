import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  css: { postcss: { plugins: [] } },
  test: {
    environment: "jsdom",
    testNamePattern: process.env.ARKA_EPHEMERAL_SIGNATURE_TESTS === '1' ? undefined : new RegExp("^(?!.*(?:E2E wallet message signing signs the SEP-53 message hash used by real Stellar wallets|operator access API route sets, validates and clears the httpOnly operator session cookie|Cryptographic local wallet bridge signs a real XDR with ephemeral keys and applies an approved action once|Cryptographic local wallet bridge rejects a stale ledger after signing|Cryptographic local wallet bridge rejects a restarted local engine|Cryptographic local wallet bridge serializes concurrent duplicate submissions|Cryptographic local wallet bridge uses the actual atomic factory method for creation|Explicit local Soroban RPC transport boundary allows ten bounded minutes for human review without extending an existing draft|Explicit local Soroban RPC transport boundary assembles and signs the exact SDK transaction, then polls reads until confirmation|Explicit local Soroban RPC transport boundary never resubmits after bounded polling cannot confirm|Explicit local Soroban RPC transport boundary rejects another signature before broadcasting|Explicit local Soroban RPC transport boundary rechecks the actual RPC network before sending a signed transaction|operator access gate verifies Stellar message signatures for authorized wallets|operator access gate accepts SEP-53 wallet challenges without accepting other messages or wallets)).*$"),
    setupFiles: ["./tests/setup.ts"],
    css: false,
  },
  oxc: {
    jsx: { runtime: "automatic" },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
