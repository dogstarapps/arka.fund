import test from "node:test";
import assert from "node:assert/strict";

import {
  CatalogApiError,
  CatalogClient,
  buildCatalogIdentityUpdateMessage,
  formatAssetAmount,
  formatBasisPoints,
  parseAssetAmount,
} from "../../src/index.js";

test("CatalogClient encodes filters and returns typed catalog pages", async () => {
  const requests: URL[] = [];
  const client = new CatalogClient({
    baseUrl: "https://catalog.example.test/",
    fetchImpl: async (input) => {
      requests.push(new URL(String(input)));
      return Response.json({ total: 5, offset: 0, limit: 10, items: [] });
    },
  });

  const result = await client.arkas({
    curated: true,
    delisted: false,
    search: "alpha beta",
    limit: 10,
  });

  assert.equal(result.total, 5);
  assert.equal(requests[0]?.pathname, "/v1/arkas");
  assert.equal(requests[0]?.searchParams.get("curated"), "true");
  assert.equal(requests[0]?.searchParams.get("delisted"), "false");
  assert.equal(requests[0]?.searchParams.get("search"), "alpha beta");
});

test("CatalogClient exposes HTTP failures with response context", async () => {
  const client = new CatalogClient({
    baseUrl: "https://catalog.example.test",
    fetchImpl: async () => Response.json({ error: "not_found" }, { status: 404 }),
  });

  await assert.rejects(
    client.arka("CUNKNOWN"),
    (error: unknown) => {
      assert.ok(error instanceof CatalogApiError);
      assert.equal(error.status, 404);
      assert.equal(error.path, "/v1/arkas/CUNKNOWN");
      assert.deepEqual(error.body, { error: "not_found" });
      return true;
    },
  );
});

test("CatalogClient calls canonical NAV and signed identity endpoints", async () => {
  const requests: Array<{ url: URL; init?: RequestInit }> = [];
  const client = new CatalogClient({
    baseUrl: "https://catalog.example.test",
    fetchImpl: async (input, init) => {
      requests.push({ url: new URL(String(input)), init });
      return Response.json({ displayName: "Stellar Growth" });
    },
  });

  await client.nav();
  await client.updateArkaIdentity("CARKA", {
    signer: "GMANAGER",
    message: "signed-message",
    signature: "c2lnbmF0dXJl",
    payload: { nonce: "nonce-1", issuedAt: "2026-07-19T10:00:00.000Z" },
  });

  assert.equal(requests[0]?.url.pathname, "/v1/nav");
  assert.equal(requests[0]?.url.search, "");
  assert.equal(requests[1]?.url.pathname, "/v1/arkas/CARKA/identity");
  assert.equal(requests[1]?.init?.method, "PUT");
  assert.equal(
    (requests[1]?.init?.headers as Record<string, string>)["content-type"],
    "application/json",
  );
});

test("CatalogClient exposes explicit OracleGuard price state", async () => {
  const paths: string[] = [];
  const client = new CatalogClient({
    baseUrl: "https://catalog.example.test",
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      paths.push(url.pathname);
      return Response.json(url.pathname === "/v1/prices"
        ? { syncedAt: "2026-07-19T10:00:00.000Z", items: [] }
        : {
            assetContract: "CXLM",
            priceUsd: "19000000000000",
            decimals: 14,
            timestamp: "1784476800",
            oracleStatus: "verified",
            valuationSource: "oracle_verified",
            primaryUsable: true,
            secondaryUsable: true,
            unavailableReason: null,
            observedAt: "2026-07-19T10:00:00.000Z",
          });
    },
  });

  const prices = await client.prices();
  const xlm = await client.price("CXLM");
  assert.equal(prices.items.length, 0);
  assert.equal(xlm.oracleStatus, "verified");
  assert.deepEqual(paths, ["/v1/prices", "/v1/prices/CXLM"]);
});

test("human-readable formatters preserve exact integer amounts", () => {
  assert.equal(formatAssetAmount("123456789", 7), "12.3456789");
  assert.equal(formatAssetAmount("120000000", 7), "12");
  assert.equal(formatAssetAmount("-5000000", 7), "-0.5");
  assert.equal(formatBasisPoints(100), "1.00%");
  assert.equal(formatBasisPoints(1_500), "15.00%");
  assert.equal(parseAssetAmount("12.3456789", 7), 123456789n);
  assert.equal(parseAssetAmount("0.5", 7), 5000000n);
  assert.equal(parseAssetAmount("12", 7), 120000000n);
  assert.throws(() => parseAssetAmount("1.00000001", 7), /more than 7 decimal places/);
  assert.throws(() => parseAssetAmount("1e3", 7), /decimal string/);
});

test("identity message builder emits the canonical signed payload", () => {
  const message = buildCatalogIdentityUpdateMessage({
    scope: "arka",
    target: "CARKA",
    signer: "GMANAGER",
    payload: {
      displayName: "  Stellar Growth  ",
      description: "  Managed on Stellar.  ",
      websiteUrl: "https://arka.fund",
      nonce: "profile-1",
      issuedAt: "2026-07-19T10:00:00Z",
    },
  });
  assert.deepEqual(JSON.parse(message), {
    version: 1,
    app: "arka.fund",
    action: "identity.update",
    scope: "arka",
    target: "CARKA",
    signer: "GMANAGER",
    payload: {
      displayName: "Stellar Growth",
      description: "Managed on Stellar.",
      avatarUrl: null,
      websiteUrl: "https://arka.fund/",
      socialUrl: null,
      nonce: "profile-1",
      issuedAt: "2026-07-19T10:00:00.000Z",
    },
  });
});
