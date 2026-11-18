import { buildApiHardeningSnapshot, jsonNoStore } from "@/lib/server/apiHardening";
import { requireOperatorApiSession } from "@/lib/server/operatorApiGuard";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const unauthorized = requireOperatorApiSession(request);
  if (unauthorized) {
    return unauthorized;
  }

  const snapshot = buildApiHardeningSnapshot();
  return jsonNoStore(
    {
      ok: snapshot.releaseGate.ready,
      source: "api_operator_hardening",
      ...snapshot,
    },
    { status: snapshot.releaseGate.ready ? 200 : 503 },
  );
}
