#![no_std]
use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, vec,
    Address, BytesN, Env, IntoVal, Map, Symbol, TryFromVal, Val, Vec,
};

#[derive(Clone)]
#[contracttype]
pub struct FeeStructure {
    pub mgmt_bps: i32,
    pub perf_bps: i32,
    pub deposit_bps: i32,
    pub redeem_bps: i32,
}

#[derive(Clone)]
#[contracttype]
pub struct ProtocolFeePolicy {
    pub mgmt_protocol_bps: i32,
    pub perf_protocol_bps: i32,
}

#[derive(Clone)]
#[contracttype]
pub struct FeeState {
    pub last_settlement_ts: u64,
    pub high_water_mark: i128,
    pub cumulative_management_shares: i128,
    pub cumulative_performance_shares: i128,
    pub cumulative_manager_shares: i128,
    pub cumulative_protocol_shares: i128,
}

#[derive(Clone)]
#[contracttype]
pub struct FeeSettlement {
    pub timestamp: u64,
    pub nav: i128,
    pub total_shares_before: i128,
    pub share_price_before: i128,
    pub management_fee_value: i128,
    pub management_fee_shares: i128,
    pub performance_fee_value: i128,
    pub performance_fee_shares: i128,
    pub manager_fee_shares: i128,
    pub protocol_fee_shares: i128,
    pub total_shares_after: i128,
    pub share_price_after: i128,
    pub high_water_mark_before: i128,
    pub high_water_mark_after: i128,
}

#[derive(Clone)]
#[contracttype]
pub struct Asset {
    pub contract: Address,
}

#[derive(Clone)]
#[contracttype]
pub struct SwapStep {
    pub adapter: Address,
    pub pool_id: u128,
    pub asset_in: Asset,
    pub amount_in: i128,
    pub min_out: i128,
    pub asset_out: Asset,
    pub router_addr: Address,
}

#[derive(Clone)]
#[contracttype]
pub struct RouterStep {
    pub adapter: Address,
    pub pool_id: u128,
    pub amount_in: i128,
    pub min_out: i128,
    pub asset_out: Asset,
}

#[derive(Clone)]
#[contracttype]
pub enum BlendAction {
    Lend,
    Borrow,
    Repay,
    Withdraw,
}

#[derive(Clone, Eq, PartialEq)]
#[contracttype]
pub enum CreditProtocol {
    Blend,
}

#[derive(Clone, Eq, PartialEq)]
#[contracttype]
pub enum CreditAction {
    Supply,
    Borrow,
    Repay,
    Withdraw,
}

#[derive(Clone)]
#[contracttype]
pub struct CreditMarketConfig {
    pub protocol: CreditProtocol,
    pub market_id: u128,
    pub adapter: Address,
    pub allow_supply: bool,
    pub allow_borrow: bool,
    pub allow_repay: bool,
    pub allow_withdraw: bool,
    pub enabled: bool,
}

#[derive(Clone)]
#[contracttype]
pub struct BlendPosition {
    pub market_id: u128,
    pub asset: Address,
    pub collateral_amount: i128,
    pub debt_amount: i128,
}

#[derive(Clone)]
#[contracttype]
pub struct CreditPosition {
    pub market_id: u128,
    pub asset: Address,
    pub collateral_amount: i128,
    pub debt_amount: i128,
}

