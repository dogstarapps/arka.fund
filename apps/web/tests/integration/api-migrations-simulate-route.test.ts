// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OPERATOR_TEST_PUBLIC_KEY,
  OPERATOR_TEST_SECRET,
  operatorRequest,
} from "../helpers/operator-auth";

vi.mock("@/lib/soroban", async () => {
  const actual = await vi.importActual<typeof import("@/lib/soroban")>(
    "@/lib/soroban",
  );
  return {
    ...actual,
    buildContractInvokeRaw: vi.fn(),
  };
});

describe("POST /api/migrations/simulate", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  function configureOperatorAccess() {
    vi.stubEnv("OPERATOR_ACCESS_SECRET", OPERATOR_TEST_SECRET);
    vi.stubEnv("NEXT_PUBLIC_ARKA_MANAGER", OPERATOR_TEST_PUBLIC_KEY);
  }

  it("requires a verified operator session", async () => {
    const { POST } = await import("@/app/api/migrations/simulate/route");

    const response = await POST(
      new Request("http://localhost/api/migrations/simulate", {
        method: "POST",
        body: JSON.stringify({ packages: [] }),
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("operator_access_required");
  });

  it("simulates governed migration packages and returns per-package results", async () => {
    configureOperatorAccess();
    const { buildContractInvokeRaw } = await import("@/lib/soroban");
    vi.mocked(buildContractInvokeRaw).mockResolvedValue("AAAA");
    const { POST } = await import("@/app/api/migrations/simulate/route");

    const response = await POST(
      operatorRequest("http://localhost/api/migrations/simulate", {
        method: "POST",
        body: JSON.stringify({
          packages: [
            {
              version: 1,
              kind: "governed-action-package",
              templateId: "factory-implementation",
              actionId: "arka-factory-set-implementation",
              title: "Factory implementation",
              description: "desc",
              domain: "ArkaFactory",
              contractId: "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
              method: "set_implementation",
              generatedAt: "2026-04-25T00:00:00.000Z",
              fieldValues: {
                impl_wasm_hash: "ab".repeat(32),
              },
              args: [{ type: "bytesn32", value: "ab".repeat(32) }],
              governancePath: {
                owner: "Governor / executor",
                governorId: "CGOV",
                executorId: "CEXEC",
                publicationMode: "governance_lane_prep",
                note: "note",
              },
              reviewBullets: [],
            },
          ],
        }),
      }) as never,
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.source).toBe("api_migrations_simulate");
    expect(payload.summary.simulated).toBe(1);
    expect(payload.entries[0].status).toBe("Simulated");
    expect(payload.entries[0].xdrBytes).toBeGreaterThan(0);
    expect(vi.mocked(buildContractInvokeRaw)).toHaveBeenCalledTimes(1);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns mixed simulation results when one package fails", async () => {
    configureOperatorAccess();
    const { buildContractInvokeRaw } = await import("@/lib/soroban");
    vi.mocked(buildContractInvokeRaw)
      .mockResolvedValueOnce("AAAA")
      .mockRejectedValueOnce(new Error("Simulation failed (set_registry)"));
    const { POST } = await import("@/app/api/migrations/simulate/route");

    const response = await POST(
      operatorRequest("http://localhost/api/migrations/simulate", {
        method: "POST",
        body: JSON.stringify({
          packages: [
            {
              version: 1,
              kind: "governed-action-package",
              templateId: "factory-implementation",
              actionId: "arka-factory-set-implementation",
              title: "Factory implementation",
              description: "desc",
              domain: "ArkaFactory",
              contractId: "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
              method: "set_implementation",
              generatedAt: "2026-04-25T00:00:00.000Z",
              fieldValues: { impl_wasm_hash: "ab".repeat(32) },
              args: [{ type: "bytesn32", value: "ab".repeat(32) }],
              governancePath: {
                owner: "Governor / executor",
                governorId: "CGOV",
                executorId: "CEXEC",
                publicationMode: "governance_lane_prep",
                note: "note",
              },
              reviewBullets: [],
            },
            {
              version: 1,
              kind: "governed-action-package",
              templateId: "factory-registry-binding",
              actionId: "arka-factory-set-registry",
              title: "Factory registry binding",
              description: "desc",
              domain: "ArkaFactory",
              contractId: "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
              method: "set_registry",
              generatedAt: "2026-04-25T00:00:00.000Z",
              fieldValues: {
                registry: "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
              },
              args: [
                {
                  type: "address",
                  value:
                    "CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW",
                },
              ],
              governancePath: {
                owner: "Governor / executor",
                governorId: "CGOV",
                executorId: "CEXEC",
                publicationMode: "governance_lane_prep",
                note: "note",
              },
              reviewBullets: [],
            },
          ],
        }),
      }) as never,
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.summary.total).toBe(2);
    expect(payload.summary.simulated).toBe(1);
    expect(payload.summary.failed).toBe(1);
    expect(payload.entries[1].status).toBe("Simulation failed");
    expect(payload.entries[1].detail).toContain("Simulation failed");
  });
});
