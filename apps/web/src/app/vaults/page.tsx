import DiscoverPage from "@/app/discover/page";
import VaultLeaderboardSurface from "@/components/product/VaultLeaderboardSurface";

export default function VaultLeaderboardPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return process.env.ARKA_FRONTEND_REDESIGN === "1" ? <DiscoverPage searchParams={searchParams} /> : <VaultLeaderboardSurface />;
}
