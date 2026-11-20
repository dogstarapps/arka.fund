import { Account, Asset, BASE_FEE, Contract, Networks, rpc, scValToNative, StrKey, TransactionBuilder, xdr } from "@stellar/stellar-sdk";
import { legacyStorageKeyName, retryTransientRpc } from "./runners.js";
import type { ProfitSource } from "./profitSync.js";

const READ_SOURCE = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const NATIVE = Asset.native().contractId(Networks.PUBLIC);
const USDC = new Asset("USDC", USDC_ISSUER).contractId(Networks.PUBLIC);
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

export function createMainnetProfitSource(rpcUrl: string, rpcServer?: rpc.Server): ProfitSource {
  if (new URL(rpcUrl).protocol !== "https:") {
    throw new Error("Verified profit requires an HTTPS Stellar RPC");
  }
  const server = rpcServer ?? new rpc.Server(rpcUrl, { timeout: 12_000, allowHttp: false });
  const read = <T>(call: () => Promise<T>) => retryTransientRpc(call, { attempts: 3, baseDelayMs: 400 });

  return {
    async coverage() {
      const [network, health] = await Promise.all([read(() => server.getNetwork()), read(() => server.getHealth())]);
      if (network.passphrase !== Networks.PUBLIC || health.status !== "healthy") throw new Error("Mainnet RPC unavailable");
      return health;
    },

    async quote(arkaId) {
      const contract = new Contract(arkaId);
      const tx = new TransactionBuilder(new Account(READ_SOURCE, "0"), {
        fee: BASE_FEE, networkPassphrase: Networks.PUBLIC,
      }).addOperation(contract.call("preview_fee_settlement")).setTimeout(0).build();
      for (let attempt = 0; attempt < 3; attempt++) {
        const [quote, entries] = await Promise.all([
          read(() => server.simulateTransaction(tx)),
          read(() => server.getLedgerEntries(contract.getFootprint())),
        ]);
        if (!rpc.Api.isSimulationSuccess(quote) || !quote.result) throw new Error("NAV quote unavailable");
        if (quote.latestLedger !== entries.latestLedger) continue;
        const instance = entries.entries[0]?.val.contractData().val().instance();
        const executable = instance?.executable();
        if (!instance || executable?.switch().name !== "contractExecutableWasm") throw new Error("Unverified Arka executable");
        const storage = new Map((instance.storage() ?? []).map(row => [
          legacyStorageKeyName(scValToNative(row.key())), scValToNative(row.val()) as unknown,
        ]));
        const denomination = storage.get("Denomination") as { contract?: unknown } | undefined;
        const shareToken = storage.get("ShareToken");
        const { nav, timestamp } = scValToNative(quote.result.retval) as { nav?: unknown; timestamp?: unknown };
        if (typeof denomination?.contract !== "string" || typeof shareToken !== "string" ||
            typeof nav !== "bigint" || typeof timestamp !== "bigint" || timestamp <= 0n) throw new Error("Invalid Arka quote");
        return {
          ledger: quote.latestLedger, nav, asOf: new Date(Number(timestamp) * 1000).toISOString(),
          denominationContract: denomination.contract, shareToken, codeHash: executable.wasmHash().toString("hex"),
        };
      }
      throw new Error("Quote and contract identity did not share a ledger");
    },

    async cashFlows(arkaId, denomination, from, through) {
      const filters: rpc.Api.EventFilter[] = [
        { type: "contract", contractIds: [arkaId], topics: ["deposit", "redeem", "upgrade", "sharetk"]
          .map(symbol => [xdr.ScVal.scvSymbol(symbol).toXDR("base64"), "**"]) },
        { type: "system", contractIds: [arkaId] },
      ];
      const flows: Awaited<ReturnType<ProfitSource["cashFlows"]>> = [];
      const seen = new Set<string>();
      let cursor: string | undefined;
      for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex++) {
        const response: rpc.Api.GetEventsResponse = await read(() => server.getEvents(cursor
          ? { cursor, filters, limit: PAGE_SIZE }
          : { startLedger: from, endLedger: through + 1, filters, limit: PAGE_SIZE }));
        if (!Number.isSafeInteger(response.oldestLedger) || !Number.isSafeInteger(response.latestLedger) ||
            response.oldestLedger > from || response.latestLedger < through) throw new Error("Uncovered ledger interval");
        if (response.events.some((event, i) => i > 0 && event.ledger < response.events[i - 1].ledger)) {
          throw new Error("Unordered event page");
        }
        for (const event of response.events) {
          if (event.ledger > through) return flows;
          if (event.ledger < from || seen.has(event.id) || event.contractId?.contractId() !== arkaId) {
            throw new Error("Invalid event sequence");
          }
          seen.add(event.id);
          const topic = event.topic[0] && scValToNative(event.topic[0]);
          if (event.type !== "contract" || (topic !== "deposit" && topic !== "redeem")) {
            throw new Error("Arka identity changed across the indexed interval");
          }
          const transaction = await read(() => server.getTransaction(event.txHash));
          const flow = verifyFlow(arkaId, event, topic, transaction);
          const amount = flow.asset === denomination ? flow.amount : await valueAtLedger(flow.amount, flow.asset, denomination, event);
          flows.push({ kind: topic, amount, estimated: flow.asset !== denomination });
        }
        if (cashFlowCursorThrough(response.cursor) >= through) return flows;
        if (!response.cursor || response.cursor === cursor) throw new Error("Stalled event cursor");
        cursor = response.cursor;
      }
      throw new Error("Event pagination did not reach the NAV ledger");
    },
  };
}

