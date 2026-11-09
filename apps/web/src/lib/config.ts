export const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'Test SDF Network ; September 2015'
export const SOROBAN_RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org'

export const SOROSWAP_ROUTER = process.env.NEXT_PUBLIC_SOROSWAP_ROUTER ?? 'CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD'
export const SOROSWAP_ADAPTER = process.env.NEXT_PUBLIC_SOROSWAP_ADAPTER ?? 'CAYJYQRBFCMKUP2W3MQKRC5WARH6FH66AVXBUR6GB3FTGU4EQX5JPXFU'
export const AQUARIUS_ROUTER = process.env.NEXT_PUBLIC_AQUARIUS_ROUTER ?? 'CBCFTQSPDBAIZ6R6PJQKSQWKNKWH2QIV3I4J72SHWBIK3ADRRAM5A6GD'
export const PHOENIX_ADAPTER = process.env.NEXT_PUBLIC_PHOENIX_ADAPTER ?? 'CCCDYVAMNJUCCBIPBIWDHFJCBWOAP5DMO57BUD6JG6S5UTHDARGDFVFO'
export const PHOENIX_POOL_ID = Number(process.env.NEXT_PUBLIC_PHOENIX_POOL_ID ?? '1')
export const BALANCED_ROUTER_MOCK = process.env.NEXT_PUBLIC_BALANCED_ROUTER_MOCK ?? 'CAHF53IIWUVKFOJ4H7OHIB667NEU7MTC3YUHSIZWETFXXPAI6DS75HQK'
export const BALANCED_EXPECTED_ROUTER = process.env.NEXT_PUBLIC_BALANCED_EXPECTED_ROUTER ?? ''
export const BALANCED_SUPPORT_STATUS =
  process.env.NEXT_PUBLIC_BALANCED_SUPPORT_STATUS ?? 'blocked'
export const BALANCED_LANE_MODE =
  process.env.NEXT_PUBLIC_BALANCED_LANE_MODE ?? 'undeclared'
export const ADAPTER_BALANCED = process.env.NEXT_PUBLIC_ADAPTER_BALANCED ?? 'CDYF5QMFETJPMJZVLO7ZRL2KA4B4Y7F24Z33HH62NJL3GEQQXXLCCRLC'
export const BALANCED_POOL_ID = Number(process.env.NEXT_PUBLIC_BALANCED_POOL_ID ?? '1')
export const BALANCED_DEFAULT_TOKEN_IN_SYMBOL =
  process.env.NEXT_PUBLIC_BALANCED_DEFAULT_TOKEN_IN_SYMBOL ??
  process.env.NEXT_PUBLIC_DENOMINATION_LABEL ??
  process.env.NEXT_PUBLIC_ROUTING_ASSET_A_LABEL ??
  'TOKEN_IN'
export const BALANCED_DEFAULT_TOKEN_OUT_SYMBOL =
  process.env.NEXT_PUBLIC_BALANCED_DEFAULT_TOKEN_OUT_SYMBOL ??
  process.env.NEXT_PUBLIC_DENOMINATION_LABEL ??
  process.env.NEXT_PUBLIC_ROUTING_ASSET_B_LABEL ??
  'TOKEN_OUT'
export const ROUTING_ASSET_A = process.env.NEXT_PUBLIC_ROUTING_ASSET_A ?? 'CAAIY7IRSBFZ6XGRVYMXMSZDJQSRB5HC6HV7MEGCGMSKP67MVC3Q32LL'
export const ROUTING_ASSET_B = process.env.NEXT_PUBLIC_ROUTING_ASSET_B ?? 'CBZ6ISRQ6QU4OJZTA54MRSFWVVEUR45Z62Q3YHCHK7E62XOY7RLSRI75'
export const ROUTING_ASSET_A_LABEL = process.env.NEXT_PUBLIC_ROUTING_ASSET_A_LABEL ?? 'Input asset'
export const ROUTING_ASSET_B_LABEL = process.env.NEXT_PUBLIC_ROUTING_ASSET_B_LABEL ?? 'Output asset'
export const ROUTING_PAIR_LABEL = `${ROUTING_ASSET_A_LABEL} -> ${ROUTING_ASSET_B_LABEL}`
export const BLEND_MARKET_ASSETS = (
  process.env.NEXT_PUBLIC_BLEND_MARKET_ASSETS ?? `${ROUTING_ASSET_A},${ROUTING_ASSET_B}`
)
  .split(',')
  .map((asset) => asset.trim())
  .filter((asset, index, assets) => Boolean(asset) && assets.indexOf(asset) === index)
