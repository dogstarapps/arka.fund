import { StrKey, rpc, scValToNative } from "@stellar/stellar-sdk";

interface ValidationInput {
  rpcUrl: string;
  startLedger: number;
  registryId: string;
  arkaId: string;
  admin: string;
  registrar: string;
  manager: string;
  rotatedManager: string;
  treasury: string;
  denominationToken: string;
  secondaryToken: string;
}

interface ValidationReport {
  validatedAt: string;
  rpcUrl: string;
  startLedger: number;
  endLedger: number;
  registryId: string;
  arkaId: string;
  registryEvents: Array<{ topic: string; value: unknown; txHash: string; ledger: number }>;
  arkaEvents: Array<{ topic: string; value: unknown; txHash: string; ledger: number }>;
}

const EXPECTED_REGISTRY_TOPICS = ["admin", "writer", "register", "curate", "delist"] as const;
const EXPECTED_ARKA_TOPICS = [
  "initcfg",
  "govset",
  "feecfg",
  "protfee",
  "whlist",
  "mngrset",
  "router",
  "sharetk",
  "blendcfg",
  "creditcf",
] as const;

async function main() {
  const raw = process.env.EVENT_SURFACE_INPUT_JSON;
  if (!raw) {
    throw new Error("Missing EVENT_SURFACE_INPUT_JSON");
  }
  const input = JSON.parse(raw) as ValidationInput;
  const server = new rpc.Server(input.rpcUrl, {
    allowHttp: input.rpcUrl.startsWith("http://"),
  });

  const health = await server.getHealth();
  const endLedger = health.latestLedger;
  const events = await fetchAllEvents(server, [input.registryId, input.arkaId], input.startLedger, endLedger);
  const registryEvents = events.filter((event) => contractIdString(event.contractId) === input.registryId);
  const arkaEvents = events.filter((event) => contractIdString(event.contractId) === input.arkaId);

  validateRegistryEvents(registryEvents, input);
  validateArkaEvents(arkaEvents, input);

  const report: ValidationReport = {
    validatedAt: new Date().toISOString(),
    rpcUrl: input.rpcUrl,
    startLedger: input.startLedger,
    endLedger,
    registryId: input.registryId,
    arkaId: input.arkaId,
    registryEvents: summarizeEvents(registryEvents),
    arkaEvents: summarizeEvents(arkaEvents),
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

async function fetchAllEvents(
  server: rpc.Server,
  contractIds: string[],
  startLedger: number,
  endLedger: number,
) {
  const results: rpc.Api.EventResponse[] = [];
  let response = await server.getEvents({
    startLedger,
    endLedger,
    filters: [{ type: "contract", contractIds }],
    limit: 200,
  });

  while (true) {
    for (const event of response.events) {
      if (event.ledger > endLedger) {
        return results;
      }
      results.push(event);
    }
    if (response.events.length < 200) {
      return results;
    }
    response = await server.getEvents({
      cursor: response.cursor,
      filters: [{ type: "contract", contractIds }],
      limit: 200,
    });
    if (response.events.length === 0) {
      return results;
    }
  }
}

function validateRegistryEvents(events: rpc.Api.EventResponse[], input: ValidationInput) {
  for (const topic of EXPECTED_REGISTRY_TOPICS) {
    const event = findTopic(events, topic);
    if (!event) {
      throw new Error(`Missing registry event topic: ${topic}`);
    }
  }

  assertEqual(
    nativeValue(findTopic(events, "admin")!.value),
    input.admin,
    "registry admin event payload",
  );
  assertArrayEqual(
    nativeValue(findTopic(events, "writer")!.value),
    [input.admin, input.registrar, true],
    "registry writer event payload",
  );
  assertArrayEqual(
    nativeValue(findTopic(events, "register")!.value),
    [input.registrar, input.manager, input.arkaId],
    "registry register event payload",
  );
  assertArrayEqual(
    nativeValue(findTopic(events, "curate")!.value),
    [input.admin, input.manager, true],
    "registry curate event payload",
  );
  assertArrayEqual(
    nativeValue(findTopic(events, "delist")!.value),
    [input.admin, input.arkaId, true],
    "registry delist event payload",
  );
}

function validateArkaEvents(events: rpc.Api.EventResponse[], input: ValidationInput) {
  for (const topic of EXPECTED_ARKA_TOPICS) {
    const event = findTopic(events, topic);
    if (!event) {
      throw new Error(`Missing arka event topic: ${topic}`);
    }
  }

  assertArrayEqual(
    nativeValue(findTopic(events, "initcfg")!.value),
    [input.manager, input.denominationToken, [input.denominationToken], 100, 200, 25, 30],
    "arka initcfg event payload",
  );
  assertArrayEqual(
    nativeValue(findTopic(events, "govset")!.value),
    [input.manager, input.admin],
    "arka govset event payload",
  );
  assertArrayEqual(
    nativeValue(findTopic(events, "feecfg")!.value),
    [input.admin, 125, 225, 35, 45],
    "arka feecfg event payload",
  );
  assertArrayEqual(
    nativeValue(findTopic(events, "protfee")!.value),
    [input.admin, input.treasury, 1500, 2500],
    "arka protfee event payload",
  );
  assertArrayEqual(
    nativeValue(findTopic(events, "whlist")!.value),
    [input.admin, [input.denominationToken, input.secondaryToken]],
    "arka whlist event payload",
  );
  assertArrayEqual(
    nativeValue(findTopic(events, "mngrset")!.value),
    [input.admin, input.rotatedManager],
    "arka mngrset event payload",
  );
  assertArrayEqual(
    nativeValue(findTopic(events, "router")!.value),
    [input.admin, input.secondaryToken],
    "arka router event payload",
  );
  assertArrayEqual(
    nativeValue(findTopic(events, "sharetk")!.value),
    [input.admin, input.denominationToken],
    "arka sharetk event payload",
  );
  assertArrayEqual(
    nativeValue(findTopic(events, "blendcfg")!.value),
    [input.admin, "7", "600", "1250000", true, false],
    "arka blendcfg event payload",
  );

  const credit = nativeValue(findTopic(events, "creditcf")!.value);
  if (!Array.isArray(credit) || credit.length !== 9) {
    throw new Error(`arka creditcf payload has unexpected shape: ${JSON.stringify(credit)}`);
  }
  assertEqual(credit[0], input.admin, "arka creditcf caller");
  assertEqual(credit[1], 0, "arka creditcf protocol");
  assertEqual(credit[2], "7", "arka creditcf market");
  assertEqual(credit[3], input.secondaryToken, "arka creditcf adapter");
  assertArrayEqual(credit.slice(4), [true, false, true, false, true], "arka creditcf flags");
}

function summarizeEvents(events: rpc.Api.EventResponse[]) {
  return events.map((event) => ({
    topic: nativeTopic(event),
    value: nativeValue(event.value),
    txHash: event.txHash,
    ledger: event.ledger,
  }));
}

function findTopic(events: rpc.Api.EventResponse[], expected: string) {
  return events.find((event) => nativeTopic(event) === expected);
}

function nativeTopic(event: rpc.Api.EventResponse) {
  return String(scValToNative(event.topic[0]));
}

function nativeValue(value: unknown) {
  return normalize(scValToNative(value as Parameters<typeof scValToNative>[0]));
}

function normalize(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalize(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, normalize(entry)]),
    );
  }
  return value;
}

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertArrayEqual(actual: unknown, expected: unknown[], label: string) {
  if (!Array.isArray(actual)) {
    throw new Error(`${label} expected array payload, got ${JSON.stringify(actual)}`);
  }
  assertEqual(actual, expected, label);
}

function contractIdString(contractId: unknown) {
  if (!contractId) {
    return "";
  }
  if (typeof contractId === "string") {
    return contractId;
  }
  const raw = (contractId as { _id?: Uint8Array | { data?: number[] | Uint8Array } })._id;
  if (!raw) {
    return "";
  }
  if (raw instanceof Uint8Array) {
    return StrKey.encodeContract(Buffer.from(raw));
  }
  if (raw && typeof raw === "object" && "data" in raw && raw.data) {
    return StrKey.encodeContract(Buffer.from(raw.data));
  }
  return "";
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
