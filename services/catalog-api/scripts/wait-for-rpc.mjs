#!/usr/bin/env node

import { rpc } from "@stellar/stellar-sdk";

function usage() {
  console.error("Usage: node ./scripts/wait-for-rpc.mjs <rpc-url> [timeout-seconds]");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const [, , rpcUrl, timeoutSecondsArg] = process.argv;

if (!rpcUrl) {
  usage();
}

const timeoutMs = Number.parseInt(timeoutSecondsArg ?? "60", 10) * 1000;
const deadline = Date.now() + timeoutMs;
const server = new rpc.Server(rpcUrl, { allowHttp: true });

for (;;) {
  try {
    const response = await server.getHealth();
    if (response?.status === "healthy") {
      process.stdout.write(`${rpcUrl}\n`);
      process.exit(0);
    }
  } catch (_error) {
  }

  if (Date.now() >= deadline) {
    console.error(`Timed out waiting for Soroban RPC health at ${rpcUrl}`);
    process.exit(1);
  }
  await sleep(1000);
}
