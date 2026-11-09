import { readFigmaAuditReadiness } from "@/lib/qa/figmaAuditReadiness";
import { requireOperatorApiSession } from "@/lib/server/operatorApiGuard";
import { jsonNoStore, redactApiText } from "@/lib/server/apiHardening";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const unauthorized = requireOperatorApiSession(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const readiness = readFigmaAuditReadiness();
    return jsonNoStore(readiness, { status: readiness.ok ? 200 : 503 });
  } catch (error) {
    return jsonNoStore(
      {
        ok: false,
        source: "figma_route_audit_manifest",
        generatedAt: new Date().toISOString(),
        error: redactApiText(error, "Failed to read Figma route audit manifest."),
      },
      { status: 500 },
    );
  }
}
