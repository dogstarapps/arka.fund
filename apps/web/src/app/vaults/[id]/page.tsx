import VaultDetailSurface from "@/components/product/VaultDetailSurface";

export default async function VaultDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VaultDetailSurface arkaId={decodeURIComponent(id)} redesign={process.env.ARKA_FRONTEND_REDESIGN === "1"} />;
}
