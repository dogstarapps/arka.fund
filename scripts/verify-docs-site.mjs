import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsRoot = resolve(repositoryRoot, "docs-site");
const sdkRoot = resolve(repositoryRoot, "sdk/typescript");
const errors = [];

const [openapi, contracts, evidence, curatedProof, pagerDuty, completionPage, sdkPackage, sdkSource] =
  await Promise.all([
    readJson(resolve(docsRoot, "openapi.json")),
    readJson(resolve(docsRoot, "contracts-mainnet.json")),
    readJson(resolve(docsRoot, "live-evidence.json")),
    readJson(resolve(docsRoot, "mainnet-curated-arkas-20260718.json")),
    readJson(resolve(docsRoot, "pagerduty-monitoring-cycle.json")),
    readFile(resolve(docsRoot, "completion.html"), "utf8"),
    readJson(resolve(sdkRoot, "package.json")),
    readFile(resolve(sdkRoot, "src/sdk.ts"), "utf8"),
  ]);

assert(openapi.openapi === "3.1.0", "OpenAPI version must be 3.1.0");
assert(
  openapi.servers?.[0]?.url === "https://catalog.arka.fund",
  "OpenAPI server must target the production catalog",
);
const operations = Object.values(openapi.paths ?? {}).flatMap((path) =>
  Object.entries(path).filter(([method]) => method === "get"),
);
assert(operations.length >= 23, "OpenAPI must document the catalog and NAV GET routes");
assert(
  openapi.paths?.["/api/nav"]?.get?.servers?.[0]?.url === "https://app.arka.fund",
  "OpenAPI NAV operation must target the production application API",
);
assert(
  openapi.components?.schemas?.NavResponse,
  "OpenAPI must publish the aggregate NAV response schema",
);

assert(contracts.network === "mainnet", "Contract evidence must target mainnet");
assert(
  ["deployed", "mainnet_manual_release_ready"].includes(contracts.status),
  "Contract evidence must carry a deployed mainnet release status",
);
assert(contracts.contracts?.length === 19, "Expected 19 mainnet contracts");
for (const contract of contracts.contracts ?? []) {
  assert(/^C[A-Z2-7]{55}$/.test(contract.contractId), `Invalid contract ID for ${contract.name}`);
  assert(
    contract.explorer ===
      `https://stellar.expert/explorer/public/contract/${contract.contractId}`,
    `Invalid explorer link for ${contract.name}`,
  );
}

assert(evidence.network === "Stellar mainnet", "Live evidence must target mainnet");
assert(evidence.indexer?.healthy === true, "Production indexer must be healthy");
assert(evidence.indexer?.failedArkas === 0, "Production indexer must have zero failed Arkas");
assert(evidence.curatedArkas?.total >= 5, "At least five curated Arkas are required");
assert(
  evidence.latency?.samples === 20 &&
    evidence.latency.averageMs < evidence.latency.targetAverageMs,
  "NAV evidence must contain 20 samples below the 200 ms average target",
);

assert(
  curatedProof.kind === "mainnet_curated_arkas_proof",
  "Missing mainnet curated-Arka proof",
);
assert(
  curatedProof.metrics?.curatedArkas === 5 && curatedProof.curatedArkas?.length === 5,
  "Curated-Arka proof must contain exactly five platform-listed Arkas",
);
for (const arka of curatedProof.curatedArkas ?? []) {
  assert(/^C[A-Z2-7]{55}$/.test(arka.arkaId), `Invalid curated Arka ID ${arka.arkaId}`);
  assert(
    arka.stellarExpert ===
      `https://stellar.expert/explorer/public/contract/${arka.arkaId}`,
    `Invalid curated Arka explorer link for ${arka.arkaId}`,
  );
}

assert(pagerDuty.kind === "pagerduty_monitoring_e2e", "Missing PagerDuty E2E evidence");
assert(pagerDuty.trigger?.monitoring?.degraded === true, "PagerDuty trigger must start degraded");
assert(pagerDuty.recovery?.monitoring?.degraded === false, "PagerDuty recovery must finish healthy");
assert(pagerDuty.trigger?.pagerDuty?.httpStatus === 202, "PagerDuty trigger was not accepted");
assert(pagerDuty.recovery?.pagerDuty?.httpStatus === 202, "PagerDuty resolution was not accepted");
assert(
  pagerDuty.trigger?.pagerDuty?.dedupKey === pagerDuty.recovery?.pagerDuty?.dedupKey,
  "PagerDuty trigger and resolution must share one deduplication key",
);

const sdkVersionMatch = sdkSource.match(/SDK_VERSION\s*=\s*"([^"]+)"/);
assert(sdkVersionMatch?.[1] === sdkPackage.version, "SDK source and package versions differ");
assert(
  completionPage.includes("https://arka.fund/arka-mainnet-verifiable-proof.mp4"),
  "Completion page must link the current operational proof video",
);

const files = await walk(docsRoot);
const textFiles = files.filter((file) =>
  [".css", ".html", ".js", ".json", ".map", ".txt"].includes(extname(file)),
);
for (const file of textFiles) {
  const contents = await readFile(file, "utf8");
  scanSensitiveText(file, contents);
  if (extname(file) === ".html") await verifyLocalLinks(file, contents);
}

if (errors.length) {
  console.error(`Documentation verification failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      openApiGetOperations: operations.length,
      mainnetContracts: contracts.contracts.length,
      indexedArkas: evidence.indexer.indexedArkas,
      curatedArkas: evidence.curatedArkas.total,
      curatedArkaContracts: curatedProof.curatedArkas.length,
      navAverageLatencyMs: evidence.latency.averageMs,
      pagerDutyCycle: "triggered_and_resolved",
      sdkVersion: sdkPackage.version,
      checkedFiles: textFiles.length,
    },
    null,
    2,
  ),
);

function assert(condition, message) {
  if (!condition) errors.push(message);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function walk(directory) {
  const entries = await readdir(directory);
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry);
    if ((await stat(path)).isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
}

function scanSensitiveText(file, contents) {
  const forbidden = [
    /\/Users\//,
    /\/home\//,
    /marcosoliva/i,
    /manna-digital/i,
    /ARKA_MAINNET_ADMIN_SK/,
    /HETZNER_PASS/,
    /OPENAI_API_KEY/,
    /GITHUB_TOKEN_DOGSTAR/,
    /ARKA_PAGERDUTY_ROUTING_KEY/,
    /\bS[A-Z2-7]{55}\b/,
  ];
  for (const pattern of forbidden) {
    if (pattern.test(contents)) {
      errors.push(`Sensitive or local value ${pattern} found in ${relative(file)}`);
    }
  }
}

async function verifyLocalLinks(file, contents) {
  const attributes = contents.matchAll(/(?:href|src)=["']([^"']+)["']/g);
  for (const [, value] of attributes) {
    if (
      value.startsWith("http://") ||
      value.startsWith("https://") ||
      value.startsWith("mailto:") ||
      value.startsWith("#") ||
      value.startsWith("data:")
    ) continue;
    const localPath = value.split(/[?#]/)[0];
    if (!localPath) continue;
    const target = resolve(dirname(file), localPath);
    try {
      const targetStat = await stat(target);
      if (targetStat.isDirectory()) await stat(resolve(target, "index.html"));
    } catch {
      errors.push(`Broken local link ${value} in ${relative(file)}`);
    }
  }
}

function relative(path) {
  return path.replace(`${repositoryRoot}/`, "");
}
