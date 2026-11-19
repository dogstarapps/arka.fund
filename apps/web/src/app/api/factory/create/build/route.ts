import {assertV3LocalRequest,buildV3DefaultReview} from '@/lib/v3DefaultRuntime'
import { NextResponse } from 'next/server'
import { buildArkaFactoryCreateAndInit } from '../../../../../lib/soroban'
import {
  apiErrorResponse,
  jsonNoStore,
  readJsonObjectBody,
} from '@/lib/server/apiHardening'

type BuildCreateRequest = {
  factoryId?: string
  creatorPubKey?: string
  saltHex?: string
  denominationContract?: string
  fees?: { mgmt_bps: number; perf_bps: number; deposit_bps: number; redeem_bps: number }
  whitelistContracts?: string[]
  routerId?: string
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    if(process.env.NEXT_PUBLIC_V3_DEFAULT_CREATION==='1'){assertV3LocalRequest(request);const body=await readJsonObjectBody<Record<string,unknown>>(request);return jsonNoStore(buildV3DefaultReview(body));}

    const body = await readJsonObjectBody<BuildCreateRequest & Record<string, unknown>>(request)
    const factoryId = body.factoryId?.trim()
    const creatorPubKey = body.creatorPubKey?.trim()
    const saltHex = body.saltHex?.trim()
    const denominationContract = body.denominationContract?.trim()
    const whitelistContracts = body.whitelistContracts?.filter(Boolean) ?? []
    const routerId = body.routerId?.trim()
    const fees = body.fees

    if (!factoryId || !creatorPubKey || !saltHex || !denominationContract || !routerId || !fees) {
      return apiErrorResponse(
        'api_factory_create_build',
        'missing_params',
        'factoryId, creatorPubKey, saltHex, denominationContract, routerId and fees are required.',
        { status: 400 },
      )
    }

    const { xdrB64, predictedAddress } = await buildArkaFactoryCreateAndInit(
      factoryId,
      creatorPubKey,
      saltHex,
      denominationContract,
      fees,
      whitelistContracts,
      routerId,
    )

    return jsonNoStore({ xdrB64, predictedAddress })
  } catch (error) {
    return apiErrorResponse(
      'api_factory_create_build',
      'build_failed',
      error instanceof Error ? error.message : 'Factory create transaction build failed.',
      { status: 500 },
    )
  }
}
