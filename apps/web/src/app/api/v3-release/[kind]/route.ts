import { GET as general } from "../../mainnet-connector/[kind]/route";
import { readMainnetV2Identity } from "@/lib/server/mainnetV2Identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ kind: string }> }) {
  const { kind } = await context.params;
  if (kind !== "identity" || process.env.ARKAFUND_NETWORK_TARGET !== "mainnet" ||
      process.env.NEXT_PUBLIC_MAINNET_GENERAL_READONLY === "1") return general(request, context);

  const id = new URL(request.url).searchParams.get("fund") ?? "";
  const identity = await readMainnetV2Identity(id).catch(() => null);
  return Response.json(identity ?? { message: "Arka version unavailable." }, {
    status: identity ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
