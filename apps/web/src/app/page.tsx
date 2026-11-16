import DiscoverPage from "./discover/page";
import DashboardSurface from "@/components/product/DashboardSurface";

export default function Home({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return process.env.ARKA_FRONTEND_REDESIGN === "1" ? <DiscoverPage searchParams={searchParams} /> : <DashboardSurface />;
}
