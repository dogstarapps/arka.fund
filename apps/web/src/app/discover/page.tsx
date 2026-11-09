import DiscoverSurface from "@/components/product/DiscoverSurface";

interface DiscoverPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const rawQuery = resolvedSearchParams?.q;
  const initialQuery = typeof rawQuery === "string" ? rawQuery : "";

  return <DiscoverSurface initialQuery={initialQuery} />;
}
