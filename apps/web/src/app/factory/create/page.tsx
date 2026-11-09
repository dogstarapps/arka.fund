export const dynamic = 'force-dynamic'

import CreateArkaClient from './CreateArkaClient'
import ManagedCreateSurface from '@/components/product/ManagedCreateSurface'
import { normalizeCreateWizardUrlState } from '@/lib/workflows/createWizardState'

type CreateArkaPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function CreateArkaPage({ searchParams }: CreateArkaPageProps) {
  if(process.env.ARKA_MANAGED_PRODUCT_LOCAL==='1'&&process.env.NEXT_PUBLIC_MANAGED_PRODUCT_LOCAL==='1')return <ManagedCreateSurface/>
  const resolvedSearchParams = searchParams ? await searchParams : {}
  return <CreateArkaClient initialUrlState={normalizeCreateWizardUrlState(resolvedSearchParams)} />
}