// An event cursor ends inside a ledger unless it has both end-of-ledger offsets.
export function cashFlowCursorThrough(cursor: string): number {
  const parts = /^(\d{1,20})-(\d{1,10})$/.exec(cursor);
  if (!parts) throw new Error("Invalid event cursor");
  const position = BigInt(parts[1]);
  const event = BigInt(parts[2]);
  const offsetMask = 0xffff_ffffn;
  const ledger = position >> 32n;
  if (ledger > offsetMask || event > offsetMask) throw new Error("Invalid event cursor");
  return Number(ledger) - ((position & offsetMask) === offsetMask && event === offsetMask ? 0 : 1);
}

export function verifyFlow(
  arkaId: string,
  event: rpc.Api.EventResponse,
  kind: "deposit" | "redeem",
  tx: rpc.Api.GetTransactionResponse,
): { asset: string; amount: bigint } {
  if (tx.status !== rpc.Api.GetTransactionStatus.SUCCESS || tx.ledger !== event.ledger) {
    throw new Error("Cash flow must belong to a successful transaction");
  }
  const operations = tx.events.contractEventsXdr;
  const events = operations.length === 1 ? operations[0] : undefined;
  if (!events) throw new Error("Missing Soroban operation events");
  const body = scValToNative(event.value) as unknown;
  const matches = events.filter(emitted => {
    const contract = emitted.contractId();
    const fields = emitted.body().v0();
    return contract && StrKey.encodeContract(Buffer.from(contract as unknown as Uint8Array)) === arkaId &&
      fields.data().toXDR("base64") === event.value.toXDR("base64") &&
      fields.topics().length === event.topic.length &&
      fields.topics().every((topic, index) => topic.toXDR("base64") === event.topic[index].toXDR("base64"));
  });
  if (matches.length !== 1 || !Array.isArray(body) || ![3, 4].includes(body.length)) throw new Error("Unverified cash-flow event");
  const [holder, ...fields] = body;
  const declared = fields.length === 3 ? fields.shift() : null;
  const amount = kind === "deposit" ? fields[0] : fields[1];
  const shares = kind === "deposit" ? fields[1] : fields[0];
  if (typeof holder !== "string" || typeof amount !== "bigint" || amount < 0n ||
      typeof shares !== "bigint" || shares <= 0n) throw new Error("Unsupported cash-flow amounts");
  const from = kind === "deposit" ? holder : arkaId;
  const to = kind === "deposit" ? arkaId : holder;
  const transfers = events.flatMap(emitted => {
    const contract = emitted.contractId();
    if (!contract || emitted.type().name !== "contract") return [];
    const fields = emitted.body().v0();
    const [label, sender, recipient] = fields.topics().map(topic => scValToNative(topic));
    const data = scValToNative(fields.data());
    const value = typeof data === "bigint" ? data : data?.amount;
    return label === "transfer" && sender === from && recipient === to && value === amount
      ? [StrKey.encodeContract(Buffer.from(contract as unknown as Uint8Array))] : [];
  });
  if (transfers.length !== 1 || (declared !== null && declared !== transfers[0])) {
    throw new Error("Cash flow does not match its settled token transfer");
  }
  return { amount, asset: transfers[0] };
}

async function valueAtLedger(amount: bigint, asset: string, denomination: string, event: rpc.Api.EventResponse) {
  const toUsdc = asset === NATIVE && denomination === USDC;
  if (!toUsdc && !(asset === USDC && denomination === NATIVE)) throw new Error("Unsupported deposit currency");
  const query = new URLSearchParams({
    base_asset_type: "native", counter_asset_type: "credit_alphanum4",
    counter_asset_code: "USDC", counter_asset_issuer: USDC_ISSUER, order: "desc", limit: "1",
    cursor: (BigInt(event.ledger) << 32n).toString() + "-0",
  });
  const response = await fetch("https://horizon.stellar.org/trades?" + query, {
    redirect: "error", signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Historical exchange rate unavailable");
  const { _embedded } = await response.json() as { _embedded?: { records?: {
    ledger_close_time: string; base_asset_type: string; counter_asset_code: string; counter_asset_issuer: string;
    price: { n: string; d: string };
  }[] } };
  const trade = _embedded?.records?.[0];
  if (!trade || trade.base_asset_type !== "native" || trade.counter_asset_code !== "USDC" ||
      trade.counter_asset_issuer !== USDC_ISSUER) throw new Error("Incorrect historical currency pair");
  const age = Date.parse(event.ledgerClosedAt) - Date.parse(trade.ledger_close_time);
  if (!Number.isFinite(age) || age <= 0 || age > 180_000) throw new Error("Historical exchange rate outside its verified interval");
  const n = BigInt(trade.price.n);
  const d = BigInt(trade.price.d);
  if (n <= 0n || d <= 0n) throw new Error("Invalid historical rate");
  const divisor = toUsdc ? d : n;
  return (amount * (toUsdc ? n : d) + divisor / 2n) / divisor;
}
