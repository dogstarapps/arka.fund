export const dynamic = 'force-dynamic'

import CreateArkaClient from './CreateArkaClient'
import ManagedCreateSurface from '@/components/product/ManagedCreateSurface'
import { normalizeCreateWizardUrlState } from '@/lib/workflows/createWizardState'

type CreateArkaPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function CreateArkaPage({ searchParams }: CreateArkaPageProps) {
  const redesign = process.env.ARKA_FRONTEND_REDESIGN === '1'
  if(process.env.ARKA_MANAGED_PRODUCT_LOCAL==='1'&&process.env.NEXT_PUBLIC_MANAGED_PRODUCT_LOCAL==='1')return <ManagedCreateSurface redesign={redesign}/>
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const initialUrlState = normalizeCreateWizardUrlState(
    redesign ? { step: 'start', ...resolvedSearchParams } : resolvedSearchParams,
  )
  return <CreateArkaClient initialUrlState={initialUrlState} redesign={redesign} />
}
