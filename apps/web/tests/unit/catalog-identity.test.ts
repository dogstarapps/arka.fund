import { describe, expect, it } from "vitest";
import {
  buildArkaIdentityDraft,
  buildIdentityPayload,
  buildIdentityUpdateMessage,
  resolveArkaDisplayName,
  resolveArkaSubtitle,
  resolveManagerDisplayName,
} from "@/lib/catalog/identity";
import type { RankedArkaCatalogEntry, RankedManagerCatalogEntry } from "@/lib/catalog/types";

const arka = {
  arkaId: "CARKA1234567890",
  rank: 7,
  identity: {
    arkaId: "CARKA1234567890",
    manager: "GMANAGER",
    displayName: "Stellar Growth",
    description: "Curated public mandate",
    avatarUrl: null,
    websiteUrl: null,
    socialUrl: null,
    trustState: "unverified",
    updatedAt: "2026-07-07T10:00:00.000Z",
    updatedBy: "GMANAGER",
  },
} as RankedArkaCatalogEntry;

const manager = {
  manager: "GMANAGER1234567890",
  identity: {
    manager: "GMANAGER1234567890",
    displayName: "Growth Desk",
    description: null,
    avatarUrl: null,
    websiteUrl: null,
    socialUrl: null,
    trustState: "curated",
    updatedAt: "2026-07-07T10:00:00.000Z",
    updatedBy: "GMANAGER1234567890",
  },
} as RankedManagerCatalogEntry;

describe("catalog identity presentation", () => {
  it("prefers editable public identity over contract labels", () => {
    expect(resolveArkaDisplayName(arka)).toBe("Stellar Growth");
    expect(resolveArkaSubtitle(arka)).toBe("Curated public mandate");
    expect(resolveManagerDisplayName(manager)).toBe("Growth Desk");
  });

  it("builds deterministic wallet-signed identity messages", () => {
    const payload = buildIdentityPayload(
      {
        displayName: "  Stellar   Growth  ",
        description: "Public mandate",
        strategy: "Capital preservation\n\nDisciplined allocation",
        riskDisclosure: "Smart-contract and liquidity risk.",
        targetReturn: "Approximately 5% APY, subject to market conditions.",
        websiteUrl: "https://arka.fund",
        socialUrl: "",
      },
      new Date("2026-07-07T10:00:00.000Z"),
    );
    const message = buildIdentityUpdateMessage({
      scope: "arka",
      target: "CARKA1234567890",
      signer: "GMANAGER1234567890",
      payload: { ...payload, nonce: "fixed-nonce" },
    });

    expect(message).toBe(
      JSON.stringify({
        version: 1,
        app: "arka.fund",
        action: "identity.update",
        scope: "arka",
        target: "CARKA1234567890",
        signer: "GMANAGER1234567890",
        payload: {
          displayName: "Stellar Growth",
          description: "Public mandate",
          strategy: "Capital preservation\n\nDisciplined allocation",
          riskDisclosure: "Smart-contract and liquidity risk.",
          targetReturn: "Approximately 5% APY, subject to market conditions.",
          avatarUrl: null,
          websiteUrl: "https://arka.fund/",
          socialUrl: null,
          nonce: "fixed-nonce",
          issuedAt: "2026-07-07T10:00:00.000Z",
        },
      }),
    );
  });

  it("does not invent strategy copy for new Arka profiles", () => {
    expect(buildArkaIdentityDraft("CARKA1234567890", 7, null)).toMatchObject({
      displayName: "",
      description: "",
      strategy: "",
      riskDisclosure: "",
      targetReturn: "",
    });
    expect(
      resolveArkaDisplayName({
        arkaId: "CARKA1234567890",
        rank: 7,
        identity: null,
      } as RankedArkaCatalogEntry),
    ).toBe("Unnamed Arka");
  });
});
