import { NextRequest } from "next/server";
import { jsonNoStore, readJsonObjectBody, redactApiText } from "@/lib/server/apiHardening";
import {
  BalancedIntentSurfaceValidationError,
  requestBalancedIntentSurfaceStatus,
} from "@/lib/server/balancedIntentSurface";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const intentTxHash = searchParams.get("intentTxHash");
    const result = await requestBalancedIntentSurfaceStatus({ intentTxHash });
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
        error: redactApiText(error, "Failed to request SODAX intent status."),
      },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await readJsonObjectBody<Record<string, unknown>>(request);
    const result = await requestBalancedIntentSurfaceStatus(body);
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
        error: redactApiText(error, "Failed to request SODAX intent status."),
      },
      { status: 502 },
    );
  }
}