#[derive(Clone)]
#[contracttype]
pub struct BlendPositionValue {
    pub market_id: u128,
    pub asset: Address,
    pub collateral_shares: i128,
    pub collateral_amount: i128,
    pub collateral_value: i128,
    pub debt_shares: i128,
    pub debt_amount: i128,
    pub debt_value: i128,
    pub net_value: i128,
    pub price: i128,
    pub health_factor: i128,
    pub c_factor: u32,
    pub oracle_timestamp: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct CreditPositionValue {
    pub market_id: u128,
    pub asset: Address,
    pub collateral_shares: i128,
    pub collateral_amount: i128,
    pub collateral_value: i128,
    pub debt_shares: i128,
    pub debt_amount: i128,
    pub debt_value: i128,
    pub net_value: i128,
    pub price: i128,
    pub health_factor: i128,
    pub c_factor: u32,
    pub oracle_timestamp: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct BlendMarketValue {
    pub market_id: u128,
    pub collateral_value: i128,
    pub debt_value: i128,
    pub net_value: i128,
    pub health_factor: i128,
    pub oracle_timestamp: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct CreditMarketValue {
    pub market_id: u128,
    pub collateral_value: i128,
    pub debt_value: i128,
    pub net_value: i128,
    pub health_factor: i128,
    pub oracle_timestamp: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct BlendRiskPolicy {
    pub market_id: u128,
    pub max_oracle_age: u64,
    pub min_health_factor: i128,
    pub fail_close_nav: bool,
    pub fail_close_actions: bool,
}

#[derive(Clone)]
#[contracttype]
pub struct CreditRiskPolicy {
    pub market_id: u128,
    pub max_oracle_age: u64,
    pub min_health_factor: i128,
    pub fail_close_nav: bool,
    pub fail_close_actions: bool,
}

#[derive(Clone)]
#[contracttype]
pub struct SwapRiskPolicy {
    pub enabled: bool,
    pub oracle_checks_enabled: bool,
    pub max_price_impact_bps: i32,
    pub max_slippage_bps: i32,
    pub max_twap_deviation_bps: i32,
    pub max_oracle_age_seconds: u64,
    pub max_trade_size_bps: i32,
}

#[derive(Clone)]
#[contracttype]
pub struct BlendMarketStatus {
    pub market_id: u128,
    pub has_live_pricing: bool,
    pub has_stale_oracle: bool,
    pub has_invalid_oracle_data: bool,
    pub has_future_oracle_timestamp: bool,
    pub has_disabled_reserve: bool,
    pub oracle_age: u64,
    pub max_oracle_age: u64,
    pub min_health_factor: i128,
    pub health_factor: i128,
    pub debt_value: i128,
    pub pool_status: u32,
    pub risky_actions_blocked: bool,
    pub nav_blocked: bool,
}

#[derive(Clone)]
#[contracttype]
pub struct CreditMarketStatus {
    pub market_id: u128,
    pub has_live_pricing: bool,
    pub has_stale_oracle: bool,
    pub has_invalid_oracle_data: bool,
    pub has_future_oracle_timestamp: bool,
    pub has_disabled_reserve: bool,
    pub oracle_age: u64,
    pub max_oracle_age: u64,
    pub min_health_factor: i128,
    pub health_factor: i128,
    pub debt_value: i128,
    pub pool_status: u32,
    pub risky_actions_blocked: bool,
    pub nav_blocked: bool,
}

#[derive(Clone)]
#[contracttype]
pub struct BlendRequest {
    pub address: Address,
    pub amount: i128,
    pub request_type: u32,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Denomination,
    TotalShares,
    ShareToken,
    Aum,
    Fees,
    ProtocolTreasury,
    ProtocolFeePolicy,
    FeeState,
    Whitelist,
    Manager,
    Governor,
    Router,
    Balance(Address),
    TrackedAssets,
    LiquidBalance(Address),
    BlendMarkets,
    BlendMarketAssets(u128),
    BlendPosition(u128, Address),
    BlendAdapter(u128),
    BlendRiskPolicy(u128),
    BlendExternalDiagnostics(u128),
    CreditProtocols,
    CreditMarkets(CreditProtocol),
    CreditMarketConfig(CreditProtocol, u128),
    SwapRiskPolicy,
    SwapOracle,
    AllowedRouters,
    AllowedAdapters,
    VenueRegistry,
    BootstrapAdmin,
    BootstrapAdminExpiresAt,
    LastWasmHash,
}

#[derive(Clone)]
#[contracttype]
pub struct BlendPoolConfig {
    pub bstop_rate: u32,
    pub max_positions: u32,
    pub min_collateral: i128,
    pub oracle: Address,
    pub status: u32,
}

#[derive(Clone)]
#[contracttype]
pub struct BlendReserveConfig {
    pub c_factor: u32,
    pub decimals: u32,
    pub enabled: bool,
    pub index: u32,
    pub l_factor: u32,
    pub max_util: u32,
    pub r_base: u32,
    pub r_one: u32,
    pub r_three: u32,
    pub r_two: u32,
    pub reactivity: u32,
    pub supply_cap: i128,
    pub util: u32,
}

#[derive(Clone)]
#[contracttype]
pub struct BlendReserveData {
    pub b_rate: i128,
    pub b_supply: i128,
    pub backstop_credit: i128,
    pub d_rate: i128,
    pub d_supply: i128,
    pub ir_mod: i128,
    pub last_time: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct BlendReserve {
    pub asset: Address,
    pub config: BlendReserveConfig,
    pub data: BlendReserveData,
    pub scalar: i128,
}

#[derive(Clone)]
#[contracttype]
pub struct BlendPoolPositions {
    pub collateral: Map<u32, i128>,
    pub liabilities: Map<u32, i128>,
    pub supply: Map<u32, i128>,
}

#[derive(Clone)]
#[contracttype]
pub struct OraclePriceData {
    pub price: i128,
    pub timestamp: u64,
}

#[derive(Clone)]
struct BlendPositionDiagnostics {
    value: BlendPositionValue,
    pool_status: u32,
    reserve_enabled: bool,
    has_invalid_oracle_data: bool,
    has_future_oracle_timestamp: bool,
}

impl From<BlendPosition> for CreditPosition {
    fn from(value: BlendPosition) -> Self {
        Self {
            market_id: value.market_id,
            asset: value.asset,
            collateral_amount: value.collateral_amount,
            debt_amount: value.debt_amount,
        }
    }
}

impl From<BlendPositionValue> for CreditPositionValue {
    fn from(value: BlendPositionValue) -> Self {
        Self {
            market_id: value.market_id,
            asset: value.asset,
            collateral_shares: value.collateral_shares,
            collateral_amount: value.collateral_amount,
            collateral_value: value.collateral_value,
            debt_shares: value.debt_shares,
            debt_amount: value.debt_amount,
            debt_value: value.debt_value,
            net_value: value.net_value,
            price: value.price,
            health_factor: value.health_factor,
            c_factor: value.c_factor,
            oracle_timestamp: value.oracle_timestamp,
        }
    }
}

impl From<BlendMarketValue> for CreditMarketValue {
    fn from(value: BlendMarketValue) -> Self {
        Self {
            market_id: value.market_id,
            collateral_value: value.collateral_value,
            debt_value: value.debt_value,
            net_value: value.net_value,
            health_factor: value.health_factor,
            oracle_timestamp: value.oracle_timestamp,
        }
    }
}

impl From<BlendRiskPolicy> for CreditRiskPolicy {
    fn from(value: BlendRiskPolicy) -> Self {
        Self {
            market_id: value.market_id,
            max_oracle_age: value.max_oracle_age,
            min_health_factor: value.min_health_factor,
            fail_close_nav: value.fail_close_nav,
            fail_close_actions: value.fail_close_actions,
        }
    }
}

impl From<BlendMarketStatus> for CreditMarketStatus {
    fn from(value: BlendMarketStatus) -> Self {
        Self {
            market_id: value.market_id,
            has_live_pricing: value.has_live_pricing,
            has_stale_oracle: value.has_stale_oracle,
            has_invalid_oracle_data: value.has_invalid_oracle_data,
            has_future_oracle_timestamp: value.has_future_oracle_timestamp,
            has_disabled_reserve: value.has_disabled_reserve,
            oracle_age: value.oracle_age,
            max_oracle_age: value.max_oracle_age,
            min_health_factor: value.min_health_factor,
            health_factor: value.health_factor,
            debt_value: value.debt_value,
            pool_status: value.pool_status,
            risky_actions_blocked: value.risky_actions_blocked,
            nav_blocked: value.nav_blocked,
        }
    }
}

#[derive(Clone)]
#[contracttype]
pub enum OracleAsset {
    Stellar(Address),
    Other(Symbol),
}

const EVENT_DEPOSIT: Symbol = symbol_short!("deposit");
const EVENT_REDEEM: Symbol = symbol_short!("redeem");
const EVENT_PROFIT: Symbol = symbol_short!("profit");
const EVENT_FEE: Symbol = symbol_short!("fee");
const EVENT_BLEND: Symbol = symbol_short!("blend");
const EVENT_INIT: Symbol = symbol_short!("initcfg");
const EVENT_GOVERNOR_SET: Symbol = symbol_short!("govset");
const EVENT_FEES_CFG: Symbol = symbol_short!("feecfg");
const EVENT_PROTOCOL_FEE_CFG: Symbol = symbol_short!("protfee");
const EVENT_WHITELIST_CFG: Symbol = symbol_short!("whlist");
const EVENT_MANAGER_SET: Symbol = symbol_short!("mngrset");
const EVENT_ROUTER_SET: Symbol = symbol_short!("router");
const EVENT_SHARE_TOKEN_SET: Symbol = symbol_short!("sharetk");
const EVENT_BLEND_POLICY_CFG: Symbol = symbol_short!("blendcfg");
const EVENT_BLEND_DIAGNOSTICS_CFG: Symbol = symbol_short!("bdiagcfg");
const EVENT_CREDIT_MARKET_CFG: Symbol = symbol_short!("creditcf");
const EVENT_SWAP_POLICY_CFG: Symbol = symbol_short!("swppol");
const EVENT_SWAP_ORACLE_SET: Symbol = symbol_short!("swporcl");
const EVENT_SWAP_VENUES_CFG: Symbol = symbol_short!("swpven");
const EVENT_VENUE_REGISTRY_SET: Symbol = symbol_short!("venreg");
const BLEND_RATE_SCALE: i128 = 1_000_000_000_000;
const DEFAULT_BLEND_MAX_ORACLE_AGE: u64 = 60 * 60;
const DEFAULT_BLEND_MIN_HEALTH_FACTOR: i128 = 12_500_000;
const DEFAULT_SWAP_MAX_PRICE_IMPACT_BPS: i32 = 300;
const DEFAULT_SWAP_MAX_SLIPPAGE_BPS: i32 = 300;
const DEFAULT_SWAP_MAX_TWAP_DEVIATION_BPS: i32 = 350;
const DEFAULT_SWAP_MAX_ORACLE_AGE_SECONDS: u64 = 60;
const DEFAULT_SWAP_MAX_TRADE_SIZE_BPS_OF_LIQUIDITY: i32 = 2_500;
const MAX_BOOTSTRAP_ADMIN_SECONDS: u64 = 365 * 24 * 60 * 60;
const SHARE_PRICE_SCALE: i128 = 1_000_000_000;
const YEAR_SECONDS: i128 = 31_536_000;

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    OnlyManager = 3,
    AmountZero = 4,
    AssetNotWhitelisted = 5,
    SharesZero = 6,
    InsufficientUserShares = 7,
    InsufficientShares = 8,
    RouterNotSet = 9,
    InvalidFeeBps = 10,
    UnauthorizedPolicy = 11,
    InsufficientLiquidity = 12,
    InvalidBlendPosition = 13,
    BlendAssetMismatch = 14,
    InvalidBlendRiskPolicy = 15,
    BlendOracleStale = 16,
    BlendHealthFactorTooLow = 17,
    BlendNavUnavailable = 18,
    BlendOracleInvalid = 19,
    CreditMarketNotConfigured = 20,
    CreditActionNotAllowed = 21,
    InvalidProtocolFeeBps = 22,
    InvalidSwapRiskPolicy = 23,
    SwapVenueNotAllowed = 24,
    SwapTradeSizeExceeded = 25,
    SwapOracleNotConfigured = 26,
    SwapOracleStale = 27,
    SwapOracleInvalid = 28,
    SwapPriceImpactExceeded = 29,
    SwapSlippageExceeded = 30,
    SwapTwapDeviationExceeded = 31,
    InvalidBootstrapAdmin = 32,
}

#[contract]
pub struct ArkaContract;

#[contractimpl]
impl ArkaContract {
    fn apply_fee_bps(amount: i128, fee_bps: i32) -> i128 {
        let bps = 10_000i128 - fee_bps as i128;
        (amount * bps) / 10_000i128
    }

    fn assert_fee_bps(env: &Env, bps: i32) {
        if !(0..=10_000).contains(&bps) {
            panic_with_error!(env, Error::InvalidFeeBps);
        }
    }

    fn assert_protocol_fee_bps(env: &Env, bps: i32) {
        if !(0..=10_000).contains(&bps) {
            panic_with_error!(env, Error::InvalidProtocolFeeBps);
        }
    }

    fn require_policy_auth(env: &Env, caller: &Address) {
        let store = env.storage().instance();
        if let Some(governor) = store.get::<DataKey, Address>(&DataKey::Governor) {
            if *caller != governor {
                panic_with_error!(env, Error::UnauthorizedPolicy);
            }
            caller.require_auth();
            return;
        }
        let manager: Address = match store.get(&DataKey::Manager) {
            Some(m) => m,
            None => panic_with_error!(env, Error::NotInitialized),
        };
        if *caller != manager {
            panic_with_error!(env, Error::UnauthorizedPolicy);
        }
        caller.require_auth();
    }

    fn bootstrap_admin_active_internal(env: &Env) -> bool {
        let Some(expires_at) = env
            .storage()
            .instance()
            .get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
        else {
            return false;
        };
        env.ledger().timestamp() <= expires_at
    }

    fn require_future_bootstrap_expiry(env: &Env, expires_at: u64) {
        let now = env.ledger().timestamp();
        if expires_at <= now || expires_at.saturating_sub(now) > MAX_BOOTSTRAP_ADMIN_SECONDS {
            panic_with_error!(env, Error::InvalidBootstrapAdmin);
        }
    }

    fn require_governor_caller_auth(env: &Env, caller: &Address) {
        let Some(governor) = env
            .storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::Governor)
        else {
            panic_with_error!(env, Error::UnauthorizedPolicy);
        };
        if *caller != governor {
            panic_with_error!(env, Error::UnauthorizedPolicy);
        }
        caller.require_auth();
    }

    fn require_bootstrap_or_governor_auth(env: &Env, caller: &Address) {
        let store = env.storage().instance();
        if Self::bootstrap_admin_active_internal(env) {
            if let Some(admin) = store.get::<DataKey, Address>(&DataKey::BootstrapAdmin) {
                if *caller == admin {
                    caller.require_auth();
                    return;
                }
            }
        }
        if let Some(governor) = store.get::<DataKey, Address>(&DataKey::Governor) {
            if *caller == governor {
                caller.require_auth();
                return;
            }
        }
        panic_with_error!(env, Error::UnauthorizedPolicy);
    }

    fn require_manager(env: &Env, manager: &Address) {
        let store = env.storage().instance();
        let stored_manager: Address = match store.get(&DataKey::Manager) {
            Some(m) => m,
            None => panic_with_error!(env, Error::NotInitialized),
        };
        if *manager != stored_manager {
            panic_with_error!(env, Error::OnlyManager);
        }
        manager.require_auth();
    }

    fn authorize_current_contract_call(
        env: &Env,
        contract: &Address,
        fn_name: &str,
        args: &Vec<Val>,
        sub_invocations: Vec<InvokerContractAuthEntry>,
    ) {
        let auth = InvokerContractAuthEntry::Contract(SubContractInvocation {
            context: ContractContext {
                contract: contract.clone(),
                fn_name: Symbol::new(env, fn_name),
                args: args.clone(),
            },
            sub_invocations,
        });
        env.authorize_as_current_contract(vec![env, auth]);
    }

    fn invoke_with_contract_auth<T>(
        env: &Env,
        contract: &Address,
        fn_name: &str,
        args: Vec<Val>,
    ) -> T
    where
        T: TryFromVal<Env, Val>,
    {
        Self::authorize_current_contract_call(env, contract, fn_name, &args, vec![env]);
        env.invoke_contract::<T>(contract, &Symbol::new(env, fn_name), args)
    }

    fn maybe_mint_share_token(env: &Env, to: &Address, amount: i128) {
        let store = env.storage().instance();
        if let Some(share_token) = store.get::<DataKey, Address>(&DataKey::ShareToken) {
            let args = vec![env, to.clone().into_val(env), amount.into_val(env)];
            Self::invoke_with_contract_auth::<()>(env, &share_token, "mint", args);
        }
    }

    fn maybe_burn_share_token(env: &Env, from: &Address, amount: i128) {
        let store = env.storage().instance();
        if let Some(share_token) = store.get::<DataKey, Address>(&DataKey::ShareToken) {
            let args = vec![env, from.clone().into_val(env), amount.into_val(env)];
            Self::invoke_with_contract_auth::<()>(env, &share_token, "burn", args);
        }
    }

    fn maybe_share_token_balance(env: &Env, user: &Address) -> Option<i128> {
        let store = env.storage().instance();
        let share_token: Option<Address> = store.get(&DataKey::ShareToken);
        share_token.map(|token| {
            let args = vec![env, user.clone().into_val(env)];
            env.invoke_contract::<i128>(&token, &Symbol::new(env, "balance"), args)
        })
    }

    fn total_shares_internal(env: &Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalShares)
            .unwrap_or(0)
    }

    fn bump_dynamic_key(env: &Env, key: &DataKey) {
        let max_ttl = env.storage().max_ttl();
        if max_ttl == 0 {
            return;
        }
        let store = env.storage().persistent();
        if store.has(key) {
            let threshold = core::cmp::max(max_ttl / 2, 1);
            store.extend_ttl(key, threshold, max_ttl);
        }
    }

    fn dynamic_get<T>(env: &Env, key: &DataKey) -> Option<T>
    where
        T: TryFromVal<Env, Val> + IntoVal<Env, Val>,
    {
        let persistent = env.storage().persistent();
        if let Some(value) = persistent.get::<DataKey, T>(key) {
            Self::bump_dynamic_key(env, key);
            return Some(value);
        }

        let legacy = env.storage().instance().get::<DataKey, T>(key);
        if let Some(value) = legacy {
            persistent.set(key, &value);
            env.storage().instance().remove(key);
            Self::bump_dynamic_key(env, key);
            return Some(value);
        }
        None
    }

    fn dynamic_set<T>(env: &Env, key: &DataKey, value: &T)
    where
        T: IntoVal<Env, Val>,
    {
        env.storage().persistent().set(key, value);
        env.storage().instance().remove(key);
        Self::bump_dynamic_key(env, key);
    }

    fn dynamic_remove(env: &Env, key: &DataKey) {
        env.storage().persistent().remove(key);
        env.storage().instance().remove(key);
    }

    fn fee_state_internal(env: &Env) -> FeeState {
        env.storage()
            .instance()
            .get(&DataKey::FeeState)
            .unwrap_or(FeeState {
                last_settlement_ts: env.ledger().timestamp(),
                high_water_mark: SHARE_PRICE_SCALE,
                cumulative_management_shares: 0,
                cumulative_performance_shares: 0,
                cumulative_manager_shares: 0,
                cumulative_protocol_shares: 0,
            })
    }

    fn protocol_fee_policy_internal(env: &Env) -> ProtocolFeePolicy {
        env.storage()
            .instance()
            .get(&DataKey::ProtocolFeePolicy)
            .unwrap_or(ProtocolFeePolicy {
                mgmt_protocol_bps: 0,
                perf_protocol_bps: 0,
            })
    }

    fn protocol_treasury_internal(env: &Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::ProtocolTreasury)
    }

    fn share_price_scaled(nav: i128, total_shares: i128) -> i128 {
        if nav <= 0 || total_shares <= 0 {
            SHARE_PRICE_SCALE
        } else {
            (nav * SHARE_PRICE_SCALE) / total_shares
        }
    }

    fn fee_value_to_shares(nav: i128, total_shares: i128, fee_value: i128) -> i128 {
        if nav <= 0 || total_shares <= 0 || fee_value <= 0 || fee_value >= nav {
            return 0;
        }
        (total_shares * fee_value) / (nav - fee_value)
    }

    fn mint_shares_to(env: &Env, to: &Address, amount: i128) {
        if amount <= 0 {
            return;
        }
        let store = env.storage().instance();
        let total = Self::total_shares_internal(env);
        store.set(&DataKey::TotalShares, &(total + amount));
        let key = DataKey::Balance(to.clone());
        let balance: i128 = Self::dynamic_get(env, &key).unwrap_or(0);
        Self::dynamic_set(env, &key, &(balance + amount));
        Self::maybe_mint_share_token(env, to, amount);
    }

    fn burn_shares_from(env: &Env, from: &Address, amount: i128) {
        if amount <= 0 {
            panic_with_error!(env, Error::SharesZero);
        }
        let store = env.storage().instance();
        let total = Self::total_shares_internal(env);
        if amount > total {
            panic_with_error!(env, Error::InsufficientShares);
        }
        let key = DataKey::Balance(from.clone());
        let balance: i128 = Self::dynamic_get(env, &key).unwrap_or(0);
        if amount > balance {
            panic_with_error!(env, Error::InsufficientUserShares);
        }
        store.set(&DataKey::TotalShares, &(total - amount));
        let next_balance = balance - amount;
        if next_balance == 0 {
            Self::dynamic_remove(env, &key);
        } else {
            Self::dynamic_set(env, &key, &next_balance);
        }
        Self::maybe_burn_share_token(env, from, amount);
    }

    fn preview_fee_settlement_internal(env: &Env) -> FeeSettlement {
        let now = env.ledger().timestamp();
        let nav = Self::total_nav_internal(env);
        let total_shares_before = Self::total_shares_internal(env);
        let state = Self::fee_state_internal(env);
        let share_price_before = Self::share_price_scaled(nav, total_shares_before);
        let high_water_mark_before = if state.high_water_mark > 0 {
            state.high_water_mark
        } else {
            SHARE_PRICE_SCALE
        };

        if total_shares_before <= 0 || nav <= 0 {
            return FeeSettlement {
                timestamp: now,
                nav,
                total_shares_before,
                share_price_before,
                management_fee_value: 0,
                management_fee_shares: 0,
                performance_fee_value: 0,
                performance_fee_shares: 0,
                manager_fee_shares: 0,
                protocol_fee_shares: 0,
                total_shares_after: total_shares_before,
                share_price_after: share_price_before,
                high_water_mark_before,
                high_water_mark_after: SHARE_PRICE_SCALE,
            };
        }

        let fees = Self::fees(env.clone());
        let delta_seconds = now.saturating_sub(state.last_settlement_ts) as i128;
        let mut management_fee_value = 0i128;
        if delta_seconds > 0 && fees.mgmt_bps > 0 {
            management_fee_value =
                (nav * fees.mgmt_bps as i128 * delta_seconds) / (YEAR_SECONDS * 10_000i128);
            if management_fee_value >= nav {
                management_fee_value = nav - 1;
            }
        }

        let management_fee_shares =
            Self::fee_value_to_shares(nav, total_shares_before, management_fee_value);
        let total_after_mgmt = total_shares_before + management_fee_shares;
        let share_price_after_mgmt = Self::share_price_scaled(nav, total_after_mgmt);

        let profit_above_hwm = if share_price_after_mgmt > high_water_mark_before {
            let hwm_nav = (high_water_mark_before * total_after_mgmt) / SHARE_PRICE_SCALE;
            if nav > hwm_nav {
                nav - hwm_nav
            } else {
                0
            }
        } else {
            0
        };

        let mut performance_fee_value = 0i128;
        if fees.perf_bps > 0 && profit_above_hwm > 0 {
            performance_fee_value = (profit_above_hwm * fees.perf_bps as i128) / 10_000i128;
            if performance_fee_value >= nav {
                performance_fee_value = nav - 1;
            }
        }

        let performance_fee_shares =
            Self::fee_value_to_shares(nav, total_after_mgmt, performance_fee_value);
        let total_shares_after = total_after_mgmt + performance_fee_shares;

        let treasury_configured = Self::protocol_treasury_internal(env).is_some();
        let protocol_policy = Self::protocol_fee_policy_internal(env);
        let protocol_mgmt_shares = if treasury_configured {
            (management_fee_shares * protocol_policy.mgmt_protocol_bps as i128) / 10_000i128
        } else {
            0
        };
        let protocol_perf_shares = if treasury_configured {
            (performance_fee_shares * protocol_policy.perf_protocol_bps as i128) / 10_000i128
        } else {
            0
        };
        let protocol_fee_shares = protocol_mgmt_shares + protocol_perf_shares;
        let manager_fee_shares =
            management_fee_shares + performance_fee_shares - protocol_fee_shares;

        let share_price_after = Self::share_price_scaled(nav, total_shares_after);
        let high_water_mark_after = if share_price_after > high_water_mark_before {
            share_price_after
        } else {
            high_water_mark_before
        };

        FeeSettlement {
            timestamp: now,
            nav,
            total_shares_before,
            share_price_before,
            management_fee_value,
            management_fee_shares,
            performance_fee_value,
            performance_fee_shares,
            manager_fee_shares,
            protocol_fee_shares,
            total_shares_after,
            share_price_after,
            high_water_mark_before,
            high_water_mark_after,
        }
    }

    fn settle_fees_internal(env: &Env) -> FeeSettlement {
        let preview = Self::preview_fee_settlement_internal(env);
        let store = env.storage().instance();
        let mut state = Self::fee_state_internal(env);

        if preview.manager_fee_shares > 0 {
            let manager: Address = store
                .get(&DataKey::Manager)
                .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized));
            Self::mint_shares_to(env, &manager, preview.manager_fee_shares);
            state.cumulative_manager_shares += preview.manager_fee_shares;
        }

