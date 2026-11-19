import { buildContractsMutationMatrixSnapshot } from "@/lib/contracts/mutationMatrix";
import { jsonNoStore } from "@/lib/server/apiHardening";
import { requireOperatorApiSession } from "@/lib/server/operatorApiGuard";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const unauthorized = requireOperatorApiSession(request);
  if (unauthorized) {
    return unauthorized;
  }

  const snapshot = buildContractsMutationMatrixSnapshot();
  return jsonNoStore(
    {
      ok: true,
      source: "api_contracts_mutation_matrix",
      ...snapshot,
    },
  );
}
