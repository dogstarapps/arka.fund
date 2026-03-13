#![no_std]
use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    Env, IntoVal, Map, Symbol, TryFromVal, Val, Vec, vec,
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
pub struct BlendRiskPolicy {
    pub market_id: u128,
    pub max_oracle_age: u64,
    pub min_health_factor: i128,
    pub fail_close_nav: bool,
    pub fail_close_actions: bool,
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

#[derive(Clone)]
#[contracttype]
pub enum OracleAsset {
    Stellar(Address),
    Other(Symbol),
}

const EVENT_DEPOSIT: Symbol = symbol_short!("deposit");
const EVENT_REDEEM: Symbol = symbol_short!("redeem");
const EVENT_PROFIT: Symbol = symbol_short!("profit");
const EVENT_BLEND: Symbol = symbol_short!("blend");
const BLEND_RATE_SCALE: i128 = 1_000_000_000_000;
const DEFAULT_BLEND_MAX_ORACLE_AGE: u64 = 60 * 60;
const DEFAULT_BLEND_MIN_HEALTH_FACTOR: i128 = 12_500_000;

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

    fn track_asset(env: &Env, asset: &Address) {
        let mut tracked: Vec<Address> = env.storage().instance().get(&DataKey::TrackedAssets).unwrap_or(Vec::new(env));
        let mut found = false;
        for existing in tracked.iter() {
            if existing == *asset {
                found = true;
                break;
            }
        }
        if !found {
            tracked.push_back(asset.clone());
            env.storage().instance().set(&DataKey::TrackedAssets, &tracked);
        }
    }

