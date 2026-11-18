import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  API_HARDENING_ROUTES,
  apiErrorResponse,
  buildApiHardeningSnapshot,
  noStoreHeaders,
  redactApiPayload,
  redactApiText,
} from "@/lib/server/apiHardening";

const EXPECTED_ROUTE_COUNT = 32;

function appRoutePath(route: string): string {
  const segments = route.replace(/^\/api\//, "").split("/");
  return join(process.cwd(), "src", "app", "api", ...segments, "route.ts");
}

describe("API hardening manifest", () => {
  it("covers every concrete Next.js API route once", () => {
    const routes = API_HARDENING_ROUTES.map((route) => route.route);

    expect(routes).toHaveLength(EXPECTED_ROUTE_COUNT);
    expect(new Set(routes).size).toBe(EXPECTED_ROUTE_COUNT);
    for (const route of routes) {
      expect(existsSync(appRoutePath(route)), `${route} is missing`).toBe(true);
    }
  });

  it("produces a ready release-gate snapshot with deterministic route classes", () => {
    const snapshot = buildApiHardeningSnapshot("2026-05-21T00:00:00.000Z");

    expect(snapshot.generatedAt).toBe("2026-05-21T00:00:00.000Z");
    expect(snapshot.routeCount).toBe(EXPECTED_ROUTE_COUNT);
    expect(snapshot.publicRouteCount).toBeGreaterThan(0);
    expect(snapshot.operatorRouteCount).toBeGreaterThan(0);
    expect(snapshot.e2eOnlyRouteCount).toBe(1);
    expect(snapshot.invariants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "API-HARD-001", status: "passed" }),
        expect.objectContaining({ id: "API-HARD-003", status: "passed" }),
        expect.objectContaining({ id: "API-HARD-006", status: "passed" }),
      ]),
    );
    expect(snapshot.releaseGate).toEqual(
      expect.objectContaining({
        ready: true,
        status: "ready",
        failedInvariantCount: 0,
        routeCount: EXPECTED_ROUTE_COUNT,
      }),
    );
  });

  it("redacts secret-looking values from text and structured payloads", () => {
    const stellarSecretLookingValue = [
      "SAAQ",
      "CAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC",
      "5MY",
    ].join("");

    expect(
      redactApiText(
        `Bearer abcdefghijklmnopqrstuvwxyz.abcdefghijklmnopqrstuvwx and ${stellarSecretLookingValue}`,
      ),
    ).not.toContain("SAAQ");

    expect(
      redactApiText("arkafund-operator-access:challenge-token-1234567890"),
    ).toBe("[redacted]");

    expect(
      redactApiPayload({
        token: "operator-session",
        publicValue: "visible",
        nested: {
          signedTxXdr: "AAAA",
          message: "Bearer abcdefghijklmnopqrstuvwxyz.abcdefghijklmnopqrstuvwx",
        },
      }),
    ).toEqual({
      token: "[redacted]",
      publicValue: "visible",
      nested: {
        signedTxXdr: "[redacted]",
        message: "[redacted]",
      },
    });
  });

  it("sets the mandatory no-store security headers on success and errors", async () => {
    const headers = noStoreHeaders({ "x-custom": "yes" });
    expect(headers.get("cache-control")).toBe("no-store");
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("referrer-policy")).toBe("no-referrer");
    expect(headers.get("x-custom")).toBe("yes");

    const response = apiErrorResponse(
      "api_unit_test",
      "bad_request",
      "Bearer abcdefghijklmnopqrstuvwxyz.abcdefghijklmnopqrstuvwx",
      { status: 400 },
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(payload).toEqual({
      ok: false,
      source: "api_unit_test",
      error: "bad_request",
      message: "[redacted]",
    });
  });
});
