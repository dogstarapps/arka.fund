#!/usr/bin/env node

import { rpc } from "@stellar/stellar-sdk";

function usage() {
  console.error(
    "Usage: node ./scripts/wait-for-account.mjs <rpc-url> <public-key> [timeout-seconds]",
  );
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const [, , rpcUrl, publicKey, timeoutSecondsArg] = process.argv;

if (!rpcUrl || !publicKey) {
  usage();
}

const timeoutMs = Number.parseInt(timeoutSecondsArg ?? "60", 10) * 1000;
const deadline = Date.now() + timeoutMs;
const server = new rpc.Server(rpcUrl, { allowHttp: true });

for (;;) {
  try {
    await server.getAccount(publicKey);
    process.stdout.write(`${publicKey}\n`);
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (Date.now() >= deadline) {
      console.error(
        `Timed out waiting for funded account ${publicKey} to become visible on RPC: ${message}`,
      );
      process.exit(1);
    }
    await sleep(1000);
  }
}
