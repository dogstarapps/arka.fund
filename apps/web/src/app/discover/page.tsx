import DiscoverSurface from "@/components/product/DiscoverSurface";

interface DiscoverPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const rawQuery = resolvedSearchParams?.q;
  const initialQuery = typeof rawQuery === "string" ? rawQuery : "";

  const redesign = process.env.ARKA_FRONTEND_REDESIGN === "1";
  return <DiscoverSurface key={redesign ? initialQuery : undefined} initialQuery={initialQuery} redesign={redesign} />;
}
