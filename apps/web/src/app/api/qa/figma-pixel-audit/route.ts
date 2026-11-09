import { readFigmaPixelAuditGate } from "@/lib/qa/figmaPixelAuditGate";
import { requireOperatorApiSession } from "@/lib/server/operatorApiGuard";
import { jsonNoStore } from "@/lib/server/apiHardening";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const unauthorized = requireOperatorApiSession(request);
  if (unauthorized) {
    return unauthorized;
  }

  const gate = readFigmaPixelAuditGate();
  return jsonNoStore(
    {
      ok: gate.ready,
      source: "figma_pixel_audit_report",
      generatedAt: new Date().toISOString(),
      gate,
    },
    { status: gate.ready ? 200 : 503 },
  );
}