export const PRODUCT_SURFACE_LABEL =
  process.env.NEXT_PUBLIC_PRODUCT_SURFACE_LABEL ?? 'Arkas'
export const CURATED_ONLY_LABEL =
  process.env.NEXT_PUBLIC_CURATED_ONLY_LABEL ?? 'Curated only'
export const ALL_ARKAS_LABEL =
  process.env.NEXT_PUBLIC_ALL_ARKAS_LABEL ?? 'All Arkas'
export const VAULT_TAB_POPULAR_LABEL =
  process.env.NEXT_PUBLIC_VAULT_TAB_POPULAR_LABEL ?? 'Popular Arkas'
export const VAULT_TAB_CURATED_LABEL =
  process.env.NEXT_PUBLIC_VAULT_TAB_CURATED_LABEL ?? 'Curated Arkas'
export const VAULT_TAB_NEW_LABEL =
  process.env.NEXT_PUBLIC_VAULT_TAB_NEW_LABEL ?? 'New Arkas'
export const DASHBOARD_TAB_DEPOSITS_LABEL =
  process.env.NEXT_PUBLIC_DASHBOARD_TAB_DEPOSITS_LABEL ?? 'My deposits'
export const DASHBOARD_TAB_ARKAS_LABEL =
  process.env.NEXT_PUBLIC_DASHBOARD_TAB_ARKAS_LABEL ?? 'My Arkas'
export const DASHBOARD_TAB_ACTIVITY_LABEL =
  process.env.NEXT_PUBLIC_DASHBOARD_TAB_ACTIVITY_LABEL ?? 'Activity'
export const ASSETS_TAB_CORE_LABEL =
  process.env.NEXT_PUBLIC_ASSETS_TAB_CORE_LABEL ?? 'Core assets'
export const ASSETS_TAB_BALANCE_SHEET_LABEL =
  process.env.NEXT_PUBLIC_ASSETS_TAB_BALANCE_SHEET_LABEL ?? 'Balance sheet'
export const ASSETS_TAB_SEARCH_AWARE_LABEL =
  process.env.NEXT_PUBLIC_ASSETS_TAB_SEARCH_AWARE_LABEL ?? 'Search-aware ranking'
export const STATUS_CURATED_LABEL =
  process.env.NEXT_PUBLIC_STATUS_CURATED_LABEL ?? 'Curated'
export const STATUS_INDEXED_LABEL =
  process.env.NEXT_PUBLIC_STATUS_INDEXED_LABEL ?? 'Listed'
export const STATUS_DELISTED_LABEL =
  process.env.NEXT_PUBLIC_STATUS_DELISTED_LABEL ?? 'Delisted'
export const MANAGERS_TAB_LEAD_LABEL =
  process.env.NEXT_PUBLIC_MANAGERS_TAB_LEAD_LABEL ?? 'Lead managers'
export const MANAGERS_TAB_CURATED_LABEL =
  process.env.NEXT_PUBLIC_MANAGERS_TAB_CURATED_LABEL ?? 'Curated mandates'
export const MANAGERS_TAB_SEARCH_AWARE_LABEL =
  process.env.NEXT_PUBLIC_MANAGERS_TAB_SEARCH_AWARE_LABEL ?? 'Search-aware ranking'
export const MANAGER_DETAIL_CURATED_ARKAS_LABEL =
  process.env.NEXT_PUBLIC_MANAGER_DETAIL_CURATED_ARKAS_LABEL ?? 'Curated Arkas'

