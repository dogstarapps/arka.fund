import { NextRequest } from "next/server";
import { jsonNoStore, readJsonObjectBody, redactApiText } from "@/lib/server/apiHardening";
import {
  BalancedIntentSurfaceValidationError,
  listBalancedIntentSurfaceTokens,
  requestBalancedIntentSurfaceQuote,
} from "@/lib/server/balancedIntentSurface";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const tokens = await listBalancedIntentSurfaceTokens();
    return jsonNoStore({
      provider: "sodax_sdk",
      chainId: "stellar",
      tokens,
    });
  } catch (error) {
    return jsonNoStore(
      {
        provider: "sodax_sdk",
        error: redactApiText(error, "Failed to load token catalog."),
      },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await readJsonObjectBody<Record<string, unknown>>(request);
    const result = await requestBalancedIntentSurfaceQuote(body);

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
        error: redactApiText(error, "Failed to request SODAX quote."),
      },
      { status: 502 },
    );
  }
}
