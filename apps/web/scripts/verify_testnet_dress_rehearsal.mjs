#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import {
  DEFAULT_TESTNET_DRESS_REHEARSAL_REPORT_PATH,
  deriveTestnetDressRehearsalGateFromReport,
  writeTestnetDressRehearsalReport,
} from "../src/lib/runtime/testnetDressRehearsal.mjs";

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

const cwd = process.cwd();
const outputPath = path.resolve(
  cwd,
  readArg("--output") ??
    process.env.ARKAFUND_TESTNET_REHEARSAL_REPORT_PATH ??
    DEFAULT_TESTNET_DRESS_REHEARSAL_REPORT_PATH,
);
const evidenceRoot = readArg("--evidence-root") ?? undefined;
const deploymentsPath = readArg("--deployments") ?? undefined;
const txManifestPath = readArg("--tx-manifest") ?? undefined;
const now = readArg("--now") ?? process.env.ARKAFUND_TESTNET_REHEARSAL_NOW;
const nowMs = now ? Date.parse(now) : Date.now();

if (now && !Number.isFinite(nowMs)) {
  throw new Error(`Invalid --now timestamp: ${now}`);
}

const report = writeTestnetDressRehearsalReport(outputPath, {
  cwd,
  evidenceRoot,
  deploymentsPath,
  txManifestPath,
  nowMs,
});
const gate = deriveTestnetDressRehearsalGateFromReport(report, {
  cwd,
  reportPath: outputPath,
  nowMs,
});

const summary = {
  ok: gate.ready,
  status: gate.status,
  code: gate.code,
  outputPath,
  steps: `${gate.checks.readyStepCount}/${gate.checks.requiredStepCount}`,
  transactionHashCount: gate.checks.transactionHashCount,
  stateProofCount: gate.checks.stateProofCount,
  warnings: gate.checks.warningCount,
  blockers: gate.blockers,
};

if (hasFlag("--json")) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} else {
  process.stdout.write(
    [
      `[testnet-rehearsal] ${summary.status} (${summary.code})`,
      `[testnet-rehearsal] output=${summary.outputPath}`,
      `[testnet-rehearsal] steps=${summary.steps} txHashes=${summary.transactionHashCount} stateProofs=${summary.stateProofCount} warnings=${summary.warnings}`,
      ...summary.blockers.map((blocker) => `[testnet-rehearsal:blocker] ${blocker}`),
    ].join("\n") + "\n",
  );
}

if (!gate.ready) {
  process.exitCode = 1;
}
