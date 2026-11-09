import { buildContractsSecurityAuditSnapshot } from "@/lib/contracts/securityAudit";
import { jsonNoStore } from "@/lib/server/apiHardening";
import { requireOperatorApiSession } from "@/lib/server/operatorApiGuard";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const unauthorized = requireOperatorApiSession(request);
  if (unauthorized) {
    return unauthorized;
  }

  const snapshot = buildContractsSecurityAuditSnapshot();
  return jsonNoStore(
    {
      ok: snapshot.releaseGate.ready,
      source: "api_contracts_security_audit",
      ...snapshot,
    },
    {
      status: snapshot.releaseGate.ready ? 200 : 503,
    },
  );
}
