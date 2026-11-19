import ManagerDetailSurface from "@/components/product/ManagerDetailSurface";

export default async function ManagerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ManagerDetailSurface managerId={decodeURIComponent(id)} />;
}
