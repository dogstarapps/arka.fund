import { NextRequest } from "next/server";
import { jsonNoStore, readJsonObjectBody, redactApiText } from "@/lib/server/apiHardening";
import {
  BalancedIntentSurfaceValidationError,
  requestBalancedIntentSurfaceRelay,
} from "@/lib/server/balancedIntentSurface";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await readJsonObjectBody<Record<string, unknown>>(request);
    const result = await requestBalancedIntentSurfaceRelay(body);
    return jsonNoStore(result);
  } catch (error) {
    if (error instanceof BalancedIntentSurfaceValidationError) {
      return jsonNoStore(
        { provider: "sodax_sdk", error: redactApiText(error, error.message) },
        { status: 400 },
      );
    }
    return jsonNoStore(
      {
        provider: "sodax_sdk",
        error: redactApiText(
          error,
          "Failed to relay SODAX source transaction hash.",
        ),
      },
      { status: 502 },
    );
  }
}
