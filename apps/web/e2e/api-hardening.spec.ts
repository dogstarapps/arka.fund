import { expect, test } from "@playwright/test";
import { enableOperatorMode } from "./helpers/operator-mode";

test.describe("API hardening", () => {
  test("keeps operator hardening evidence behind wallet-gated operator mode", async ({
    page,
    request,
  }) => {
    const anonymous = await request.get("/api/operator/hardening");
    expect(anonymous.status()).toBe(401);
    expect(anonymous.headers()["cache-control"]).toContain("no-store");
    const anonymousPayload = await anonymous.json();
    expect(anonymousPayload).toEqual(
      expect.objectContaining({
        ok: false,
        error: "operator_access_required",
      }),
    );

    await enableOperatorMode(page);
    const operator = await page.request.get("/api/operator/hardening");
    expect(operator.status()).toBe(200);
    expect(operator.headers()["cache-control"]).toContain("no-store");
    const payload = await operator.json();
    const serialized = JSON.stringify(payload);

    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        source: "api_operator_hardening",
        routeCount: 32,
        e2eOnlyRouteCount: 1,
      }),
    );
    expect(payload.releaseGate).toEqual(
      expect.objectContaining({
        ready: true,
        status: "ready",
        failedInvariantCount: 0,
      }),
    );
    expect(serialized).not.toMatch(/E2E_WALLET_SECRET|OPERATOR_ACCESS_SECRET|private_key/i);
  });

  test("public health and release-gate surfaces expose no raw upstream secrets", async ({
    page,
  }) => {
    const health = await page.request.get("/api/health");
    expect([200, 503]).toContain(health.status());
    expect(health.headers()["cache-control"]).toContain("no-store");
    const healthPayload = await health.json();
    const healthSerialized = JSON.stringify(healthPayload);
    expect(healthSerialized).not.toMatch(/OPERATOR_ACCESS_SECRET|E2E_WALLET_SECRET/i);
    if (healthPayload.catalog?.configured) {
      expect(healthPayload.catalog.baseUrl).toBe("[redacted]");
    }

    await enableOperatorMode(page);
    const releaseGate = await page.request.get("/api/release/gate");
    expect([200, 503]).toContain(releaseGate.status());
    expect(releaseGate.headers()["cache-control"]).toContain("no-store");
    const releasePayload = await releaseGate.json();
    expect(releasePayload.gates.apiHardening).toEqual(
      expect.objectContaining({
        ready: true,
        status: "ready",
        routeCount: 32,
        failedInvariantCount: 0,
      }),
    );
  });
});
