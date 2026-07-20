import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsRoot = resolve(repositoryRoot, "docs-site");
const sdkRoot = resolve(repositoryRoot, "sdk/typescript");
const errors = [];

const [openapi, contracts, systemStatus, curatedArkas, pagerDuty, sdkCanary, platformPage, sdkPackage, sdkSource] =
  await Promise.all([
    readJson(resolve(docsRoot, "openapi.json")),
    readJson(resolve(docsRoot, "contracts-mainnet.json")),
    readJson(resolve(docsRoot, "system-status.json")),
    readJson(resolve(docsRoot, "mainnet-curated-arkas-20260718.json")),
    readJson(resolve(docsRoot, "pagerduty-monitoring-cycle.json")),
    readJson(resolve(docsRoot, "published-sdk-mainnet-canary.json")),
    readFile(resolve(docsRoot, "platform.html"), "utf8"),
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
assert(operations.length >= 25, "OpenAPI must document the catalog and canonical NAV routes");
assert(!openapi.paths?.["/api/nav"], "OpenAPI must not publish the DApp compatibility facade");
assert(
  openapi.components?.schemas?.NavResponse,
  "OpenAPI must publish the aggregate NAV response schema",
);
assert(openapi.paths?.["/v1/nav"]?.get, "OpenAPI must publish the canonical NAV route");
assert(
  openapi.paths?.["/v1/arkas/{id}/identity"]?.put &&
    openapi.paths?.["/v1/managers/{id}/identity"]?.put,
  "OpenAPI must document signed public profile updates",
);

assert(contracts.network === "mainnet", "Contract registry must target mainnet");
assert(
  ["deployed", "mainnet_manual_release_ready"].includes(contracts.status),
  "Contract registry must carry a deployed mainnet status",
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

assert(systemStatus.network === "Stellar mainnet", "System snapshot must target mainnet");
assert(systemStatus.indexer?.healthy === true, "Production indexer must be healthy");
assert(systemStatus.indexer?.failedArkas === 0, "Production indexer must have zero failed Arkas");
assert(systemStatus.curatedArkas?.total >= 5, "At least five curated Arkas are required");
assert(
  systemStatus.latency?.samples === 20 &&
    systemStatus.latency.averageMs < systemStatus.latency.targetAverageMs,
  "NAV system snapshot must contain 20 samples below the 200 ms average target",
);

assert(
  curatedArkas.kind === "mainnet_curated_arkas_snapshot",
  "Missing mainnet curated-Arka snapshot",
);
assert(
  curatedArkas.metrics?.curatedArkas === 5 && curatedArkas.curatedArkas?.length === 5,
  "Curated-Arka snapshot must contain exactly five platform-listed Arkas",
);
for (const arka of curatedArkas.curatedArkas ?? []) {
  assert(/^C[A-Z2-7]{55}$/.test(arka.arkaId), `Invalid curated Arka ID ${arka.arkaId}`);
  assert(
    arka.stellarExpert ===
      `https://stellar.expert/explorer/public/contract/${arka.arkaId}`,
    `Invalid curated Arka explorer link for ${arka.arkaId}`,
  );
}

assert(pagerDuty.kind === "pagerduty_monitoring_e2e", "Missing PagerDuty monitoring cycle");
assert(pagerDuty.trigger?.monitoring?.degraded === true, "PagerDuty trigger must start degraded");
assert(pagerDuty.recovery?.monitoring?.degraded === false, "PagerDuty recovery must finish healthy");
assert(pagerDuty.trigger?.pagerDuty?.httpStatus === 202, "PagerDuty trigger was not accepted");
assert(pagerDuty.recovery?.pagerDuty?.httpStatus === 202, "PagerDuty resolution was not accepted");
assert(
  pagerDuty.trigger?.pagerDuty?.dedupKey === pagerDuty.recovery?.pagerDuty?.dedupKey,
  "PagerDuty trigger and resolution must share one deduplication key",
);

assert(sdkCanary.kind === "published_sdk_mainnet_canary", "Missing published SDK mainnet run");
assert(sdkCanary.package === "@arkafund/sdk@0.4.1", "SDK mainnet run must use release 0.4.1");
for (const operation of ["approval", "deposit", "redemption"]) {
  const transaction = sdkCanary[operation];
  assert(transaction?.status === "SUCCESS", `SDK ${operation} transaction was not successful`);
  assert(
    transaction?.explorer ===
      `https://stellar.expert/explorer/public/tx/${transaction?.hash}`,
    `SDK ${operation} explorer link is invalid`,
  );
}

const sdkVersionMatch = sdkSource.match(/SDK_VERSION\s*=\s*"([^"]+)"/);
assert(sdkVersionMatch?.[1] === sdkPackage.version, "SDK source and package versions differ");
assert(
  platformPage.includes("https://arka.fund/arka-developer-platform-overview.mp4") &&
    platformPage.includes("https://arka.fund/arka-dapp-product-tour.mp4"),
  "Platform page must link both current walkthrough videos",
);

const publicHtml = await Promise.all(
  ["index.html", "platform.html", "api-reference.html", "completion.html", "evidence.html"]
    .map((name) => readFile(resolve(docsRoot, name), "utf8")),
);
const reviewerLanguage = /\b(reviewer|tranche|proof|evidence|deliverable|reproduce|completion)\b/i;
for (const [index, contents] of publicHtml.entries()) {
  assert(!reviewerLanguage.test(contents), `Reviewer-oriented wording found in public HTML ${index}`);
}

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
      indexedArkas: systemStatus.indexer.indexedArkas,
      curatedArkas: systemStatus.curatedArkas.total,
      curatedArkaContracts: curatedArkas.curatedArkas.length,
      navAverageLatencyMs: systemStatus.latency.averageMs,
      pagerDutyCycle: "triggered_and_resolved",
      sdkMainnetTransactions: 3,
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
