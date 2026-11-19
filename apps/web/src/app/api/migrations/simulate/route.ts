import { NextRequest } from "next/server";
import { SIM_ACCOUNT } from "@/lib/config";
import { buildContractInvokeRaw } from "@/lib/soroban";
import {
  jsonNoStore,
  readJsonObjectBody,
  redactApiText,
} from "@/lib/server/apiHardening";
import { requireOperatorApiSession } from "@/lib/server/operatorApiGuard";
import {
  governedArgsToScVals,
  type GovernedActionPackage,
} from "@/lib/workflows/governanceComposer";

export const dynamic = "force-dynamic";

type MigrationSimulateBody = {
  packages?: GovernedActionPackage[];
  sourceAccount?: string;
};

function isGovernedActionPackage(value: unknown): value is GovernedActionPackage {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.kind === "governed-action-package" &&
    typeof record.contractId === "string" &&
    typeof record.method === "string" &&
    Array.isArray(record.args) &&
    typeof record.templateId === "string" &&
    typeof record.title === "string"
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  const unauthorized = requireOperatorApiSession(request);
  if (unauthorized) {
    return unauthorized;
  }

  let body: MigrationSimulateBody;
  try {
    body = await readJsonObjectBody<MigrationSimulateBody & Record<string, unknown>>(request);
  } catch {
    return jsonNoStore(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const packages = Array.isArray(body.packages)
    ? body.packages.filter(isGovernedActionPackage)
    : [];
  if (packages.length === 0) {
    return jsonNoStore(
      { ok: false, error: "Add at least one governed package to simulate." },
      { status: 400 },
    );
  }

  const sourceAccount =
    typeof body.sourceAccount === "string" && body.sourceAccount.trim()
      ? body.sourceAccount.trim()
      : SIM_ACCOUNT;

  const entries = await Promise.all(
    packages.map(async (pkg) => {
      try {
        const xdrB64 = await buildContractInvokeRaw(
          sourceAccount,
          pkg.contractId,
          pkg.method,
          governedArgsToScVals(pkg.args),
        );
        return {
          id: pkg.templateId,
          title: pkg.title,
          method: pkg.method,
          contractId: pkg.contractId,
          status: "Simulated",
          tone: "positive" as const,
          detail:
            "RPC accepted the contract invocation and assembled a prepared transaction from the current ledger state.",
          xdrBytes: Buffer.from(xdrB64, "base64").byteLength,
          argCount: pkg.args.length,
        };
      } catch (error) {
        return {
          id: pkg.templateId,
          title: pkg.title,
          method: pkg.method,
          contractId: pkg.contractId,
          status: "Simulation failed",
          tone: "warning" as const,
          detail: redactApiText(error, "Unknown simulation failure."),
          xdrBytes: null,
          argCount: pkg.args.length,
        };
      }
    }),
  );

  const simulated = entries.filter((entry) => entry.status === "Simulated").length;

  return jsonNoStore(
    {
      ok: true,
      source: "api_migrations_simulate",
      generatedAt: new Date().toISOString(),
      sourceAccount,
      summary: {
        total: entries.length,
        simulated,
        failed: entries.length - simulated,
      },
      entries,
      note:
        "This simulation validates the governed target writes against the live factory/runtime. It does not publish a governor proposal or bypass contract authorization.",
    },
  );
}