// Multi-Arka: no fixed ARKA_ID at app level
export const ARKA_ID = process.env.NEXT_PUBLIC_ARKA_ID ?? 'CA5KVVH4WBL2EQE5TEQWMX5T7KN4B2A2KSICUDC6IEK5IWJ22ML7DFDA'
export const AQUARIUS_ADAPTER = process.env.NEXT_PUBLIC_AQUARIUS_ADAPTER ?? 'CDEWNICQBSXNRBC7FKO5KZX7YID4KLF7OA3GXAGZ3QEGUJTD733L3ZMV'
export const ARKA_MANAGER = process.env.NEXT_PUBLIC_ARKA_MANAGER ?? 'GCZ57QGTW5HKXI7KAS5XXIV3FQM5P4PJQ2BRIE6QC6TWHQ6RWQBR3CWT'
export const ARKA_FACTORY = process.env.NEXT_PUBLIC_ARKA_FACTORY ?? 'CAZPR5MIUHXH46ZJ5OAMRZXD7PXIHMF5HHSSKQPDUBEXVID5SAGSZ3HW'
export const ARKA_ROUTER = process.env.NEXT_PUBLIC_ARKA_ROUTER ?? 'CB273QHT7GISJF4EW434UY3K6IWTOINAKN6B7NZPAVRBYSERZ2QFBVAQ'
export const ARKA_REGISTRY = process.env.NEXT_PUBLIC_ARKA_REGISTRY ?? 'CD7NVBDWH7YDCAJGPESKANQMQGNC2FCNX7WBUIRWWKF4QI5NMPRP22NW'
export const ORACLE_GUARD =
  process.env.NEXT_PUBLIC_ORACLE_GUARD ?? 'CBVIUEY2C627QSVCKNC4XSVSHRH3DTRK6HQOBOQVJBIXKUKJDH5E22BZ'

// Denomination token (SAC) contract id used as baseline denomination in UI/workflows.
export const DENOMINATION = process.env.NEXT_PUBLIC_DENOMINATION ?? ROUTING_ASSET_A
export const DENOMINATION_LABEL = process.env.NEXT_PUBLIC_DENOMINATION_LABEL ?? ''

const MAINNET_NETWORK_PASSPHRASE = 'Public Global Stellar Network ; September 2015'
const TESTNET_SIM_ACCOUNT = 'GCO7KAJ7WCIFDLAEDHKSFQRNQLR3SQ6JTIVSMYYFUC5KRTA2KG2QJYDE'
const MAINNET_SIM_ACCOUNT = 'GBHIT7TXZSRWT4QZXKINECMQWKC7NC7GBJAGK6XFOURI3T6ZHJDTHCMD'

// Public simulation source account (read-only calls when no wallet connected)
export const SIM_ACCOUNT =
  process.env.NEXT_PUBLIC_SIM_ACCOUNT ??
  (NETWORK_PASSPHRASE === MAINNET_NETWORK_PASSPHRASE
    ? MAINNET_SIM_ACCOUNT
    : TESTNET_SIM_ACCOUNT)

// Optional known pools/routes for automatic resolution (fallback if adapters need explicit ids)
export const SOROSWAP_POOL_ROUTING_PAIR = process.env.NEXT_PUBLIC_SOROSWAP_POOL_ROUTING_PAIR ?? ''
export const AQUARIUS_POOL_ROUTING_PAIR = process.env.NEXT_PUBLIC_AQUARIUS_POOL_ROUTING_PAIR ?? '9ac7a9cde23ac2ada11105eeaa42e43c2ea8332ca0aa8f41f58d7160274d718e'
export const PHOENIX_POOL_ROUTING_PAIR = process.env.NEXT_PUBLIC_PHOENIX_POOL_ROUTING_PAIR ?? ''
export const REBALANCE_DISABLED_PROTOCOLS =
  process.env.NEXT_PUBLIC_REBALANCE_DISABLED_PROTOCOLS ?? ''
export const REBALANCE_DISABLED_PROTOCOL_REASON =
  process.env.NEXT_PUBLIC_REBALANCE_DISABLED_PROTOCOL_REASON ??
  'Protocol paused while route safety is reviewed.'

type RebalancePreset = {
  defaultPct: number
  maxPct: number
  extraBufferPct: number
  fallbackExtraPct: number
}

const REBALANCE_PRESETS: Record<string, RebalancePreset> = {
  standard: {
    defaultPct: 1,
    maxPct: 10,
    extraBufferPct: 1.5,
    fallbackExtraPct: 2.5,
  },
  micro_liquidity: {
    defaultPct: 5,
    maxPct: 25,
    extraBufferPct: 5,
    fallbackExtraPct: 8,
  },
}

