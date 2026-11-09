import { readLeaderboardSourceSnapshot } from "@/lib/runtime/leaderboardSource";
import { jsonNoStore } from "@/lib/server/apiHardening";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const snapshot = await readLeaderboardSourceSnapshot();
  return jsonNoStore(snapshot);
}