        if preview.protocol_fee_shares > 0 {
            if let Some(treasury) = Self::protocol_treasury_internal(env) {
                Self::mint_shares_to(env, &treasury, preview.protocol_fee_shares);
                state.cumulative_protocol_shares += preview.protocol_fee_shares;
            }
        }

        state.last_settlement_ts = preview.timestamp;
        state.high_water_mark = preview.high_water_mark_after;
        state.cumulative_management_shares += preview.management_fee_shares;
        state.cumulative_performance_shares += preview.performance_fee_shares;
        store.set(&DataKey::FeeState, &state);
        Self::refresh_aum(env);

        if preview.management_fee_shares > 0 || preview.performance_fee_shares > 0 {
            env.events().publish(
                (EVENT_FEE,),
                (
                    preview.management_fee_shares,
                    preview.performance_fee_shares,
                    preview.manager_fee_shares,
                    preview.protocol_fee_shares,
                    preview.share_price_after,
                ),
            );
        }

        preview
    }

    fn track_asset(env: &Env, asset: &Address) {
        let tracked_key = DataKey::TrackedAssets;
        let mut tracked: Vec<Address> =
            Self::dynamic_get(env, &tracked_key).unwrap_or(Vec::new(env));
        let mut found = false;
        for existing in tracked.iter() {
            if existing == *asset {
                found = true;
                break;
            }
        }
        if !found {
            tracked.push_back(asset.clone());
            Self::dynamic_set(env, &tracked_key, &tracked);
        }
    }

    fn credit_protocol_event_code(protocol: &CreditProtocol) -> u32 {
        match protocol {
            CreditProtocol::Blend => 0,
        }
    }

    fn liquid_balance_internal(env: &Env, asset: &Address) -> i128 {
        let key = DataKey::LiquidBalance(asset.clone());
        Self::dynamic_get(env, &key).unwrap_or(0)
    }

    fn set_liquid_balance(env: &Env, asset: &Address, amount: i128) {
        Self::track_asset(env, asset);
        let key = DataKey::LiquidBalance(asset.clone());
        if amount == 0 {
            Self::dynamic_remove(env, &key);
            return;
        }
        Self::dynamic_set(env, &key, &amount);
    }

    fn add_liquid_balance(env: &Env, asset: &Address, delta: i128) {
        let next = Self::liquid_balance_internal(env, asset) + delta;
        if next < 0 {
            panic_with_error!(env, Error::InsufficientLiquidity);
        }
        Self::set_liquid_balance(env, asset, next);
    }

    fn add_blend_market(env: &Env, market_id: u128) {
        let markets_key = DataKey::BlendMarkets;
        let mut markets: Vec<u128> = Self::dynamic_get(env, &markets_key).unwrap_or(Vec::new(env));
        let mut found = false;
        for existing in markets.iter() {
            if existing == market_id {
                found = true;
                break;
            }
        }
        if !found {
            markets.push_back(market_id);
            Self::dynamic_set(env, &markets_key, &markets);
        }
    }

    fn remove_blend_market(env: &Env, market_id: u128) {
        let markets_key = DataKey::BlendMarkets;
        let markets: Vec<u128> = Self::dynamic_get(env, &markets_key).unwrap_or(Vec::new(env));
        let mut next: Vec<u128> = Vec::new(env);
        for existing in markets.iter() {
            if existing != market_id {
                next.push_back(existing);
            }
        }
        if next.is_empty() {
            Self::dynamic_remove(env, &markets_key);
        } else {
            Self::dynamic_set(env, &markets_key, &next);
        }
    }

    fn add_blend_market_asset(env: &Env, market_id: u128, asset: &Address) {
        let assets_key = DataKey::BlendMarketAssets(market_id);
        let mut assets: Vec<Address> = Self::dynamic_get(env, &assets_key).unwrap_or(Vec::new(env));
        let mut found = false;
        for existing in assets.iter() {
            if existing == *asset {
                found = true;
                break;
            }
        }
        if !found {
            assets.push_back(asset.clone());
            Self::dynamic_set(env, &assets_key, &assets);
        }
        Self::add_blend_market(env, market_id);
    }

    fn remove_blend_market_asset(env: &Env, market_id: u128, asset: &Address) {
        let assets_key = DataKey::BlendMarketAssets(market_id);
        let assets: Vec<Address> = Self::dynamic_get(env, &assets_key).unwrap_or(Vec::new(env));
        let mut next: Vec<Address> = Vec::new(env);
        for existing in assets.iter() {
            if existing != *asset {
                next.push_back(existing);
            }
        }
        if next.is_empty() {
            Self::dynamic_remove(env, &assets_key);
            Self::remove_blend_market(env, market_id);
        } else {
            Self::dynamic_set(env, &assets_key, &next);
        }
    }

    fn read_blend_market_assets_internal(env: &Env, market_id: u128) -> Vec<Address> {
        let key = DataKey::BlendMarketAssets(market_id);
        Self::dynamic_get(env, &key).unwrap_or(Vec::new(env))
    }

    fn read_blend_position_internal(
        env: &Env,
        market_id: u128,
        asset: &Address,
    ) -> Option<BlendPosition> {
        let key = DataKey::BlendPosition(market_id, asset.clone());
        Self::dynamic_get(env, &key)
    }

    fn write_blend_position(env: &Env, position: &BlendPosition) {
        let key = DataKey::BlendPosition(position.market_id, position.asset.clone());
        if position.collateral_amount == 0 && position.debt_amount == 0 {
            Self::dynamic_remove(env, &key);
            Self::remove_blend_market_asset(env, position.market_id, &position.asset);
            return;
        }
        Self::add_blend_market_asset(env, position.market_id, &position.asset);
        Self::dynamic_set(env, &key, position);
    }

    fn read_blend_adapter_internal(env: &Env, market_id: u128) -> Option<Address> {
        let key = DataKey::BlendAdapter(market_id);
        Self::dynamic_get(env, &key)
    }

    fn write_blend_adapter(env: &Env, market_id: u128, adapter: &Address) {
        let key = DataKey::BlendAdapter(market_id);
        Self::dynamic_set(env, &key, adapter);
    }

    fn clear_blend_adapter(env: &Env, market_id: u128) {
        let key = DataKey::BlendAdapter(market_id);
        Self::dynamic_remove(env, &key);
    }

    fn add_credit_protocol(env: &Env, protocol: &CreditProtocol) {
        let protocols_key = DataKey::CreditProtocols;
        let mut protocols: Vec<CreditProtocol> =
            Self::dynamic_get(env, &protocols_key).unwrap_or(Vec::new(env));
        let mut found = false;
        for existing in protocols.iter() {
            if existing == *protocol {
                found = true;
                break;
            }
        }
        if !found {
            protocols.push_back(protocol.clone());
            Self::dynamic_set(env, &protocols_key, &protocols);
        }
    }

    fn read_credit_markets_internal(env: &Env, protocol: &CreditProtocol) -> Vec<u128> {
        let key = DataKey::CreditMarkets(protocol.clone());
        Self::dynamic_get(env, &key).unwrap_or(Vec::new(env))
    }

    fn add_credit_market(env: &Env, protocol: &CreditProtocol, market_id: u128) {
        let mut markets = Self::read_credit_markets_internal(env, protocol);
        let mut found = false;
        for existing in markets.iter() {
            if existing == market_id {
                found = true;
                break;
            }
        }
        if !found {
            markets.push_back(market_id);
            let key = DataKey::CreditMarkets(protocol.clone());
            Self::dynamic_set(env, &key, &markets);
        }
        Self::add_credit_protocol(env, protocol);
    }

    fn write_credit_market_config(env: &Env, config: &CreditMarketConfig) {
        Self::add_credit_market(env, &config.protocol, config.market_id);
        let key = DataKey::CreditMarketConfig(config.protocol.clone(), config.market_id);
        Self::dynamic_set(env, &key, config);
    }

    fn read_credit_market_config_internal(
        env: &Env,
        protocol: &CreditProtocol,
        market_id: u128,
    ) -> Option<CreditMarketConfig> {
        let key = DataKey::CreditMarketConfig(protocol.clone(), market_id);
        Self::dynamic_get(env, &key)
    }

    fn read_credit_market_configs_internal(
        env: &Env,
        protocol: &CreditProtocol,
    ) -> Vec<CreditMarketConfig> {
        let mut configs = Vec::new(env);
        for market_id in Self::read_credit_markets_internal(env, protocol).iter() {
            if let Some(config) = Self::read_credit_market_config_internal(env, protocol, market_id)
            {
                configs.push_back(config);
            }
        }
        configs
    }

    fn require_credit_market_config(
        env: &Env,
        protocol: &CreditProtocol,
        market_id: u128,
    ) -> CreditMarketConfig {
        match Self::read_credit_market_config_internal(env, protocol, market_id) {
            Some(config) if config.enabled => config,
            _ => panic_with_error!(env, Error::CreditMarketNotConfigured),
        }
    }

    fn assert_credit_action_allowed(env: &Env, config: &CreditMarketConfig, action: &CreditAction) {
        let allowed = match action {
            CreditAction::Supply => config.allow_supply,
            CreditAction::Borrow => config.allow_borrow,
            CreditAction::Repay => config.allow_repay,
            CreditAction::Withdraw => config.allow_withdraw,
        };
        if !allowed {
            panic_with_error!(env, Error::CreditActionNotAllowed);
        }
    }

    fn require_legacy_blend_market_action(
        env: &Env,
        adapter: &Address,
        market_id: u128,
        action: &CreditAction,
    ) -> CreditMarketConfig {
        let config = Self::require_credit_market_config(env, &CreditProtocol::Blend, market_id);
        if config.adapter != *adapter {
            panic_with_error!(env, Error::SwapVenueNotAllowed);
        }
        Self::assert_credit_action_allowed(env, &config, action);
        config
    }

    fn default_blend_risk_policy(market_id: u128) -> BlendRiskPolicy {
        BlendRiskPolicy {
            market_id,
            max_oracle_age: DEFAULT_BLEND_MAX_ORACLE_AGE,
            min_health_factor: DEFAULT_BLEND_MIN_HEALTH_FACTOR,
            fail_close_nav: true,
            fail_close_actions: true,
        }
    }

    fn read_blend_risk_policy_internal(env: &Env, market_id: u128) -> BlendRiskPolicy {
        let key = DataKey::BlendRiskPolicy(market_id);
        Self::dynamic_get(env, &key).unwrap_or(Self::default_blend_risk_policy(market_id))
    }

    fn read_blend_external_diagnostics_internal(env: &Env, market_id: u128) -> bool {
        let key = DataKey::BlendExternalDiagnostics(market_id);
        Self::dynamic_get(env, &key).unwrap_or(true)
    }

    fn assert_blend_risk_policy(env: &Env, max_oracle_age: u64, min_health_factor: i128) {
        if max_oracle_age == 0 || min_health_factor < 0 {
            panic_with_error!(env, Error::InvalidBlendRiskPolicy);
        }
    }

    fn default_swap_risk_policy() -> SwapRiskPolicy {
        SwapRiskPolicy {
            enabled: false,
            oracle_checks_enabled: false,
            max_price_impact_bps: DEFAULT_SWAP_MAX_PRICE_IMPACT_BPS,
            max_slippage_bps: DEFAULT_SWAP_MAX_SLIPPAGE_BPS,
            max_twap_deviation_bps: DEFAULT_SWAP_MAX_TWAP_DEVIATION_BPS,
            max_oracle_age_seconds: DEFAULT_SWAP_MAX_ORACLE_AGE_SECONDS,
            max_trade_size_bps: DEFAULT_SWAP_MAX_TRADE_SIZE_BPS_OF_LIQUIDITY,
        }
    }

    fn read_swap_risk_policy_internal(env: &Env) -> SwapRiskPolicy {
        env.storage()
            .instance()
            .get(&DataKey::SwapRiskPolicy)
            .unwrap_or(Self::default_swap_risk_policy())
    }

    fn read_swap_oracle_internal(env: &Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::SwapOracle)
    }

    fn read_allowed_routers_internal(env: &Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::AllowedRouters)
            .unwrap_or(Vec::new(env))
    }

    fn read_allowed_adapters_internal(env: &Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::AllowedAdapters)
            .unwrap_or(Vec::new(env))
    }

    fn read_venue_registry_internal(env: &Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::VenueRegistry)
    }

    fn assert_global_venue_allowed(env: &Env, venue: &Address) {
        if let Some(registry) = Self::read_venue_registry_internal(env) {
            let args = vec![env, venue.clone().into_val(env)];
            let allowed: bool =
                env.invoke_contract(&registry, &Symbol::new(env, "is_allowed"), args);
            if !allowed {
                panic_with_error!(env, Error::SwapVenueNotAllowed);
            }
        }
    }

    fn assert_swap_risk_policy(env: &Env, policy: &SwapRiskPolicy) {
        if !(0..=10_000).contains(&policy.max_price_impact_bps)
            || !(0..=10_000).contains(&policy.max_slippage_bps)
            || !(0..=10_000).contains(&policy.max_twap_deviation_bps)
            || !(1..=10_000).contains(&policy.max_trade_size_bps)
            || policy.max_oracle_age_seconds == 0
        {
            panic_with_error!(env, Error::InvalidSwapRiskPolicy);
        }
    }

    fn assert_address_allowed_or_fail(env: &Env, allowed: Vec<Address>, candidate: &Address) {
        if allowed.is_empty() {
            return;
        }
        for value in allowed.iter() {
            if value == *candidate {
                return;
            }
        }
        panic_with_error!(env, Error::SwapVenueNotAllowed);
    }

    fn positive_bps_loss(value_in: i128, value_out: i128) -> i32 {
        if value_in <= 0 || value_out >= value_in {
            return 0;
        }
        let loss = value_in - value_out;
        ((loss * 10_000i128) / value_in) as i32
    }

    fn value_with_oracle_price(env: &Env, amount: i128, price: i128) -> i128 {
        if amount <= 0 || price <= 0 {
            panic_with_error!(env, Error::SwapOracleInvalid);
        }
        match amount.checked_mul(price) {
            Some(value) => value,
            None => panic_with_error!(env, Error::SwapOracleInvalid),
        }
    }

    fn enforce_swap_risk_policy_for_step(env: &Env, s: &SwapStep, internal_router: &Address) {
        Self::assert_asset_allowed(env, &s.asset_in.contract);
        Self::assert_asset_allowed(env, &s.asset_out.contract);

        let venue = if s.router_addr == *internal_router {
            s.adapter.clone()
        } else {
            s.router_addr.clone()
        };
        Self::assert_global_venue_allowed(env, &venue);

        let policy = Self::read_swap_risk_policy_internal(env);
        if !policy.enabled {
            return;
        }

        if s.router_addr == *internal_router {
            Self::assert_address_allowed_or_fail(
                env,
                Self::read_allowed_adapters_internal(env),
                &s.adapter,
            );
        } else {
            Self::assert_address_allowed_or_fail(
                env,
                Self::read_allowed_routers_internal(env),
                &s.router_addr,
            );
        }

        let liquid = Self::liquid_balance_internal(env, &s.asset_in.contract);
        let max_allowed = (liquid * policy.max_trade_size_bps as i128) / 10_000i128;
        if s.amount_in > max_allowed {
            panic_with_error!(env, Error::SwapTradeSizeExceeded);
        }

        if !policy.oracle_checks_enabled {
            return;
        }

        let oracle = match Self::read_swap_oracle_internal(env) {
            Some(value) => value,
            None => panic_with_error!(env, Error::SwapOracleNotConfigured),
        };
        let price_in = Self::read_oracle_last_price(env, &oracle, &s.asset_in.contract);
        let price_out = Self::read_oracle_last_price(env, &oracle, &s.asset_out.contract);
        let ledger_ts = env.ledger().timestamp();
        if price_in.price <= 0
            || price_out.price <= 0
            || price_in.timestamp > ledger_ts
            || price_out.timestamp > ledger_ts
        {
            panic_with_error!(env, Error::SwapOracleInvalid);
        }
        if (ledger_ts - price_in.timestamp) > policy.max_oracle_age_seconds
            || (ledger_ts - price_out.timestamp) > policy.max_oracle_age_seconds
        {
            panic_with_error!(env, Error::SwapOracleStale);
        }

        let value_in = Self::value_with_oracle_price(env, s.amount_in, price_in.price);
        let value_out_floor = Self::value_with_oracle_price(env, s.min_out, price_out.price);
        let loss_bps = Self::positive_bps_loss(value_in, value_out_floor);

        if loss_bps > policy.max_slippage_bps {
            panic_with_error!(env, Error::SwapSlippageExceeded);
        }
        if loss_bps > policy.max_price_impact_bps {
            panic_with_error!(env, Error::SwapPriceImpactExceeded);
        }
        if loss_bps > policy.max_twap_deviation_bps {
            panic_with_error!(env, Error::SwapTwapDeviationExceeded);
        }
    }

    fn read_blend_pool_config(env: &Env, router: &Address) -> BlendPoolConfig {
        env.invoke_contract::<BlendPoolConfig>(router, &Symbol::new(env, "get_config"), vec![env])
    }

    fn read_blend_pool_positions(
        env: &Env,
        router: &Address,
        owner: &Address,
    ) -> BlendPoolPositions {
        let args = vec![env, owner.clone().into_val(env)];
        env.invoke_contract::<BlendPoolPositions>(router, &Symbol::new(env, "get_positions"), args)
    }

    fn read_blend_reserve(env: &Env, router: &Address, asset: &Address) -> BlendReserve {
        let args = vec![env, asset.clone().into_val(env)];
        env.invoke_contract::<BlendReserve>(router, &Symbol::new(env, "get_reserve"), args)
    }

    fn read_oracle_last_price(env: &Env, oracle: &Address, asset: &Address) -> OraclePriceData {
        let args = vec![env, OracleAsset::Stellar(asset.clone()).into_val(env)];
        env.invoke_contract::<OraclePriceData>(oracle, &Symbol::new(env, "lastprice"), args)
    }

    fn convert_position_shares_to_amount(shares: i128, rate: i128) -> i128 {
        (shares * rate) / BLEND_RATE_SCALE
    }

    fn value_in_denom_units(amount: i128, asset_price: i128, denom_price: i128) -> i128 {
        if denom_price <= 0 {
            return amount;
        }
        (amount * asset_price) / denom_price
    }

    fn blend_position_value_from_internal(position: BlendPosition) -> BlendPositionValue {
        let collateral_value = position.collateral_amount;
        let debt_value = position.debt_amount;
        BlendPositionValue {
            market_id: position.market_id,
            asset: position.asset,
            collateral_shares: position.collateral_amount,
            collateral_amount: position.collateral_amount,
            collateral_value,
            debt_shares: position.debt_amount,
            debt_amount: position.debt_amount,
            debt_value,
            net_value: collateral_value - debt_value,
            price: 0,
            health_factor: 0,
            c_factor: 0,
            oracle_timestamp: 0,
        }
    }

    fn blend_position_diagnostics_internal(
        env: &Env,
        market_id: u128,
        asset: &Address,
    ) -> Option<BlendPositionDiagnostics> {
        if !Self::read_blend_external_diagnostics_internal(env, market_id) {
            return None;
        }
        let position = Self::read_blend_position_internal(env, market_id, asset)?;
        let adapter = Self::read_blend_adapter_internal(env, market_id)?;
        let router = Self::read_blend_router(env, &adapter);
        let pool_config = Self::read_blend_pool_config(env, &router);
        let reserve = Self::read_blend_reserve(env, &router, &position.asset);
        let positions =
            Self::read_blend_pool_positions(env, &router, &env.current_contract_address());
        let reserve_index = reserve.config.index;
        let collateral_shares = positions.collateral.get(reserve_index).unwrap_or(0);
        let debt_shares = positions.liabilities.get(reserve_index).unwrap_or(0);
        let collateral_amount =
            Self::convert_position_shares_to_amount(collateral_shares, reserve.data.b_rate);
        let debt_amount = Self::convert_position_shares_to_amount(debt_shares, reserve.data.d_rate);
        let asset_price = Self::read_oracle_last_price(env, &pool_config.oracle, &position.asset);
        let denomination = Self::denomination(env.clone());
        let denom_price_data = if denomination.contract == position.asset {
            asset_price.clone()
        } else {
            Self::read_oracle_last_price(env, &pool_config.oracle, &denomination.contract)
        };
        let ledger_timestamp = env.ledger().timestamp();
        let has_invalid_oracle_data = asset_price.price <= 0 || denom_price_data.price <= 0;
        let has_future_oracle_timestamp = asset_price.timestamp > ledger_timestamp
            || denom_price_data.timestamp > ledger_timestamp;
        let prices_are_usable = !has_invalid_oracle_data && !has_future_oracle_timestamp;
        let collateral_value = if prices_are_usable {
            Self::value_in_denom_units(collateral_amount, asset_price.price, denom_price_data.price)
        } else {
            0
        };
        let debt_value = if prices_are_usable {
            Self::value_in_denom_units(debt_amount, asset_price.price, denom_price_data.price)
        } else {
            0
        };
        let health_factor = if debt_value == 0 {
            0
        } else {
            (collateral_value * reserve.config.c_factor as i128) / debt_value
        };

        Some(BlendPositionDiagnostics {
            value: BlendPositionValue {
                market_id,
                asset: position.asset,
                collateral_shares,
                collateral_amount,
                collateral_value,
                debt_shares,
                debt_amount,
                debt_value,
                net_value: collateral_value - debt_value,
                price: if prices_are_usable {
                    asset_price.price
                } else {
                    0
                },
                health_factor,
                c_factor: reserve.config.c_factor,
                oracle_timestamp: if asset_price.timestamp > denom_price_data.timestamp {
                    asset_price.timestamp
                } else {
                    denom_price_data.timestamp
                },
            },
            pool_status: pool_config.status,
            reserve_enabled: reserve.config.enabled,
            has_invalid_oracle_data,
            has_future_oracle_timestamp,
        })
    }

    fn blend_position_value_internal(
        env: &Env,
        market_id: u128,
        asset: &Address,
    ) -> Option<BlendPositionValue> {
        if let Some(diagnostics) = Self::blend_position_diagnostics_internal(env, market_id, asset)
        {
            return Some(diagnostics.value);
        }
        Self::read_blend_position_internal(env, market_id, asset)
            .map(Self::blend_position_value_from_internal)
    }

    fn blend_market_value_internal(env: &Env, market_id: u128) -> Option<BlendMarketValue> {
        let assets = Self::read_blend_market_assets_internal(env, market_id);
        if assets.is_empty() {
            return None;
        }

        let mut collateral_value = 0i128;
        let mut debt_value = 0i128;
        let mut collateral_buffer = 0i128;
        let mut latest_oracle_timestamp = 0u64;

        for asset in assets.iter() {
            if let Some(position_value) =
                Self::blend_position_diagnostics_internal(env, market_id, &asset)
                    .map(|diagnostics| diagnostics.value)
            {
                collateral_value += position_value.collateral_value;
                debt_value += position_value.debt_value;
                collateral_buffer += (position_value.collateral_value
                    * position_value.c_factor as i128)
                    / 10_000_000i128;
                if position_value.oracle_timestamp > latest_oracle_timestamp {
                    latest_oracle_timestamp = position_value.oracle_timestamp;
                }
            } else if let Some(position) =
                Self::read_blend_position_internal(env, market_id, &asset)
            {
                let position_value = Self::blend_position_value_from_internal(position);
                collateral_value += position_value.collateral_value;
                debt_value += position_value.debt_value;
            }
        }

        let health_factor = if debt_value == 0 {
            0
        } else {
            (collateral_buffer * 10_000_000i128) / debt_value
        };

        Some(BlendMarketValue {
            market_id,
            collateral_value,
            debt_value,
            net_value: collateral_value - debt_value,
            health_factor,
            oracle_timestamp: latest_oracle_timestamp,
        })
    }

    fn blend_market_status_internal(env: &Env, market_id: u128) -> Option<BlendMarketStatus> {
        let assets = Self::read_blend_market_assets_internal(env, market_id);
        if assets.is_empty() {
            return None;
        }

        let policy = Self::read_blend_risk_policy_internal(env, market_id);
        let external_diagnostics_enabled =
            Self::read_blend_external_diagnostics_internal(env, market_id);
        let market_value = Self::blend_market_value_internal(env, market_id);
        let ledger_timestamp = env.ledger().timestamp();
        let oracle_timestamp = market_value
            .as_ref()
            .map(|value| value.oracle_timestamp)
            .unwrap_or(0);
        let has_live_pricing = oracle_timestamp > 0;
        let oracle_age = if has_live_pricing && ledger_timestamp >= oracle_timestamp {
            ledger_timestamp - oracle_timestamp
        } else {
            0
        };
        let health_factor = market_value
            .as_ref()
            .map(|value| value.health_factor)
            .unwrap_or(0);
        let debt_value = market_value
            .as_ref()
            .map(|value| value.debt_value)
            .unwrap_or(0);
        let has_stale_oracle = if external_diagnostics_enabled || debt_value > 0 {
            !has_live_pricing || oracle_age > policy.max_oracle_age
        } else {
            false
        };
        let below_min_health_factor = debt_value > 0 && health_factor < policy.min_health_factor;
        let mut has_invalid_oracle_data = false;
        let mut has_future_oracle_timestamp = false;
        let mut has_disabled_reserve = false;
        let mut pool_status = 0u32;

        if external_diagnostics_enabled {
            for asset in assets.iter() {
                if let Some(diagnostics) =
                    Self::blend_position_diagnostics_internal(env, market_id, &asset)
                {
                    if diagnostics.has_invalid_oracle_data {
                        has_invalid_oracle_data = true;
                    }
                    if diagnostics.has_future_oracle_timestamp {
                        has_future_oracle_timestamp = true;
                    }
                    if !diagnostics.reserve_enabled {
                        has_disabled_reserve = true;
                    }
                    if diagnostics.pool_status > pool_status {
                        pool_status = diagnostics.pool_status;
                    }
                }
            }
        }
        let has_integrity_failure = has_invalid_oracle_data
            || has_future_oracle_timestamp
            || has_disabled_reserve
            || pool_status != 0;

        Some(BlendMarketStatus {
            market_id,
            has_live_pricing,
            has_stale_oracle,
            has_invalid_oracle_data,
            has_future_oracle_timestamp,
            has_disabled_reserve,
            oracle_age,
            max_oracle_age: policy.max_oracle_age,
            min_health_factor: policy.min_health_factor,
            health_factor,
            debt_value,
            pool_status,
            risky_actions_blocked: (policy.fail_close_actions
                && (has_stale_oracle || has_integrity_failure))
                || below_min_health_factor,
            nav_blocked: policy.fail_close_nav && (has_stale_oracle || has_integrity_failure),
        })
    }

    fn assert_blend_nav_available(env: &Env, market_id: u128) {
        if let Some(status) = Self::blend_market_status_internal(env, market_id) {
            if status.nav_blocked {
                panic_with_error!(env, Error::BlendNavUnavailable);
            }
        }
    }

    fn assert_blend_risky_actions_allowed(env: &Env, market_id: u128) {
        if let Some(status) = Self::blend_market_status_internal(env, market_id) {
            if status.has_stale_oracle {
                panic_with_error!(env, Error::BlendOracleStale);
            }
            if status.has_invalid_oracle_data
                || status.has_future_oracle_timestamp
                || status.has_disabled_reserve
                || status.pool_status != 0
            {
                panic_with_error!(env, Error::BlendOracleInvalid);
            }
            if status.debt_value > 0 && status.health_factor < status.min_health_factor {
                panic_with_error!(env, Error::BlendHealthFactorTooLow);
            }
            if status.risky_actions_blocked {
                panic_with_error!(env, Error::BlendOracleInvalid);
            }
        }
    }

    fn total_nav_internal(env: &Env) -> i128 {
        let tracked: Vec<Address> =
            Self::dynamic_get(env, &DataKey::TrackedAssets).unwrap_or(Vec::new(env));
        let mut nav = 0i128;
        for asset in tracked.iter() {
            nav += Self::liquid_balance_internal(env, &asset);
        }
        let markets: Vec<u128> =
            Self::dynamic_get(env, &DataKey::BlendMarkets).unwrap_or(Vec::new(env));
        for market_id in markets.iter() {
            Self::assert_blend_nav_available(env, market_id);
            if let Some(market_value) = Self::blend_market_value_internal(env, market_id) {
                nav += market_value.net_value;
            } else {
                for asset in Self::read_blend_market_assets_internal(env, market_id).iter() {
                    if let Some(position) =
                        Self::read_blend_position_internal(env, market_id, &asset)
                    {
                        nav += position.collateral_amount - position.debt_amount;
                    }
                }
            }
        }
        nav
    }

    fn refresh_aum(env: &Env) {
        let nav = Self::total_nav_internal(env);
        env.storage().instance().set(&DataKey::Aum, &nav);
    }

    fn assert_asset_allowed(env: &Env, asset: &Address) {
        let store = env.storage().instance();
        let wl: Vec<Asset> = store.get(&DataKey::Whitelist).unwrap_or(Vec::new(env));
        for entry in wl.iter() {
            if entry.contract == *asset {
                return;
            }
        }
        panic_with_error!(env, Error::AssetNotWhitelisted);
    }

    fn transfer_from_user_to_vault(env: &Env, token: &Address, user: &Address, amount: i128) {
        let self_addr = env.current_contract_address();
        let args = vec![
            env,
            self_addr.clone().into_val(env),
            user.clone().into_val(env),
            self_addr.clone().into_val(env),
            amount.into_val(env),
        ];
        Self::invoke_with_contract_auth::<()>(env, token, "transfer_from", args);
    }

    fn transfer_from_vault(env: &Env, token: &Address, to: &Address, amount: i128) {
        let self_addr = env.current_contract_address();
        let args = vec![
            env,
            self_addr.clone().into_val(env),
            to.clone().into_val(env),
            amount.into_val(env),
        ];
        Self::invoke_with_contract_auth::<()>(env, token, "transfer", args);
    }

    fn read_blend_router(env: &Env, adapter: &Address) -> Address {
        env.invoke_contract::<Address>(adapter, &Symbol::new(env, "router"), vec![env])
    }

    fn invoke_blend_adapter(
        env: &Env,
        adapter: &Address,
        asset: &Address,
        action: BlendAction,
        _market_id: u128,
        amount: i128,
    ) -> i128 {
        let self_addr = env.current_contract_address();
        let router = Self::read_blend_router(env, adapter);
        let request_type = match action {
            BlendAction::Lend => 2,
            BlendAction::Withdraw => 3,
            BlendAction::Borrow => 4,
            BlendAction::Repay => 5,
        };
        let requests = vec![
            env,
            BlendRequest {
                address: asset.clone(),
                amount,
                request_type,
            },
        ];
        let router_args = vec![
            env,
            self_addr.clone().into_val(env),
            self_addr.clone().into_val(env),
            self_addr.clone().into_val(env),
            requests.into_val(env),
        ];
        let mut auths = vec![
            env,
            InvokerContractAuthEntry::Contract(SubContractInvocation {
                context: ContractContext {
                    contract: router.clone(),
                    fn_name: Symbol::new(env, "submit"),
                    args: router_args.clone(),
                },
                sub_invocations: vec![env],
            }),
        ];
        if matches!(action, BlendAction::Lend | BlendAction::Repay) {
            auths.push_back(InvokerContractAuthEntry::Contract(SubContractInvocation {
                context: ContractContext {
                    contract: asset.clone(),
                    fn_name: symbol_short!("transfer"),
                    args: vec![
                        env,
                        self_addr.clone().into_val(env),
                        router.clone().into_val(env),
                        amount.into_val(env),
                    ],
                },
                sub_invocations: vec![env],
            }));
        }
        env.authorize_as_current_contract(auths);
        let _: Val = env.invoke_contract(&router, &Symbol::new(env, "submit"), router_args);
        amount
    }

    pub fn init(
        env: Env,
        denomination_contract: Address,
        mgmt_bps: i32,
        perf_bps: i32,
        deposit_bps: i32,
        redeem_bps: i32,
        whitelist_contracts: Vec<Address>,
        manager: Address,
    ) {
        Self::assert_fee_bps(&env, mgmt_bps);
        Self::assert_fee_bps(&env, perf_bps);
        Self::assert_fee_bps(&env, deposit_bps);
        Self::assert_fee_bps(&env, redeem_bps);

        let store = env.storage().instance();
        if store.has(&DataKey::Denomination) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        let denomination = Asset {
            contract: denomination_contract.clone(),
        };
        let fees = FeeStructure {
            mgmt_bps,
            perf_bps,
            deposit_bps,
            redeem_bps,
        };
        let mut wl_assets: Vec<Asset> = Vec::new(&env);
        for addr in whitelist_contracts.iter() {
            wl_assets.push_back(Asset {
                contract: addr.clone(),
            });
            Self::track_asset(&env, &addr);
        }
        Self::track_asset(&env, &denomination_contract);
        store.set(&DataKey::Denomination, &denomination);
        store.set(&DataKey::Fees, &fees);
        store.set(&DataKey::Whitelist, &wl_assets);
        store.set(&DataKey::Manager, &manager);
        store.set(&DataKey::TotalShares, &0i128);
        store.set(&DataKey::Aum, &0i128);
        store.set(
            &DataKey::FeeState,
            &FeeState {
                last_settlement_ts: env.ledger().timestamp(),
                high_water_mark: SHARE_PRICE_SCALE,
                cumulative_management_shares: 0,
                cumulative_performance_shares: 0,
                cumulative_manager_shares: 0,
                cumulative_protocol_shares: 0,
            },
        );
        store.set(
            &DataKey::ProtocolFeePolicy,
            &ProtocolFeePolicy {
                mgmt_protocol_bps: 0,
                perf_protocol_bps: 0,
            },
        );
        store.set(&DataKey::SwapRiskPolicy, &Self::default_swap_risk_policy());
        store.set(&DataKey::AllowedRouters, &Vec::<Address>::new(&env));
        store.set(&DataKey::AllowedAdapters, &Vec::<Address>::new(&env));
        env.events().publish(
            (EVENT_INIT,),
            (
                manager,
                denomination_contract,
                whitelist_contracts,
                mgmt_bps,
                perf_bps,
                deposit_bps,
                redeem_bps,
            ),
        );
    }

    pub fn set_governor(env: Env, caller: Address, governor: Address) {
        let store = env.storage().instance();
        if let Some(current_governor) = store.get::<DataKey, Address>(&DataKey::Governor) {
            if caller != current_governor {
                panic_with_error!(&env, Error::UnauthorizedPolicy);
            }
            caller.require_auth();
        } else {
            let manager: Address = match store.get(&DataKey::Manager) {
                Some(m) => m,
                None => panic_with_error!(&env, Error::NotInitialized),
            };
            if caller != manager {
                panic_with_error!(&env, Error::UnauthorizedPolicy);
            }
            caller.require_auth();
        }
        store.set(&DataKey::Governor, &governor);
        env.events()
            .publish((EVENT_GOVERNOR_SET,), (caller, governor));
    }

    pub fn set_bootstrap_admin(env: Env, caller: Address, admin: Address, expires_at: u64) {
        let can_bootstrap_update = Self::bootstrap_admin_active_internal(&env)
            && env
                .storage()
                .instance()
                .get::<DataKey, Address>(&DataKey::BootstrapAdmin)
                .is_some();
        if can_bootstrap_update {
            Self::require_bootstrap_or_governor_auth(&env, &caller);
        } else {
            Self::require_policy_auth(&env, &caller);
        }
        Self::require_future_bootstrap_expiry(&env, expires_at);
        let store = env.storage().instance();
        if let Some(current_expires_at) =
            store.get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
        {
            assert!(
                expires_at <= current_expires_at,
                "bootstrap_admin_expiry_locked"
            );
        }
        store.set(&DataKey::BootstrapAdmin, &admin);
        store.set(&DataKey::BootstrapAdminExpiresAt, &expires_at);
    }

    pub fn set_bootstrap_admin_expiry(env: Env, caller: Address, expires_at: u64) {
        Self::require_bootstrap_or_governor_auth(&env, &caller);
        Self::require_future_bootstrap_expiry(&env, expires_at);
        if let Some(current_expires_at) = env
            .storage()
            .instance()
            .get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
        {
            assert!(
                expires_at <= current_expires_at,
                "bootstrap_admin_expiry_locked"
            );
        }
        env.storage()
            .instance()
            .set(&DataKey::BootstrapAdminExpiresAt, &expires_at);
    }

    pub fn clear_bootstrap_admin(env: Env, caller: Address) {
        Self::require_governor_caller_auth(&env, &caller);
        let store = env.storage().instance();
        store.remove(&DataKey::BootstrapAdmin);
        store.remove(&DataKey::BootstrapAdminExpiresAt);
    }

    pub fn bootstrap_admin(env: Env) -> Option<Address> {
        env.storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::BootstrapAdmin)
    }

    pub fn bootstrap_admin_expires_at(env: Env) -> Option<u64> {
        env.storage()
            .instance()
            .get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
    }

    pub fn bootstrap_admin_active(env: Env) -> bool {
        Self::bootstrap_admin_active_internal(&env)
    }

    pub fn upgrade(env: Env, caller: Address, new_wasm_hash: BytesN<32>) {
        Self::require_bootstrap_or_governor_auth(&env, &caller);
        env.storage()
            .instance()
            .set(&DataKey::LastWasmHash, &new_wasm_hash);
        env.events()
            .publish((symbol_short!("upgrade"),), new_wasm_hash.clone());
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    pub fn last_wasm_hash(env: Env) -> Option<BytesN<32>> {
        env.storage()
            .instance()
            .get::<DataKey, BytesN<32>>(&DataKey::LastWasmHash)
    }

    pub fn set_fees(
        env: Env,
        caller: Address,
        mgmt_bps: i32,
        perf_bps: i32,
        deposit_bps: i32,
        redeem_bps: i32,
    ) {
        Self::require_policy_auth(&env, &caller);
        Self::settle_fees_internal(&env);
        Self::assert_fee_bps(&env, mgmt_bps);
        Self::assert_fee_bps(&env, perf_bps);
        Self::assert_fee_bps(&env, deposit_bps);
        Self::assert_fee_bps(&env, redeem_bps);
        let fees = FeeStructure {
            mgmt_bps,
            perf_bps,
            deposit_bps,
            redeem_bps,
        };
        env.storage().instance().set(&DataKey::Fees, &fees);
        env.events().publish(
            (EVENT_FEES_CFG,),
            (caller, mgmt_bps, perf_bps, deposit_bps, redeem_bps),
        );
    }

    pub fn set_protocol_fee_policy(
        env: Env,
        caller: Address,
        treasury: Address,
        mgmt_protocol_bps: i32,
        perf_protocol_bps: i32,
    ) {
        Self::require_policy_auth(&env, &caller);
        Self::settle_fees_internal(&env);
        Self::assert_protocol_fee_bps(&env, mgmt_protocol_bps);
        Self::assert_protocol_fee_bps(&env, perf_protocol_bps);
        env.storage()
            .instance()
            .set(&DataKey::ProtocolTreasury, &treasury);
        env.storage().instance().set(
            &DataKey::ProtocolFeePolicy,
            &ProtocolFeePolicy {
                mgmt_protocol_bps,
                perf_protocol_bps,
            },
        );
        env.events().publish(
            (EVENT_PROTOCOL_FEE_CFG,),
            (caller, treasury, mgmt_protocol_bps, perf_protocol_bps),
        );
    }

    pub fn set_whitelist(env: Env, caller: Address, whitelist_contracts: Vec<Address>) {
        Self::require_policy_auth(&env, &caller);
        let mut wl_assets: Vec<Asset> = Vec::new(&env);
        for addr in whitelist_contracts.iter() {
            wl_assets.push_back(Asset {
                contract: addr.clone(),
            });
            Self::track_asset(&env, &addr);
        }
        env.storage()
            .instance()
            .set(&DataKey::Whitelist, &wl_assets);
        env.events()
            .publish((EVENT_WHITELIST_CFG,), (caller, whitelist_contracts));
    }

    pub fn set_swap_risk_policy(
        env: Env,
        caller: Address,
        enabled: bool,
        oracle_checks_enabled: bool,
        max_price_impact_bps: i32,
        max_slippage_bps: i32,
        max_twap_deviation_bps: i32,
        max_oracle_age_seconds: u64,
        max_trade_size_bps: i32,
    ) {
        Self::require_policy_auth(&env, &caller);
        let policy = SwapRiskPolicy {
            enabled,
            oracle_checks_enabled,
            max_price_impact_bps,
            max_slippage_bps,
            max_twap_deviation_bps,
            max_oracle_age_seconds,
            max_trade_size_bps,
        };
        Self::assert_swap_risk_policy(&env, &policy);
        env.storage()
            .instance()
            .set(&DataKey::SwapRiskPolicy, &policy);
        env.events()
            .publish((EVENT_SWAP_POLICY_CFG,), (caller, policy));
    }

    pub fn set_swap_oracle(env: Env, caller: Address, oracle: Address) {
        Self::require_policy_auth(&env, &caller);
        env.storage().instance().set(&DataKey::SwapOracle, &oracle);
        env.events()
            .publish((EVENT_SWAP_ORACLE_SET,), (caller, oracle));
    }

    pub fn set_allowed_venues(
        env: Env,
        caller: Address,
        allowed_routers: Vec<Address>,
        allowed_adapters: Vec<Address>,
    ) {
        Self::require_policy_auth(&env, &caller);
        env.storage()
            .instance()
            .set(&DataKey::AllowedRouters, &allowed_routers);
        env.storage()
            .instance()
            .set(&DataKey::AllowedAdapters, &allowed_adapters);
        env.events().publish(
            (EVENT_SWAP_VENUES_CFG,),
            (caller, allowed_routers, allowed_adapters),
        );
    }

    pub fn set_venue_registry(env: Env, caller: Address, registry: Address) {
        Self::require_policy_auth(&env, &caller);
        env.storage()
            .instance()
            .set(&DataKey::VenueRegistry, &registry);
        env.events()
            .publish((EVENT_VENUE_REGISTRY_SET,), (caller, registry));
    }

    pub fn clear_venue_registry(env: Env, caller: Address) {
        Self::require_policy_auth(&env, &caller);
        env.storage().instance().remove(&DataKey::VenueRegistry);
        env.events().publish(
            (EVENT_VENUE_REGISTRY_SET,),
            (caller, Option::<Address>::None),
        );
    }

    pub fn set_manager(env: Env, caller: Address, manager: Address) {
        Self::require_policy_auth(&env, &caller);
        Self::settle_fees_internal(&env);
        env.storage().instance().set(&DataKey::Manager, &manager);
        env.events()
            .publish((EVENT_MANAGER_SET,), (caller, manager));
    }

    pub fn set_router(env: Env, caller: Address, router: Address) {
        Self::require_policy_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Router, &router);
        env.events().publish((EVENT_ROUTER_SET,), (caller, router));
    }

    pub fn set_share_token(env: Env, caller: Address, share_token: Address) {
        Self::require_policy_auth(&env, &caller);
        env.storage()
            .instance()
            .set(&DataKey::ShareToken, &share_token);
        env.events()
            .publish((EVENT_SHARE_TOKEN_SET,), (caller, share_token));
    }

    pub fn set_blend_risk_policy(
        env: Env,
        caller: Address,
        market_id: u128,
        max_oracle_age: u64,
        min_health_factor: i128,
        fail_close_nav: bool,
        fail_close_actions: bool,
    ) {
        Self::require_policy_auth(&env, &caller);
        Self::assert_blend_risk_policy(&env, max_oracle_age, min_health_factor);
        let key = DataKey::BlendRiskPolicy(market_id);
        Self::dynamic_set(
            &env,
            &key,
            &BlendRiskPolicy {
                market_id,
                max_oracle_age,
                min_health_factor,
                fail_close_nav,
                fail_close_actions,
            },
        );
        env.events().publish(
            (EVENT_BLEND_POLICY_CFG,),
            (
                caller,
                market_id,
                max_oracle_age,
                min_health_factor,
                fail_close_nav,
                fail_close_actions,
            ),
        );
    }

    pub fn set_blend_external_diagnostics(
        env: Env,
        caller: Address,
        market_id: u128,
        enabled: bool,
    ) {
        Self::require_policy_auth(&env, &caller);
        let key = DataKey::BlendExternalDiagnostics(market_id);
        Self::dynamic_set(&env, &key, &enabled);
        env.events()
            .publish((EVENT_BLEND_DIAGNOSTICS_CFG,), (caller, market_id, enabled));
    }

    pub fn configure_credit_market(
        env: Env,
        caller: Address,
        protocol: CreditProtocol,
        market_id: u128,
        adapter: Address,
        allow_supply: bool,
        allow_borrow: bool,
        allow_repay: bool,
        allow_withdraw: bool,
        enabled: bool,
    ) {
        Self::require_policy_auth(&env, &caller);
        let protocol_event = protocol.clone();
        let adapter_event = adapter.clone();
        Self::write_credit_market_config(
            &env,
            &CreditMarketConfig {
                protocol,
                market_id,
                adapter,
                allow_supply,
                allow_borrow,
                allow_repay,
                allow_withdraw,
                enabled,
            },
        );
        env.events().publish(
            (EVENT_CREDIT_MARKET_CFG,),
            (
                caller,
                Self::credit_protocol_event_code(&protocol_event),
                market_id,
                adapter_event,
                allow_supply,
                allow_borrow,
                allow_repay,
                allow_withdraw,
                enabled,
            ),
        );
    }

    pub fn deposit(env: Env, user: Address, asset: Asset, amount: i128) -> i128 {
        user.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::AmountZero);
        }
        Self::assert_asset_allowed(&env, &asset.contract);
        Self::settle_fees_internal(&env);
        let nav_before = Self::total_nav_internal(&env);
        Self::transfer_from_user_to_vault(&env, &asset.contract, &user, amount);
        Self::add_liquid_balance(&env, &asset.contract, amount);

        let fees: FeeStructure =
            env.storage()
                .instance()
                .get(&DataKey::Fees)
                .unwrap_or(FeeStructure {
                    mgmt_bps: 0,
                    perf_bps: 0,
                    deposit_bps: 0,
                    redeem_bps: 0,
                });
        let net_amount = Self::apply_fee_bps(amount, fees.deposit_bps);
        let total = Self::total_shares_internal(&env);
        let shares_minted = if total == 0 || nav_before == 0 {
            net_amount
        } else {
            (net_amount * total) / nav_before
        };
        if shares_minted <= 0 {
            panic_with_error!(&env, Error::SharesZero);
        }
        Self::mint_shares_to(&env, &user, shares_minted);
        Self::refresh_aum(&env);
        env.events()
            .publish((EVENT_DEPOSIT,), (user.clone(), amount, shares_minted));
        shares_minted
    }

    pub fn redeem(env: Env, user: Address, shares: i128) -> i128 {
        user.require_auth();
        if shares <= 0 {
            panic_with_error!(&env, Error::SharesZero);
        }
        Self::settle_fees_internal(&env);
        let store = env.storage().instance();
        let user_bal: i128 = Self::dynamic_get(&env, &DataKey::Balance(user.clone())).unwrap_or(0);
        if shares > user_bal {
            panic_with_error!(&env, Error::InsufficientUserShares);
        }
        let total = Self::total_shares_internal(&env);
        if shares > total {
            panic_with_error!(&env, Error::InsufficientShares);
        }

        let nav = Self::total_nav_internal(&env);
        let gross_out = if total == 0 {
            0
        } else {
            (shares * nav) / total
        };
        let fees: FeeStructure = store.get(&DataKey::Fees).unwrap_or(FeeStructure {
            mgmt_bps: 0,
            perf_bps: 0,
            deposit_bps: 0,
            redeem_bps: 0,
        });
        let net_out = Self::apply_fee_bps(gross_out, fees.redeem_bps);
        let denom: Asset = match store.get(&DataKey::Denomination) {
            Some(d) => d,
            None => panic_with_error!(&env, Error::NotInitialized),
        };
        if Self::liquid_balance_internal(&env, &denom.contract) < net_out {
            panic_with_error!(&env, Error::InsufficientLiquidity);
        }

        Self::burn_shares_from(&env, &user, shares);
        Self::add_liquid_balance(&env, &denom.contract, -net_out);
        Self::transfer_from_vault(&env, &denom.contract, &user, net_out);
        Self::refresh_aum(&env);
        env.events()
            .publish((EVENT_REDEEM,), (user.clone(), shares, net_out));
        net_out
    }

    pub fn rebalance(env: Env, manager: Address, steps: Vec<SwapStep>) -> i128 {
        Self::require_manager(&env, &manager);
        Self::settle_fees_internal(&env);
        let store = env.storage().instance();
        let router_internal: Address = match store.get(&DataKey::Router) {
            Some(r) => r,
            None => panic_with_error!(&env, Error::RouterNotSet),
        };
        let self_addr = env.current_contract_address();
        let latest = env.ledger().sequence();
        let exp: u32 = latest + 100_000;
        let mut total_out: i128 = 0;
        let mut internal_steps: Vec<RouterStep> = Vec::new(&env);
        let mut first_internal_in: Option<(Address, i128)> = None;
        let mut last_internal_out: Option<Address> = None;

        for s in steps.iter() {
            Self::enforce_swap_risk_policy_for_step(&env, &s, &router_internal);
            if Self::liquid_balance_internal(&env, &s.asset_in.contract) < s.amount_in {
                panic_with_error!(&env, Error::InsufficientLiquidity);
            }
            if s.router_addr != router_internal {
                Self::add_liquid_balance(&env, &s.asset_in.contract, -s.amount_in);
                let args_approve = vec![
                    &env,
                    self_addr.clone().into_val(&env),
                    s.router_addr.clone().into_val(&env),
                    s.amount_in.into_val(&env),
                    exp.into_val(&env),
                ];
                let _ = env.invoke_contract::<()>(
                    &s.asset_in.contract,
                    &symbol_short!("approve"),
                    args_approve,
                );
                let mut path: Vec<Address> = Vec::new(&env);
                path.push_back(s.asset_in.contract.clone());
                path.push_back(s.asset_out.contract.clone());
                let deadline: u64 = env.ledger().timestamp() + 1800u64;
                let args_swap = vec![
                    &env,
                    s.amount_in.into_val(&env),
                    s.min_out.into_val(&env),
                    path.into_val(&env),
                    self_addr.clone().into_val(&env),
                    deadline.into_val(&env),
                ];
                let func = Symbol::new(&env, "swap_exact_tokens_for_tokens");
                let amounts: Vec<i128> = env.invoke_contract(&s.router_addr, &func, args_swap);
                let mut out: i128 = 0;
                for v in amounts.iter() {
                    out = v;
                }
                Self::add_liquid_balance(&env, &s.asset_out.contract, out);
                total_out += out;
            } else {
                if first_internal_in.is_none() {
                    first_internal_in = Some((s.asset_in.contract.clone(), s.amount_in));
                }
                last_internal_out = Some(s.asset_out.contract.clone());
                Self::add_liquid_balance(&env, &s.asset_in.contract, -s.amount_in);
                let args_transfer = vec![
                    &env,
                    self_addr.clone().into_val(&env),
                    s.adapter.clone().into_val(&env),
                    s.amount_in.into_val(&env),
                ];
                Self::invoke_with_contract_auth::<()>(
                    &env,
                    &s.asset_in.contract,
                    "transfer",
                    args_transfer,
                );
                internal_steps.push_back(RouterStep {
                    adapter: s.adapter,
                    pool_id: s.pool_id,
                    amount_in: s.amount_in,
                    min_out: s.min_out,
                    asset_out: s.asset_out.clone(),
                });
            }
        }

        if internal_steps.len() > 0 {
            let args = vec![
                &env,
                manager.clone().into_val(&env),
                self_addr.clone().into_val(&env),
                internal_steps.into_val(&env),
            ];
            let out_internal: i128 =
                env.invoke_contract(&router_internal, &Symbol::new(&env, "execute_for"), args);
            if let Some(asset) = last_internal_out {
                Self::add_liquid_balance(&env, &asset, out_internal);
            }
            total_out += out_internal;
        }

        Self::refresh_aum(&env);
        Self::settle_fees_internal(&env);
        env.events()
            .publish((EVENT_PROFIT,), (total_out, steps.len() as u32));
        total_out
    }

    fn blend_lend_internal(
        env: &Env,
        manager: &Address,
        adapter: &Address,
        market_id: u128,
        asset: &Address,
        amount: i128,
    ) -> i128 {
        Self::require_manager(env, manager);
        Self::assert_global_venue_allowed(env, adapter);
        if amount <= 0 {
            panic_with_error!(env, Error::AmountZero);
        }
        Self::assert_asset_allowed(env, asset);
        let effective_asset = asset.clone();
        if Self::liquid_balance_internal(env, &effective_asset) < amount {
            panic_with_error!(env, Error::InsufficientLiquidity);
        }
        let _ = Self::invoke_blend_adapter(
            env,
            adapter,
            &effective_asset,
            BlendAction::Lend,
            market_id,
            amount,
        );
        let mut position = Self::read_blend_position_internal(env, market_id, &effective_asset)
            .unwrap_or(BlendPosition {
                market_id,
                asset: effective_asset.clone(),
                collateral_amount: 0,
                debt_amount: 0,
            });
        if position.asset != effective_asset {
            panic_with_error!(env, Error::InvalidBlendPosition);
        }
        position.collateral_amount += amount;
        Self::write_blend_adapter(env, market_id, adapter);
        Self::add_liquid_balance(env, &effective_asset, -amount);
        Self::write_blend_position(env, &position);
        env.events()
            .publish((EVENT_BLEND,), (symbol_short!("lend"), market_id, amount));
        amount
    }

    fn blend_borrow_internal(
        env: &Env,
        manager: &Address,
        adapter: &Address,
        market_id: u128,
        asset: &Address,
        amount: i128,
    ) -> i128 {
        Self::require_manager(env, manager);
        Self::assert_global_venue_allowed(env, adapter);
        if amount <= 0 {
            panic_with_error!(env, Error::AmountZero);
        }
        Self::assert_asset_allowed(env, asset);
        let effective_asset = asset.clone();
        let out = Self::invoke_blend_adapter(
            env,
            adapter,
            &effective_asset,
            BlendAction::Borrow,
            market_id,
            amount,
        );
        let mut position = Self::read_blend_position_internal(env, market_id, &effective_asset)
            .unwrap_or(BlendPosition {
                market_id,
                asset: effective_asset.clone(),
                collateral_amount: 0,
                debt_amount: 0,
            });
        if position.asset != effective_asset {
            panic_with_error!(env, Error::InvalidBlendPosition);
        }
        position.debt_amount += out;
        Self::write_blend_adapter(env, market_id, adapter);
        Self::add_liquid_balance(env, &effective_asset, out);
        Self::write_blend_position(env, &position);
        Self::assert_blend_risky_actions_allowed(env, market_id);
        env.events()
            .publish((EVENT_BLEND,), (symbol_short!("borrow"), market_id, out));
        out
    }

    fn blend_repay_internal(
        env: &Env,
        manager: &Address,
        adapter: &Address,
        market_id: u128,
        asset: &Address,
        amount: i128,
    ) -> i128 {
        Self::require_manager(env, manager);
        Self::assert_global_venue_allowed(env, adapter);
        if amount <= 0 {
            panic_with_error!(env, Error::AmountZero);
        }
        Self::assert_asset_allowed(env, asset);
        let effective_asset = asset.clone();
        let mut position =
            match Self::read_blend_position_internal(env, market_id, &effective_asset) {
                Some(p) => p,
                None => panic_with_error!(env, Error::InvalidBlendPosition),
            };
        if position.asset != effective_asset || position.debt_amount < amount {
            panic_with_error!(env, Error::InvalidBlendPosition);
        }
        if Self::liquid_balance_internal(env, &effective_asset) < amount {
            panic_with_error!(env, Error::InsufficientLiquidity);
        }
        let _ = Self::invoke_blend_adapter(
            env,
            adapter,
            &effective_asset,
            BlendAction::Repay,
            market_id,
            amount,
        );
        position.debt_amount -= amount;
        Self::add_liquid_balance(env, &effective_asset, -amount);
        Self::write_blend_position(env, &position);
        if Self::read_blend_market_assets_internal(env, market_id).is_empty() {
            Self::clear_blend_adapter(env, market_id);
        } else {
            Self::write_blend_adapter(env, market_id, adapter);
        }
        env.events()
            .publish((EVENT_BLEND,), (symbol_short!("repay"), market_id, amount));
        amount
    }

    fn blend_withdraw_internal(
        env: &Env,
        manager: &Address,
        adapter: &Address,
        market_id: u128,
        asset: &Address,
        amount: i128,
    ) -> i128 {
        Self::require_manager(env, manager);
        Self::assert_global_venue_allowed(env, adapter);
        if amount <= 0 {
            panic_with_error!(env, Error::AmountZero);
        }
        Self::assert_asset_allowed(env, asset);
        let effective_asset = asset.clone();
        let mut position =
            match Self::read_blend_position_internal(env, market_id, &effective_asset) {
                Some(p) => p,
                None => panic_with_error!(env, Error::InvalidBlendPosition),
            };
        if position.asset != effective_asset || position.collateral_amount < amount {
            panic_with_error!(env, Error::InvalidBlendPosition);
        }
        let out = Self::invoke_blend_adapter(
            env,
            adapter,
            &effective_asset,
            BlendAction::Withdraw,
            market_id,
            amount,
        );
        position.collateral_amount -= amount;
        Self::add_liquid_balance(env, &effective_asset, out);
        Self::write_blend_position(env, &position);
        if Self::read_blend_market_assets_internal(env, market_id).is_empty() {
            Self::clear_blend_adapter(env, market_id);
        } else {
            Self::write_blend_adapter(env, market_id, adapter);
        }
        Self::assert_blend_risky_actions_allowed(env, market_id);
        env.events()
            .publish((EVENT_BLEND,), (symbol_short!("wdrw"), market_id, out));
        out
    }

    pub fn credit_supply(
        env: Env,
        manager: Address,
        protocol: CreditProtocol,
        market_id: u128,
        asset: Address,
        amount: i128,
    ) -> i128 {
        Self::settle_fees_internal(&env);
        let config = Self::require_credit_market_config(&env, &protocol, market_id);
        Self::assert_credit_action_allowed(&env, &config, &CreditAction::Supply);
        match protocol {
            CreditProtocol::Blend => Self::blend_lend_internal(
                &env,
                &manager,
                &config.adapter,
                market_id,
                &asset,
                amount,
            ),
        }
    }

    pub fn credit_borrow(
        env: Env,
        manager: Address,
        protocol: CreditProtocol,
        market_id: u128,
        asset: Address,
        amount: i128,
    ) -> i128 {
        Self::settle_fees_internal(&env);
        let config = Self::require_credit_market_config(&env, &protocol, market_id);
        Self::assert_credit_action_allowed(&env, &config, &CreditAction::Borrow);
        match protocol {
            CreditProtocol::Blend => Self::blend_borrow_internal(
                &env,
                &manager,
                &config.adapter,
                market_id,
                &asset,
                amount,
            ),
        }
    }

    pub fn credit_repay(
        env: Env,
        manager: Address,
        protocol: CreditProtocol,
        market_id: u128,
        asset: Address,
        amount: i128,
    ) -> i128 {
        Self::settle_fees_internal(&env);
        let config = Self::require_credit_market_config(&env, &protocol, market_id);
        Self::assert_credit_action_allowed(&env, &config, &CreditAction::Repay);
        match protocol {
            CreditProtocol::Blend => Self::blend_repay_internal(
                &env,
                &manager,
                &config.adapter,
                market_id,
                &asset,
                amount,
            ),
        }
    }

    pub fn credit_withdraw(
        env: Env,
        manager: Address,
        protocol: CreditProtocol,
        market_id: u128,
        asset: Address,
        amount: i128,
    ) -> i128 {
        Self::settle_fees_internal(&env);
        let config = Self::require_credit_market_config(&env, &protocol, market_id);
        Self::assert_credit_action_allowed(&env, &config, &CreditAction::Withdraw);
        match protocol {
            CreditProtocol::Blend => Self::blend_withdraw_internal(
                &env,
                &manager,
                &config.adapter,
                market_id,
                &asset,
                amount,
            ),
        }
    }

    pub fn blend_lend(
        env: Env,
        manager: Address,
        adapter: Address,
        market_id: u128,
        asset: Address,
        amount: i128,
    ) -> i128 {
        Self::settle_fees_internal(&env);
        Self::require_legacy_blend_market_action(&env, &adapter, market_id, &CreditAction::Supply);
        Self::blend_lend_internal(&env, &manager, &adapter, market_id, &asset, amount)
    }

    pub fn blend_borrow(
        env: Env,
        manager: Address,
        adapter: Address,
        market_id: u128,
        asset: Address,
        amount: i128,
    ) -> i128 {
        Self::settle_fees_internal(&env);
        Self::require_legacy_blend_market_action(&env, &adapter, market_id, &CreditAction::Borrow);
        Self::blend_borrow_internal(&env, &manager, &adapter, market_id, &asset, amount)
    }

    pub fn blend_repay(
        env: Env,
        manager: Address,
        adapter: Address,
        market_id: u128,
        asset: Address,
        amount: i128,
    ) -> i128 {
        Self::settle_fees_internal(&env);
        Self::require_legacy_blend_market_action(&env, &adapter, market_id, &CreditAction::Repay);
        Self::blend_repay_internal(&env, &manager, &adapter, market_id, &asset, amount)
    }

    pub fn blend_withdraw(
        env: Env,
        manager: Address,
        adapter: Address,
        market_id: u128,
        asset: Address,
        amount: i128,
    ) -> i128 {
        Self::settle_fees_internal(&env);
        Self::require_legacy_blend_market_action(
            &env,
            &adapter,
            market_id,
            &CreditAction::Withdraw,
        );
        Self::blend_withdraw_internal(&env, &manager, &adapter, market_id, &asset, amount)
    }

    pub fn manager(env: Env) -> Address {
        match env.storage().instance().get(&DataKey::Manager) {
            Some(m) => m,
            None => panic_with_error!(&env, Error::NotInitialized),
        }
    }

    pub fn router(env: Env) -> Address {
        match env.storage().instance().get(&DataKey::Router) {
            Some(r) => r,
            None => panic_with_error!(&env, Error::RouterNotSet),
        }
    }

    pub fn denomination(env: Env) -> Asset {
        match env.storage().instance().get(&DataKey::Denomination) {
            Some(d) => d,
            None => panic_with_error!(&env, Error::NotInitialized),
        }
    }

    pub fn shares_of(env: Env, user: Address) -> i128 {
        if let Some(balance) = Self::maybe_share_token_balance(&env, &user) {
            return balance;
        }
        Self::dynamic_get(&env, &DataKey::Balance(user)).unwrap_or(0)
    }

    pub fn share_token(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::ShareToken)
    }

    pub fn governor(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Governor)
    }

    pub fn fees(env: Env) -> FeeStructure {
        env.storage()
            .instance()
            .get(&DataKey::Fees)
            .unwrap_or(FeeStructure {
                mgmt_bps: 0,
                perf_bps: 0,
                deposit_bps: 0,
                redeem_bps: 0,
            })
    }

    pub fn protocol_treasury(env: Env) -> Option<Address> {
        Self::protocol_treasury_internal(&env)
    }

    pub fn protocol_fee_policy(env: Env) -> ProtocolFeePolicy {
        Self::protocol_fee_policy_internal(&env)
    }

    pub fn fee_state(env: Env) -> FeeState {
        Self::fee_state_internal(&env)
    }

    pub fn preview_fee_settlement(env: Env) -> FeeSettlement {
        Self::preview_fee_settlement_internal(&env)
    }

    pub fn settle_fees(env: Env) -> FeeSettlement {
        Self::settle_fees_internal(&env)
    }

    pub fn whitelist(env: Env) -> Vec<Asset> {
        env.storage()
            .instance()
            .get(&DataKey::Whitelist)
            .unwrap_or(Vec::new(&env))
    }

    pub fn swap_risk_policy(env: Env) -> SwapRiskPolicy {
        Self::read_swap_risk_policy_internal(&env)
    }

    pub fn swap_oracle(env: Env) -> Option<Address> {
        Self::read_swap_oracle_internal(&env)
    }

    pub fn allowed_routers(env: Env) -> Vec<Address> {
        Self::read_allowed_routers_internal(&env)
    }

    pub fn allowed_adapters(env: Env) -> Vec<Address> {
        Self::read_allowed_adapters_internal(&env)
    }

    pub fn venue_registry(env: Env) -> Option<Address> {
        Self::read_venue_registry_internal(&env)
    }

    pub fn nav(env: Env) -> i128 {
        Self::total_nav_internal(&env)
    }

    pub fn liquid_balance(env: Env, asset: Address) -> i128 {
        Self::liquid_balance_internal(&env, &asset)
    }

    pub fn blend_markets(env: Env) -> Vec<u128> {
        Self::dynamic_get(&env, &DataKey::BlendMarkets).unwrap_or(Vec::new(&env))
    }

    pub fn blend_market_assets(env: Env, market_id: u128) -> Vec<Address> {
        Self::read_blend_market_assets_internal(&env, market_id)
    }

    pub fn blend_position(env: Env, market_id: u128, asset: Address) -> Option<BlendPosition> {
        Self::read_blend_position_internal(&env, market_id, &asset)
    }

    pub fn blend_positions(env: Env, market_id: u128) -> Vec<BlendPosition> {
        let mut positions = Vec::new(&env);
        for asset in Self::read_blend_market_assets_internal(&env, market_id).iter() {
            if let Some(position) = Self::read_blend_position_internal(&env, market_id, &asset) {
                positions.push_back(position);
            }
        }
        positions
    }

    pub fn blend_position_value(
        env: Env,
        market_id: u128,
        asset: Address,
    ) -> Option<BlendPositionValue> {
        Self::blend_position_value_internal(&env, market_id, &asset)
    }

    pub fn blend_position_values(env: Env, market_id: u128) -> Vec<BlendPositionValue> {
        let mut values = Vec::new(&env);
        for asset in Self::read_blend_market_assets_internal(&env, market_id).iter() {
            if let Some(value) = Self::blend_position_value_internal(&env, market_id, &asset) {
                values.push_back(value);
            }
        }
        values
    }

    pub fn blend_market_value(env: Env, market_id: u128) -> Option<BlendMarketValue> {
        Self::blend_market_value_internal(&env, market_id)
    }

    pub fn blend_health_factor(env: Env, market_id: u128) -> Option<i128> {
        Self::blend_market_value_internal(&env, market_id).map(|position| position.health_factor)
    }

    pub fn blend_risk_policy(env: Env, market_id: u128) -> BlendRiskPolicy {
        Self::read_blend_risk_policy_internal(&env, market_id)
    }

    pub fn blend_external_diagnostics(env: Env, market_id: u128) -> bool {
        Self::read_blend_external_diagnostics_internal(&env, market_id)
    }

    pub fn blend_market_status(env: Env, market_id: u128) -> Option<BlendMarketStatus> {
        Self::blend_market_status_internal(&env, market_id)
    }

    pub fn credit_markets(env: Env, protocol: CreditProtocol) -> Vec<u128> {
        Self::read_credit_markets_internal(&env, &protocol)
    }

    pub fn credit_protocols(env: Env) -> Vec<CreditProtocol> {
        Self::dynamic_get(&env, &DataKey::CreditProtocols).unwrap_or(Vec::new(&env))
    }

    pub fn credit_market_config(
        env: Env,
        protocol: CreditProtocol,
        market_id: u128,
    ) -> Option<CreditMarketConfig> {
        Self::read_credit_market_config_internal(&env, &protocol, market_id)
    }

    pub fn credit_market_configs(env: Env, protocol: CreditProtocol) -> Vec<CreditMarketConfig> {
        Self::read_credit_market_configs_internal(&env, &protocol)
    }

    pub fn credit_market_assets(
        env: Env,
        protocol: CreditProtocol,
        market_id: u128,
    ) -> Vec<Address> {
        match protocol {
            CreditProtocol::Blend => Self::blend_market_assets(env, market_id),
        }
    }

    pub fn credit_position(
        env: Env,
        protocol: CreditProtocol,
        market_id: u128,
        asset: Address,
    ) -> Option<CreditPosition> {
        match protocol {
            CreditProtocol::Blend => Self::blend_position(env, market_id, asset).map(Into::into),
        }
    }

    pub fn credit_positions(
        env: Env,
        protocol: CreditProtocol,
        market_id: u128,
    ) -> Vec<CreditPosition> {
        let mut positions = Vec::new(&env);
        match protocol {
            CreditProtocol::Blend => {
                for position in Self::blend_positions(env.clone(), market_id).iter() {
                    positions.push_back(position.into());
                }
            }
        }
        positions
    }

    pub fn credit_position_value(
        env: Env,
        protocol: CreditProtocol,
        market_id: u128,
        asset: Address,
    ) -> Option<CreditPositionValue> {
        match protocol {
            CreditProtocol::Blend => {
                Self::blend_position_value(env, market_id, asset).map(Into::into)
            }
        }
    }

    pub fn credit_position_values(
        env: Env,
        protocol: CreditProtocol,
        market_id: u128,
    ) -> Vec<CreditPositionValue> {
        let mut values = Vec::new(&env);
        match protocol {
            CreditProtocol::Blend => {
                for value in Self::blend_position_values(env.clone(), market_id).iter() {
                    values.push_back(value.into());
                }
            }
        }
        values
    }

    pub fn credit_market_value(
        env: Env,
        protocol: CreditProtocol,
        market_id: u128,
    ) -> Option<CreditMarketValue> {
        match protocol {
            CreditProtocol::Blend => Self::blend_market_value(env, market_id).map(Into::into),
        }
    }

    pub fn credit_health_factor(
        env: Env,
        protocol: CreditProtocol,
        market_id: u128,
    ) -> Option<i128> {
        match protocol {
            CreditProtocol::Blend => Self::blend_health_factor(env, market_id),
        }
    }

    pub fn credit_risk_policy(
        env: Env,
        protocol: CreditProtocol,
        market_id: u128,
    ) -> CreditRiskPolicy {
        match protocol {
            CreditProtocol::Blend => Self::blend_risk_policy(env, market_id).into(),
        }
    }

    pub fn credit_market_status(
        env: Env,
        protocol: CreditProtocol,
        market_id: u128,
    ) -> Option<CreditMarketStatus> {
        match protocol {
            CreditProtocol::Blend => Self::blend_market_status(env, market_id).map(Into::into),
        }
    }
}

#[cfg(test)]
mod test;
