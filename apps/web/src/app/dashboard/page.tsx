import { redirect } from "next/navigation";
import DashboardSurface from "@/components/product/DashboardSurface";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const redesign = process.env.ARKA_FRONTEND_REDESIGN === "1";
  if (redesign) {
    const feature = (await searchParams)?.feature;
    if (feature === "mine") redirect("/investments");
    if (feature === "curated") redirect("/?curated=1");
    if (feature === "fresh") redirect("/?sort=fresh");
  }
  return <DashboardSurface redesign={redesign} />;
}
