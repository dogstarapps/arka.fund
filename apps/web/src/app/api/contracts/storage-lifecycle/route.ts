import { buildContractsStorageLifecycleSnapshot } from "@/lib/contracts/storageLifecycle";
import { jsonNoStore } from "@/lib/server/apiHardening";
import { requireOperatorApiSession } from "@/lib/server/operatorApiGuard";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const unauthorized = requireOperatorApiSession(request);
  if (unauthorized) {
    return unauthorized;
  }

  const snapshot = buildContractsStorageLifecycleSnapshot();
  return jsonNoStore(
    {
      ok: true,
      source: "api_contracts_storage_lifecycle",
      readyForExecution: snapshot.summary.blocked === 0,
      ...snapshot,
    },
  );
}
