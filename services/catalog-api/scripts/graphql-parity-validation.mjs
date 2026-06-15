import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  compareCatalogSnapshots,
  createSnapshotGraphqlMirrorServer,
  GraphqlCatalogSyncRunner,
  normalizeCatalogSnapshotForParity,
  OnChainCatalogSyncRunner,
} from "../dist/src/index.js";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const deploymentsPath = resolve(args["deploy-json"]);
  const reportPath = resolve(args["out-json"]);
  const deployments = JSON.parse(await readFile(deploymentsPath, "utf8"));
  const registryId =
    args["registry-id"] ?? deployments.contracts?.arkaRegistry;

  if (!registryId) {
    throw new Error("Missing registry id for GraphQL parity validation");
  }

  const nativeRunner = new OnChainCatalogSyncRunner({
    rpcUrl: args["rpc-url"],
    networkPassphrase: args["network-passphrase"],
    registryContractId: registryId,
    allowHttp: args["rpc-url"].startsWith("http://"),
  });

  const nativeSnapshot = await nativeRunner.run();
  const mirrorToken = "graphql-parity-token";
  const mirrorProfile = args["mirror-profile"] ?? "generic";
  const graphqlProfile = args["graphql-profile"] ?? "generic";
  const mirror = await createSnapshotGraphqlMirrorServer({
    snapshot: nativeSnapshot,
    bearerToken: mirrorToken,
    profile: mirrorProfile,
  });

  let graphqlSnapshot;
  try {
    const graphqlRunner = new GraphqlCatalogSyncRunner({
      graphqlUrl: mirror.url,
      profile: graphqlProfile,
      headers: {
        authorization: `Bearer ${mirrorToken}`,
      },
      pageSize: 25,
      requestTimeoutMs: 10_000,
    });
    graphqlSnapshot = await graphqlRunner.run();
  } finally {
    await mirror.close();
  }

  const parity = compareCatalogSnapshots(nativeSnapshot, graphqlSnapshot);
  const nativeNormalized = normalizeCatalogSnapshotForParity(nativeSnapshot);
  const graphqlNormalized = normalizeCatalogSnapshotForParity(graphqlSnapshot);
  const report = {
    validatedAt: new Date().toISOString(),
    network: "testnet",
    rpcUrl: args["rpc-url"],
    registryContractId: registryId,
    nativeBackend: "native",
    mirroredBackend: graphqlProfile,
    mirrorProfile,
    equal: parity.equal,
    differences: parity.differences,
    metrics: {
      native: nativeSnapshot.metrics,
      graphql: graphqlSnapshot.metrics,
    },
    digests: {
      native: digest(nativeNormalized),
      graphql: digest(graphqlNormalized),
    },
  };

  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (args["update-deployments"]) {
    deployments.validations ??= {};
    const validationKey = args["validation-key"] ?? "graphqlBackendParity";
    deployments.validations[validationKey] = {
      validatedAt: report.validatedAt,
      network: report.network,
      rpcUrl: report.rpcUrl,
      registryContractId: report.registryContractId,
      status: report.equal ? "passed" : "failed",
      report: reportPath,
      digests: report.digests,
      differences: report.differences,
    };
    await writeFile(deploymentsPath, `${JSON.stringify(deployments, null, 2)}\n`, "utf8");
  }

  if (!report.equal) {
    process.exitCode = 1;
  }
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function parseArgs(argv) {
  const parsed = Object.create(null);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  requireValue(parsed, "deploy-json");
  requireValue(parsed, "out-json");
  requireValue(parsed, "rpc-url");
  requireValue(parsed, "network-passphrase");
  return parsed;
}

function requireValue(args, key) {
  if (!args[key]) {
    throw new Error(`Missing required argument: --${key}`);
  }
}

await main();
