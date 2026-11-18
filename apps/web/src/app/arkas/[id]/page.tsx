"use client";
import V3VersionBoundary from "@/components/product/V3VersionBoundary";
import {MANAGED_PRODUCT_LOCAL} from '@/lib/managedProduct';
import {ManagedFundSurface} from '@/components/product/ManagedProductSurface';

import Link from 'next/link'
import FundSwapReview from '@/components/product/FundSwapReview'
import type { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActionField,
  Panel,
  StatusPill,
  SurfaceTable,
  TransactionFeedbackRail,
} from '@/components/product/surfacePrimitives'
import { resolveAssetDisplayLabel } from '@/lib/catalog/assetPresentation'
import {
  loadArkaActivityPage,
  loadArkaCatalogEntry,
  loadArkaHoldersPage,
  loadCatalogAssetPrice,
} from '@/lib/catalog/api'
import { formatContractLabel, formatHumanAssetAmount } from '@/lib/catalog/format'
import { formatHolderPositionValue, formatInvestorCountLabel } from '@/lib/catalog/holderPresentation'
import {
  resolveArkaDisplayName,
} from '@/lib/catalog/identity'
import type { ArkaHolderPage, CatalogAssetPrice, RankedArkaCatalogEntry } from '@/lib/catalog/types'
import { isCatalogAssetPriceUsable } from '@/lib/catalog/valuation'
import { isPublicWalletAddress } from '@/lib/catalog/walletPositions'
import {
  ADAPTER_BALANCED,
  ROUTING_ASSET_A,
  ROUTING_ASSET_B,
  ARKA_ROUTER,
  AQUARIUS_ADAPTER,
  AQUARIUS_POOL_ROUTING_PAIR,
  AQUARIUS_ROUTER,
  BALANCED_POOL_ID,
  BLEND_MARKET_ASSETS,
  DEFAULT_REBALANCE_SLIPPAGE_PCT,
  MAX_REBALANCE_SLIPPAGE_PCT,
  SUSHI_ADAPTER,
  SUSHI_POOL_ID,
  resolveSushiPoolId,
  PHOENIX_ADAPTER,
  PHOENIX_POOL_ROUTING_PAIR,
  PHOENIX_POOL_ID,
  SOROSWAP_ADAPTER,
  SIM_ACCOUNT,
} from '../../../lib/config'
import {
  buildAdapterBalancedExecute,
  buildArkaCreditAction,
  buildArkaDeposit,
  buildArkaRedeem,
  buildArkaRebalance,
  buildSwapStepScVal,
  buildTokenApprove,
  readAquariusEstimateOut,
  readAquariusPoolIndex,
  readArkaCreditMarketConfigs,
  readArkaCreditMarketAssets,
  readArkaCreditBorrowPolicy,
  readArkaCreditMarketRiskSource,
  readArkaCreditMarketStatus,
  readArkaCreditMarketValue,
  readArkaCreditProtocols,
  readArkaCreditPositionValues,
  readArkaCreditRiskPolicy,
  readArkaDenomination,
  readArkaLiquidBalance,
  readArkaManager,
  readArkaNav,
  readArkaShareToken,
  readArkaShares,
  readArkaTotalShares,
  readArkaWhitelist,
  readSushiEstimateOut,
  readSushiFundBinding,
  readVenueSnapshot,
  readPhoenixEstimateOut,
  readSoroswapAmountOutForPath,
  readTokenAllowance,
  readSoroswapAmountOut,
  readTokenBalance,
  resolveRpcUrl,
  TESTNET,
  toBaseUnits,
  type ArkaCreditMarketConfig,
  type ArkaCreditBorrowPolicy,
  type ArkaCreditMarketRiskSource,
  type ArkaCreditMarketStatus,
  type ArkaCreditMarketValue,
  type ArkaCreditPositionValue,
  type ArkaCreditRiskPolicy,
  type CreditPositionAction,
  type CreditProtocol,
} from '../../../lib/soroban'
import {
  buildRuntimeRebalanceProtocolPolicies,
  createIdleRebalanceRoutePlan,
  formatRebalanceConfirmationModelLabel,
  formatRebalancePathModelLabel,
  formatRebalanceRoutePath,
  formatRebalanceProtocolLabel,
  formatRebalanceVenueFamilyLabel,
  resolveRebalanceRoutePlan,
  type RebalanceGuardrailStatus,
  type RebalanceProtocol,
  type RebalanceRouteCandidate,
} from '@/lib/workflows/rebalanceRouting'
import {
  buildRebalanceExecutionReceipt,
  buildSplitRebalanceExecutionReceipt,
  type ExecutionReceipt,
} from '@/lib/workflows/executionReceipts'
import {
} from '@/lib/workflows/assetSelection'
import {
  ARKA_WORKSPACE_TABS,
  resolveArkaWorkspaceId,
  type ArkaWorkspaceId,
} from '@/lib/workflows/arkaWorkspaces'
import {
  buildBalancedIntentExecutionDriver,
  deriveBalancedRouteLaneFromDriver,
} from '@/lib/workflows/intentExecutionDrivers'
import {
  buildBalancedIntentExecutionHandoff,
  formatIntentExecutionHandoffStepStateLabel,
} from '@/lib/workflows/intentExecutionHandoffs'
import {
  buildBalancedFallbackPayload,
  readAppHealthSnapshot,
  type BalancedProtocolHealthPayload,
} from '@/lib/runtime/appHealth'
import { resolveRuntimeRebalanceRoutePlan } from '@/lib/runtime/rebalanceRoutePlanResolver'
import {
  deriveProjectedAllocationShiftBps,
  deriveRebalanceGuardrailActivityState,
  emptyRebalanceGuardrailActivityState,
  type RebalanceGuardrailActivityState,
} from '@/lib/workflows/rebalanceGuardrailState'
import { signXdr as signWalletXdr } from '@/lib/tx'
import { assertFinancialActionsEnabled, UX_REVIEW_PREVIEW } from '@/lib/previewSafety'
import { requireSignedTransactionXdr } from '@/lib/workflows/walletProviderRejectionMatrix'
import { describePublicTransactionError } from '@/lib/workflows/publicTransactionError'
import { hasVerifiedDebtFreeCreditMarket, isCreditActionRiskBlocked } from '@/lib/workflows/creditActionSafety'
import {
  estimateMaximumRedemption,
  estimateWithdrawableNow,
  quoteRedemptionByDenominationAmount,
} from '@/lib/workflows/redemptionQuote'
import { E2E_WALLET_ENABLED, getWalletsKit, signWithE2EWallet } from '../../../lib/walletKit'

function describeError(error: unknown, fallback: string): string {
  return describePublicTransactionError(error, fallback)
}

function formatAssetDisplayLabel(asset: string): string {
  return resolveAssetDisplayLabel(asset)
}

function parseDecimalInput(value: string): number {
  return Number((value || '0').replace(',', '.'))
}

function formatHumanAmount(value: number): string {
  return formatHumanAssetAmount(value)
}

function formatBaseAmountWithAsset(amountBase: number, asset: string): string {
  return `${formatHumanAmount(amountBase / 10_000_000)} ${formatAssetDisplayLabel(asset)}`
}

function formatBaseAmountForInput(amountBase: number): string {
  if (!Number.isFinite(amountBase) || amountBase <= 0) return '0'
  return (amountBase / 10_000_000).toFixed(7).replace(/\.?0+$/, '')
}

function formatInputAmountWithAsset(amount: string, asset: string): string {
  const value = parseDecimalInput(amount)
  return `${formatHumanAmount(value)} ${formatAssetDisplayLabel(asset)}`
}

const CREDIT_ACTION_COPY: Record<CreditPositionAction, string> = {
  Supply: 'Move funds from this Arka into Blend.',
  Borrow: "Borrow against this Arka's supplied funds.",
  Repay: "Use this Arka's balance to reduce its Blend debt.",
  Withdraw: 'Return supplied funds from Blend to this Arka.',
}

const CREDIT_ACTION_BUTTON_COPY: Record<CreditPositionAction, string> = {
  Supply: 'Supply to Blend',
  Borrow: 'Borrow from Blend',
  Repay: 'Repay Blend debt',
  Withdraw: 'Withdraw from Blend',
}

function formatTransactionHashLabel(hash: string): string {
  return hash.length > 16 ? `${hash.slice(0, 8)}...${hash.slice(-8)}` : hash
}

function isVaultActionConfirmed(status: string): boolean {
  return /\bconfirmed\b/i.test(status)
}

function formatUserRouteDecision(
  note: string,
  candidate: RebalanceRouteCandidate | null,
  requestedProtocol: RebalanceProtocol,
): string {
  if (/resolving live route quotes/i.test(note)) return 'Comparing available routes...'
  if (candidate) {
    if (requestedProtocol === 'AUTO') {
      return `Best execution selected ${candidate.title}.`
    }
    return `${formatRebalanceProtocolLabel(candidate.protocol)} selected.`
  }
  if (requestedProtocol !== 'AUTO') {
    return `${formatRebalanceProtocolLabel(requestedProtocol)} has no executable quote for this swap.`
  }
  if (/blocked/i.test(note)) return 'Review the selected route before signing.'
  if (/valid amount/i.test(note)) return 'Enter an amount to compare available routes.'
  if (/could not read live quotes/i.test(note)) {
    return 'No swap route is currently available for this pair and amount.'
  }
  return note
}

function formatRouteAvailability(candidate: RebalanceRouteCandidate): string {
  if (!candidate.available) return 'No quote'
  if (!candidate.autoEligible) return 'Manual review'
  return 'Quoted'
}

function formatGuardrailStatus(
  status: RebalanceGuardrailStatus,
  id?: string,
): string {
  if (status === 'passed') return 'OK'
  if (status === 'blocked') {
    if (id === 'emergency_pause_swap') return 'Paused'
    if (id === 'max_path_length' || id === 'forbid_route_cycles') return 'Route unavailable'
    return 'Reduce amount'
  }
  if (status === 'requires_state') return 'Checked when signing'
  return 'Not applied'
}

function formatPolicyPercent(bps: number): string {
  return `${(Math.max(0, bps) / 100).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}%`
}

function formatRouteImpactLabel(
  candidate: RebalanceRouteCandidate | null,
  liveCandidates: RebalanceRouteCandidate[],
): string {
  if (!candidate?.available || candidate.estimatedOutBase <= 0) return 'Not available'
  const bestOutBase = Math.max(
    ...liveCandidates.map((route) => route.estimatedOutBase).filter((value) => value > 0),
  )
  if (!Number.isFinite(bestOutBase) || bestOutBase <= 0) return 'Not available'
  const deltaBps = Math.max(
    0,
    Math.round(((bestOutBase - candidate.estimatedOutBase) * 10_000) / bestOutBase),
  )
  return `${(deltaBps / 100).toFixed(2)}%`
}

function formatRouteImpactContext(
  candidate: RebalanceRouteCandidate | null,
  liveCandidates: RebalanceRouteCandidate[],
): string {
  if (!candidate?.available) return 'Enter an amount'
  if (liveCandidates.length <= 1) return 'Single quoted route'
  return 'vs best quote'
}

type GuardrailValuationPrices = {
  assetIn: string;
  denominationAsset: string;
  assetInPrice: CatalogAssetPrice | null;
  denominationPrice: CatalogAssetPrice | null;
};

