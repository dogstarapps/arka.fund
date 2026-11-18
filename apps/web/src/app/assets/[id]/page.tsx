import AssetDetailSurface from "@/components/product/AssetDetailSurface";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AssetDetailSurface assetId={decodeURIComponent(id)} />;
}