function parseNumericEnv(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseIntegerEnv(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback
  const parsed = Number(raw)
  return Number.isSafeInteger(parsed) ? parsed : fallback
}

function parseBooleanEnv(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw.trim() === '') return fallback
  const normalized = raw.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

export const REBALANCE_SLIPPAGE_PROFILE =
  process.env.NEXT_PUBLIC_REBALANCE_SLIPPAGE_PROFILE ?? 'standard'

const REBALANCE_PRESET =
  REBALANCE_PRESETS[REBALANCE_SLIPPAGE_PROFILE] ?? REBALANCE_PRESETS.standard

// Rebalance risk guardrails. Production-like defaults stay in `standard`;
// low-liquidity test overrides must opt in via `NEXT_PUBLIC_REBALANCE_SLIPPAGE_PROFILE=micro_liquidity`
// or explicit env vars below.
export const DEFAULT_REBALANCE_SLIPPAGE_PCT = parseNumericEnv(
  process.env.NEXT_PUBLIC_DEFAULT_REBALANCE_SLIPPAGE_PCT,
  REBALANCE_PRESET.defaultPct,
)
export const MAX_REBALANCE_SLIPPAGE_PCT = parseNumericEnv(
  process.env.NEXT_PUBLIC_MAX_REBALANCE_SLIPPAGE_PCT,
  REBALANCE_PRESET.maxPct,
)
export const REBALANCE_EXTRA_BUFFER_PCT = parseNumericEnv(
  process.env.NEXT_PUBLIC_REBALANCE_EXTRA_BUFFER_PCT,
  REBALANCE_PRESET.extraBufferPct,
)
export const REBALANCE_FALLBACK_EXTRA_PCT = parseNumericEnv(
  process.env.NEXT_PUBLIC_REBALANCE_FALLBACK_EXTRA_PCT,
  REBALANCE_PRESET.fallbackExtraPct,
)

export const REBALANCE_MAX_NOTIONAL_PER_SWAP_BASE = parseIntegerEnv(
  process.env.NEXT_PUBLIC_REBALANCE_MAX_NOTIONAL_PER_SWAP_BASE,
  100_000_000_000,
)
export const REBALANCE_MAX_PATH_LENGTH = parseIntegerEnv(
  process.env.NEXT_PUBLIC_REBALANCE_MAX_PATH_LENGTH,
  6,
)
export const REBALANCE_FORBID_ROUTE_CYCLES = parseBooleanEnv(
  process.env.NEXT_PUBLIC_REBALANCE_FORBID_ROUTE_CYCLES,
  true,
)
export const REBALANCE_CHUNKING_THRESHOLD_BASE = parseIntegerEnv(
  process.env.NEXT_PUBLIC_REBALANCE_CHUNKING_THRESHOLD_BASE,
  25_000_000,
)
export const REBALANCE_MAX_CHUNK_SIZE_BASE = parseIntegerEnv(
  process.env.NEXT_PUBLIC_REBALANCE_MAX_CHUNK_SIZE_BASE,
  5_000_000,
)
export const REBALANCE_POST_TRADE_DEVIATION_BPS = parseIntegerEnv(
  process.env.NEXT_PUBLIC_REBALANCE_POST_TRADE_DEVIATION_BPS,
  250,
)
export const REBALANCE_DAILY_TURNOVER_CAP_BPS = parseIntegerEnv(
  process.env.NEXT_PUBLIC_REBALANCE_DAILY_TURNOVER_CAP_BPS,
  1_000,
)
export const REBALANCE_EMERGENCY_PAUSE_SWAP = parseBooleanEnv(
  process.env.NEXT_PUBLIC_REBALANCE_EMERGENCY_PAUSE_SWAP,
  false,
)

// Current protocol contracts
// CoverageVault is a per-manager instance, not a platform-wide mainnet vault.
// Never silently send mainnet reads/actions to a historical testnet address.
export const COVERAGE_VAULT = process.env.NEXT_PUBLIC_COVERAGE_VAULT ?? (NETWORK_PASSPHRASE === MAINNET_NETWORK_PASSPHRASE ? '' : 'CCLEUWT6NSMIP2QFGHRIERDM453X24GC56ZNZH7VVEDVQ5JRNNRFB5BL')
export const COVERAGE_FUND = process.env.NEXT_PUBLIC_COVERAGE_FUND ?? 'CCX5QACCFXC3VNMKUHBUZ2NGD2HNU6W47G3E3LBGPAK2DWX63FERA3MO'
// In mainnet the contribution token is read and checked against reserve_token.
export const COVERAGE_TOKEN = process.env.NEXT_PUBLIC_COVERAGE_TOKEN ?? (NETWORK_PASSPHRASE === MAINNET_NETWORK_PASSPHRASE ? '' : 'CA33YVWPBWG6A7JPMMUEUUELUB3UPATI64K62RZFPGYCBJD5GFACOWGK')
export const CLAIMS_MANAGER =
  process.env.NEXT_PUBLIC_CLAIMS_MANAGER ?? 'CBBTR7VED6ZZTK3Z2ZVOWUFSP574UQGO4C2JK6YUUBSH4FPJ2GB4VF5P'
export const LOCKED_ARKA =
  process.env.NEXT_PUBLIC_LOCKED_ARKA ?? 'CAUE46HQDGXCP5RUFN4CEU7KOSOWG2UGJIXZRNAPXZFYBC55PH4NGZAC'
export const MANAGER_TIER = process.env.NEXT_PUBLIC_MANAGER_TIER ?? 'CDQVWIBJDX3K3XS4OLL4HFFSG2KKQGOZU7TIFCLMXFDCJDRDOQLB6FGR'

export const ADAPTER_BLEND = process.env.NEXT_PUBLIC_ADAPTER_BLEND ?? 'CADVUIKDYSEHWNWFMUACMUUVXA7GNNVFVIHO365FG2YGQU7OKEOUXCHX'
export const BLEND_MARKET_ID = Number(process.env.NEXT_PUBLIC_BLEND_MARKET_ID ?? '0')
export const BLEND_POOL_REAL = process.env.NEXT_PUBLIC_BLEND_POOL_REAL ?? 'CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF'
export const GOVERNOR_ID = process.env.NEXT_PUBLIC_GOVERNOR_ID ?? 'CBU6HR77QR3QYQCJI6K3F7YBR5NXBXJ33TFK7NUDTV6TE6SP672L5V6V'
export const VOTES_ID = process.env.NEXT_PUBLIC_VOTES_ID ?? 'CADJC5R6DRD3SMDVQB7FGPTMO2FTYRHQNRV3G7YRE6B5VJNG7OM3FPTK'
export const GOVERNANCE_EXECUTOR_ID =
  process.env.NEXT_PUBLIC_GOVERNANCE_EXECUTOR_ID ?? ''

// Sushi is configured explicitly; public source metadata is not chain verification.
export const SUSHI_ADAPTER = process.env.NEXT_PUBLIC_SUSHI_ADAPTER ?? ''
export const SUSHI_FACTORY = process.env.NEXT_PUBLIC_SUSHI_FACTORY ?? ''
export const SUSHI_POOL_ID = Number(process.env.NEXT_PUBLIC_SUSHI_POOL_ID ?? '1')

export const PLATFORM_VENUE_REGISTRY = process.env.NEXT_PUBLIC_VENUE_REGISTRY ?? ''
export const SUSHI_REVERSE_POOL_ID = Number(process.env.NEXT_PUBLIC_SUSHI_REVERSE_POOL_ID ?? '2')
export function resolveSushiPoolId(tokenIn: string, tokenOut: string): number | undefined {
  if(tokenIn===ROUTING_ASSET_A&&tokenOut===ROUTING_ASSET_B)return SUSHI_POOL_ID
  if(tokenIn===ROUTING_ASSET_B&&tokenOut===ROUTING_ASSET_A)return SUSHI_REVERSE_POOL_ID
  return undefined
}

export const SUSHI_POOL_ROUTING_PAIR = process.env.NEXT_PUBLIC_SUSHI_POOL_ROUTING_PAIR ?? ''