function RecordedArkaDispatcher() {
  return MANAGED_PRODUCT_LOCAL ? <ManagedFundSurface/> : <LegacyArkaDetail/>;
}
function LegacyArkaDetail() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawId = params.id
  const arkaId = (rawId || '').replace(/^Arka:\s*/i, '')
  const workspaceQueryValue = searchParams.get('workspace')
  const [pubKey, setPubKey] = useState('')
  const lookupAddress = searchParams.get('address') || ''
  const ownershipAddress = pubKey || (isPublicWalletAddress(lookupAddress) ? lookupAddress : '')
  const [vaultStatus, setVaultStatus] = useState('')
  const [vaultActionPending, setVaultActionPending] = useState(false)
  const [rebalanceStatus, setRebalanceStatus] = useState('')
  const [creditStatus, setCreditStatus] = useState('')
  const [vaultError, setVaultError] = useState('')
  const [rebalanceError, setRebalanceError] = useState('')
  const [rebalanceReceipt, setRebalanceReceipt] = useState<ExecutionReceipt | null>(null)
  const [creditError, setCreditError] = useState('')
  const [walletsKit, setWalletsKit] = useState<StellarWalletsKit | null>(null)
  const [onchainManager, setOnchainManager] = useState('')
  const [shareTokenId, setShareTokenId] = useState<string | null>(null)
  const [shares, setShares] = useState(0)
  const [sharesLoaded, setSharesLoaded] = useState(false)
  const [sharesLoadError, setSharesLoadError] = useState(false)
  const [redemptionCashBase, setRedemptionCashBase] = useState<number | null>(null)
  const [cashLoading, setCashLoading] = useState(true)
  const refreshVersion = useRef(0)
  const [totalShares, setTotalShares] = useState<number | null>(null)
  const [protocol, setProtocol] = useState<RebalanceProtocol>('AUTO')
  const [creditProtocols, setCreditProtocols] = useState<CreditProtocol[]>([])
  const [creditProtocol, setCreditProtocol] = useState<CreditProtocol>('Blend')
  const [creditMarketId, setCreditMarketId] = useState<number>(0)
  const [creditAction, setCreditAction] = useState<CreditPositionAction>('Supply')
  const [assetIn, setAssetIn] = useState<string>(ROUTING_ASSET_A)
  const [assetOut, setAssetOut] = useState<string>(ROUTING_ASSET_B)
  const [denominationAsset, setDenominationAsset] = useState('')
  const [arkaBalances, setArkaBalances] = useState<Record<string, number>>({})
  const [walletBalances, setWalletBalances] = useState<Record<string, number>>({})
  const [depositPricesByAsset, setDepositPricesByAsset] = useState<Record<string, CatalogAssetPrice | null>>({})
  const [depositPricesLoading, setDepositPricesLoading] = useState(false)
  const [arkaNav, setArkaNav] = useState(-1)
  const [guardrailActivityState, setGuardrailActivityState] =
    useState<RebalanceGuardrailActivityState>(() =>
      emptyRebalanceGuardrailActivityState(),
    )
  const [guardrailValuationPrices, setGuardrailValuationPrices] =
    useState<GuardrailValuationPrices | null>(null)
  const [creditMarketConfigs, setCreditMarketConfigs] = useState<ArkaCreditMarketConfig[]>([])
  const [creditBorrowPolicy, setCreditBorrowPolicy] = useState<ArkaCreditBorrowPolicy | null>(null)
  const [creditMarketRiskSource, setCreditMarketRiskSource] = useState<ArkaCreditMarketRiskSource | null>(null)
  const [creditConfigurationError, setCreditConfigurationError] = useState('')
  const [creditReadState, setCreditReadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [creditActionPending, setCreditActionPending] = useState(false)
  const creditActionPendingRef = useRef(false)
  const [whitelistAssets, setWhitelistAssets] = useState<string[]>([])
  const [creditPositionValues, setCreditPositionValues] = useState<ArkaCreditPositionValue[]>([])
  const [creditRiskPolicy, setCreditRiskPolicy] = useState<ArkaCreditRiskPolicy | null>(null)
  const [creditMarketStatus, setCreditMarketStatus] = useState<ArkaCreditMarketStatus | null>(null)
  const [catalogArka, setCatalogArka] = useState<RankedArkaCatalogEntry | null>(null)
  const [holderPage, setHolderPage] = useState<ArkaHolderPage | null>(null)
  const [holderPageIndex, setHolderPageIndex] = useState(0)
  const [holderLoading, setHolderLoading] = useState(false)
  const [holderError, setHolderError] = useState('')
  const [amountStr, setAmountStr] = useState('1')
  const [redeemAmountStr, setRedeemAmountStr] = useState('1')
  const [slippageStr, setSlippageStr] = useState(String(DEFAULT_REBALANCE_SLIPPAGE_PCT))
  const [minOutStr, setMinOutStr] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const [activeWorkspace, setActiveWorkspace] = useState<ArkaWorkspaceId>(() =>
    resolveArkaWorkspaceId(workspaceQueryValue),
  )
  const lastWorkspaceQueryValueRef = useRef(workspaceQueryValue)
  const [routePlan, setRoutePlan] = useState(() => createIdleRebalanceRoutePlan('AUTO'))
  const [balancedSupport, setBalancedSupport] = useState<BalancedProtocolHealthPayload>(() =>
    buildBalancedFallbackPayload({
      adapterBalanced: ADAPTER_BALANCED,
      poolId: BALANCED_POOL_ID,
      supportStatus: "blocked",
      laneMode: "undeclared",
      blockingReasons: ["Balanced is waiting for canonical readiness."],
      source: "fallback",
    }),
  )
  const userSelectedAssetInRef = useRef(false)
  const userSelectedAssetOutRef = useRef(false)
  const vaultActionPendingRef = useRef(false)
  const e2eWalletMode = E2E_WALLET_ENABLED

  useEffect(() => { setWalletsKit(getWalletsKit(['FREIGHTER','ALBEDO','XBULL'])) }, [])
  useEffect(() => {
    try {
      const saved = localStorage.getItem('wallet:pubkey')
      if (saved) setPubKey(saved)
    } catch {}
    const onWalletChanged = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      if (typeof detail === 'string') {
        setPubKey(detail.trim())
        return
      }
      try {
        setPubKey(localStorage.getItem('wallet:pubkey')?.trim() ?? '')
      } catch {
        setPubKey('')
      }
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'wallet:pubkey') setPubKey(event.newValue?.trim() ?? '')
    }
    window.addEventListener('wallet:pubkey-changed', onWalletChanged as EventListener)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('wallet:pubkey-changed', onWalletChanged as EventListener)
      window.removeEventListener('storage', onStorage)
    }
  }, [])
  useEffect(() => { (async()=>{
    try{
      if (!walletsKit) return
      try { const { address } = await walletsKit.getAddress(); if (address) { setPubKey(address); return } } catch {}
    }catch{}
  })() }, [walletsKit])

  useEffect(() => {
    let active = true
    ;(async () => {
      const snapshot = await readAppHealthSnapshot()
      if (!active || !snapshot?.protocols?.balanced) return
      setBalancedSupport(snapshot.protocols.balanced)
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!arkaId) {
      setCatalogArka(null)
      return
    }
    const controller = new AbortController()
    ;(async () => {
      try {
        const entry = await loadArkaCatalogEntry(arkaId, controller.signal)
        if (!controller.signal.aborted) setCatalogArka(entry)
      } catch {
        if (!controller.signal.aborted) setCatalogArka(null)
      }
    })()
    return () => controller.abort()
  }, [arkaId])

  const loadGuardrailActivitySnapshot = async (): Promise<RebalanceGuardrailActivityState> => {
    if (!arkaId || !denominationAsset) {
      return emptyRebalanceGuardrailActivityState()
    }
    try {
      const activityPage = await loadArkaActivityPage(arkaId, {
        order: 'desc',
        limit: 200,
      })
      const priceContracts = Array.from(new Set(
        activityPage.items
          .map((entry) => entry.assetContract?.trim().toUpperCase() ?? '')
          .filter((contract) => contract && contract !== denominationAsset.trim().toUpperCase()),
      ))
      if (priceContracts.length > 0) {
        priceContracts.push(denominationAsset.trim().toUpperCase())
      }
      const priceResults = await Promise.allSettled(
        priceContracts.map((contract) => loadCatalogAssetPrice(contract)),
      )
      const pricesByAsset = new Map<string, CatalogAssetPrice | null>()
      priceContracts.forEach((contract, index) => {
        const result = priceResults[index]
        pricesByAsset.set(
          contract,
          result?.status === 'fulfilled' ? result.value : null,
        )
      })
      return deriveRebalanceGuardrailActivityState(activityPage, {
        denominationAsset,
        pricesByAsset,
      })
    } catch {
      return guardrailActivityState.source === 'catalog_activity'
        ? guardrailActivityState
        : emptyRebalanceGuardrailActivityState()
    }
  }

  const refreshGuardrailActivityState = async (): Promise<void> => {
    setGuardrailActivityState(await loadGuardrailActivitySnapshot())
  }

  // Activity-backed guardrails should not depend on every Soroban read succeeding.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { (async()=>{ await refreshGuardrailActivityState() })() }, [arkaId, denominationAsset])

  const activeCreditMarketConfig =
    creditMarketConfigs.find((config) => config.market_id === creditMarketId) ??
    creditMarketConfigs[0] ??
    null
  useEffect(() => {
    let active = true
    setCreditBorrowPolicy(null)
    setCreditMarketRiskSource(null)
    if (!arkaId || !assetIn || !activeCreditMarketConfig?.allow_borrow) {
      return () => { active = false }
    }

    void readArkaCreditBorrowPolicy(
      arkaId,
      creditProtocol,
      activeCreditMarketConfig.market_id,
      assetIn,
      pubKey || undefined,
    )
      .then((policy) => {
        if (active) setCreditBorrowPolicy(policy?.enabled ? policy : null)
      })
      .catch(() => {
        if (active) setCreditBorrowPolicy(null)
      })

    if (creditProtocol === 'Blend') {
      void readArkaCreditMarketRiskSource(
        arkaId,
        activeCreditMarketConfig.market_id,
        pubKey || undefined,
      )
        .then((source) => {
          if (active) setCreditMarketRiskSource(source)
        })
        .catch(() => {
          if (active) setCreditMarketRiskSource(null)
        })
    }

    return () => { active = false }
  }, [activeCreditMarketConfig?.allow_borrow, activeCreditMarketConfig?.market_id, arkaId, assetIn, creditProtocol, pubKey])
  const effectiveWhitelistAssets = useMemo(
    () => Array.from(new Set([
      ...(catalogArka?.whitelistContracts ?? []),
      ...whitelistAssets,
    ].filter(Boolean))),
    [catalogArka?.whitelistContracts, whitelistAssets],
  )
  const creditSelectableAssets = useMemo(
    () => BLEND_MARKET_ASSETS.filter((asset) => effectiveWhitelistAssets.includes(asset)),
    [effectiveWhitelistAssets],
  )
  const vaultSelectableAssets = useMemo(
    () => (effectiveWhitelistAssets.length > 0 ? effectiveWhitelistAssets : [ROUTING_ASSET_A, ROUTING_ASSET_B]),
    [effectiveWhitelistAssets],
  )
  const depositableVaultAssets = useMemo(
    () => vaultSelectableAssets.filter((asset) => isCatalogAssetPriceUsable(depositPricesByAsset[asset])),
    [depositPricesByAsset, vaultSelectableAssets],
  )
  const selectedDepositAssetUsable = isCatalogAssetPriceUsable(depositPricesByAsset[assetIn])
  const depositAvailabilityLabel = depositableVaultAssets
    .map(formatAssetDisplayLabel)
    .join(', ')
  const selectAssetIn = (contract: string) => {
    userSelectedAssetInRef.current = true
    setAssetIn(contract)
  }
  const selectAssetOut = (contract: string) => {
    userSelectedAssetOutRef.current = true
    setAssetOut(contract)
  }

  useEffect(() => {
    if (vaultSelectableAssets.length === 0) {
      setDepositPricesByAsset({})
      setDepositPricesLoading(false)
      return
    }
    const controller = new AbortController()
    setDepositPricesLoading(true)
    Promise.allSettled(
      vaultSelectableAssets.map((asset) => loadCatalogAssetPrice(asset, controller.signal)),
    ).then((results) => {
      if (controller.signal.aborted) return
      const nextPrices: Record<string, CatalogAssetPrice | null> = {}
      vaultSelectableAssets.forEach((asset, index) => {
        const result = results[index]
        nextPrices[asset] = result?.status === 'fulfilled' ? result.value : null
      })
      setDepositPricesByAsset(nextPrices)
      setDepositPricesLoading(false)
    })
    return () => controller.abort()
  }, [vaultSelectableAssets])

  useEffect(() => {
    if (activeWorkspace !== 'flow' || depositPricesLoading || selectedDepositAssetUsable) return
    const firstAvailable = depositableVaultAssets[0]
    if (firstAvailable && firstAvailable !== assetIn) setAssetIn(firstAvailable)
  }, [activeWorkspace, assetIn, depositPricesLoading, depositableVaultAssets, selectedDepositAssetUsable])
  const walletRoutedRebalance = false
  const blendBorrowConfigurationReady =
    creditProtocol !== 'Blend' || Boolean(creditMarketRiskSource)
  const borrowingReady = Boolean(creditBorrowPolicy) && blendBorrowConfigurationReady
  const creditActionRiskBlocked = isCreditActionRiskBlocked(creditAction, creditMarketStatus, creditPositionValues)
  const creditDebtFree = creditReadState === 'ready' && hasVerifiedDebtFreeCreditMarket(creditMarketStatus, creditPositionValues)
  const creditMarketUnavailable = Boolean(
    creditMarketStatus?.has_disabled_reserve ||
      (creditMarketStatus && creditMarketStatus.pool_status > (creditMarketRiskSource ? 1 : 0)),
  )
  const supportedCreditActions = useMemo(
    () =>
      activeCreditMarketConfig
        ? ([
            activeCreditMarketConfig.allow_supply ? 'Supply' : null,
            activeCreditMarketConfig.allow_borrow ? 'Borrow' : null,
            activeCreditMarketConfig.allow_repay ? 'Repay' : null,
            activeCreditMarketConfig.allow_withdraw ? 'Withdraw' : null,
          ].filter(Boolean) as CreditPositionAction[])
        : [],
    [activeCreditMarketConfig],
  )
  const balancedLaneReady =
    balancedSupport.intentVenue.manualExecutionEligible &&
    Boolean(balancedSupport.adapterBalanced || ADAPTER_BALANCED) &&
    (balancedSupport.poolId || BALANCED_POOL_ID) > 0
  const balancedIntentDriver = useMemo(
    () => buildBalancedIntentExecutionDriver(balancedSupport),
    [balancedSupport],
  )
  const balancedIntentHandoff = useMemo(
    () =>
      buildBalancedIntentExecutionHandoff(balancedIntentDriver, {
        assetIn,
        assetOut,
        amountLabel: amountStr || '0',
        minOutLabel: formatBaseAmountWithAsset(routePlan.minOutBase, assetOut),
      }),
    [amountStr, assetIn, assetOut, balancedIntentDriver, routePlan.minOutBase],
  )

  useEffect(() => {
    if (!supportedCreditActions.length) return
    if (!supportedCreditActions.includes(creditAction)) {
      setCreditAction(supportedCreditActions[0])
    }
  }, [creditAction, supportedCreditActions])

  useEffect(() => {
    const selectableAssets = whitelistAssets.length > 0 ? whitelistAssets : [ROUTING_ASSET_A, ROUTING_ASSET_B]
    if (!selectableAssets.length) return
    const positiveVaultAsset = selectableAssets.find((asset) => (arkaBalances[asset] || 0) > 0)
    const denominationSelectable =
      denominationAsset && selectableAssets.includes(denominationAsset)
        ? denominationAsset
        : ''
    const preferredVaultAsset = denominationSelectable || positiveVaultAsset || selectableAssets[0] || ''
    const shouldApplyVaultDefault =
      activeWorkspace !== 'credit' &&
      !userSelectedAssetInRef.current &&
      preferredVaultAsset &&
      assetIn !== preferredVaultAsset
    if (!selectableAssets.includes(assetIn) || shouldApplyVaultDefault) {
      setAssetIn(preferredVaultAsset)
    }
    const selectedIn =
      selectableAssets.includes(assetIn) && !shouldApplyVaultDefault
        ? assetIn
        : preferredVaultAsset
    if (
      !selectableAssets.includes(assetOut) ||
      assetOut === selectedIn ||
      (!userSelectedAssetOutRef.current && assetOut === assetIn)
    ) {
      const fallbackOut = selectableAssets.find((asset) => asset !== selectedIn) ?? selectableAssets[0] ?? ''
      if (fallbackOut) setAssetOut(fallbackOut)
    }
  }, [activeWorkspace, arkaBalances, assetIn, assetOut, denominationAsset, whitelistAssets])

  useEffect(() => {
    if (!assetIn || !denominationAsset) {
      setGuardrailValuationPrices(null)
      return
    }
    if (assetIn === denominationAsset) {
      setGuardrailValuationPrices({
        assetIn,
        denominationAsset,
        assetInPrice: null,
        denominationPrice: null,
      })
      return
    }

    const controller = new AbortController()
    Promise.allSettled([
      loadCatalogAssetPrice(assetIn, controller.signal),
      loadCatalogAssetPrice(denominationAsset, controller.signal),
    ]).then(([assetResult, denominationResult]) => {
      if (controller.signal.aborted) return
      setGuardrailValuationPrices({
        assetIn,
        denominationAsset,
        assetInPrice: assetResult.status === 'fulfilled' ? assetResult.value : null,
        denominationPrice:
          denominationResult.status === 'fulfilled'
            ? denominationResult.value
            : null,
      })
    })

    return () => controller.abort()
  }, [assetIn, denominationAsset])

  useEffect(() => {
    if (!arkaId) return
    try {
      const stored = window.localStorage.getItem('recent_arkas')
      const parsed = stored ? JSON.parse(stored) : []
      const current = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
      const next = [arkaId, ...current.filter((item) => item !== arkaId)].slice(0, 8)
      window.localStorage.setItem('recent_arkas', JSON.stringify(next))
    } catch {}
  }, [arkaId])

  useEffect(() => {
    if (activeWorkspace !== 'rebalance') {
      setRoutePlan(createIdleRebalanceRoutePlan(protocol))
      return
    }
    const amount = toBaseUnits(Number((amountStr || '0').replace(',', '.')))
    const slip = Math.max(0, Math.min(MAX_REBALANCE_SLIPPAGE_PCT, Number((slippageStr || '0').replace(',', '.'))))
    const manualMinOutBase = advanced && minOutStr ? toBaseUnits(Number((minOutStr || '0').replace(',', '.'))) : 0
    if (amount <= 0 || !assetIn || !assetOut || assetIn === assetOut) {
      setRoutePlan(createIdleRebalanceRoutePlan(protocol))
      return
    }

    let active = true
    setRoutePlan((current) => ({ ...current, requestedProtocol: protocol, note: 'Resolving live route quotes...' }))

    ;(async () => {
      const projectedPostTradeDeviationBps =
        guardrailValuationPrices?.assetIn === assetIn &&
        guardrailValuationPrices.denominationAsset === denominationAsset
          ? deriveProjectedAllocationShiftBps({
              amountBase: amount,
              vaultNavBase: arkaNav > 0 ? arkaNav : undefined,
              assetIn,
              denominationAsset,
              assetInPrice: guardrailValuationPrices.assetInPrice,
              denominationPrice: guardrailValuationPrices.denominationPrice,
            })
          : undefined
      const configuredPoolIndex =
        ((assetIn === ROUTING_ASSET_A && assetOut === ROUTING_ASSET_B) || (assetIn === ROUTING_ASSET_B && assetOut === ROUTING_ASSET_A))
          ? AQUARIUS_POOL_ROUTING_PAIR
          : ''
      const configuredPhoenixPool =
        ((assetIn === ROUTING_ASSET_A && assetOut === ROUTING_ASSET_B) || (assetIn === ROUTING_ASSET_B && assetOut === ROUTING_ASSET_A))
          ? PHOENIX_POOL_ROUTING_PAIR
          : ''
      const protocolPolicies = buildRuntimeRebalanceProtocolPolicies({
        base: {
          BALANCED: {
            planningEnabled:
              balancedIntentDriver.plannerAdmission !== 'blocked',
            executionEnabled: balancedLaneReady,
            disabledReason:
              balancedIntentDriver.plannerDetail ||
              balancedSupport.blockingReasons[0] ||
              'Balanced stays blocked until canonical readiness is live.',
          },
        },
      })

      const resolveLocalPlan = async () =>
        resolveRebalanceRoutePlan(
          {
            requestedProtocol: protocol,
            fundId: arkaId,
            requireVenueState: true,
            sushiAdapterId: SUSHI_ADAPTER || undefined,
            sushiPoolId: resolveSushiPoolId(assetIn, assetOut),
            amountBase: amount,
            tokenIn: assetIn,
            tokenOut: assetOut,
            slippagePct: slip,
            manualMinOutBase,
            aquariusRouterId: AQUARIUS_ROUTER,
            aquariusAdapterId: AQUARIUS_ADAPTER,
            aquariusPoolId: 1,
            soroswapAdapterId: SOROSWAP_ADAPTER,
            phoenixAdapterId: PHOENIX_ADAPTER || undefined,
            phoenixPoolId: PHOENIX_POOL_ID,
            configuredPhoenixPool: configuredPhoenixPool || undefined,
            configuredAquariusPoolIndex: configuredPoolIndex,
            routingAssets: vaultSelectableAssets,
            balancedLane: deriveBalancedRouteLaneFromDriver(balancedIntentDriver),
            protocolPolicies,
            guardrailState: {
              vaultNavBase: arkaNav > 0 ? arkaNav : undefined,
              dailyTurnoverUsedBase:
                guardrailActivityState.dailyTurnoverUsedBase,
              projectedPostTradeDeviationBps,
            },
            readerPubKey: pubKey || undefined,
          },
          {
            readSoroswapAmountOut,
            readSoroswapAmountOutForPath,
            readAquariusPoolIndex,
            readAquariusEstimateOut,
            readSushiEstimateOut,
            readSushiFundBinding,
            readVenueSnapshot,
            readPhoenixEstimateOut,
          },
        )

      const nextPlan = await resolveRuntimeRebalanceRoutePlan({
        requestPayload: {
          fundId: arkaId,
          requestedProtocol: protocol,
          amountBase: amount,
          tokenIn: assetIn,
          tokenOut: assetOut,
          slippagePct: slip,
          manualMinOutBase,
          configuredAquariusPoolIndex: configuredPoolIndex,
          configuredPhoenixPool: configuredPhoenixPool || undefined,
          routingAssets: vaultSelectableAssets,
          vaultNavBase: arkaNav > 0 ? arkaNav : undefined,
          dailyTurnoverUsedBase: guardrailActivityState.dailyTurnoverUsedBase,
          projectedPostTradeDeviationBps,
          readerPubKey: pubKey || undefined,
        },
        resolveLocalPlan,
        failureMode: 'idle',
      })
      if (!active) return
      setRoutePlan(nextPlan)
    })()

    return () => {
      active = false
    }
  }, [activeWorkspace, advanced, amountStr, arkaId, arkaNav, assetIn, assetOut, balancedIntentDriver, balancedLaneReady, balancedSupport, denominationAsset, guardrailActivityState.dailyTurnoverUsedBase, guardrailValuationPrices, minOutStr, protocol, pubKey, slippageStr, vaultSelectableAssets])

  const refreshArka = async (): Promise<void> => {
    if (!arkaId) return
    const version = ++refreshVersion.current
    setRedemptionCashBase(null)
    setCashLoading(true)
    setSharesLoadError(false)
    if (activeWorkspace === 'credit') setCreditReadState('loading')
    try {
    const catalogSnapshot = catalogArka ?? await loadArkaCatalogEntry(arkaId).catch(() => null)
    if (version !== refreshVersion.current) return
    if (catalogSnapshot && !catalogArka) setCatalogArka(catalogSnapshot)
    const indexedNav = Number(catalogSnapshot?.nav ?? Number.NaN)
    setArkaNav(Number.isFinite(indexedNav) ? indexedNav : -1)
    const m = catalogSnapshot?.manager || await readArkaManager(arkaId, pubKey || undefined)
    setOnchainManager(m)
    const shareToken = catalogSnapshot?.shareToken || await readArkaShareToken(arkaId, pubKey || undefined)
    setShareTokenId(shareToken)
    setSharesLoaded(false)
    setShares(0)
    setTotalShares(null)
    if (ownershipAddress) {
      try {
        // The vault's shares_of is canonical for both accounting versions.
        // V2 holdings need not be mirrored by the old share token balance.
        const [s, total] = await Promise.all([
          readArkaShares(arkaId, pubKey || SIM_ACCOUNT, ownershipAddress),
          readArkaTotalShares(arkaId, pubKey || undefined),
        ])
        if (version !== refreshVersion.current) return
        setShares(s)
        setTotalShares(total)
        setSharesLoaded(true)
      } catch {
        if (version !== refreshVersion.current) return
        // Unknown ownership is not a zero balance; transaction amounts stay
        // unavailable until a successful canonical read, never from table cache.
        setSharesLoaded(false)
        setSharesLoadError(true)
      }
    } else {
      setShares(0)
      setTotalShares(null)
    }
    let protocols: CreditProtocol[] = []
    let configs: ArkaCreditMarketConfig[] = []
    let resolvedProtocol = creditProtocol
    let creditConfigError = ''
    if (activeWorkspace === 'credit') try {
      protocols = await readArkaCreditProtocols(arkaId, pubKey || undefined)
      if (protocols.length === 0) {
        creditConfigError = 'Blend is not available for this Arka.'
      } else {
        resolvedProtocol = protocols.includes(creditProtocol) ? creditProtocol : protocols[0]!
        const marketConfigs = await readArkaCreditMarketConfigs(
          arkaId,
          resolvedProtocol,
          pubKey || undefined,
        )
        configs = marketConfigs.filter((config) => config.enabled)
        if (configs.length === 0) {
          creditConfigError = 'Blend is not available for this Arka.'
        }
      }
    } catch {
      creditConfigError = 'Blend is temporarily unavailable. Please try again.'
    }
    const resolvedMarketId = configs.some((config) => config.market_id === creditMarketId)
      ? creditMarketId
      : (configs[0]?.market_id ?? 0)
    let creditReadFailed = false
    const creditReadFallback = <T,>(fallback: T) => () => { creditReadFailed = true; return fallback }
    const creditReads: Promise<[
      string[],
      ArkaCreditPositionValue[],
      ArkaCreditMarketValue | null,
      ArkaCreditRiskPolicy | null,
      ArkaCreditMarketStatus | null,
    ]> = activeWorkspace === 'credit' && configs.length > 0
      ? Promise.all([
          readArkaCreditMarketAssets(arkaId, resolvedProtocol, resolvedMarketId, pubKey || undefined).catch(creditReadFallback([])),
          readArkaCreditPositionValues(arkaId, resolvedProtocol, resolvedMarketId, pubKey || undefined).catch(creditReadFallback([])),
          readArkaCreditMarketValue(arkaId, resolvedProtocol, resolvedMarketId, pubKey || undefined).catch(creditReadFallback(null)),
          readArkaCreditRiskPolicy(arkaId, resolvedProtocol, resolvedMarketId, pubKey || undefined).catch(creditReadFallback(null)),
          readArkaCreditMarketStatus(arkaId, resolvedProtocol, resolvedMarketId, pubKey || undefined).catch(creditReadFallback(null)),
        ])
      : Promise.resolve([[], [], null, null, null])
    const indexedWhitelist = catalogSnapshot?.whitelistContracts?.filter(Boolean) ?? []
    const denominationRead = catalogSnapshot?.denominationContract
      ? Promise.resolve(catalogSnapshot.denominationContract)
      : readArkaDenomination(arkaId, pubKey || undefined).catch(() => '')
    const whitelistRead = indexedWhitelist.length > 0
      ? Promise.resolve(indexedWhitelist)
      : readArkaWhitelist(arkaId, pubKey || undefined).catch((): string[] => [])
    const [nav, denomination, whitelist, [positionAssets, positionValues, marketValue, riskPolicy, marketStatus]] = await Promise.all([
      Number.isFinite(indexedNav)
        ? Promise.resolve(indexedNav)
        : readArkaNav(arkaId, pubKey || undefined).catch(() => -1),
      denominationRead,
      whitelistRead,
      creditReads,
    ])
    const activeConfig = configs.find((config) => config.market_id === resolvedMarketId) ?? configs[0] ?? null
    const marketAssets = activeConfig
      ? BLEND_MARKET_ASSETS.filter((asset) => whitelist.includes(asset))
      : positionAssets.filter((asset) => whitelist.includes(asset))
    const resolvedDenomination = denomination || catalogSnapshot?.denominationContract || ''
    const freshCash = resolvedDenomination ? await readArkaLiquidBalance(arkaId, resolvedDenomination, pubKey || undefined).catch(() => null) : null
    if (version !== refreshVersion.current) return
    setRedemptionCashBase(freshCash)
    setCashLoading(false)
    const balanceAssets = [...new Set([resolvedDenomination, ROUTING_ASSET_A, ROUTING_ASSET_B, ...whitelist, ...marketAssets].filter(Boolean))]
    if (activeWorkspace === 'credit') {
      if (protocols.length > 0 && resolvedProtocol !== creditProtocol) setCreditProtocol(resolvedProtocol)
      setCreditProtocols(protocols)
      setCreditMarketConfigs(configs)
      setCreditConfigurationError(creditConfigError)
      if (resolvedMarketId !== creditMarketId) setCreditMarketId(resolvedMarketId)
    }
    const enabledActions = activeConfig
      ? ([
          activeConfig.allow_supply ? 'Supply' : null,
          activeConfig.allow_borrow ? 'Borrow' : null,
          activeConfig.allow_repay ? 'Repay' : null,
          activeConfig.allow_withdraw ? 'Withdraw' : null,
        ].filter(Boolean) as CreditPositionAction[])
      : []
    if (enabledActions.length > 0 && !enabledActions.includes(creditAction)) {
      setCreditAction(enabledActions[0]!)
    }
    const indexedLiquidBalances = Object.fromEntries(
      (catalogSnapshot?.assets ?? []).filter((asset) => asset.liquidBalance !== null && asset.liquidBalance !== undefined && Number.isSafeInteger(Number(asset.liquidBalance)) && Number(asset.liquidBalance) >= 0).map((asset) => [
        asset.assetContract,
        Number(asset.liquidBalance),
      ]),
    )
    const missingBalanceAssets = balanceAssets.filter(
      (asset) => indexedLiquidBalances[asset] === undefined,
    )
    const liveLiquidBalances = await Promise.all(
      missingBalanceAssets.map(async (asset) => [
        asset,
        await readArkaLiquidBalance(arkaId, asset, pubKey || undefined).catch(() => null),
      ] as const),
    )
    const liquidBalanceMap = {
      ...indexedLiquidBalances,
      ...Object.fromEntries(liveLiquidBalances.filter((entry): entry is readonly [string, number] => entry[1] !== null)),
      ...(freshCash !== null && resolvedDenomination ? { [resolvedDenomination]: freshCash } : {}),
    }
    if (version !== refreshVersion.current) return
    setArkaNav(nav)
    setArkaBalances(liquidBalanceMap)
    setDenominationAsset(resolvedDenomination)
    setWhitelistAssets(whitelist)
    setCreditPositionValues(positionValues)
    setCreditRiskPolicy(riskPolicy)
    setCreditMarketStatus(marketStatus)
    if (activeWorkspace === 'credit') setCreditReadState(!creditReadFailed && !creditConfigError && marketValue !== null && marketStatus !== null ? 'ready' : 'error')
    await refreshGuardrailActivityState()
    const knownCreditAssets = marketAssets
    const preferredAsset = knownCreditAssets.find((asset) => (liquidBalanceMap[asset] || 0) > 0)
      ?? knownCreditAssets[0]
      ?? ''
    const selectedCreditAssetBalance = liquidBalanceMap[assetIn] || 0
    const preferredCreditAssetBalance = preferredAsset ? (liquidBalanceMap[preferredAsset] || 0) : 0
    if (
      activeWorkspace === 'credit' &&
      preferredAsset &&
      (
        !knownCreditAssets.includes(assetIn) ||
        (selectedCreditAssetBalance <= 0 && preferredCreditAssetBalance > 0)
      )
    ) {
      setAssetIn(preferredAsset)
      if (!assetOut || assetOut === assetIn) {
        setAssetOut(preferredAsset)
      }
    }
    if (pubKey) {
      const walletEntries = await Promise.all(balanceAssets.map(async (asset) => [asset, await readTokenBalance(asset, pubKey, pubKey)] as const))
      if (version !== refreshVersion.current) return
      setWalletBalances(Object.fromEntries(walletEntries))
    }
    } catch (error) {
      if (version === refreshVersion.current) {
        setCashLoading(false)
        if (activeWorkspace === 'credit') {
          setCreditReadState('error')
          setCreditConfigurationError('The Blend position could not be checked. Refresh before taking an action.')
        }
      }
      throw error
    }
  }

  const runVaultAction = async (
    fallbackError: string,
    action: () => Promise<void>,
  ): Promise<void> => {
    if (vaultActionPendingRef.current) return
    vaultActionPendingRef.current = true
    setVaultActionPending(true)
    setVaultStatus('')
    setVaultError('')
    try {
      await action()
      setVaultError('')
    } catch (error) {
      setVaultStatus('')
      setVaultError(describeError(error, fallbackError))
    } finally {
      vaultActionPendingRef.current = false
      setVaultActionPending(false)
    }
  }

  // refreshArka intentionally closes over the latest page state for manual refreshes after txs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void refreshArka().catch(()=>{}); return () => { refreshVersion.current++ } }, [activeWorkspace, arkaId, pubKey, ownershipAddress, creditProtocol, creditMarketId])

  const submitSigned = async (signedXdr: string | { signedTxXdr?: string }): Promise<string> => {
    assertFinancialActionsEnabled()
    type RpcSendTx = { jsonrpc: '2.0'; id: number; result?: { hash: string }; error?: { code: number; message: string } }
    const txB64 = requireSignedTransactionXdr(signedXdr, 'Arka detail signer')
    const res = await fetch(resolveRpcUrl(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'sendTransaction', params: { transaction: txB64 } }) })
    const json = (await res.json()) as RpcSendTx
    if (!json.result?.hash) throw new Error(json.error?.message || 'sendTransaction failed')
    return json.result.hash
  }

  const waitForSorobanTx = async (hash: string, timeoutMs = 90000): Promise<void> => {
    const started = Date.now()
    for (;;) {
      const res = await fetch(resolveRpcUrl(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: { hash } }) })
      const json = (await res.json()) as { result?: { status?: string } }
      const s = json.result?.status
      if (s === 'SUCCESS') return
      if (s === 'FAILED' || s === 'ERROR') throw new Error(`Tx failed: ${hash}`)
      if (Date.now() - started > timeoutMs) throw new Error(`Tx timeout: ${hash}`)
      await new Promise(r => setTimeout(r, 1200))
    }
  }

  const waitForRequiredAllowance = async (
    tokenId: string,
    owner: string,
    spender: string,
    requiredAmount: number,
  ): Promise<void> => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const allowance = await readTokenAllowance(tokenId, owner, spender, owner)
      if (allowance >= requiredAmount) return
      await new Promise(resolve => setTimeout(resolve, 1200 + attempt * 600))
    }
    throw new Error('Token approval is not confirmed yet. Wait a few seconds and try again.')
  }

  const signXdr = async (xdrB64: string): Promise<string> => {
    assertFinancialActionsEnabled()
    if (e2eWalletMode) {
      try {
        const signed = await signWithE2EWallet(xdrB64, { networkPassphrase: TESTNET, submit: false })
        if (typeof signed === 'string' && signed.trim()) return signed
        throw new Error('E2E wallet signature missing')
      } catch (error) {
        throw new Error(`Wallet signature unavailable: ${describeError(error, 'E2E wallet signer failed')}`)
      }
    }
    return signWalletXdr(walletsKit ?? ({} as StellarWalletsKit), xdrB64)
  }

  const runRebalance = async (reviewedMinimumOutBase: number): Promise<void> => {
    if (!pubKey) return
    const amount = toBaseUnits(Number((amountStr || '0').replace(',', '.')))
    if (amount <= 0) throw new Error('Invalid amount')
    const slip = Math.max(0, Math.min(MAX_REBALANCE_SLIPPAGE_PCT, Number((slippageStr || '0').replace(',', '.'))))
    const manualMinOutBase = advanced && minOutStr ? toBaseUnits(Number((minOutStr || '0').replace(',', '.'))) : 0
    const configuredPoolIndex =
      ((assetIn === ROUTING_ASSET_A && assetOut === ROUTING_ASSET_B) || (assetIn === ROUTING_ASSET_B && assetOut === ROUTING_ASSET_A))
        ? AQUARIUS_POOL_ROUTING_PAIR
        : ''
    const configuredPhoenixPool =
      ((assetIn === ROUTING_ASSET_A && assetOut === ROUTING_ASSET_B) || (assetIn === ROUTING_ASSET_B && assetOut === ROUTING_ASSET_A))
        ? PHOENIX_POOL_ROUTING_PAIR
        : ''
    const executionGuardrailActivityState = await loadGuardrailActivitySnapshot()
    setGuardrailActivityState(executionGuardrailActivityState)
    const latestArkaNav = await readArkaNav(arkaId, pubKey).catch(() => arkaNav)
    if (latestArkaNav > 0 && latestArkaNav !== arkaNav) {
      setArkaNav(latestArkaNav)
    }
    const liquidInventoryNavBase = Object.values(arkaBalances).reduce(
      (total, balance) => total + Math.max(0, Number(balance) || 0),
      0,
    )
    const executionNavEvidence =
      routePlan.guardrails?.checks.find((check) => check.id === 'post_trade_deviation_bps')?.evidence?.vaultNavBase ??
      routePlan.guardrails?.checks.find((check) => check.id === 'daily_turnover_cap_bps')?.evidence?.vaultNavBase
    const executionVaultNavBase =
      latestArkaNav > 0
        ? latestArkaNav
        : arkaNav > 0
          ? arkaNav
          : executionNavEvidence ?? (liquidInventoryNavBase > 0 ? liquidInventoryNavBase : undefined)
    const executionDailyTurnoverUsedBase =
      executionGuardrailActivityState.dailyTurnoverUsedBase
    const latestValuationPrices =
      guardrailValuationPrices?.assetIn === assetIn &&
      guardrailValuationPrices.denominationAsset === denominationAsset
        ? guardrailValuationPrices
        : assetIn === denominationAsset
          ? {
              assetIn,
              denominationAsset,
              assetInPrice: null,
              denominationPrice: null,
            }
          : await Promise.allSettled([
              loadCatalogAssetPrice(assetIn),
              loadCatalogAssetPrice(denominationAsset),
            ]).then(([assetResult, denominationResult]) => ({
              assetIn,
              denominationAsset,
              assetInPrice: assetResult.status === 'fulfilled' ? assetResult.value : null,
              denominationPrice:
                denominationResult.status === 'fulfilled'
                  ? denominationResult.value
                  : null,
            }))
    const projectedPostTradeDeviationBps = deriveProjectedAllocationShiftBps({
      amountBase: amount,
      vaultNavBase: executionVaultNavBase,
      assetIn,
      denominationAsset,
      assetInPrice: latestValuationPrices.assetInPrice,
      denominationPrice: latestValuationPrices.denominationPrice,
    })
    const executionGuardrailState = {
      vaultNavBase: executionVaultNavBase,
      dailyTurnoverUsedBase: executionDailyTurnoverUsedBase,
      projectedPostTradeDeviationBps,
    }
    const executionProtocolPolicies = buildRuntimeRebalanceProtocolPolicies({
      base: {
        BALANCED: {
          planningEnabled:
            balancedIntentDriver.plannerAdmission !== 'blocked',
          executionEnabled: balancedLaneReady,
          disabledReason:
            balancedIntentDriver.plannerDetail ||
            balancedSupport.blockingReasons[0] ||
            'Balanced stays blocked until canonical readiness is live.',
        },
      },
    })
    const resolveLocalPlan = async () =>
      resolveRebalanceRoutePlan(
        {
          requestedProtocol: protocol,
          fundId: arkaId,
          requireVenueState: true,
          sushiAdapterId: SUSHI_ADAPTER || undefined,
          sushiPoolId: resolveSushiPoolId(assetIn, assetOut),
          amountBase: amount,
          tokenIn: assetIn,
          tokenOut: assetOut,
          slippagePct: slip,
          manualMinOutBase,
          aquariusRouterId: AQUARIUS_ROUTER,
          aquariusAdapterId: AQUARIUS_ADAPTER,
          aquariusPoolId: 1,
          soroswapAdapterId: SOROSWAP_ADAPTER,
          phoenixAdapterId: PHOENIX_ADAPTER || undefined,
          phoenixPoolId: PHOENIX_POOL_ID,
          configuredPhoenixPool: configuredPhoenixPool || undefined,
          configuredAquariusPoolIndex: configuredPoolIndex,
          routingAssets: vaultSelectableAssets,
          balancedLane: deriveBalancedRouteLaneFromDriver(balancedIntentDriver),
          protocolPolicies: executionProtocolPolicies,
          guardrailState: executionGuardrailState,
          requiredStatefulGuardrails: [
            "post_trade_deviation_bps",
            "daily_turnover_cap_bps",
          ],
          readerPubKey: pubKey,
        },
        {
          readSoroswapAmountOut,
          readSoroswapAmountOutForPath,
          readAquariusPoolIndex,
          readAquariusEstimateOut,
          readSushiEstimateOut,
          readSushiFundBinding,
          readVenueSnapshot,
          readPhoenixEstimateOut,
        },
      )

    const executionPlan = await resolveRuntimeRebalanceRoutePlan({
      requestPayload: {
        fundId: arkaId,
        requestedProtocol: protocol,
        amountBase: amount,
        tokenIn: assetIn,
        tokenOut: assetOut,
        slippagePct: slip,
        manualMinOutBase,
        configuredAquariusPoolIndex: configuredPoolIndex,
        configuredPhoenixPool: configuredPhoenixPool || undefined,
        routingAssets: vaultSelectableAssets,
        vaultNavBase: executionGuardrailState.vaultNavBase,
        dailyTurnoverUsedBase: executionGuardrailState.dailyTurnoverUsedBase,
        projectedPostTradeDeviationBps:
          executionGuardrailState.projectedPostTradeDeviationBps,
        requiredStatefulGuardrails: [
          "post_trade_deviation_bps",
          "daily_turnover_cap_bps",
        ],
        readerPubKey: pubKey,
      },
      resolveLocalPlan,
      failureMode: 'throw',
    })
    setRoutePlan(executionPlan)
    const missingExecutionGuardrails = [
      'post_trade_deviation_bps',
      'daily_turnover_cap_bps',
    ].filter((id) => !executionPlan.guardrails?.checks.some((check) => check.id === id))
    if (missingExecutionGuardrails.length > 0) {
      throw new Error('Current vault risk checks are unavailable. Refresh and try again.')
    }
    if (executionPlan.guardrails?.status === 'blocked') {
      throw new Error(executionPlan.guardrails.blockedReasons.join(' '))
    }
    const selectedProtocol = executionPlan.selectedProtocol
    const selectedCandidate = executionPlan.selectedCandidate
      ?? executionPlan.candidates.find((candidate) => candidate.protocol === selectedProtocol)
    const minOut = executionPlan.minOutBase
    if (!Number.isSafeInteger(reviewedMinimumOutBase) || reviewedMinimumOutBase <= 0 || !Number.isSafeInteger(minOut) || minOut < reviewedMinimumOutBase) {
      throw new Error('SWAP_REVIEW_MINIMUM_CHANGED')
    }
    const receiptSteps: ExecutionReceipt["steps"] = []
    const buildVaultRebalanceStep = (input: {
      protocol: 'SOROSWAP' | 'AQUARIUS' | 'PHOENIX' | 'SUSHI'
      amountInBase: number
      minOutBase: number
      pathAssets?: string[]
      adapterId?: string
      poolId?: number
    }) => {
      const pathAssets =
        input.pathAssets && input.pathAssets.length >= 2
          ? input.pathAssets
          : [assetIn, assetOut]
      if (pathAssets.length !== 2 && input.protocol !== 'SOROSWAP') {
        throw new Error('Vault-owned multi-hop execution is currently supported only through SoroSwap adapter paths.')
      }
      const outputAsset = pathAssets[pathAssets.length - 1]
      return buildSwapStepScVal({
        adapterAddress:
          input.adapterId ??
          (input.protocol === 'AQUARIUS'
            ? AQUARIUS_ADAPTER
            : input.protocol === 'SUSHI'
              ? SUSHI_ADAPTER
            : input.protocol === 'PHOENIX'
              ? PHOENIX_ADAPTER
              : SOROSWAP_ADAPTER),
        poolId: input.poolId ?? 1,
        assetInContract: pathAssets[0],
        amountIn: input.amountInBase,
        minOut: input.minOutBase,
        assetOutContract: outputAsset,
        routerAddress: ARKA_ROUTER,
      })
    }

    setRebalanceError('')
    setRebalanceReceipt(null)
    setRebalanceStatus(
      protocol === 'AUTO'
        ? executionPlan.note
        : `Rebalance ${selectedCandidate?.title ?? formatRebalanceProtocolLabel(selectedProtocol)}...`,
    )
    const splitRoute = executionPlan.splitRoute
    if (
      protocol === 'AUTO' &&
      splitRoute?.executable &&
      splitRoute.status === 'recommended' &&
      splitRoute.allocations.length > 1
    ) {
      setRebalanceStatus(splitRoute.note)
      const steps = splitRoute.allocations.map((allocation) =>
        buildVaultRebalanceStep({
          protocol: allocation.protocol,
          amountInBase: allocation.amountInBase,
          minOutBase: allocation.minOutBase,
          pathAssets: allocation.pathAssets,
          adapterId:
            allocation.protocol === 'AQUARIUS'
              ? (allocation.adapterId || AQUARIUS_ADAPTER)
              : allocation.protocol === 'SUSHI'
                ? (allocation.adapterId || SUSHI_ADAPTER)
              : allocation.protocol === 'PHOENIX'
                ? (allocation.adapterId || PHOENIX_ADAPTER)
              : (allocation.adapterId || SOROSWAP_ADAPTER),
          poolId: allocation.poolId ?? (allocation.protocol === 'SUSHI' ? SUSHI_POOL_ID : allocation.protocol === 'PHOENIX' ? PHOENIX_POOL_ID : 1),
        }),
      )
      setRebalanceStatus(`Submitting ${splitRoute.allocations.length} vault-owned route steps...`)
      const tx = await buildArkaRebalance(pubKey, arkaId, steps)
      const signed = await signXdr(tx)
      const hash = await submitSigned(signed)
      await waitForSorobanTx(hash)
      await refreshArka()
      receiptSteps.push({
        id: 'vault_split_rebalance',
        label: 'Vault-owned split rebalance',
        hash,
      })
      setRebalanceReceipt(
        buildSplitRebalanceExecutionReceipt({
          splitRoute,
          primaryHash: hash,
          actionLabel: 'Rebalance',
          steps: receiptSteps,
        }),
      )
      setRebalanceStatus(`Split-route rebalance completed: ${hash}`)
      return
    }

    if (selectedProtocol === 'SOROSWAP') {
      setRebalanceStatus('Submitting vault-owned SoroSwap rebalance...')
      const tx = await buildArkaRebalance(pubKey, arkaId, [
        buildVaultRebalanceStep({
          protocol: 'SOROSWAP',
          amountInBase: amount,
          minOutBase: minOut,
          pathAssets: selectedCandidate?.pathAssets,
          adapterId: selectedCandidate?.adapterId || SOROSWAP_ADAPTER,
          poolId: selectedCandidate?.poolId ?? 1,
        }),
      ])
      const signed = await signXdr(tx)
      const hash = await submitSigned(signed)
      await waitForSorobanTx(hash)
      await refreshArka()
      receiptSteps.push({ id: 'vault_rebalance', label: 'Vault-owned rebalance', hash })
      if (selectedCandidate) {
        setRebalanceReceipt(
          buildRebalanceExecutionReceipt({
            candidate: selectedCandidate,
            primaryHash: hash,
            actionLabel: 'Rebalance',
            steps: receiptSteps,
          }),
        )
      }
      setRebalanceStatus(`Rebalance completed via ${formatRebalanceProtocolLabel(selectedProtocol)}: ${hash}`)
      return
    }

    if (selectedProtocol === 'AQUARIUS') {
      setRebalanceStatus('Submitting vault-owned Aquarius rebalance...')
      const tx = await buildArkaRebalance(pubKey, arkaId, [
        buildVaultRebalanceStep({
          protocol: 'AQUARIUS',
          amountInBase: amount,
          minOutBase: minOut,
          pathAssets: selectedCandidate?.pathAssets,
          adapterId: selectedCandidate?.adapterId || AQUARIUS_ADAPTER,
          poolId: selectedCandidate?.poolId ?? 1,
        }),
      ])
      const signed = await signXdr(tx)
      const hash = await submitSigned(signed)
      await waitForSorobanTx(hash)
      await refreshArka()
      receiptSteps.push({ id: 'vault_rebalance', label: 'Vault-owned rebalance', hash })
      if (selectedCandidate) {
        setRebalanceReceipt(
          buildRebalanceExecutionReceipt({
            candidate: selectedCandidate,
            primaryHash: hash,
            actionLabel: 'Rebalance',
            steps: receiptSteps,
          }),
        )
      }
      setRebalanceStatus(`Rebalance completed via ${formatRebalanceProtocolLabel(selectedProtocol)}: ${hash}`)
      return
    }

    if(selectedProtocol==='PHOENIX')throw new Error('Phoenix has been retired from new routes.')
    if (selectedProtocol === 'SUSHI') {
      if (!SUSHI_ADAPTER) {
        throw new Error('Sushi adapter id is not declared')
      }
      setRebalanceStatus('Submitting vault-owned Sushi rebalance...')
      const tx = await buildArkaRebalance(pubKey, arkaId, [
        buildVaultRebalanceStep({
          protocol: 'SUSHI',
          amountInBase: amount,
          minOutBase: minOut,
          pathAssets: selectedCandidate?.pathAssets,
          adapterId: selectedCandidate?.adapterId || SUSHI_ADAPTER,
          poolId: selectedCandidate?.poolId ?? SUSHI_POOL_ID,
        }),
      ])
      const signed = await signXdr(tx)
      const hash = await submitSigned(signed)
      await waitForSorobanTx(hash)
      await refreshArka()
      receiptSteps.push({ id: 'vault_rebalance', label: 'Vault-owned rebalance', hash })
      if (selectedCandidate) {
        setRebalanceReceipt(
          buildRebalanceExecutionReceipt({
            candidate: selectedCandidate,
            primaryHash: hash,
            actionLabel: 'Rebalance',
            steps: receiptSteps,
          }),
        )
      }
      setRebalanceStatus(`Rebalance completed via ${formatRebalanceProtocolLabel(selectedProtocol)}: ${hash}`)
      return
    }

    if (selectedProtocol === 'BALANCED') {
      if (!balancedLaneReady) {
        throw new Error(
          balancedSupport.blockingReasons[0] ||
            'Balanced is not ready for dApp execution.',
        )
      }
      const adapterId =
        selectedCandidate?.adapterId || balancedSupport.adapterBalanced || ADAPTER_BALANCED
      const poolId =
        selectedCandidate?.poolId || balancedSupport.poolId || BALANCED_POOL_ID
      if (!adapterId) throw new Error('Balanced adapter id is not declared')
      if (!Number.isFinite(poolId) || poolId <= 0) {
        throw new Error('Balanced pool id is not declared')
      }
      setRebalanceStatus(
        selectedCandidate?.note ||
          'Submitting canonical Balanced execute to the vault receiver...',
      )
      const rx = await buildAdapterBalancedExecute(
        pubKey,
        adapterId,
        poolId,
        amount,
        minOut,
        arkaId,
      )
      const rs = await signXdr(rx)
      const rh = await submitSigned(rs)
      await waitForSorobanTx(rh)
      await refreshArka()
      receiptSteps.push({ id: 'execute', label: 'Execute', hash: rh })
      if (selectedCandidate) {
        setRebalanceReceipt(
          buildRebalanceExecutionReceipt({
            candidate: selectedCandidate,
            primaryHash: rh,
            actionLabel: 'Rebalance',
            steps: receiptSteps,
          }),
        )
      }
      setRebalanceStatus(`Rebalance completed via Balanced: ${rh}`)
      return
    }

    throw new Error(`Unsupported rebalance protocol: ${selectedProtocol}`)
  }

  const runCreditPositionAction = async (): Promise<void> => {
    assertFinancialActionsEnabled()
    if (creditReadState !== 'ready') throw new Error('Refresh the Blend position before taking an action.')
    if (!pubKey || !isManager) throw new Error('Connect the manager wallet to manage the Blend position.')
    if (!activeCreditMarketConfig) {
      throw new Error('Credit market configuration is unavailable. Refresh before submitting an action.')
    }
    const amount = toBaseUnits(Number((amountStr || '0').replace(',', '.')))
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Enter a valid positive amount.')
    if (!supportedCreditActions.includes(creditAction)) {
      throw new Error('Credit action is not enabled for the selected market')
    }
    if (creditAction === 'Borrow' && !borrowingReady) {
      throw new Error(`Borrowing is not enabled for ${formatAssetDisplayLabel(assetIn)} in this market`)
    }
    if (creditAction === 'Borrow' || creditAction === 'Withdraw') {
      // Recheck before building: the displayed snapshot may predate new debt
      // or a market restriction. The builder then simulates the exact action.
      const [liveStatus, livePositions] = await Promise.all([
        readArkaCreditMarketStatus(arkaId, creditProtocol, activeCreditMarketConfig.market_id, pubKey),
        readArkaCreditPositionValues(arkaId, creditProtocol, activeCreditMarketConfig.market_id, pubKey),
      ])
      setCreditMarketStatus(liveStatus)
      setCreditPositionValues(livePositions)
      if (isCreditActionRiskBlocked(creditAction, liveStatus, livePositions)) {
        throw new Error(creditAction === 'Borrow'
          ? 'New borrowing is paused by the market risk checks.'
          : 'This withdrawal is paused by the debt or valuation checks. Refresh the position and review its risk status.')
      }
    }
    if (creditAction === 'Repay') {
      const livePositions = await readArkaCreditPositionValues(
        arkaId,
        creditProtocol,
        activeCreditMarketConfig.market_id,
        pubKey,
      )
      const liveDebt = livePositions.find((position) => position.asset === assetIn)?.debt_amount ?? 0
      if (liveDebt <= 0) {
        throw new Error(`There is no outstanding ${formatAssetDisplayLabel(assetIn)} debt to repay`)
      }
      if (amount > liveDebt) {
        throw new Error(`Enter no more than the outstanding debt: ${formatBaseAmountWithAsset(liveDebt, assetIn)}`)
      }
    }
    setCreditError('')
    setCreditStatus(`${creditProtocol} credit ${creditAction} on market ${activeCreditMarketConfig.market_id}...`)
    const xdrB64 = await buildArkaCreditAction(pubKey, arkaId, creditProtocol, creditAction, activeCreditMarketConfig.market_id, assetIn, amount)
    const signed = await signXdr(xdrB64)
    const hash = await submitSigned(signed)
    await waitForSorobanTx(hash)
    await refreshArka()
    setCreditStatus(`${creditProtocol} credit action submitted: ${hash}`)
  }

  const isManager = Boolean(
    pubKey && (pubKey === onchainManager || pubKey === catalogArka?.manager),
  )

  const formatHolderPosition = (shares: string) => {
    if (!holderPage || !catalogArka) return { primary: 'Value unavailable', secondary: '' }
    const economics = catalogArka.economics
    const denomination = economics?.denominationAsset
    return formatHolderPositionValue({
      holderShares: shares,
      totalShares: holderPage.totalShares,
      navDenomination: economics?.navDenomination ?? catalogArka.nav,
      denominationSymbol: denomination?.symbol,
      denominationDecimals: denomination?.decimals,
      navUsdEstimate: economics?.navUsdEstimate,
    })
  }

  useEffect(() => {
    if (!arkaId) {
      setHolderPage(null)
      setHolderError('')
      setHolderLoading(false)
      setHolderPageIndex(0)
      return
    }
    const controller = new AbortController()
    setHolderLoading(true)
    setHolderError('')
    ;(async () => {
      try {
        const page = await loadArkaHoldersPage(
          arkaId,
          { offset: holderPageIndex * 10, limit: 10 },
          controller.signal,
        )
        setHolderPage(page)
      } catch (error) {
        if (!controller.signal.aborted) {
          setHolderPage(null)
          setHolderError(error instanceof Error ? error.message : 'Investor data is unavailable.')
        }
      } finally {
        if (!controller.signal.aborted) setHolderLoading(false)
      }
    })()
    return () => controller.abort()
  }, [arkaId, holderPageIndex])

  useEffect(() => {
    if (lastWorkspaceQueryValueRef.current === workspaceQueryValue) return
    lastWorkspaceQueryValueRef.current = workspaceQueryValue
    const resolvedWorkspace = resolveArkaWorkspaceId(workspaceQueryValue)
    setActiveWorkspace((current) =>
      current === resolvedWorkspace ? current : resolvedWorkspace,
    )
  }, [workspaceQueryValue])

  const buildWorkspaceHref = (workspace: ArkaWorkspaceId) => {
    const nextParams = new URLSearchParams(searchParams.toString())
    if (workspace === 'state') {
      nextParams.delete('workspace')
    } else {
      nextParams.set('workspace', workspace)
    }
    const query = nextParams.toString()
    return query
      ? `/arkas/${encodeURIComponent(arkaId)}?${query}`
      : `/arkas/${encodeURIComponent(arkaId)}`
  }

  const selectWorkspace = (workspace: ArkaWorkspaceId) => {
    lastWorkspaceQueryValueRef.current = workspace === 'state' ? null : workspace
    setActiveWorkspace(workspace)
    const nextPath = buildWorkspaceHref(workspace)
    router.replace(nextPath, { scroll: false })
  }

  const navLabel = arkaNav >= 0 ? formatHumanAmount(arkaNav / 1e7) : 'Unavailable'
  const shareLabel = sharesLoaded ? formatHumanAmount(shares / 1e7) : 'unavailable'
  const ownershipLabel = !ownershipAddress ? 'Connect wallet' : !sharesLoaded ? sharesLoadError ? 'Unavailable' : 'Checking ownership…' : totalShares !== null && totalShares > 0
    ? `${((shares / totalShares) * 100).toFixed(2)}% · ${shareLabel} shares`
    : `${shareLabel} shares`
  const amountBase = toBaseUnits(parseDecimalInput(amountStr))
  const selectedAssetLabel = formatAssetDisplayLabel(assetIn)
  const redemptionAsset = denominationAsset || assetIn
  const denominationLabel = formatAssetDisplayLabel(redemptionAsset)
  const redeemFeeBps = catalogArka?.economics?.fees.redeemBps ?? catalogArka?.fees.redeemBps ?? 0
  const maximumRedemptionBase = totalShares !== null
    ? estimateMaximumRedemption({
        navBase: arkaNav,
        totalSharesBase: totalShares,
        userSharesBase: shares,
        redeemFeeBps,
      })
    : null
  const requestedRedemptionBase = toBaseUnits(parseDecimalInput(redeemAmountStr))
  const redemptionQuote = totalShares !== null
    ? quoteRedemptionByDenominationAmount({
        requestedNetOutBase: requestedRedemptionBase,
        navBase: arkaNav,
        totalSharesBase: totalShares,
        userSharesBase: shares,
        redeemFeeBps,
      })
    : null
  const maximumRedemptionLabel = maximumRedemptionBase !== null
    ? formatBaseAmountWithAsset(maximumRedemptionBase, redemptionAsset)
    : 'unavailable'
  const withdrawableNowBase = estimateWithdrawableNow(maximumRedemptionBase, redemptionCashBase)
  const exceedsCash = redemptionCashBase !== null && redemptionQuote !== null && redemptionQuote.estimatedNetOutBase > redemptionCashBase
  const redemptionInputError = !ownershipAddress || !sharesLoaded
    ? undefined
    : requestedRedemptionBase <= 0
    ? 'Enter a positive amount.'
    : !redemptionQuote
      ? `Enter no more than your available position: ${maximumRedemptionLabel}.`
      : exceedsCash
        ? 'The fund has less cash than this amount. Choose a smaller amount or ask the manager to restore liquidity.'
      : undefined
  const draftAmountLabel = formatInputAmountWithAsset(amountStr || '0', assetIn)
  const walletAssetBalanceLabel = formatBaseAmountWithAsset(walletBalances[assetIn] || 0, assetIn)
  const vaultActionConfirmed = isVaultActionConfirmed(vaultStatus)
  const creditUnknownLabel = creditReadState === 'loading' ? 'Checking…' : 'Unavailable'
  const creditHealthFactorLabel = creditReadState !== 'ready' || !creditMarketStatus ? creditUnknownLabel : creditDebtFree
    ? 'No debt'
    : creditMarketStatus.health_factor > 0 ? formatHumanAmount(creditMarketStatus.health_factor / 1e7) : 'Debt detected; check health'
  const selectedCreditPosition = creditPositionValues.find((position) => position.asset === assetIn)
  const selectedCreditCollateralBase = selectedCreditPosition?.collateral_amount ?? 0
  const selectedCreditDebtBase = selectedCreditPosition?.debt_amount ?? 0
  const selectedCreditNetBase = selectedCreditPosition?.net_value ?? 0
  const selectedCreditLiquidBase = arkaBalances[assetIn] || 0
  const creditMarketAssetLabels = creditSelectableAssets
    .map(formatAssetDisplayLabel)
    .filter((label, index, labels) => labels.indexOf(label) === index)
  const creditMarketDisplayName = creditMarketAssetLabels.length > 0
    ? `${creditProtocol} · ${creditMarketAssetLabels.join(' / ')}`
    : creditProtocol
  const creditActionMaxBase = creditAction === 'Supply'
    ? selectedCreditLiquidBase
    : creditAction === 'Repay'
      ? Math.min(selectedCreditLiquidBase, selectedCreditDebtBase)
      : creditAction === 'Withdraw'
        ? selectedCreditCollateralBase
        : 0
  const creditLiquidKnown = creditReadState === 'ready' && Object.hasOwn(arkaBalances, assetIn)
  const creditValuationKnown = creditReadState === 'ready' && Boolean(denominationAsset) && !creditMarketStatus?.has_invalid_oracle_data && !creditMarketStatus?.has_future_oracle_timestamp && !creditMarketStatus?.has_stale_oracle
  const canFillCreditMaximum = creditReadState === 'ready' && creditLiquidKnown && creditAction !== 'Borrow' && creditActionMaxBase > 0
  const creditAmountHint = creditReadState !== 'ready' ? 'Balances must finish loading before an action.' : creditAction === 'Borrow'
    ? `Enter the amount to borrow in ${formatAssetDisplayLabel(assetIn)}.`
    : creditAction === 'Withdraw'
      ? `Supplied: ${formatBaseAmountWithAsset(selectedCreditCollateralBase, assetIn)}`
      : creditAction === 'Repay'
        ? `Outstanding debt: ${formatBaseAmountWithAsset(selectedCreditDebtBase, assetIn)}`
        : `Available in this Arka: ${creditLiquidKnown ? formatBaseAmountWithAsset(selectedCreditLiquidBase, assetIn) : 'Unavailable'}`
  const routeSummaryCandidate = useMemo(
    () => {
      if (
        routePlan.selectedCandidate?.available &&
        routePlan.selectedCandidate.estimatedOutBase > 0
      ) {
        return routePlan.selectedCandidate
      }
      const candidate = routePlan.candidates.find(
        (item) => item.protocol === routePlan.selectedProtocol,
      )
      return candidate?.available && candidate.estimatedOutBase > 0 ? candidate : null
    },
    [routePlan],
  )
  const routeIsResolving = /resolving live route quotes/i.test(routePlan.note)
  const routeEstimatedOutBase = routeSummaryCandidate?.estimatedOutBase ?? routePlan.estimatedOutBase
  const routeMinimumOutBase = routeSummaryCandidate?.minOutBase ?? routePlan.minOutBase
  const routeHasQuote = Boolean(
    routeSummaryCandidate?.available && routeEstimatedOutBase > 0,
  )
  const routeHasMinimum = routeHasQuote && routeMinimumOutBase > 0
  const liveRouteCandidates = routePlan.candidates.filter(
    (candidate) => candidate.available && candidate.estimatedOutBase > 0,
  )
  const liveProtocolLabels = Array.from(
    new Set(liveRouteCandidates.map((candidate) => formatRebalanceProtocolLabel(candidate.protocol))),
  )
  const routeDecisionCopy = formatUserRouteDecision(
    routePlan.note,
    routeSummaryCandidate,
    protocol,
  )
  const routeUnavailableMessage = amountBase > 0 && !routeIsResolving && !routeHasQuote
    ? `No swap route is available for ${formatAssetDisplayLabel(assetIn)} to ${formatAssetDisplayLabel(assetOut)} at this amount. Try a different amount or pair. Your wallet opens only when a route is ready to sign.`
    : ''
  const routeRiskLabel =
    routeIsResolving
      ? 'Comparing'
      : !routeHasQuote
        ? 'Unavailable'
        : routePlan.guardrails?.status === 'blocked'
      ? 'Reduce amount'
      : routePlan.guardrails?.checks.some((check) => check.status === 'requires_state')
        ? 'Checked when signing'
        : routeHasMinimum
          ? 'Ready'
          : 'Unavailable'
  const routeRiskTone =
    routePlan.guardrails?.status === 'blocked'
      ? 'warning'
      : routeRiskLabel === 'Ready'
        ? 'positive'
        : 'neutral'
  const routeTradeLimits = useMemo(() => {
    const policy = routePlan.guardrails?.policy
    if (!policy) return null
    const dailyCheck = routePlan.guardrails?.checks.find(
      (check) => check.id === 'daily_turnover_cap_bps',
    )
    const navBase = dailyCheck?.evidence?.vaultNavBase ?? (arkaNav > 0 ? arkaNav : 0)
    const dailyCapBase = dailyCheck?.evidence?.turnoverCapBase
      ?? (navBase > 0 ? Math.floor((navBase * policy.dailyTurnoverCapBps) / 10_000) : 0)
    const dailyUsedBase = dailyCheck?.evidence?.dailyTurnoverUsedBase
      ?? guardrailActivityState.dailyTurnoverUsedBase
      ?? 0
    const dailyRemainingBase = Math.max(0, dailyCapBase - dailyUsedBase)
    const allocationShiftBase = navBase > 0
      ? Math.floor((navBase * policy.postTradeDeviationBps) / 10_000)
      : 0
    const valueAsset = denominationAsset || assetIn
    const immediateCeilings = [
      policy.maxNotionalPerSwapBase,
      allocationShiftBase,
      dailyRemainingBase,
    ].filter((value) => value > 0)

    return {
      allocationPercent: formatPolicyPercent(policy.postTradeDeviationBps),
      allocationShiftBase,
      dailyPercent: formatPolicyPercent(policy.dailyTurnoverCapBps),
      dailyCapBase,
      dailyRemainingBase,
      maxNowBase: immediateCeilings.length > 0 ? Math.min(...immediateCeilings) : 0,
      splitThresholdBase: policy.chunkingThresholdBase,
      maxChunkSizeBase: policy.maxChunkSizeBase,
      valueAsset,
    }
  }, [arkaNav, assetIn, denominationAsset, guardrailActivityState.dailyTurnoverUsedBase, routePlan.guardrails])
  const routeLimitMessage = useMemo(() => {
    if (!routeHasQuote || routePlan.guardrails?.status !== 'blocked') return ''
    const blockedIds = new Set(
      routePlan.guardrails.checks
        .filter((check) => check.status === 'blocked')
        .map((check) => check.id),
    )
    if (blockedIds.has('emergency_pause_swap')) {
      return 'Swaps are temporarily paused for this Arka.'
    }
    if (!routeTradeLimits) {
      return 'This amount exceeds the current trading limits. Enter a smaller amount.'
    }
    const messages: string[] = []
    if (
      routeTradeLimits.maxNowBase > 0 &&
      (blockedIds.has('post_trade_deviation_bps') ||
        blockedIds.has('daily_turnover_cap_bps') ||
        blockedIds.has('max_notional_per_swap'))
    ) {
      messages.push(
        `Maximum for this swap: ${formatBaseAmountWithAsset(routeTradeLimits.maxNowBase, routeTradeLimits.valueAsset)}.`,
      )
    }
    if (blockedIds.has('daily_turnover_cap_bps')) {
      messages.push(
        `${formatBaseAmountWithAsset(routeTradeLimits.dailyRemainingBase, routeTradeLimits.valueAsset)} remains available today.`,
      )
    }
    if (blockedIds.has('chunking_threshold') || blockedIds.has('max_chunk_size')) {
      messages.push(
        `Orders above ${formatBaseAmountWithAsset(routeTradeLimits.splitThresholdBase, assetIn)} require split execution, with up to ${formatBaseAmountWithAsset(routeTradeLimits.maxChunkSizeBase, assetIn)} per part.`,
      )
    }
    if (blockedIds.has('max_path_length') || blockedIds.has('forbid_route_cycles')) {
      messages.push('No eligible route is available for this pair at the selected amount.')
    }
    return messages.length > 0
      ? messages.join(' ')
      : 'This amount exceeds the current trading limits. Enter a smaller amount.'
  }, [assetIn, routeHasQuote, routePlan.guardrails, routeTradeLimits])
  const selectedRouteTitle =
    routeSummaryCandidate?.title ??
    (protocol === 'AUTO' ? 'Best execution' : formatRebalanceProtocolLabel(routePlan.selectedProtocol))
  const estimatedReceiveLabel = routeHasQuote
    ? formatBaseAmountWithAsset(routeEstimatedOutBase, assetOut)
    : routeIsResolving
      ? 'Comparing...'
      : 'Not available'
  const minimumReceiveLabel = routeHasMinimum
    ? formatBaseAmountWithAsset(routeMinimumOutBase, assetOut)
    : routeIsResolving
      ? 'Comparing...'
      : 'Not available'
  const reviewedMinimumLabel = routeHasMinimum
    ? `${formatBaseAmountForInput(routeMinimumOutBase)} ${formatAssetDisplayLabel(assetOut)}`
    : minimumReceiveLabel
  const routeImpactLabel = formatRouteImpactLabel(routeSummaryCandidate, liveRouteCandidates)
  const routeImpactContext = formatRouteImpactContext(routeSummaryCandidate, liveRouteCandidates)
  const routeComparedLabel =
    liveRouteCandidates.length > 0
      ? `${liveRouteCandidates.length} live ${liveRouteCandidates.length === 1 ? 'route' : 'routes'}`
      : 'No live routes'
  const selectedInputBalanceBase =
    (walletRoutedRebalance ? walletBalances[assetIn] : arkaBalances[assetIn]) || 0
  const managerProfileId = onchainManager || catalogArka?.manager || ''
  const arkaStrategyDescription = catalogArka?.identity?.description?.trim() ?? ''
  const arkaDisplayName = catalogArka
    ? resolveArkaDisplayName(catalogArka)
    : formatContractLabel(arkaId, 12, 8)
  const arkaDisplayDescription = arkaStrategyDescription
    ? arkaStrategyDescription
    : 'No public strategy profile has been published yet.'
  const managementWorkspace = activeWorkspace === 'rebalance' || activeWorkspace === 'credit'
  const visibleWorkspaceTabs = ARKA_WORKSPACE_TABS.filter(tab => managementWorkspace ? tab.id === 'rebalance' || tab.id === 'credit' : tab.id === 'state' || tab.id === 'flow')

  return (
    <main className={`surface-stack arka-detail-shell ux-role-separated ${managementWorkspace ? 'ux-manager-workspace' : 'ux-investor-workspace'} ${activeWorkspace === 'rebalance' ? 'ux-compact-swap-workspace' : ''}`}>
      <section className="surface-panel arka-stage-panel" data-testid="arka-stage-panel">
        <div className="arka-stage-topline">
          <div className="arka-stage-identity">
            <span className="surface-eyebrow">{managementWorkspace ? 'Fund management' : 'Your investment'}</span>
            <h1 className="arka-stage-title">{arkaDisplayName}</h1>
            <p className="surface-description arka-stage-description ux-strategy-summary">
              {arkaDisplayDescription}
            </p>
            <div className="surface-chip-wrap arka-stage-chip-row">
              <StatusPill label={isManager ? "Manager access" : pubKey ? "Investor" : "View only"} tone={isManager ? "positive" : "neutral"} />
              <StatusPill label={pubKey ? "Wallet connected" : "Connect wallet"} tone={pubKey ? "positive" : "warning"} />
              {holderPage ? (
                <StatusPill
                  label={formatInvestorCountLabel(holderPage.total, holderPage.complete)}
                  tone="neutral"
                />
              ) : null}
            </div>
          </div>
          <div className="surface-actions arka-stage-actions">
            <Link href={`/vaults/${encodeURIComponent(arkaId)}`} className="surface-button surface-button-secondary">
              Open Arka profile
            </Link>
            <Link
              href={buildWorkspaceHref('flow')}
              className="surface-button surface-button-primary"
              data-testid="arka-open-deposit-workspace"
              onClick={(event) => {
                event.preventDefault()
                selectWorkspace('flow')
              }}
            >
              Deposit or withdraw
            </Link>
          </div>
        </div>

        <div className="ux-role-switch" aria-label="Investor and manager workspaces">
          <Link href={buildWorkspaceHref('flow')} className={!managementWorkspace ? 'ux-role-active' : ''} onClick={event=>{event.preventDefault();selectWorkspace('flow')}}>Invest in this fund</Link>
          <Link href={buildWorkspaceHref('rebalance')} className={managementWorkspace ? 'ux-role-active' : ''} onClick={event=>{event.preventDefault();selectWorkspace('rebalance')}}>Manage fund portfolio</Link>
        </div>
        <p className="ux-role-explanation">{managementWorkspace ? 'Changes here move assets owned by the fund and affect all its investors. Only the fund manager can sign. This is not a personal wallet swap.' : 'Deposit from your wallet or withdraw your investment. You do not need to be the fund manager.'}</p>

        <nav
          className="detail-tab-row vault-detail-tab-row arka-detail-tab-row arka-workspace-tabs"
          data-testid="arka-workspace-tabs"
          aria-label="Arka actions"
        >
          {visibleWorkspaceTabs.map((tab) => (
            <Link
              key={tab.id}
              href={buildWorkspaceHref(tab.id)}
              role="button"
              className={`detail-tab ${activeWorkspace === tab.id ? 'detail-tab-active' : ''}`}
              aria-pressed={activeWorkspace === tab.id}
              data-testid={`arka-workspace-tab-${tab.id}`}
              onClick={(event) => {
                event.preventDefault()
                selectWorkspace(tab.id)
              }}
            >
              {tab.id === 'flow' ? 'Deposit & withdraw' : tab.id === 'rebalance' ? 'Change fund assets' : tab.label}
            </Link>
          ))}
        </nav>

        <dl className="arka-stage-summary-list" data-testid="arka-stage-summary-list">
          <div className="arka-stage-summary-row">
            <dt>Vault value</dt>
            <dd>
              {arkaNav >= 0
                ? denominationAsset
                  ? `${navLabel} ${formatAssetDisplayLabel(denominationAsset)}`
                  : navLabel
                : 'Unavailable'}
            </dd>
          </div>
          <div className="arka-stage-summary-row">
            <dt>My ownership</dt>
            <dd>{ownershipLabel}</dd>
          </div>
          <div className="arka-stage-summary-row">
            <dt>{managementWorkspace ? 'Fund cash for withdrawals' : 'My investments'}</dt>
            <dd>{managementWorkspace ? redemptionCashBase !== null ? formatBaseAmountWithAsset(redemptionCashBase, redemptionAsset) : cashLoading ? 'Checking cash…' : 'Cash unavailable' : <Link href="/investments">View all my holdings</Link>}</dd>
          </div>
        </dl>

      </section>

      {activeWorkspace === 'state' ? (
      <section className="surface-grid arka-action-stack" data-testid="arka-state-workspace">
        <div>
        <Panel title="Arka details" subtitle="Manager, strategy and share token" testId="arka-state-panel">
          <SurfaceTable
            testId="arka-state-table"
            className="arka-state-table"
            columnsClassName="arka-state-table"
            headers={['Profile', 'Details']}
          >
            <div className="surface-table-row arka-state-table">
              <div className="surface-table-cell surface-table-cell-strong">Arka name</div>
              <div className="surface-table-cell">{arkaDisplayName}</div>
            </div>
            <div className="surface-table-row arka-state-table">
              <div className="surface-table-cell surface-table-cell-strong">Strategy, risk and target return</div>
              <div className="surface-table-cell surface-table-subtle">
                {arkaStrategyDescription || 'Not published yet. The manager can add it from the Arka profile.'}
              </div>
            </div>
            <div className="surface-table-row arka-state-table">
              <div className="surface-table-cell surface-table-cell-strong">Manager profile</div>
              <div className="surface-table-cell">
                {managerProfileId ? (
                  <Link
                    href={`/managers/${encodeURIComponent(managerProfileId)}`}
                    className="surface-table-link"
                  >
                    Open manager profile
                  </Link>
                ) : (
                  'Loading'
                )}
              </div>
            </div>
          </SurfaceTable>
          <details className="credit-market-details arka-contract-details" data-testid="arka-contract-details">
            <summary>Contract details</summary>
            <dl className="credit-position-list credit-market-detail-list">
              <div className="credit-position-row">
                <dt>Arka contract</dt>
                <dd className="ops-mono">{arkaId}</dd>
              </div>
              <div className="credit-position-row">
                <dt>Manager address</dt>
                <dd className="ops-mono">{onchainManager || 'Unavailable'}</dd>
              </div>
              <div className="credit-position-row">
                <dt>Share token</dt>
                <dd className="ops-mono">{shareTokenId || 'Unavailable'}</dd>
              </div>
            </dl>
          </details>
        </Panel>
        </div>

        {isManager ? (
          <div>
            <Panel
              title="Investors"
              subtitle="Current ownership of this Arka"
              testId="arka-investors-panel"
            >
              {holderLoading ? (
                <p className="surface-empty-copy" data-testid="arka-investors-loading">
                  Loading investors...
                </p>
              ) : holderError ? (
                <p className="surface-empty-copy" data-testid="arka-investors-error">
                  Investor data is temporarily unavailable.
                </p>
              ) : holderPage && holderPage.items.length > 0 ? (
                <>
                  {!holderPage.complete ? (
                    <p className="surface-note" data-testid="arka-investors-indexing-note">
                      Earlier holder history is still being indexed. Balances shown below were verified on-chain.
                    </p>
                  ) : null}
                  <p className="surface-note" data-testid="arka-investors-verification-note">
                    Last on-chain verification: {holderPage.indexedAt}.
                    {holderPage.stale ? (holderPage.refreshFailed
                      ? ' Balance refresh is delayed; showing the last verified balances.'
                      : ' Refreshing balances; showing the last verified balances.') : null}
                  </p>
                  <SurfaceTable
                    testId="arka-investors-table"
                    columnsClassName="arka-investors-table"
                    headers={['Investor', 'Ownership', 'Position value']}
                  >
                    {holderPage.items.map((entry) => {
                      const position = formatHolderPosition(entry.shares)
                      return (
                      <div className="surface-table-row arka-investors-table" key={entry.holder}>
                        <div className="surface-table-cell surface-table-cell-strong ops-mono" data-label="Investor" title={entry.holder}>
                          {formatContractLabel(entry.holder, 10, 8)}
                        </div>
                        <div className="surface-table-cell" data-label="Ownership">
                          {(entry.ownershipBps / 100).toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          })}%
                        </div>
                        <div className="surface-table-cell arka-investor-position" data-label="Position value">
                          <strong>{position.primary}</strong>
                          {position.secondary ? <span>{position.secondary}</span> : null}
                        </div>
                      </div>
                    )})}
                  </SurfaceTable>
                  {holderPage.total > holderPage.limit ? (
                    <nav
                      className="surface-pagination"
                      aria-label="Investor pages"
                      data-testid="arka-investors-pagination"
                    >
                      <button
                        type="button"
                        className="surface-button surface-button-secondary"
                        disabled={holderPageIndex === 0}
                        onClick={() => setHolderPageIndex((page) => Math.max(0, page - 1))}
                      >
                        Previous
                      </button>
                      <span aria-live="polite">
                        Page {holderPageIndex + 1} of {Math.ceil(holderPage.total / holderPage.limit)}
                      </span>
                      <button
                        type="button"
                        className="surface-button surface-button-secondary"
                        disabled={(holderPageIndex + 1) * holderPage.limit >= holderPage.total}
                        onClick={() => setHolderPageIndex((page) => page + 1)}
                      >
                        Next
                      </button>
                    </nav>
                  ) : null}
                </>
              ) : (
                <p className="surface-empty-copy" data-testid="arka-investors-empty">
                  No investor balances are currently recorded.
                </p>
              )}
            </Panel>
          </div>
        ) : null}

      </section>
      ) : null}

      {activeWorkspace === 'flow' ? (
      <section className="surface-grid arka-action-stack" data-testid="arka-flow-workspace">
        <div>
        <Panel title="Deposit or withdraw" subtitle="Move money between your wallet and this fund. Shares track your ownership; they are not the same as XLM or USDC." testId="arka-flow-panel">
          <nav className="ux-task-entrypoints" aria-label="Investment actions"><a className="surface-button surface-button-secondary" href="#deposit-investment">Deposit</a><a className="surface-button surface-button-primary" href="#withdraw-investment">Withdraw</a></nav>
          {!pubKey && ownershipAddress ? <p className="ops-alert ops-alert-warning">Viewing public address {formatContractLabel(ownershipAddress,8,5)}. This is a read-only lookup, not a wallet connection.</p> : !pubKey ? <p className="surface-note">Connect your wallet to check your position and prepare a withdrawal.</p> : null}
          <div className="arka-capital-section" id="deposit-investment">
          <h3 className="arka-capital-section-title">Deposit</h3>
          <div className="ops-form-grid">
            <ActionField
              label="Asset"
              hint={depositPricesLoading
                ? 'Checking which assets are available for deposit...'
                : depositAvailabilityLabel
                  ? `Available for deposit: ${depositAvailabilityLabel}. ${pubKey ? `Selected balance: ${walletAssetBalanceLabel}.` : 'Connect your wallet to check your balance.'}`
                  : 'No assets currently have a live valuation for deposits.'}
              span
            >
              <select data-testid="arka-asset-select" className="ops-select" value={assetIn} onChange={e=>selectAssetIn(e.target.value)}>
                {vaultSelectableAssets.map((asset) => (
                  <option
                    key={asset}
                    value={asset}
                    disabled={!depositPricesLoading && !isCatalogAssetPriceUsable(depositPricesByAsset[asset])}
                  >
                    {isCatalogAssetPriceUsable(depositPricesByAsset[asset])
                      ? pubKey ? `${formatBaseAmountWithAsset(walletBalances[asset] || 0, asset)} available` : `${formatAssetDisplayLabel(asset)} · connect wallet to see balance`
                      : `${formatAssetDisplayLabel(asset)} · pricing unavailable`}
                  </option>
                ))}
              </select>
            </ActionField>
            <ActionField
              label={`Amount in ${selectedAssetLabel}`}
              hint={`Enter the amount in ${selectedAssetLabel}, for example 5 ${selectedAssetLabel}.`}
              error={amountBase <= 0 ? 'Enter a positive amount.' : undefined}
              span
            >
              <input data-testid="arka-amount-input" className="ops-input" value={amountStr} onChange={e=>setAmountStr(e.target.value)} placeholder={`e.g. 5 ${selectedAssetLabel}`} inputMode="decimal" aria-invalid={amountBase <= 0} />
            </ActionField>
          </div>
          {!depositPricesLoading && !selectedDepositAssetUsable ? (
            <div className="ops-alert ops-alert-warning" data-testid="arka-deposit-pricing-warning">
              A live valuation is not available for {selectedAssetLabel}, so it cannot be deposited yet.
            </div>
          ) : null}
          <div className="ops-action-row">
            <button data-testid="arka-deposit-button" className="surface-button surface-button-primary" disabled={UX_REVIEW_PREVIEW || !pubKey || vaultActionPending || depositPricesLoading || !selectedDepositAssetUsable} onClick={()=>runVaultAction('The deposit could not be completed.', async()=>{
                if(!pubKey) return; const amt=toBaseUnits(parseDecimalInput(amountStr)); const actionAmountLabel = formatBaseAmountWithAsset(amt, assetIn); if(amt<=0) throw new Error('Invalid amount');
                const available = walletBalances[assetIn] || 0
                if (available > 0 && amt > available) throw new Error('Amount exceeds wallet balance for selected asset')
                const allowance = await readTokenAllowance(assetIn, pubKey, arkaId, pubKey)
                if (allowance < amt) {
                  setVaultStatus(`Approving ${actionAmountLabel}`); const ax=await buildTokenApprove(pubKey, assetIn, arkaId, amt); const s=await signXdr(ax); const h=await submitSigned(s); setVaultStatus(`Confirming allowance for ${actionAmountLabel}`); await waitForSorobanTx(h)
                  setVaultStatus('Confirming allowance...')
                  await waitForRequiredAllowance(assetIn, pubKey, arkaId, amt)
                }
                setVaultStatus(`Submitting deposit of ${actionAmountLabel}`); const dx=await buildArkaDeposit(pubKey, arkaId, assetIn, amt); const ds=await signXdr(dx); const dh=await submitSigned(ds); setVaultStatus(`Confirming deposit of ${actionAmountLabel}`); await waitForSorobanTx(dh); await refreshArka(); setVaultStatus(`Deposit confirmed: ${actionAmountLabel} · tx ${formatTransactionHashLabel(dh)}`)
            })}>{`Deposit ${draftAmountLabel}`}</button>
          </div>
          </div>
          <div className="arka-capital-section" id="withdraw-investment" data-testid="arka-redeem-section">
            <h3 className="arka-capital-section-title">Withdraw to your wallet</h3>
            <dl className="ux-withdrawal-balances" data-testid="withdrawal-balances"><div><dt>Your position value, estimated</dt><dd>{ownershipAddress && sharesLoaded ? maximumRedemptionLabel : ownershipAddress ? sharesLoadError ? 'Position unavailable' : 'Checking position…' : 'Connect wallet'}</dd></div><div><dt>Fund cash in {denominationLabel}, shared by all investors</dt><dd>{redemptionCashBase !== null ? formatBaseAmountWithAsset(redemptionCashBase, redemptionAsset) : cashLoading ? 'Checking cash…' : 'Cash unavailable'}</dd></div><div><dt>Estimated amount available now</dt><dd>{ownershipAddress && sharesLoaded && withdrawableNowBase !== null ? formatBaseAmountWithAsset(withdrawableNowBase, redemptionAsset) : 'Not yet available'}</dd></div></dl>
            <button className="surface-button surface-button-secondary" onClick={()=>void refreshArka().catch(()=>{})}>Refresh position and cash</button>
            <p className="surface-note">A withdrawal pays {denominationLabel} to your wallet and burns the required shares. Fund assets in other tokens are not automatically sold. Cash is shared, fees can accrue, and the amount must pass a fresh simulation before signing.</p>
            <div className="ops-form-grid">
              <ActionField
                label={`Amount to withdraw in ${denominationLabel}`}
                hint="Enter the value you want returned to your wallet. The required shares are calculated automatically."
                error={redemptionInputError}
                span
              >
                <input
                  data-testid="arka-redeem-amount-input"
                  className="ops-input"
                  value={redeemAmountStr}
                  onChange={event => setRedeemAmountStr(event.target.value)}
                  placeholder={`e.g. 3 ${denominationLabel}`}
                  inputMode="decimal"
                  aria-invalid={Boolean(redemptionInputError)}
                />
              </ActionField>
            </div>
            {redemptionQuote ? (
              <p className="surface-note" data-testid="arka-redemption-quote">
                This will redeem {formatHumanAmount(redemptionQuote.sharesToRedeemBase / 10_000_000)} shares for about {formatBaseAmountWithAsset(redemptionQuote.estimatedNetOutBase, redemptionAsset)}.
              </p>
            ) : null}
            <div className="ops-action-row">
              <button data-testid="arka-redeem-button" className="surface-button surface-button-primary" disabled={UX_REVIEW_PREVIEW || !pubKey || vaultActionPending || !redemptionQuote || redemptionCashBase === null || exceedsCash} onClick={()=>runVaultAction('The redemption could not be completed.', async()=>{
                  if(!pubKey || !redemptionQuote) return; const sh=redemptionQuote.sharesToRedeemBase; const shareAmountLabel = `${formatHumanAmount(sh / 10_000_000)} shares`; const valueLabel = formatBaseAmountWithAsset(redemptionQuote.estimatedNetOutBase, redemptionAsset); setVaultStatus(`Submitting redemption of about ${valueLabel}`); const rx=await buildArkaRedeem(pubKey, arkaId, sh); const rs=await signXdr(rx); const rh=await submitSigned(rs); setVaultStatus(`Confirming redemption of about ${valueLabel}`); await waitForSorobanTx(rh); await refreshArka(); setVaultStatus(`Redemption confirmed: about ${valueLabel} (${shareAmountLabel}) · tx ${formatTransactionHashLabel(rh)}`)
              })}>{`Withdraw ${formatHumanAmount(parseDecimalInput(redeemAmountStr || '0'))} ${denominationLabel}`}</button>
              <button className="surface-button surface-button-secondary" data-testid="arka-use-available-button" disabled={!sharesLoaded || withdrawableNowBase === null || withdrawableNowBase <= 0} onClick={()=>setRedeemAmountStr(String((withdrawableNowBase || 0) / 1e7))}>Use available amount</button>
              <button data-testid="arka-redeem-all-button" className="surface-button surface-button-secondary" disabled={UX_REVIEW_PREVIEW || !pubKey || vaultActionPending || shares <= 0 || maximumRedemptionBase === null || redemptionCashBase === null || maximumRedemptionBase > redemptionCashBase} onClick={()=>runVaultAction('The redemption could not be completed.', async()=>{
                  if(!pubKey) return; if (shares<=0 || maximumRedemptionBase === null) throw new Error('No redeemable position'); const shareAmountLabel = `${formatHumanAmount(shares / 10_000_000)} shares`; const valueLabel = formatBaseAmountWithAsset(maximumRedemptionBase, redemptionAsset); setVaultStatus(`Submitting redemption of about ${valueLabel}`); const rx=await buildArkaRedeem(pubKey, arkaId, shares); const rs=await signXdr(rx); const rh=await submitSigned(rs); setVaultStatus(`Confirming redemption of about ${valueLabel}`); await waitForSorobanTx(rh); await refreshArka(); setVaultStatus(`Redemption confirmed: about ${valueLabel} (${shareAmountLabel}) · tx ${formatTransactionHashLabel(rh)}`)
              })}>Withdraw entire position</button>
            </div>
            {UX_REVIEW_PREVIEW ? <p className="surface-note">Read-only UX preview: you can review estimates, but no transaction can be signed or sent.</p> : null}
          </div>
          <TransactionFeedbackRail
            loading={vaultActionPending}
            loadingLabel={vaultStatus || 'Submitting vault action...'}
            status={vaultActionConfirmed ? vaultStatus : ''}
            error={vaultError}
            statusTestId="vault-status"
            errorTestId="vault-error"
          />
        </Panel>
        </div>
      </section>
      ) : null}

      {activeWorkspace === 'rebalance' ? (
      <section className="surface-grid arka-action-stack" data-testid="arka-rebalance-workspace">
          <div>
          <Panel className="ux-compact-swap-panel" title="Change fund assets" subtitle={`Swap assets owned by ${arkaDisplayName}. Both the input and output belong to the fund, not your personal wallet.`} testId="arka-rebalance-panel">
            <FundSwapReview
              snapshotKey={JSON.stringify([arkaId,pubKey,protocol,assetIn,assetOut,amountStr,slippageStr,advanced,minOutStr,routeMinimumOutBase,routeEstimatedOutBase,selectedRouteTitle,routePlan.guardrails?.status])}
              fundName={arkaDisplayName}
              pays={`${formatBaseAmountForInput(toBaseUnits(parseDecimalInput(amountStr)))} ${formatAssetDisplayLabel(assetIn)}`}
              receives={estimatedReceiveLabel}
              minimum={reviewedMinimumLabel}
              route={routeSummaryCandidate ? formatRebalanceProtocolLabel(routeSummaryCandidate.protocol) : selectedRouteTitle}
              canReview={!routeIsResolving && routeHasQuote && routeHasMinimum && routePlan.guardrails?.status !== 'blocked' && toBaseUnits(parseDecimalInput(amountStr)) > 0 && assetIn !== assetOut}
              canSign={isManager}
              onConfirm={async()=>{
                try {
                  setRebalanceError('')
                  await runRebalance(routeMinimumOutBase)
                } catch (e) {
                  setRebalanceError(describeError(e, 'The swap could not be completed.'))
                  setRebalanceStatus('')
                }
              }}
            >
            {!isManager ? (
              <div className="ops-alert ops-alert-warning">
                Connect the manager wallet to make a swap. Route estimates remain available for review.
              </div>
            ) : null}
            <div className={`ops-form-grid ux-swap-form ${advanced ? 'ux-swap-advanced-open' : ''}`}>
              <div hidden={!advanced} className="ops-field-span">
              <ActionField label="Protocol" hint="Choose a protocol or let Best execution compare the available routes." span>
                <select data-testid="rebalance-protocol-select" className="ops-select" value={protocol} onChange={e=>setProtocol(e.target.value as RebalanceProtocol)}>
                  <option value="AUTO">Best execution</option>
                  <option value="SOROSWAP">SoroSwap</option>
                  <option value="AQUARIUS">Aquarius</option>
                  <option value="SUSHI" disabled={!SUSHI_ADAPTER}>Sushi</option>
                  <option value="BALANCED">Balanced</option>
                </select>
              </ActionField>
              </div>
              <div className="ux-swap-token ux-swap-pay">
              <ActionField label="The fund pays">
                <select data-testid="rebalance-asset-in-select" className="ops-select" value={assetIn} onChange={e=>selectAssetIn(e.target.value)}>
                  {vaultSelectableAssets.map((asset) => (
                    <option
                      key={`rebalance-in-${asset}`}
                      value={asset}
                      disabled={((walletRoutedRebalance ? walletBalances[asset] : arkaBalances[asset]) || 0) === 0}
                    >
                      {formatAssetDisplayLabel(asset)}
                    </option>
                  ))}
                </select>
              </ActionField>
              <ActionField label="Amount to swap">
                <input data-testid="rebalance-amount-input" className="ops-input" value={amountStr} onChange={e=>setAmountStr(e.target.value)} inputMode="decimal" />
              </ActionField>
              <p className="ux-swap-balance">Fund balance: {Object.prototype.hasOwnProperty.call(arkaBalances,assetIn) ? formatBaseAmountWithAsset(selectedInputBalanceBase,assetIn) : 'Checking fund balance…'}</p>
              </div>
              <div className="ux-swap-direction" aria-hidden="true">↓</div>
              <div className="ux-swap-token ux-swap-receive">
              <ActionField label="The fund receives">
                <select data-testid="rebalance-asset-out-select" className="ops-select" value={assetOut} onChange={e=>selectAssetOut(e.target.value)}>
                  {vaultSelectableAssets.map((asset) => (
                    <option key={`rebalance-out-${asset}`} value={asset}>
                      {formatAssetDisplayLabel(asset)}
                    </option>
                  ))}
                </select>
              </ActionField>
              <output className="ux-swap-output" aria-live="polite" data-testid="compact-swap-receive"><span>Estimated to the fund</span><strong>{estimatedReceiveLabel}</strong></output>
              </div>
              <div className="ux-swap-minimum"><span>Minimum received</span><strong>{reviewedMinimumLabel}</strong></div>
              <div hidden={!advanced} className="ops-field-span">
              <ActionField label="Slippage %" hint="The maximum price movement you accept before the swap is cancelled.">
                <input data-testid="rebalance-slippage-input" className="ops-input" value={slippageStr} onChange={e=>setSlippageStr(e.target.value)} inputMode="decimal" />
              </ActionField>
              </div>
              {routeTradeLimits ? (
                <details className="surface-data-item ops-field-span rebalance-trade-limits" data-testid="rebalance-trade-limits" open={advanced}>
                  <summary>Trading limits · {routeTradeLimits.allocationPercent} per swap · {routeTradeLimits.dailyPercent} daily cap</summary>
                  <div className="rebalance-trade-limit-row">
                    <span>Per swap</span>
                    <strong>
                      {routeTradeLimits.allocationPercent}
                      {routeTradeLimits.allocationShiftBase > 0
                        ? ` · about ${formatBaseAmountWithAsset(routeTradeLimits.allocationShiftBase, routeTradeLimits.valueAsset)}`
                        : ''}
                    </strong>
                  </div>
                  <div className="rebalance-trade-limit-row">
                    <span>Available today</span>
                    <strong>
                      {routeTradeLimits.dailyPercent}
                      {routeTradeLimits.dailyCapBase > 0
                        ? ` · ${formatBaseAmountWithAsset(routeTradeLimits.dailyRemainingBase, routeTradeLimits.valueAsset)}`
                        : ''}
                    </strong>
                  </div>
                  <div className="rebalance-trade-limit-row">
                    <span>Larger swaps</span>
                    <strong>
                      Split above {formatBaseAmountWithAsset(routeTradeLimits.splitThresholdBase, assetIn)} · up to {formatBaseAmountWithAsset(routeTradeLimits.maxChunkSizeBase, assetIn)} per part
                    </strong>
                  </div>
                </details>
              ) : null}
              <div className="surface-data-item ops-field-span rebalance-route-review" data-testid="rebalance-estimate">
                <div className="rebalance-route-summary-card" data-testid="rebalance-route-summary">
                  <div className="rebalance-route-summary-head">
                    <div>
                      <span className="surface-table-hint">Route</span>
                      <strong>{advanced || !routeSummaryCandidate ? selectedRouteTitle : formatRebalanceProtocolLabel(routeSummaryCandidate.protocol)}</strong>
                      <span className="surface-note" hidden={!advanced}>{routeDecisionCopy}</span>
                    </div>
                    <StatusPill label={routeRiskLabel} tone={routeRiskTone} />
                  </div>
                  {routeLimitMessage ? (
                    <div className="ops-alert ops-alert-warning" data-testid="rebalance-limit-message">
                      {routeLimitMessage}
                    </div>
                  ) : null}
                  {routeUnavailableMessage ? (
                    <div className="ops-alert ops-alert-warning" data-testid="rebalance-route-unavailable-message">
                      {routeUnavailableMessage}
                    </div>
                  ) : null}
                  <div className="rebalance-route-summary-grid">
                    <div>
                      <span className="surface-list-label">Est. receive</span>
                      <strong>{estimatedReceiveLabel}</strong>
                    </div>
                    <div>
                      <span className="surface-list-label">Minimum receive</span>
                      <strong>{minimumReceiveLabel}</strong>
                    </div>
                    <div>
                      <span className="surface-list-label">Input balance</span>
                      <strong>{formatBaseAmountWithAsset(selectedInputBalanceBase, assetIn)}</strong>
                    </div>
                    <div>
                      <span className="surface-list-label">Slippage</span>
                      <strong>{slippageStr || '0'}%</strong>
                    </div>
                    <div>
                      <span className="surface-list-label">Price impact</span>
                      <strong>{routeImpactLabel}</strong>
                      <span className="surface-table-subtle">{routeImpactContext}</span>
                    </div>
                  </div>
                  {routeHasQuote && routeHasMinimum ? <p className="surface-note" data-testid="swap-effective-tolerance">The minimum is {((1-routeMinimumOutBase/routeEstimatedOutBase)*100).toFixed(2)}% below this estimate, including configured safety buffers. This is price protection, not a platform fee.</p> : null}
                  {advanced ? <div className="rebalance-route-summary-meta">
                    <span>Path: {routeSummaryCandidate ? formatRebalanceRoutePath(routeSummaryCandidate.pathAssets) : formatRebalanceRoutePath([assetIn, assetOut])}</span>
                    <span>Markets checked: {routeComparedLabel}</span>
                    <span>Venues: {liveProtocolLabels.join(', ') || 'No quoted venues'}</span>
                    {routeSummaryCandidate?.protocol === 'BALANCED' || protocol === 'BALANCED' ? (
                      <span>
                        Balanced: {balancedSupport.supportStatus === 'ready' ? 'Ready' : balancedSupport.supportStatus === 'blocked' ? 'Review required' : 'Unavailable'}
                      </span>
                    ) : null}
                  </div> : null}
                </div>
                  {advanced ? <div className="ops-inline-grid" data-testid="rebalance-route-candidates">
                  {routePlan.routeSearch ? (
                    <div className="surface-note" data-testid="rebalance-route-search">
                      <strong>Markets compared</strong>
                      {`: ${routePlan.routeSearch.venuesCompared.length.toLocaleString()} venues checked, ${routePlan.routeSearch.liveQuoteCount.toLocaleString()} quoted, up to ${routePlan.routeSearch.deepestQuotedHops.toLocaleString()} hops.`}
                    </div>
                  ) : null}
                  {routePlan.splitRoute ? (
                    <div className="surface-note" data-testid="rebalance-split-route">
                      <strong>Execution plan</strong>
                      {routePlan.splitRoute.status === 'recommended'
                        ? `: Recommended across ${routePlan.splitRoute.allocationCount.toLocaleString()} routes. Estimated receive ${formatBaseAmountWithAsset(routePlan.splitRoute.totalEstimatedOutBase, assetOut)}, minimum ${formatBaseAmountWithAsset(routePlan.splitRoute.totalMinOutBase, assetOut)}.`
                        : ': Single route selected.'}
                      {' '}
                      {routePlan.splitRoute.allocations
                        .map((allocation) =>
                          `${formatRebalanceProtocolLabel(allocation.protocol)} ${(
                            allocation.amountShareBps / 100
                          ).toFixed(2)}% ${formatBaseAmountWithAsset(allocation.amountInBase, assetIn)} -> ${formatBaseAmountWithAsset(allocation.estimatedOutBase, assetOut)} via ${allocation.pathLabel}`,
                        )
                        .join(" · ")}
                    </div>
                  ) : null}
                  {routePlan.guardrails ? (
                    <div className="surface-note" data-testid="rebalance-guardrail-evaluation">
                      <strong>Trade limits</strong>
                      {`: ${routeRiskLabel}. `}
                      {routePlan.guardrails.checks
                        .map((check) => `${check.label}: ${formatGuardrailStatus(check.status, check.id)}`)
                        .join(" · ")}
                    </div>
                  ) : null}
                  <div className="surface-note" data-testid="rebalance-guardrail-state-source">
                    <strong>Turnover window</strong>
                    {guardrailActivityState.source === 'catalog_activity'
                      ? `: Recent turnover is included in daily limits. ${guardrailActivityState.includedEventCount}/${guardrailActivityState.eventCount} events counted.`
                      : ': Turnover limits refresh before signing.'}
                  </div>
                  {routePlan.candidates.map((candidate) => (
                    <div key={candidate.routeId} className="surface-note">
                      <strong>{candidate.title}</strong>
                      {`: ${formatRouteAvailability(candidate)} · ${candidate.available ? `receive ${formatBaseAmountWithAsset(candidate.estimatedOutBase, assetOut)}` : 'quote not available'} · ${candidate.pathLabel}`}
                    </div>
                  ))}
                </div> : null}
                {advanced && (routeSummaryCandidate?.protocol === 'BALANCED' || protocol === 'BALANCED') ? (
                  <div className="ops-inline-grid" data-testid="rebalance-intent-handoff">
                    <div className="surface-note" data-testid="rebalance-intent-handoff-summary">
                      <strong>Balanced intent route</strong>
                      {balancedIntentDriver.comparableQuote
                        ? ': Quote and status are available for route review.'
                        : ': Review only until a comparable quote and completion status are available.'}
                    </div>
                    <div className="surface-note" data-testid="rebalance-intent-handoff-route">
                      Balanced uses intent execution, so signing should happen only when amount, minimum receive and completion status are clear.
                    </div>
                    <div className="surface-note" data-testid="rebalance-intent-handoff-steps">
                      {balancedIntentHandoff.steps
                        .map((step) => `${step.label}: ${formatIntentExecutionHandoffStepStateLabel(step.state)}`)
                        .join(' · ')}
                    </div>
                    <div className="surface-chip-wrap" data-testid="rebalance-intent-handoff-links">
                      {balancedIntentHandoff.primaryAction ||
                      balancedIntentHandoff.supportingLinks.length > 0 ? (
                        <>
                          {balancedIntentHandoff.primaryAction ? (
                            <a
                              href={balancedIntentHandoff.primaryAction.href}
                              target="_blank"
                              rel="noreferrer"
                              className="surface-chip"
                            >
                              {balancedIntentHandoff.primaryAction.label}
                            </a>
                          ) : null}
                          {balancedIntentHandoff.supportingLinks.map((link) => (
                            <a
                              key={link.id}
                              href={link.href}
                              target="_blank"
                              rel="noreferrer"
                              className="surface-chip"
                            >
                              {link.label}
                            </a>
                          ))}
                        </>
                      ) : (
                        <span className="surface-note">
                          Balanced links are not available in this environment.
                        </span>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
              {advanced ? <div className="surface-data-item">
                <div data-testid="rebalance-balance-in" data-base-units={arkaBalances[assetIn] || 0}>
                  Input balance: {formatBaseAmountWithAsset(arkaBalances[assetIn] || 0, assetIn)}
                </div>
                <div data-testid="rebalance-balance-out" data-base-units={arkaBalances[assetOut] || 0}>
                  Output balance: {formatBaseAmountWithAsset(arkaBalances[assetOut] || 0, assetOut)}
                </div>
              </div> : null}
              {advanced && (
                <ActionField label="Min out (override)" hint="Optional manual floor in the selected output token.">
                  <input data-testid="rebalance-min-out-input" className="ops-input" value={minOutStr} onChange={e=>setMinOutStr(e.target.value)} inputMode="decimal" />
                </ActionField>
              )}
              <label className="discover-toggle ops-field-span ux-swap-options-toggle"><input type="checkbox" checked={advanced} onChange={e=>setAdvanced(e.target.checked)} /> Advanced: route, costs & price protection</label>
              {advanced ? <p className="surface-note">Network cost is calculated during simulation before the wallet opens. No network cost has been estimated in this quote.</p> : null}
            </div>
            </FundSwapReview>
            <p className="surface-note">{UX_REVIEW_PREVIEW ? 'Read-only preview. Quotes can be reviewed, but signing and sending are disabled.' : 'The manager wallet signs for the fund. A fresh quote and simulation run before the wallet opens.'}</p>
            <TransactionFeedbackRail
              loading={rebalanceStatus.toLowerCase().includes('submitting') || rebalanceStatus.toLowerCase().includes('running') || rebalanceStatus.toLowerCase().includes('broadcast')}
              loadingLabel={rebalanceStatus || 'Submitting swap...'}
              status={rebalanceStatus && rebalanceStatus.toLowerCase().includes('completed') ? rebalanceStatus : ''}
              error={rebalanceError}
              statusTestId="arka-status"
              errorTestId="rebalance-error"
            />
            {rebalanceReceipt ? (
              <div className="surface-entry-card" data-testid="rebalance-receipt-panel">
                <div className="surface-entry-head">
                  <div>
                    <div className="surface-entry-title">Execution receipt</div>
                    <div className="surface-note" data-testid="rebalance-receipt-summary">
                      {rebalanceReceipt.summary}
                    </div>
                  </div>
                  <StatusPill label={formatRebalanceVenueFamilyLabel(rebalanceReceipt.venueFamily)} tone="positive" />
                </div>
                <div className="surface-list">
                  <div className="surface-list-row">
                    <div>
                      <div className="surface-table-cell-strong">Action</div>
                      <div className="surface-table-subtle">{rebalanceReceipt.actionLabel}</div>
                    </div>
                    <span className="surface-table-hint">{rebalanceReceipt.venueTitle}</span>
                  </div>
                  <div className="surface-list-row">
                    <div>
                      <div className="surface-table-cell-strong">Path model</div>
                      <div className="surface-table-subtle">{formatRebalancePathModelLabel(rebalanceReceipt.pathModel)}</div>
                    </div>
                    <span className="surface-table-hint">{formatRebalanceConfirmationModelLabel(rebalanceReceipt.confirmationModel)}</span>
                  </div>
                  <div className="surface-list-row">
                    <div>
                      <div className="surface-table-cell-strong">Primary hash</div>
                      <div className="surface-table-subtle ops-mono" data-testid="rebalance-receipt-primary-hash">{rebalanceReceipt.primaryHash}</div>
                    </div>
                    <span className="surface-table-hint">{rebalanceReceipt.submittedAt}</span>
                  </div>
                </div>
                <div className="surface-note">{rebalanceReceipt.detail}</div>
                <div className="surface-list" data-testid="rebalance-receipt-steps">
                  {rebalanceReceipt.steps.map((step) => (
                    <div key={step.id} className="surface-list-row">
                      <div>
                        <div className="surface-table-cell-strong">{step.label}</div>
                      </div>
                      <span className="surface-table-subtle ops-mono">{step.hash}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Panel>
          </div>
      </section>
      ) : null}

      {activeWorkspace === 'credit' ? (
      <section className="surface-grid arka-action-stack" data-testid="arka-credit-workspace">
          <div>
          <Panel
            title="Blend"
            subtitle="Manage the fund's Blend position. Withdrawing here returns assets to the fund, not to your personal wallet. To withdraw your investment, use Deposit & withdraw."
            testId="arka-credit-panel"
          >
            {activeCreditMarketConfig ? (
              <div className="credit-market-line" data-testid="credit-market-name">
                <span>Market</span>
                <strong>{creditMarketDisplayName}</strong>
              </div>
            ) : null}
            {!isManager ? (
              <div className="ops-alert ops-alert-warning">
                Connect the manager wallet to use Blend. You can still view the current position.
              </div>
            ) : null}
            <div className="ops-action-row ux-credit-refresh">
              <p className="surface-note" role="status" data-testid="credit-read-status">{creditReadState === 'loading' ? 'Checking the selected market and fund position…' : creditReadState === 'error' ? 'Position data is incomplete. Unknown balances are not zero; actions stay unavailable until refreshed.' : 'Position checked. Market and fund risk checks still apply to every transaction.'}</p>
              <button type="button" className="surface-button surface-button-secondary" disabled={creditReadState === 'loading' || creditActionPending} onClick={() => void refreshArka().catch(() => {})}>Refresh Blend position</button>
            </div>
            {creditConfigurationError ? (
              <div className="ops-alert ops-alert-warning" data-testid="credit-configuration-unavailable">
                {creditConfigurationError}
              </div>
            ) : null}
            {creditAction === 'Borrow' && activeCreditMarketConfig?.allow_borrow && !creditBorrowPolicy ? (
              <div className="ops-alert ops-alert-warning" data-testid="credit-borrow-policy-unavailable">
                Borrowing is not enabled for {formatAssetDisplayLabel(assetIn)} in this market.
              </div>
            ) : null}
            {creditAction === 'Borrow' && activeCreditMarketConfig?.allow_borrow && creditBorrowPolicy && !blendBorrowConfigurationReady ? (
              <div className="ops-alert ops-alert-warning" data-testid="credit-borrow-source-unavailable">
                Borrowing setup is not complete for this market yet.
              </div>
            ) : null}
            {creditMarketStatus?.has_invalid_oracle_data || creditMarketStatus?.has_future_oracle_timestamp || creditMarketUnavailable ? (
              <div className="ops-alert ops-alert-critical" data-testid="credit-integrity-banner">
                Market restrictions apply. Review the checks for the selected action.
                {creditMarketStatus?.has_invalid_oracle_data ? ' Its price is unavailable.' : ''}
                {creditMarketStatus?.has_future_oracle_timestamp ? ' Its price update is not valid yet.' : ''}
                {creditMarketStatus?.has_disabled_reserve ? ' The reserve is unavailable.' : ''}
                {creditMarketUnavailable && !creditMarketStatus?.has_disabled_reserve ? ' New borrowing is restricted.' : ''}
              </div>
            ) : null}
            {creditMarketStatus?.has_stale_oracle ? (
              <div className="ops-alert ops-alert-critical" data-testid="credit-risk-banner">
                Market pricing is out of date. New borrowing and withdrawals that require a debt health check remain restricted. Every action still needs a valid contract simulation.
              </div>
            ) : null}
            {!creditMarketStatus?.has_stale_oracle && creditMarketStatus?.debt_value && creditRiskPolicy && creditMarketStatus.health_factor < creditRiskPolicy.min_health_factor ? (
              <div className="ops-alert ops-alert-warning" data-testid="credit-health-warning">
                This position is below its safety threshold. Borrowing and withdrawals with outstanding debt remain restricted until it is made safer.
              </div>
            ) : null}

            <dl className="credit-position-list" data-testid="credit-position-summary">
              <div className="credit-position-row">
                <dt>Available in Arka</dt>
                <dd data-testid="credit-liquid-live">{creditLiquidKnown ? formatBaseAmountWithAsset(selectedCreditLiquidBase, assetIn) : creditUnknownLabel}</dd>
              </div>
              <div className="credit-position-row">
                <dt>Supplied to Blend</dt>
                <dd data-testid="credit-collateral-live">{creditReadState === 'ready' ? formatBaseAmountWithAsset(selectedCreditCollateralBase, assetIn) : creditUnknownLabel}</dd>
              </div>
              <div className="credit-position-row">
                <dt>Borrowed</dt>
                <dd data-testid="credit-debt-live">{creditReadState === 'ready' ? formatBaseAmountWithAsset(selectedCreditDebtBase, assetIn) : creditUnknownLabel}</dd>
              </div>
              <div className="credit-position-row">
                <dt>Position health</dt>
                <dd data-testid="credit-health-factor">
                  {creditHealthFactorLabel}
                </dd>
              </div>
              <div className="credit-position-row credit-position-row-secondary">
                <dt>Net value in fund currency</dt>
                <dd data-testid="credit-net-live">{creditValuationKnown ? formatBaseAmountWithAsset(selectedCreditNetBase, denominationAsset) : creditReadState === 'loading' ? 'Checking…' : 'Valuation unavailable'}</dd>
              </div>
            </dl>

            {activeCreditMarketConfig && supportedCreditActions.length > 0 ? (
            <section className="credit-action-shell" aria-labelledby="credit-action-heading">
              <div className="credit-action-heading">
                <div>
                  <span className="surface-table-hint">Action</span>
                  <h3 id="credit-action-heading">What would you like to do?</h3>
                </div>
              </div>

              <div className="credit-action-picker" role="group" aria-label="Blend action" data-testid="credit-action-picker">
                {supportedCreditActions.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    className={`credit-action-option ${creditAction === entry ? 'credit-action-option-active' : ''}`}
                    aria-pressed={creditAction === entry}
                    data-testid={`credit-action-${entry.toLowerCase()}`}
                    disabled={creditActionPending}
                    onClick={() => setCreditAction(entry)}
                  >
                    {entry}
                  </button>
                ))}
              </div>

              <p className="credit-action-description">{CREDIT_ACTION_COPY[creditAction]}</p>
              {creditReadState === 'ready' && (creditMarketStatus?.risky_actions_blocked || creditMarketStatus?.nav_blocked) ? (
                <p className="surface-note" role="status" data-testid="credit-action-restriction">
                  {creditAction === 'Borrow' ? 'New borrowing is paused by the market risk checks.'
                    : creditAction === 'Withdraw' ? creditActionRiskBlocked
                      ? 'This withdrawal is paused by the debt or valuation checks.'
                      : 'No outstanding debt was found in this market. Returning assets to the fund can be reviewed; live contract checks still apply.'
                    : 'Borrowing restrictions do not automatically block supplying or repaying. Live contract checks still apply.'}
                </p>
              ) : null}

              <div className="ops-form-grid credit-form-grid">
              {creditProtocols.length > 1 ? (
                <ActionField label="Protocol" hint="Choose the lending protocol.">
                <select data-testid="credit-protocol-select" className="ops-select" value={creditProtocols.length > 0 ? creditProtocol : ''} disabled={creditActionPending || creditProtocols.length === 0} onChange={e=>setCreditProtocol(e.target.value as CreditProtocol)}>
                  {creditProtocols.map((entry) => (
                    <option key={entry} value={entry}>{entry}</option>
                  ))}
                </select>
                </ActionField>
              ) : null}
              {creditMarketConfigs.length > 1 ? (
                <ActionField label="Market" hint="Choose a Blend market.">
                <select
                  aria-label="Blend market"
                  data-testid="credit-market-select"
                  className="ops-select"
                  value={activeCreditMarketConfig ? String(creditMarketId) : ''}
                  disabled={creditActionPending || creditMarketConfigs.length === 0}
                  onChange={e=>setCreditMarketId(Number(e.target.value))}
                >
                  {creditMarketConfigs.map((config) => (
                    <option key={config.market_id} value={String(config.market_id)}>
                      {config.market_id === activeCreditMarketConfig?.market_id
                        ? creditMarketDisplayName
                        : `${config.protocol} market`}
                    </option>
                    ))}
                </select>
                </ActionField>
              ) : null}
              <ActionField label="Asset" hint="Choose the asset for this action.">
                <select aria-label="Blend asset" data-testid="credit-asset-select" className="ops-select" value={assetIn} disabled={creditActionPending} onChange={e=>selectAssetIn(e.target.value)}>
                  {creditSelectableAssets.map((asset) => (
                    <option key={asset} value={asset}>{formatAssetDisplayLabel(asset)}</option>
                  ))}
                </select>
              </ActionField>
              <ActionField label="Amount" hint={creditAmountHint} span>
                <div className="credit-amount-control">
                  <input
                    data-testid="credit-amount-input"
                    disabled={creditActionPending}
                    className="ops-input"
                    value={amountStr}
                    onChange={e=>setAmountStr(e.target.value)}
                    inputMode="decimal"
                    aria-label={`Amount in ${formatAssetDisplayLabel(assetIn)}`}
                  />
                  {canFillCreditMaximum ? (
                    <button
                      type="button"
                      className="credit-maximum-button"
                      data-testid={creditAction === 'Repay' ? 'credit-repay-full' : 'credit-fill-maximum'}
                      disabled={creditActionPending}
                      onClick={() => setAmountStr(formatBaseAmountForInput(creditActionMaxBase))}
                    >
                      Maximum
                    </button>
                  ) : null}
                </div>
                {creditAction === 'Repay' ? (
                  <span className="surface-table-subtle" data-testid="credit-outstanding-debt">
                    Outstanding debt: {creditReadState === 'ready' ? formatBaseAmountWithAsset(selectedCreditDebtBase, assetIn) : creditUnknownLabel}
                  </span>
                ) : null}
              </ActionField>
              </div>

              {creditAction === 'Borrow' && creditBorrowPolicy ? (
                <p className="credit-limit-note" data-testid="credit-borrow-policy">
                  Borrow up to {formatBaseAmountWithAsset(creditBorrowPolicy.max_borrow_per_action, assetIn)} per transaction.
                </p>
              ) : null}

              <p className="credit-action-review" data-testid="arka-credit-review-card">
                <strong>{CREDIT_ACTION_BUTTON_COPY[creditAction]}</strong>
                <span>{draftAmountLabel}</span>
              </p>

              <button
                data-testid="credit-run-button"
                className="surface-button surface-button-primary credit-submit-button"
                disabled={UX_REVIEW_PREVIEW || creditActionPending || creditReadState !== 'ready' || !isManager || !activeCreditMarketConfig || !supportedCreditActions.includes(creditAction) || (creditAction === 'Borrow' && !borrowingReady) || creditActionRiskBlocked}
                onClick={async()=>{
                if (creditActionPendingRef.current) return
                creditActionPendingRef.current = true
                setCreditActionPending(true)
                try {
                  setCreditError('')
                  await runCreditPositionAction()
                } catch (e) {
                  setCreditError(describeError(e, 'The Blend action could not be completed.'))
                  setCreditStatus('')
                } finally {
                  creditActionPendingRef.current = false
                  setCreditActionPending(false)
                }
              }}>{creditActionPending ? 'Waiting for confirmation…' : CREDIT_ACTION_BUTTON_COPY[creditAction]}</button>
              {UX_REVIEW_PREVIEW ? <p className="surface-note">Review only: Blend transactions are disabled in this preview.</p> : null}
            </section>
            ) : null}

            {activeCreditMarketConfig ? (
            <details className="credit-market-details" data-testid="credit-market-details">
              <summary>Market details</summary>
              <dl className="credit-position-list credit-market-detail-list">
                <div className="credit-position-row">
                  <dt>Assets</dt>
                  <dd>{creditMarketAssetLabels.join(' / ') || 'Unavailable'}</dd>
                </div>
                <div className="credit-position-row">
                  <dt>Prices</dt>
                  <dd data-testid="credit-oracle-age">
                    {creditReadState !== 'ready' || !creditMarketStatus ? creditUnknownLabel : creditMarketStatus.has_invalid_oracle_data || creditMarketStatus.has_future_oracle_timestamp ? 'Invalid / unavailable' : creditMarketStatus.has_stale_oracle ? 'Out of date' : 'Up to date'}
                  </dd>
                </div>
                <div className="credit-position-row">
                  <dt>New borrowing</dt>
                  <dd data-testid="credit-pool-status">
                    {creditReadState !== 'ready' || !creditMarketStatus ? creditUnknownLabel : creditMarketStatus.risky_actions_blocked ? 'Paused' : 'Subject to transaction checks'}
                  </dd>
                </div>
                <div className="credit-position-row">
                  <dt>Return assets to fund</dt>
                  <dd data-testid="credit-withdraw-status">
                    {creditReadState !== 'ready' || !creditMarketStatus ? creditUnknownLabel
                      : isCreditActionRiskBlocked('Withdraw', creditMarketStatus, creditPositionValues) ? 'Paused by debt / valuation checks'
                      : creditDebtFree ? 'No debt; subject to transaction checks' : 'Subject to debt and transaction checks'}
                  </dd>
                </div>
                {creditRiskPolicy ? (
                  <div className="credit-position-row" data-testid="credit-risk-policy">
                    <dt>Minimum health</dt>
                    <dd>{formatHumanAmount(creditRiskPolicy.min_health_factor / 1e7)}</dd>
                  </div>
                ) : null}
                {creditBorrowPolicy ? (
                  <div className="credit-position-row">
                    <dt>Total borrowing limit</dt>
                    <dd>{formatBaseAmountWithAsset(creditBorrowPolicy.max_debt_for_asset, assetIn)}</dd>
                  </div>
                ) : null}
              </dl>

              {creditPositionValues.length > 1 ? (
                <div className="surface-table surface-table-panel credit-all-assets-table">
                  <div className="surface-table-header credit-position-table">
                    <div>Asset</div>
                    <div>Supplied</div>
                    <div>Borrowed</div>
                    <div>Net</div>
                    <div>Price</div>
                  </div>
                  {creditPositionValues.map((position) => (
                    <div key={position.asset} className="surface-table-row credit-position-table">
                      <div className="surface-table-cell" data-testid={`credit-asset-row-${position.asset}`}>{formatAssetDisplayLabel(position.asset)}</div>
                      <div className="surface-table-cell" data-testid={`credit-collateral-live-${position.asset}`}>{formatBaseAmountWithAsset(position.collateral_amount, position.asset)}</div>
                      <div className="surface-table-cell" data-testid={`credit-debt-live-${position.asset}`}>{formatBaseAmountWithAsset(position.debt_amount, position.asset)}</div>
                      <div className="surface-table-cell" data-testid={`credit-net-live-${position.asset}`}>{creditValuationKnown ? formatBaseAmountWithAsset(position.net_value, denominationAsset) : 'Valuation unavailable'}</div>
                      <div className="surface-table-cell" data-testid={`credit-price-${position.asset}`}>{formatHumanAmount(position.price / 1e7)}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </details>
            ) : null}

            <TransactionFeedbackRail
              loading={creditStatus.toLowerCase().includes('building') || creditStatus.toLowerCase().includes('submitting') || creditStatus.toLowerCase().includes('blend credit')}
              loadingLabel={creditStatus || 'Submitting credit action...'}
              status={creditStatus && creditStatus.toLowerCase().includes('submitted') ? creditStatus : ''}
              error={creditError}
              statusTestId="credit-status"
              errorTestId="credit-error"
            />
          </Panel>
          </div>
      </section>
      ) : null}
    </main>
  )
}

export default function VersionedArkaPage(){return <V3VersionBoundary><RecordedArkaDispatcher/></V3VersionBoundary>;}
