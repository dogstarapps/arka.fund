// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OPERATOR_TEST_PUBLIC_KEY,
  OPERATOR_TEST_SECRET,
  operatorRequest,
} from "../helpers/operator-auth";

describe("GET /api/operator/hardening", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  function configureOperatorAccess() {
    vi.stubEnv("OPERATOR_ACCESS_SECRET", OPERATOR_TEST_SECRET);
    vi.stubEnv("NEXT_PUBLIC_ARKA_MANAGER", OPERATOR_TEST_PUBLIC_KEY);
  }

  it("rejects anonymous callers with the canonical operator error shape", async () => {
    const { GET } = await import("@/app/api/operator/hardening/route");

    const response = await GET(new Request("http://localhost/api/operator/hardening"));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("www-authenticate")).toContain("OperatorSession");
    expect(payload).toEqual(
      expect.objectContaining({
        ok: false,
        source: "api_operator_guard",
        error: "operator_access_required",
      }),
    );
  });

  it("returns the complete API hardening evidence matrix for operators", async () => {
    configureOperatorAccess();
    const { GET } = await import("@/app/api/operator/hardening/route");

    const response = await GET(operatorRequest("http://localhost/api/operator/hardening"));
    const payload = await response.json();
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        source: "api_operator_hardening",
        routeCount: 32,
        operatorRouteCount: expect.any(Number),
        publicRouteCount: expect.any(Number),
        e2eOnlyRouteCount: 1,
      }),
    );
    expect(payload.releaseGate).toEqual(
      expect.objectContaining({
        ready: true,
        status: "ready",
        failedInvariantCount: 0,
        routeCount: 32,
      }),
    );
    expect(payload.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          route: "/api/e2e-wallet",
          access: "e2e_only",
          cachePolicy: "no-store",
        }),
        expect.objectContaining({
          route: "/api/release/gate",
          access: "operator",
          cachePolicy: "no-store",
        }),
        expect.objectContaining({
          route: "/api/health",
          access: "public",
          publicSecretExposure: "redacted",
        }),
      ]),
    );
    expect(serialized).not.toContain(OPERATOR_TEST_SECRET);
    expect(serialized).not.toContain("E2E_WALLET_SECRET");
  });
});
