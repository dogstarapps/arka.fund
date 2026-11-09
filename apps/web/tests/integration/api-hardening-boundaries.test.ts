// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

type RouteCall = {
  label: string;
  call: () => Promise<Response>;
};

describe("API hardening boundary matrix", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("keeps all operator-only API surfaces fail-closed for anonymous callers", async () => {
    const mutationMatrix = await import("@/app/api/contracts/mutation-matrix/route");
    const securityAudit = await import("@/app/api/contracts/security-audit/route");
    const storageLifecycle = await import("@/app/api/contracts/storage-lifecycle/route");
    const migrationInspect = await import("@/app/api/migrations/inspect/route");
    const migrationSimulate = await import("@/app/api/migrations/simulate/route");
    const hardening = await import("@/app/api/operator/hardening/route");
    const figmaPixelAudit = await import("@/app/api/qa/figma-pixel-audit/route");
    const figmaReadiness = await import("@/app/api/qa/figma-readiness/route");
    const releaseGate = await import("@/app/api/release/gate/route");
    const routingBenchmark = await import("@/app/api/routing/rebalance/benchmark/route");

    const calls: RouteCall[] = [
      {
        label: "contracts mutation matrix",
        call: () => mutationMatrix.GET(new Request("http://localhost/api/contracts/mutation-matrix")),
      },
      {
        label: "contracts security audit",
        call: () => securityAudit.GET(new Request("http://localhost/api/contracts/security-audit")),
      },
      {
        label: "contracts storage lifecycle",
        call: () => storageLifecycle.GET(new Request("http://localhost/api/contracts/storage-lifecycle")),
      },
      {
        label: "migration inspect",
        call: () => migrationInspect.GET(new Request("http://localhost/api/migrations/inspect") as never),
      },
      {
        label: "migration simulate",
        call: () =>
          migrationSimulate.POST(
            new Request("http://localhost/api/migrations/simulate", {
              method: "POST",
              body: "{}",
            }) as never,
          ),
      },
      {
        label: "operator hardening",
        call: () => hardening.GET(new Request("http://localhost/api/operator/hardening")),
      },
      {
        label: "figma pixel audit",
        call: () => figmaPixelAudit.GET(new Request("http://localhost/api/qa/figma-pixel-audit")),
      },
      {
        label: "figma readiness",
        call: () => figmaReadiness.GET(new Request("http://localhost/api/qa/figma-readiness")),
      },
      {
        label: "release gate",
        call: () => releaseGate.GET(new Request("http://localhost/api/release/gate")),
      },
      {
        label: "routing benchmark",
        call: () => routingBenchmark.GET(new Request("http://localhost/api/routing/rebalance/benchmark")),
      },
    ];

    for (const { label, call } of calls) {
      const response = await call();
      const payload = await response.json();
      expect(response.status, label).toBe(401);
      expect(response.headers.get("cache-control"), label).toBe("no-store");
      expect(response.headers.get("x-content-type-options"), label).toBe("nosniff");
      expect(payload.error, label).toBe("operator_access_required");
      expect(JSON.stringify(payload), label).not.toMatch(/secret|private_key|signedTxXdr/i);
    }
  });

  it("keeps the E2E wallet signer disabled and no-store outside E2E mode", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_E2E_WALLET", "0");
    vi.stubEnv("E2E_WALLET_ENABLED", "0");
    const walletRoute = await import("@/app/api/e2e-wallet/route");

    const response = await walletRoute.GET(new Request("http://localhost/api/e2e-wallet"));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload).toEqual(
      expect.objectContaining({
        ok: false,
        source: "api_e2e_wallet",
        error: "not_found",
      }),
    );
  });
});
