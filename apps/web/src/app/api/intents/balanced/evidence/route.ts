import { deriveBalancedAutoSurfaceReadiness } from "@/lib/runtime/balancedAutoSurfaceGate";
import { readBalancedProtocolHealth } from "@/lib/runtime/protocolSupport";
import { deriveBalancedOfficialSurfaceEvidence } from "@/lib/workflows/balancedOfficialSurfaceEvidence";
import { jsonNoStore, redactApiText } from "@/lib/server/apiHardening";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const balanced = await readBalancedProtocolHealth();
    const evidence = deriveBalancedOfficialSurfaceEvidence(balanced);
    const autoSurface = deriveBalancedAutoSurfaceReadiness(balanced);

    return jsonNoStore({
      provider: "sodax_sdk",
      architecture: "intent_interchain",
      generatedAt: new Date().toISOString(),
      evidence,
      autoSurface: {
        plannerAdmission: autoSurface.plannerAdmission,
        laneReady: autoSurface.laneReady,
        surfaceReady: autoSurface.surfaceReady,
        officialEvidenceReady: autoSurface.officialEvidenceReady,
        officialAutoComparable: autoSurface.officialAutoComparable,
        autoReady: autoSurface.autoReady,
        reason: autoSurface.reason,
      },
    });
  } catch (error) {
    return jsonNoStore(
      {
        provider: "sodax_sdk",
        architecture: "intent_interchain",
        error: redactApiText(
          error,
          "Failed to resolve Balanced/SODAX official surface evidence.",
        ),
      },
      { status: 502 },
    );
  }
}
