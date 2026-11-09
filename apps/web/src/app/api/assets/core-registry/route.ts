import { loadCoreStellarAssetMetadata } from "@/lib/server/stellarToml";
import { jsonNoStore, redactApiText } from "@/lib/server/apiHardening";

export async function GET(): Promise<Response> {
  try {
    const items = await loadCoreStellarAssetMetadata();
    return jsonNoStore(
      {
        generatedAt: new Date().toISOString(),
        items,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    return jsonNoStore(
      {
        error: "core_registry_unavailable",
        message: redactApiText(error, "Unable to resolve core Stellar assets."),
      },
      {
        status: 500,
      },
    );
  }
}
