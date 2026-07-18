import test from "node:test";
import assert from "node:assert/strict";

import {
  CatalogApiError,
  CatalogClient,
  formatAssetAmount,
  formatBasisPoints,
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

test("human-readable formatters preserve exact integer amounts", () => {
  assert.equal(formatAssetAmount("123456789", 7), "12.3456789");
  assert.equal(formatAssetAmount("120000000", 7), "12");
  assert.equal(formatAssetAmount("-5000000", 7), "-0.5");
  assert.equal(formatBasisPoints(100), "1.00%");
  assert.equal(formatBasisPoints(1_500), "15.00%");
});
