import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGraphqlArkaNode } from "../../src/graphqlRunner.js";
import { extractGraphqlArkaNodes } from "../../src/graphqlProfiles.js";

test("normalizeGraphqlArkaNode maps GraphQL payloads into catalog entries", () => {
  const entry = normalizeGraphqlArkaNode(
    {
      id: "CARKA",
      manager: "GMANAGER",
      curated: true,
      delisted: false,
      nav: "2500",
      denominationContract: "CDENOM",
      whitelistContracts: ["CDENOM", "CALT"],
      shareToken: "CSHARE",
      syncedAt: "2026-03-29T12:00:00.000Z",
      fees: {
        mgmtBps: 100,
        perfBps: 1200,
        depositBps: 10,
        redeemBps: 5,
      },
      assets: [
        {
          assetContract: "CDENOM",
          isDenomination: true,
          liquidBalance: "2500",
          collateralAmount: "0",
          debtAmount: "0",
          netManagedAmount: "2500",
          netPositionValue: "0",
          marketIds: [],
          syncedAt: "2026-03-29T12:00:00.000Z",
        },
      ],
    },
    "2026-03-29T12:00:01.000Z",
  );

  assert.equal(entry.arkaId, "CARKA");
  assert.equal(entry.manager, "GMANAGER");
  assert.equal(entry.nav, "2500");
  assert.equal(entry.denominationContract, "CDENOM");
  assert.deepEqual(entry.whitelistContracts, ["CDENOM", "CALT"]);
  assert.equal(entry.shareToken, "CSHARE");
  assert.equal(entry.fees.mgmtBps, 100);
  assert.equal(entry.assets[0].assetContract, "CDENOM");
});

test("normalizeGraphqlArkaNode fails fast on malformed GraphQL payloads", () => {
  assert.throws(
    () =>
      normalizeGraphqlArkaNode(
        {
          id: "CARKA",
          manager: "GMANAGER",
          nav: "100",
          fees: {
            mgmtBps: 0,
            perfBps: 0,
            depositBps: 0,
            redeemBps: 0,
          },
          assets: [{ assetContract: 12 }],
        },
        "2026-03-29T12:00:01.000Z",
      ),
    /assetContract/,
  );
});

test("extractGraphqlArkaNodes supports the SubQuery connection shape", () => {
  const nodes = extractGraphqlArkaNodes("subquery", {
    arkas: {
      totalCount: 1,
      nodes: [{ id: "CARKA" }],
    },
  });
  assert.deepEqual(nodes, [{ id: "CARKA" }]);
});

test("normalizeGraphqlArkaNode accepts SubQuery-style asset connections", () => {
  const entry = normalizeGraphqlArkaNode(
    {
      id: "CARKA",
      manager: "GMANAGER",
      nav: "2500",
      fees: {
        mgmtBps: 100,
        perfBps: 1200,
        depositBps: 10,
        redeemBps: 5,
      },
      assets: {
        totalCount: 1,
        nodes: [
          {
            assetContract: "CDENOM",
            isDenomination: true,
            liquidBalance: "2500",
            collateralAmount: "0",
            debtAmount: "0",
            netManagedAmount: "2500",
            netPositionValue: "0",
            marketIds: [],
            syncedAt: "2026-03-29T12:00:00.000Z",
          },
        ],
      },
    },
    "2026-03-29T12:00:01.000Z",
  );

  assert.equal(entry.assets.length, 1);
  assert.equal(entry.assets[0].assetContract, "CDENOM");
});