    fn liquid_balance_internal(env: &Env, asset: &Address) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::LiquidBalance(asset.clone()))
            .unwrap_or(0)
    }

    fn set_liquid_balance(env: &Env, asset: &Address, amount: i128) {
        Self::track_asset(env, asset);
        env.storage()
            .instance()
            .set(&DataKey::LiquidBalance(asset.clone()), &amount);
    }

    fn add_liquid_balance(env: &Env, asset: &Address, delta: i128) {
        let next = Self::liquid_balance_internal(env, asset) + delta;
        if next < 0 {
            panic_with_error!(env, Error::InsufficientLiquidity);
        }
        Self::set_liquid_balance(env, asset, next);
    }

    fn add_blend_market(env: &Env, market_id: u128) {
        let mut markets: Vec<u128> = env.storage().instance().get(&DataKey::BlendMarkets).unwrap_or(Vec::new(env));
        let mut found = false;
        for existing in markets.iter() {
            if existing == market_id {
                found = true;
                break;
            }
        }
        if !found {
            markets.push_back(market_id);
            env.storage().instance().set(&DataKey::BlendMarkets, &markets);
        }
    }

    fn remove_blend_market(env: &Env, market_id: u128) {
        let markets: Vec<u128> = env.storage().instance().get(&DataKey::BlendMarkets).unwrap_or(Vec::new(env));
        let mut next: Vec<u128> = Vec::new(env);
        for existing in markets.iter() {
            if existing != market_id {
                next.push_back(existing);
            }
        }
        env.storage().instance().set(&DataKey::BlendMarkets, &next);
    }

    fn add_blend_market_asset(env: &Env, market_id: u128, asset: &Address) {
        let mut assets: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::BlendMarketAssets(market_id))
            .unwrap_or(Vec::new(env));
        let mut found = false;
        for existing in assets.iter() {
            if existing == *asset {
                found = true;
                break;
            }
        }
        if !found {
            assets.push_back(asset.clone());
            env.storage()
                .instance()
                .set(&DataKey::BlendMarketAssets(market_id), &assets);
        }
        Self::add_blend_market(env, market_id);
    }

    fn remove_blend_market_asset(env: &Env, market_id: u128, asset: &Address) {
        let assets: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::BlendMarketAssets(market_id))
            .unwrap_or(Vec::new(env));
        let mut next: Vec<Address> = Vec::new(env);
        for existing in assets.iter() {
            if existing != *asset {
                next.push_back(existing);
            }
        }
        if next.is_empty() {
            env.storage().instance().remove(&DataKey::BlendMarketAssets(market_id));
            Self::remove_blend_market(env, market_id);
        } else {
            env.storage()
                .instance()
                .set(&DataKey::BlendMarketAssets(market_id), &next);
        }
    }

    fn read_blend_market_assets_internal(env: &Env, market_id: u128) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::BlendMarketAssets(market_id))
            .unwrap_or(Vec::new(env))
    }

    fn read_blend_position_internal(env: &Env, market_id: u128, asset: &Address) -> Option<BlendPosition> {
        env.storage()
            .instance()
            .get(&DataKey::BlendPosition(market_id, asset.clone()))
    }

    fn write_blend_position(env: &Env, position: &BlendPosition) {
        if position.collateral_amount == 0 && position.debt_amount == 0 {
            env.storage()
                .instance()
                .remove(&DataKey::BlendPosition(position.market_id, position.asset.clone()));
            Self::remove_blend_market_asset(env, position.market_id, &position.asset);
            return;
        }
        Self::add_blend_market_asset(env, position.market_id, &position.asset);
        env.storage()
            .instance()
            .set(&DataKey::BlendPosition(position.market_id, position.asset.clone()), position);
    }

    fn read_blend_adapter_internal(env: &Env, market_id: u128) -> Option<Address> {
        env.storage().instance().get(&DataKey::BlendAdapter(market_id))
    }

    fn write_blend_adapter(env: &Env, market_id: u128, adapter: &Address) {
        env.storage()
            .instance()
            .set(&DataKey::BlendAdapter(market_id), adapter);
    }

    fn clear_blend_adapter(env: &Env, market_id: u128) {
        env.storage().instance().remove(&DataKey::BlendAdapter(market_id));
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
        env.storage()
            .instance()
            .get(&DataKey::BlendRiskPolicy(market_id))
            .unwrap_or(Self::default_blend_risk_policy(market_id))
    }

    fn assert_blend_risk_policy(env: &Env, max_oracle_age: u64, min_health_factor: i128) {
        if max_oracle_age == 0 || min_health_factor < 0 {
            panic_with_error!(env, Error::InvalidBlendRiskPolicy);
        }
    }

    fn read_blend_pool_config(env: &Env, router: &Address) -> BlendPoolConfig {
        env.invoke_contract::<BlendPoolConfig>(router, &Symbol::new(env, "get_config"), vec![env])
    }

    fn read_blend_pool_positions(env: &Env, router: &Address, owner: &Address) -> BlendPoolPositions {
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

    fn blend_position_diagnostics_internal(
        env: &Env,
        market_id: u128,
        asset: &Address,
    ) -> Option<BlendPositionDiagnostics> {
        let position = Self::read_blend_position_internal(env, market_id, asset)?;
        let adapter = Self::read_blend_adapter_internal(env, market_id)?;
        let router = Self::read_blend_router(env, &adapter);
        let pool_config = Self::read_blend_pool_config(env, &router);
        let reserve = Self::read_blend_reserve(env, &router, &position.asset);
        let positions = Self::read_blend_pool_positions(env, &router, &env.current_contract_address());
        let reserve_index = reserve.config.index;
        let collateral_shares = positions.collateral.get(reserve_index).unwrap_or(0);
        let debt_shares = positions.liabilities.get(reserve_index).unwrap_or(0);
        let collateral_amount = Self::convert_position_shares_to_amount(collateral_shares, reserve.data.b_rate);
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
        let has_future_oracle_timestamp =
            asset_price.timestamp > ledger_timestamp || denom_price_data.timestamp > ledger_timestamp;
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
                price: if prices_are_usable { asset_price.price } else { 0 },
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

    fn blend_position_value_internal(env: &Env, market_id: u128, asset: &Address) -> Option<BlendPositionValue> {
        Self::blend_position_diagnostics_internal(env, market_id, asset).map(|diagnostics| diagnostics.value)
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
            if let Some(position_value) = Self::blend_position_diagnostics_internal(env, market_id, &asset).map(|diagnostics| diagnostics.value) {
                collateral_value += position_value.collateral_value;
                debt_value += position_value.debt_value;
                collateral_buffer +=
                    (position_value.collateral_value * position_value.c_factor as i128) / 10_000_000i128;
                if position_value.oracle_timestamp > latest_oracle_timestamp {
                    latest_oracle_timestamp = position_value.oracle_timestamp;
                }
            } else if let Some(position) = Self::read_blend_position_internal(env, market_id, &asset) {
                collateral_value += position.collateral_amount;
                debt_value += position.debt_amount;
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
        let market_value = Self::blend_market_value_internal(env, market_id);
        let ledger_timestamp = env.ledger().timestamp();
        let oracle_timestamp = market_value.as_ref().map(|value| value.oracle_timestamp).unwrap_or(0);
        let has_live_pricing = oracle_timestamp > 0;
        let oracle_age = if has_live_pricing && ledger_timestamp >= oracle_timestamp {
            ledger_timestamp - oracle_timestamp
        } else {
            0
        };
        let has_stale_oracle = !has_live_pricing || oracle_age > policy.max_oracle_age;
        let health_factor = market_value.as_ref().map(|value| value.health_factor).unwrap_or(0);
        let debt_value = market_value.as_ref().map(|value| value.debt_value).unwrap_or(0);
        let below_min_health_factor = debt_value > 0 && health_factor < policy.min_health_factor;
        let mut has_invalid_oracle_data = false;
        let mut has_future_oracle_timestamp = false;
        let mut has_disabled_reserve = false;
        let mut pool_status = 0u32;

        for asset in assets.iter() {
            if let Some(diagnostics) = Self::blend_position_diagnostics_internal(env, market_id, &asset) {
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
        let has_integrity_failure =
            has_invalid_oracle_data || has_future_oracle_timestamp || has_disabled_reserve || pool_status != 0;

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
            risky_actions_blocked: (policy.fail_close_actions && (has_stale_oracle || has_integrity_failure)) || below_min_health_factor,
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
            if status.has_invalid_oracle_data || status.has_future_oracle_timestamp || status.has_disabled_reserve || status.pool_status != 0 {
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
        let tracked: Vec<Address> = env.storage().instance().get(&DataKey::TrackedAssets).unwrap_or(Vec::new(env));
        let mut nav = 0i128;
        for asset in tracked.iter() {
            nav += Self::liquid_balance_internal(env, &asset);
        }
        let markets: Vec<u128> = env.storage().instance().get(&DataKey::BlendMarkets).unwrap_or(Vec::new(env));
        for market_id in markets.iter() {
            Self::assert_blend_nav_available(env, market_id);
            if let Some(market_value) = Self::blend_market_value_internal(env, market_id) {
                nav += market_value.net_value;
            } else {
                for asset in Self::read_blend_market_assets_internal(env, market_id).iter() {
                    if let Some(position) = Self::read_blend_position_internal(env, market_id, &asset) {
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
        let denomination = Asset { contract: denomination_contract.clone() };
        let fees = FeeStructure { mgmt_bps, perf_bps, deposit_bps, redeem_bps };
        let mut wl_assets: Vec<Asset> = Vec::new(&env);
        for addr in whitelist_contracts.iter() {
            wl_assets.push_back(Asset { contract: addr.clone() });
            Self::track_asset(&env, &addr);
        }
        Self::track_asset(&env, &denomination_contract);
        store.set(&DataKey::Denomination, &denomination);
        store.set(&DataKey::Fees, &fees);
        store.set(&DataKey::Whitelist, &wl_assets);
        store.set(&DataKey::Manager, &manager);
        store.set(&DataKey::TotalShares, &0i128);
        store.set(&DataKey::Aum, &0i128);
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
    }

    pub fn set_fees(env: Env, caller: Address, mgmt_bps: i32, perf_bps: i32, deposit_bps: i32, redeem_bps: i32) {
        Self::assert_fee_bps(&env, mgmt_bps);
        Self::assert_fee_bps(&env, perf_bps);
        Self::assert_fee_bps(&env, deposit_bps);
        Self::assert_fee_bps(&env, redeem_bps);
        Self::require_policy_auth(&env, &caller);
        let fees = FeeStructure { mgmt_bps, perf_bps, deposit_bps, redeem_bps };
        env.storage().instance().set(&DataKey::Fees, &fees);
    }

    pub fn set_whitelist(env: Env, caller: Address, whitelist_contracts: Vec<Address>) {
        Self::require_policy_auth(&env, &caller);
        let mut wl_assets: Vec<Asset> = Vec::new(&env);
        for addr in whitelist_contracts.iter() {
            wl_assets.push_back(Asset { contract: addr.clone() });
            Self::track_asset(&env, &addr);
        }
        env.storage().instance().set(&DataKey::Whitelist, &wl_assets);
    }

    pub fn set_manager(env: Env, caller: Address, manager: Address) {
        Self::require_policy_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Manager, &manager);
    }

    pub fn set_router(env: Env, caller: Address, router: Address) {
        Self::require_policy_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Router, &router);
    }

    pub fn set_share_token(env: Env, caller: Address, share_token: Address) {
        Self::require_policy_auth(&env, &caller);
        env.storage().instance().set(&DataKey::ShareToken, &share_token);
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
        env.storage().instance().set(
            &DataKey::BlendRiskPolicy(market_id),
            &BlendRiskPolicy {
                market_id,
                max_oracle_age,
                min_health_factor,
                fail_close_nav,
                fail_close_actions,
            },
        );
    }

    pub fn deposit(env: Env, user: Address, asset: Asset, amount: i128) -> i128 {
        user.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::AmountZero);
        }
        Self::assert_asset_allowed(&env, &asset.contract);
        let nav_before = Self::total_nav_internal(&env);
        Self::transfer_from_user_to_vault(&env, &asset.contract, &user, amount);
        Self::add_liquid_balance(&env, &asset.contract, amount);

        let fees: FeeStructure = env.storage().instance().get(&DataKey::Fees).unwrap_or(FeeStructure {
            mgmt_bps: 0,
            perf_bps: 0,
            deposit_bps: 0,
            redeem_bps: 0,
        });
        let net_amount = Self::apply_fee_bps(amount, fees.deposit_bps);
        let total: i128 = env.storage().instance().get(&DataKey::TotalShares).unwrap_or(0);
        let shares_minted = if total == 0 || nav_before == 0 {
            net_amount
        } else {
            (net_amount * total) / nav_before
        };
        if shares_minted <= 0 {
            panic_with_error!(&env, Error::SharesZero);
        }
        env.storage().instance().set(&DataKey::TotalShares, &(total + shares_minted));
        let bal: i128 = env.storage().instance().get(&DataKey::Balance(user.clone())).unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::Balance(user.clone()), &(bal + shares_minted));
        Self::maybe_mint_share_token(&env, &user, shares_minted);
        Self::refresh_aum(&env);
        env.events().publish((EVENT_DEPOSIT,), (user.clone(), amount, shares_minted));
        shares_minted
    }

    pub fn redeem(env: Env, user: Address, shares: i128) -> i128 {
        user.require_auth();
        if shares <= 0 {
            panic_with_error!(&env, Error::SharesZero);
        }
        let store = env.storage().instance();
        let user_bal: i128 = store.get(&DataKey::Balance(user.clone())).unwrap_or(0);
        if shares > user_bal {
            panic_with_error!(&env, Error::InsufficientUserShares);
        }
        let total: i128 = store.get(&DataKey::TotalShares).unwrap_or(0);
        if shares > total {
            panic_with_error!(&env, Error::InsufficientShares);
        }

        let nav = Self::total_nav_internal(&env);
        let gross_out = if total == 0 { 0 } else { (shares * nav) / total };
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

        store.set(&DataKey::TotalShares, &(total - shares));
        store.set(&DataKey::Balance(user.clone()), &(user_bal - shares));
        Self::maybe_burn_share_token(&env, &user, shares);
        Self::add_liquid_balance(&env, &denom.contract, -net_out);
        Self::transfer_from_vault(&env, &denom.contract, &user, net_out);
        Self::refresh_aum(&env);
        env.events().publish((EVENT_REDEEM,), (user.clone(), shares, net_out));
        net_out
    }

    pub fn rebalance(env: Env, manager: Address, steps: Vec<SwapStep>) -> i128 {
        Self::require_manager(&env, &manager);
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
                let _ = env.invoke_contract::<()>(&s.asset_in.contract, &symbol_short!("approve"), args_approve);
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
                    manager.clone().into_val(&env),
                    s.amount_in.into_val(&env),
                ];
                Self::invoke_with_contract_auth::<()>(&env, &s.asset_in.contract, "transfer", args_transfer);
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
                internal_steps.into_val(&env),
            ];
            let out_internal: i128 = env.invoke_contract(&router_internal, &symbol_short!("execute"), args);
            if let Some(asset) = last_internal_out {
                let args = vec![
                    &env,
                    manager.clone().into_val(&env),
                    self_addr.clone().into_val(&env),
                    out_internal.into_val(&env),
                ];
                let _ = env.invoke_contract::<()>(&asset, &symbol_short!("transfer"), args);
                Self::add_liquid_balance(&env, &asset, out_internal);
            }
            total_out += out_internal;
        }

        Self::refresh_aum(&env);
        env.events().publish((EVENT_PROFIT,), (total_out, steps.len() as u32));
        total_out
    }

    pub fn blend_lend(env: Env, manager: Address, adapter: Address, market_id: u128, asset: Address, amount: i128) -> i128 {
        Self::require_manager(&env, &manager);
        if amount <= 0 {
            panic_with_error!(&env, Error::AmountZero);
        }
        Self::assert_asset_allowed(&env, &asset);
        let effective_asset = asset.clone();
        if Self::liquid_balance_internal(&env, &effective_asset) < amount {
            panic_with_error!(&env, Error::InsufficientLiquidity);
        }
        let _ = Self::invoke_blend_adapter(&env, &adapter, &effective_asset, BlendAction::Lend, market_id, amount);
        let mut position = Self::read_blend_position_internal(&env, market_id, &effective_asset).unwrap_or(BlendPosition {
            market_id,
            asset: effective_asset.clone(),
            collateral_amount: 0,
            debt_amount: 0,
        });
        if position.asset != effective_asset {
            panic_with_error!(&env, Error::InvalidBlendPosition);
        }
        position.collateral_amount += amount;
        Self::write_blend_adapter(&env, market_id, &adapter);
        Self::add_liquid_balance(&env, &effective_asset, -amount);
        Self::write_blend_position(&env, &position);
        env.events().publish((EVENT_BLEND,), (symbol_short!("lend"), market_id, amount));
        amount
    }

    pub fn blend_borrow(env: Env, manager: Address, adapter: Address, market_id: u128, asset: Address, amount: i128) -> i128 {
        Self::require_manager(&env, &manager);
        if amount <= 0 {
            panic_with_error!(&env, Error::AmountZero);
        }
        Self::assert_asset_allowed(&env, &asset);
        let effective_asset = asset.clone();
        let out = Self::invoke_blend_adapter(&env, &adapter, &effective_asset, BlendAction::Borrow, market_id, amount);
        let mut position = Self::read_blend_position_internal(&env, market_id, &effective_asset).unwrap_or(BlendPosition {
            market_id,
            asset: effective_asset.clone(),
            collateral_amount: 0,
            debt_amount: 0,
        });
        if position.asset != effective_asset {
            panic_with_error!(&env, Error::InvalidBlendPosition);
        }
        position.debt_amount += out;
        Self::write_blend_adapter(&env, market_id, &adapter);
        Self::add_liquid_balance(&env, &effective_asset, out);
        Self::write_blend_position(&env, &position);
        Self::assert_blend_risky_actions_allowed(&env, market_id);
        env.events().publish((EVENT_BLEND,), (symbol_short!("borrow"), market_id, out));
        out
    }

    pub fn blend_repay(env: Env, manager: Address, adapter: Address, market_id: u128, asset: Address, amount: i128) -> i128 {
        Self::require_manager(&env, &manager);
        if amount <= 0 {
            panic_with_error!(&env, Error::AmountZero);
        }
        Self::assert_asset_allowed(&env, &asset);
        let effective_asset = asset.clone();
        let mut position = match Self::read_blend_position_internal(&env, market_id, &effective_asset) {
            Some(p) => p,
            None => panic_with_error!(&env, Error::InvalidBlendPosition),
        };
        if position.asset != effective_asset || position.debt_amount < amount {
            panic_with_error!(&env, Error::InvalidBlendPosition);
        }
        if Self::liquid_balance_internal(&env, &effective_asset) < amount {
            panic_with_error!(&env, Error::InsufficientLiquidity);
        }
        let _ = Self::invoke_blend_adapter(&env, &adapter, &effective_asset, BlendAction::Repay, market_id, amount);
        position.debt_amount -= amount;
        Self::add_liquid_balance(&env, &effective_asset, -amount);
        Self::write_blend_position(&env, &position);
        if Self::read_blend_market_assets_internal(&env, market_id).is_empty() {
            Self::clear_blend_adapter(&env, market_id);
        } else {
            Self::write_blend_adapter(&env, market_id, &adapter);
        }
        env.events().publish((EVENT_BLEND,), (symbol_short!("repay"), market_id, amount));
        amount
    }

    pub fn blend_withdraw(env: Env, manager: Address, adapter: Address, market_id: u128, asset: Address, amount: i128) -> i128 {
        Self::require_manager(&env, &manager);
        if amount <= 0 {
            panic_with_error!(&env, Error::AmountZero);
        }
        Self::assert_asset_allowed(&env, &asset);
        let effective_asset = asset.clone();
        let mut position = match Self::read_blend_position_internal(&env, market_id, &effective_asset) {
            Some(p) => p,
            None => panic_with_error!(&env, Error::InvalidBlendPosition),
        };
        if position.asset != effective_asset || position.collateral_amount < amount {
            panic_with_error!(&env, Error::InvalidBlendPosition);
        }
        let out = Self::invoke_blend_adapter(&env, &adapter, &effective_asset, BlendAction::Withdraw, market_id, amount);
        position.collateral_amount -= amount;
        Self::add_liquid_balance(&env, &effective_asset, out);
        Self::write_blend_position(&env, &position);
        if Self::read_blend_market_assets_internal(&env, market_id).is_empty() {
            Self::clear_blend_adapter(&env, market_id);
        } else {
            Self::write_blend_adapter(&env, market_id, &adapter);
        }
        Self::assert_blend_risky_actions_allowed(&env, market_id);
        env.events().publish((EVENT_BLEND,), (symbol_short!("wdrw"), market_id, out));
        out
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
        env.storage().instance().get(&DataKey::Balance(user)).unwrap_or(0)
    }

    pub fn share_token(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::ShareToken)
    }

    pub fn governor(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Governor)
    }

    pub fn fees(env: Env) -> FeeStructure {
        env.storage().instance().get(&DataKey::Fees).unwrap_or(FeeStructure {
            mgmt_bps: 0,
            perf_bps: 0,
            deposit_bps: 0,
            redeem_bps: 0,
        })
    }

    pub fn whitelist(env: Env) -> Vec<Asset> {
        env.storage().instance().get(&DataKey::Whitelist).unwrap_or(Vec::new(&env))
    }

    pub fn nav(env: Env) -> i128 {
        Self::total_nav_internal(&env)
    }

    pub fn liquid_balance(env: Env, asset: Address) -> i128 {
        Self::liquid_balance_internal(&env, &asset)
    }

    pub fn blend_markets(env: Env) -> Vec<u128> {
        env.storage().instance().get(&DataKey::BlendMarkets).unwrap_or(Vec::new(&env))
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

    pub fn blend_position_value(env: Env, market_id: u128, asset: Address) -> Option<BlendPositionValue> {
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

    pub fn blend_market_status(env: Env, market_id: u128) -> Option<BlendMarketStatus> {
        Self::blend_market_status_internal(&env, market_id)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use adapter_blend::{BlendAdapter, BlendAdapterClient};
    use blend_router_mock::{BlendRouterMock, BlendRouterMockClient};
    use soroban_sdk::{
        contract, contractimpl,
        testutils::{Address as _, Ledger},
        Address, Env,
    };

    #[contract]
    struct DummyToken;

    #[contractimpl]
    impl DummyToken {
        pub fn transfer_from(_env: Env, spender: Address, _from: Address, _to: Address, _amount: i128) {
            spender.require_auth();
        }
        pub fn transfer(_env: Env, from: Address, _to: Address, _amount: i128) {
            from.require_auth();
        }
        pub fn mint(env: Env, to: Address, amount: i128) {
            let key = (symbol_short!("bal"), to);
            let prev: i128 = env.storage().instance().get(&key).unwrap_or(0);
            env.storage().instance().set(&key, &(prev + amount));
        }
        pub fn burn(env: Env, from: Address, amount: i128) {
            let key = (symbol_short!("bal"), from);
            let prev: i128 = env.storage().instance().get(&key).unwrap_or(0);
            env.storage().instance().set(&key, &(prev - amount));
        }
        pub fn balance(env: Env, owner: Address) -> i128 {
            let key = (symbol_short!("bal"), owner);
            env.storage().instance().get(&key).unwrap_or(0)
        }
    }

    #[contract]
    struct DummyOracle;

    #[contractimpl]
    impl DummyOracle {
        pub fn set_price(env: Env, asset: Address, price: i128, timestamp: u64) {
            env.storage().instance().set(&(symbol_short!("price"), asset.clone()), &price);
            env.storage().instance().set(&(symbol_short!("time"), asset), &timestamp);
        }

        pub fn lastprice(env: Env, asset: OracleAsset) -> OraclePriceData {
            let OracleAsset::Stellar(address) = asset else {
                panic!("unsupported_oracle_asset");
            };
            OraclePriceData {
                price: env.storage().instance().get(&(symbol_short!("price"), address.clone())).unwrap_or(10_000_000),
                timestamp: env.storage().instance().get(&(symbol_short!("time"), address)).unwrap_or(0u64),
            }
        }
    }

    #[contract]
    struct DummyBlendAdapter;

    #[contractimpl]
    impl DummyBlendAdapter {
        pub fn set_market_asset(env: Env, market_id: u128, asset: Address) {
            env.storage().instance().set(&(symbol_short!("mkt"), market_id), &asset);
        }

        pub fn market_asset(env: Env, market_id: u128) -> Option<Address> {
            env.storage().instance().get(&(symbol_short!("mkt"), market_id))
        }

        pub fn router(_env: Env) -> Address {
            Address::generate(&_env)
        }

        pub fn execute(_env: Env, caller: Address, _action: BlendAction, _market_id: u128, amount: i128, _receiver: Address) -> i128 {
            caller.require_auth();
            amount
        }
    }

    fn manager(env: &Env) -> Address {
        Address::generate(env)
    }

    fn setup_live_blend<'a>(env: &'a Env, mgr: &Address, asset: &Address) -> (Address, Address, BlendRouterMockClient<'a>) {
        let oracle_id = env.register_contract(None, DummyOracle);
        let oracle = DummyOracleClient::new(env, &oracle_id);
        oracle.set_price(asset, &10_000_000, &123u64);

        let router_id = env.register_contract(None, BlendRouterMock);
        let router = BlendRouterMockClient::new(env, &router_id);
        router.set_oracle(&oracle_id);
        router.set_reserve(asset, &0u32, &9_000_000u32, &1_000_000_000_000i128, &1_000_000_000_000i128, &10_000_000i128);

        let adapter_id = env.register_contract(None, BlendAdapter);
        let adapter = BlendAdapterClient::new(env, &adapter_id);
        adapter.init(mgr, &router_id);
        (oracle_id, adapter_id, router)
    }

    fn setup_arka(env: &Env) -> (ArkaContractClient<'_>, Address, Address, Asset) {
        if env.ledger().timestamp() == 0 {
            env.ledger().set_timestamp(1_000);
        }
        let contract_id = env.register_contract(None, ArkaContract);
        let client = ArkaContractClient::new(env, &contract_id);
        let token_id = env.register_contract(None, DummyToken);
        let denom_asset = Asset { contract: token_id.clone() };
        let wl = vec![env, token_id.clone()];
        let mgr = manager(env);
        client.init(&token_id, &0, &0, &0, &0, &wl, &mgr);
        (client, token_id, mgr, denom_asset)
    }

    #[test]
    fn test_init_and_deposit_redeem() {
        let env = Env::default();
        let (client, token_id, _mgr, denom_asset) = setup_arka(&env);
        let user = Address::generate(&env);
        env.mock_all_auths_allowing_non_root_auth();
        let minted = client.deposit(&user, &denom_asset, &100);
        assert_eq!(minted, 100);
        assert_eq!(client.nav(), 100);
        assert_eq!(client.liquid_balance(&token_id), 100);

        let out = client.redeem(&user, &40);
        assert_eq!(out, 40);
        assert_eq!(client.nav(), 60);
        assert_eq!(client.liquid_balance(&token_id), 60);
    }

    #[test]
    fn test_governor_controls_policy_after_set() {
        let env = Env::default();
        let (client, token_id, mgr, _denom_asset) = setup_arka(&env);
        let gov = Address::generate(&env);
        env.mock_all_auths_allowing_non_root_auth();
        client.set_governor(&mgr, &gov);
        assert_eq!(client.governor(), Some(gov.clone()));

        let new_router = Address::generate(&env);
        client.set_router(&gov, &new_router);
        assert_eq!(client.router(), new_router);

        client.set_fees(&gov, &10, &20, &30, &40);
        let fees = client.fees();
        assert_eq!(fees.mgmt_bps, 10);
        assert_eq!(fees.perf_bps, 20);
        assert_eq!(fees.deposit_bps, 30);
        assert_eq!(fees.redeem_bps, 40);

        let new_mgr = Address::generate(&env);
        client.set_manager(&gov, &new_mgr);
        assert_eq!(client.manager(), new_mgr);
        assert_eq!(client.liquid_balance(&token_id), 0);
    }

    #[test]
    fn test_share_token_mints_and_burns_with_deposit_and_redeem() {
        let env = Env::default();
        let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
        let share_token_id = env.register_contract(None, DummyToken);

        env.mock_all_auths_allowing_non_root_auth();
        client.set_share_token(&mgr, &share_token_id);

        let user = Address::generate(&env);
        let minted = client.deposit(&user, &denom_asset, &100);
        assert_eq!(minted, 100);
        assert_eq!(client.shares_of(&user), 100);

        let out = client.redeem(&user, &40);
        assert_eq!(out, 40);
        assert_eq!(client.shares_of(&user), 60);
        assert_eq!(client.liquid_balance(&denom_id), 60);
    }

    #[test]
    fn test_blend_position_updates_nav_and_liquidity() {
        let env = Env::default();
        let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
        let user = Address::generate(&env);
        env.mock_all_auths_allowing_non_root_auth();
        let (_oracle_id, adapter_id, _router) = setup_live_blend(&env, &mgr, &denom_id);
        client.deposit(&user, &denom_asset, &1_000);
        assert_eq!(client.nav(), 1_000);
        assert_eq!(client.liquid_balance(&denom_id), 1_000);

        client.blend_lend(&mgr, &adapter_id, &0u128, &denom_id, &400);
        let position = client.blend_position(&0u128, &denom_id).unwrap();
        assert_eq!(position.collateral_amount, 400);
        assert_eq!(position.debt_amount, 0);
        assert_eq!(client.liquid_balance(&denom_id), 600);
        assert_eq!(client.nav(), 1_000);

        client.blend_borrow(&mgr, &adapter_id, &0u128, &denom_id, &150);
        let position = client.blend_position(&0u128, &denom_id).unwrap();
        assert_eq!(position.collateral_amount, 400);
        assert_eq!(position.debt_amount, 150);
        assert_eq!(client.liquid_balance(&denom_id), 750);
        assert_eq!(client.nav(), 1_000);

        client.blend_repay(&mgr, &adapter_id, &0u128, &denom_id, &50);
        let position = client.blend_position(&0u128, &denom_id).unwrap();
        assert_eq!(position.debt_amount, 100);
        assert_eq!(client.liquid_balance(&denom_id), 700);
        assert_eq!(client.nav(), 1_000);

        client.blend_withdraw(&mgr, &adapter_id, &0u128, &denom_id, &100);
        let position = client.blend_position(&0u128, &denom_id).unwrap();
        assert_eq!(position.collateral_amount, 300);
        assert_eq!(position.debt_amount, 100);
        assert_eq!(client.liquid_balance(&denom_id), 800);
        assert_eq!(client.nav(), 1_000);
    }

    #[test]
    #[should_panic]
    fn test_redeem_requires_liquidity_when_blend_collateral_locked() {
        let env = Env::default();
        let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
        let user = Address::generate(&env);
        env.mock_all_auths_allowing_non_root_auth();
        let (_oracle_id, adapter_id, _router) = setup_live_blend(&env, &mgr, &denom_id);
        client.deposit(&user, &denom_asset, &1_000);
        client.blend_lend(&mgr, &adapter_id, &0u128, &denom_id, &900);
        client.redeem(&user, &500);
    }

    #[test]
    fn test_blend_supports_multiple_assets_within_whitelist() {
        let env = Env::default();
        let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
        let user = Address::generate(&env);
        env.mock_all_auths_allowing_non_root_auth();

        let other_token_id = env.register_contract(None, DummyToken);
        client.set_whitelist(&mgr, &vec![&env, denom_id.clone(), other_token_id.clone()]);
        let oracle_id = env.register_contract(None, DummyOracle);
        let oracle = DummyOracleClient::new(&env, &oracle_id);
        oracle.set_price(&denom_id, &10_000_000i128, &123u64);
        oracle.set_price(&other_token_id, &15_000_000i128, &124u64);
        let router_id = env.register_contract(None, BlendRouterMock);
        let router = BlendRouterMockClient::new(&env, &router_id);
        router.set_oracle(&oracle_id);
        router.set_reserve(&denom_id, &0u32, &9_000_000u32, &1_000_000_000_000i128, &1_000_000_000_000i128, &10_000_000i128);
        router.set_reserve(&other_token_id, &1u32, &8_000_000u32, &1_000_000_000_000i128, &1_000_000_000_000i128, &10_000_000i128);
        let adapter_id = env.register_contract(None, BlendAdapter);
        let adapter = BlendAdapterClient::new(&env, &adapter_id);
        adapter.init(&mgr, &router_id);
        client.deposit(&user, &denom_asset, &1_000);
        client.blend_lend(&mgr, &adapter_id, &7u128, &denom_id, &400);
        client.set_blend_risk_policy(&mgr, &7u128, &DEFAULT_BLEND_MAX_ORACLE_AGE, &10_000_000i128, &true, &true);
        client.blend_borrow(&mgr, &adapter_id, &7u128, &other_token_id, &200);

        let collateral = client.blend_position(&7u128, &denom_id).unwrap();
        assert_eq!(collateral.collateral_amount, 400);
        assert_eq!(collateral.debt_amount, 0);

        let debt = client.blend_position(&7u128, &other_token_id).unwrap();
        assert_eq!(debt.collateral_amount, 0);
        assert_eq!(debt.debt_amount, 200);

        let market_assets = client.blend_market_assets(&7u128);
        assert_eq!(market_assets.len(), 2);

        let market_value = client.blend_market_value(&7u128).unwrap();
        assert!(market_value.net_value > 0);
        assert_eq!(client.nav(), 900);
    }

    #[test]
    fn test_blend_position_value_uses_live_pool_rates() {
        let env = Env::default();
        let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
        let user = Address::generate(&env);
        env.mock_all_auths_allowing_non_root_auth();
        let (oracle_id, adapter_id, router) = setup_live_blend(&env, &mgr, &denom_id);
        let oracle = DummyOracleClient::new(&env, &oracle_id);
        router.set_reserve(&denom_id, &0u32, &9_000_000u32, &1_100_000_000_000i128, &1_200_000_000_000i128, &10_000_000i128);
        oracle.set_price(&denom_id, &10_000_000i128, &456u64);

        client.deposit(&user, &denom_asset, &1_000);
        client.blend_lend(&mgr, &adapter_id, &0u128, &denom_id, &400);
        client.blend_borrow(&mgr, &adapter_id, &0u128, &denom_id, &100);

        let position_value = client.blend_position_value(&0u128, &denom_id).unwrap();
        assert_eq!(position_value.collateral_amount, 440);
        assert_eq!(position_value.debt_amount, 120);
        assert_eq!(position_value.net_value, 320);
        assert_eq!(position_value.health_factor, 33_000_000);
        assert_eq!(client.nav(), 1_020);
        assert_eq!(client.blend_health_factor(&0u128), Some(33_000_000));
    }

    #[test]
    fn test_blend_market_status_blocks_stale_nav() {
        let env = Env::default();
        env.ledger().set_timestamp(150);
        let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
        let user = Address::generate(&env);
        env.mock_all_auths_allowing_non_root_auth();
        let (oracle_id, adapter_id, _router) = setup_live_blend(&env, &mgr, &denom_id);
        let oracle = DummyOracleClient::new(&env, &oracle_id);
        oracle.set_price(&denom_id, &10_000_000i128, &100u64);

        client.deposit(&user, &denom_asset, &1_000);
        client.blend_lend(&mgr, &adapter_id, &0u128, &denom_id, &400);
        client.set_blend_risk_policy(&mgr, &0u128, &60u64, &12_500_000i128, &true, &true);
        env.ledger().set_timestamp(5_000);

        let status = client.blend_market_status(&0u128).unwrap();
        assert!(status.has_stale_oracle);
        assert!(status.nav_blocked);
    }

    #[test]
    #[should_panic]
    fn test_stale_oracle_panics_nav() {
        let env = Env::default();
        env.ledger().set_timestamp(150);
        let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
        let user = Address::generate(&env);
        env.mock_all_auths_allowing_non_root_auth();
        let (oracle_id, adapter_id, _router) = setup_live_blend(&env, &mgr, &denom_id);
        let oracle = DummyOracleClient::new(&env, &oracle_id);
        oracle.set_price(&denom_id, &10_000_000i128, &100u64);

        client.deposit(&user, &denom_asset, &1_000);
        client.blend_lend(&mgr, &adapter_id, &0u128, &denom_id, &400);
        client.set_blend_risk_policy(&mgr, &0u128, &60u64, &12_500_000i128, &true, &true);
        env.ledger().set_timestamp(5_000);
        client.nav();
    }

    #[test]
    fn test_invalid_oracle_data_blocks_market_status() {
        let env = Env::default();
        env.ledger().set_timestamp(150);
        let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
        let user = Address::generate(&env);
        env.mock_all_auths_allowing_non_root_auth();
        let (oracle_id, adapter_id, _router) = setup_live_blend(&env, &mgr, &denom_id);
        let oracle = DummyOracleClient::new(&env, &oracle_id);

        client.deposit(&user, &denom_asset, &1_000);
        client.blend_lend(&mgr, &adapter_id, &0u128, &denom_id, &400);
        oracle.set_price(&denom_id, &0i128, &140u64);

        let status = client.blend_market_status(&0u128).unwrap();
        assert!(status.has_invalid_oracle_data);
        assert!(status.nav_blocked);
        assert!(status.risky_actions_blocked);
    }

    #[test]
    #[should_panic]
    fn test_invalid_oracle_data_panics_borrow() {
        let env = Env::default();
        env.ledger().set_timestamp(150);
        let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
        let user = Address::generate(&env);
        env.mock_all_auths_allowing_non_root_auth();
        let (oracle_id, adapter_id, _router) = setup_live_blend(&env, &mgr, &denom_id);
        let oracle = DummyOracleClient::new(&env, &oracle_id);

        client.deposit(&user, &denom_asset, &1_000);
        client.blend_lend(&mgr, &adapter_id, &0u128, &denom_id, &400);
        oracle.set_price(&denom_id, &0i128, &140u64);
        client.blend_borrow(&mgr, &adapter_id, &0u128, &denom_id, &10);
    }

    #[test]
    #[should_panic]
    fn test_blend_borrow_panics_below_min_health_factor() {
        let env = Env::default();
        let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
        let user = Address::generate(&env);
        env.mock_all_auths_allowing_non_root_auth();
        let (_oracle_id, adapter_id, _router) = setup_live_blend(&env, &mgr, &denom_id);

        client.deposit(&user, &denom_asset, &1_000);
        client.blend_lend(&mgr, &adapter_id, &0u128, &denom_id, &400);
        client.set_blend_risk_policy(&mgr, &0u128, &DEFAULT_BLEND_MAX_ORACLE_AGE, &15_000_000i128, &true, &true);
        client.blend_borrow(&mgr, &adapter_id, &0u128, &denom_id, &300);
    }

    #[test]
    #[should_panic]
    fn test_manager_cannot_set_policy_after_governor_assigned() {
        let env = Env::default();
        let (client, _denom_id, mgr, _denom_asset) = setup_arka(&env);
        let gov = Address::generate(&env);
        env.mock_all_auths_allowing_non_root_auth();
        client.set_governor(&mgr, &gov);
        client.set_router(&mgr, &Address::generate(&env));
    }

    #[test]
    #[should_panic]
    fn test_invalid_fee_bps_rejected() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ArkaContract);
        let client = ArkaContractClient::new(&env, &contract_id);
        let token_id = env.register_contract(None, DummyToken);
        let wl = vec![&env, token_id.clone()];
        let mgr = manager(&env);
        client.init(&token_id, &20_000, &0, &0, &0, &wl, &mgr);
    }

    #[test]
    fn test_blend_lend_with_real_adapter_authorizes_pool_submit() {
        let env = Env::default();
        let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
        let oracle_id = env.register_contract(None, DummyOracle);
        let oracle = DummyOracleClient::new(&env, &oracle_id);
        oracle.set_price(&denom_id, &10_000_000i128, &123u64);
        let router_id = env.register_contract(None, BlendRouterMock);
        let router = BlendRouterMockClient::new(&env, &router_id);
        router.set_oracle(&oracle_id);
        router.set_reserve(&denom_id, &0u32, &9_000_000u32, &1_000_000_000_000i128, &1_000_000_000_000i128, &10_000_000i128);
        let adapter_id = env.register_contract(None, BlendAdapter);
        let adapter = BlendAdapterClient::new(&env, &adapter_id);
        let user = Address::generate(&env);
        let arka_id = client.address.clone();
        env.mock_all_auths_allowing_non_root_auth();
        adapter.init(&mgr, &router_id);
        client.deposit(&user, &denom_asset, &1_000);
        client.blend_lend(&mgr, &adapter_id, &0u128, &denom_id, &400);

        let position = client.blend_position(&0u128, &denom_id).unwrap();
        assert_eq!(position.collateral_amount, 400);
        assert_eq!(position.debt_amount, 0);
        assert_eq!(client.liquid_balance(&denom_id), 600);
        assert_eq!(router.collateral(&arka_id, &denom_id), 400);

    }
}
