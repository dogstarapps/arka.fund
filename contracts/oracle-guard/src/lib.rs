#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, BytesN, Env,
    IntoVal, Symbol, TryFromVal, Val, I256,
};

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum OracleAsset {
    Stellar(Address),
    Other(Symbol),
}

#[derive(Clone)]
#[contracttype]
pub struct OraclePriceData {
    pub price: i128,
    pub timestamp: u64,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Governor,
    BootstrapAdminExpiresAt,
    Guardian,
    GuardianExpiresAt,
    Policy(OracleAsset),
    ProviderAsset(OracleAsset, Address),
    Paused(OracleAsset),
    LastWasmHash,
    ProviderNormalization(Address),
}

/// One explicit conversion leg from a provider's declared quote base to USD.
/// This is not another independent price confirmation for the priced asset.
#[derive(Clone)]
#[contracttype]
pub struct ProviderNormalization {
    pub base_asset: OracleAsset,
    pub conversion_oracle: Address,
    pub conversion_asset: OracleAsset,
}

#[derive(Clone)]
#[contracttype]
pub struct AssetPolicy {
    pub primary: Address,
    pub secondary: Address,
    pub has_secondary: bool,
    pub max_price_age: u64,
    pub max_deviation_bps: u32,
    pub require_secondary: bool,
    pub divergence_mode: u32,
}

#[derive(Clone)]
#[contracttype]
pub struct AssetInspection {
    pub price: i128,
    pub timestamp: u64,
    pub primary_price: i128,
    pub primary_timestamp: u64,
    pub secondary_price: i128,
    pub secondary_timestamp: u64,
    pub primary_usable: bool,
    pub secondary_configured: bool,
    pub secondary_usable: bool,
    pub selected_source: u32,
    pub deviation_bps: u32,
    pub diverged: bool,
}

#[derive(Clone)]
#[contracttype]
pub struct GuardianConfig {
    pub guardian: Option<Address>,
    pub expires_at: u64,
    pub active: bool,
}

const SOURCE_NONE: u32 = 0;
const SOURCE_PRIMARY: u32 = 1;
const SOURCE_SECONDARY: u32 = 2;
const SOURCE_LOWER_PRICE: u32 = 3;

const DIVERGENCE_FAIL_CLOSED: u32 = 0;
const DIVERGENCE_USE_SECONDARY: u32 = 1;
const DIVERGENCE_USE_LOWER_PRICE: u32 = 2;

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidPolicy = 4,
    InvalidGuardian = 5,
    InvalidBootstrapAdmin = 6,
}

const MAX_BOOTSTRAP_ADMIN_SECONDS: u64 = 365 * 24 * 60 * 60;

#[contract]
pub struct OracleGuard;

#[contractimpl]
impl OracleGuard {
    /// All prices exposed by this guard use USD and fourteen decimal places.
    pub fn base(env: Env) -> OracleAsset {
        Self::usd(&env)
    }

    pub fn decimals(_env: Env) -> u32 {
        14
    }

    pub fn set_provider_normalization(
        env: Env,
        caller: Address,
        provider: Address,
        normalization: ProviderNormalization,
    ) {
        Self::require_admin(&env, &caller);
        if normalization.base_asset == Self::usd(&env)
            || normalization.conversion_oracle == provider
            || normalization.conversion_oracle == env.current_contract_address()
            || Self::provider_base(&env, &provider) != Some(normalization.base_asset.clone())
            || Self::provider_base(&env, &normalization.conversion_oracle) != Some(Self::usd(&env))
        {
            panic_with_error!(&env, Error::InvalidPolicy);
        }
        Self::policy_set(&env, &DataKey::ProviderNormalization(provider), &normalization);
    }

    pub fn clear_provider_normalization(env: Env, caller: Address, provider: Address) {
        Self::require_admin(&env, &caller);
        Self::policy_remove(&env, &DataKey::ProviderNormalization(provider));
    }

    pub fn provider_normalization(env: Env, provider: Address) -> Option<ProviderNormalization> {
        Self::policy_get(&env, &DataKey::ProviderNormalization(provider))
    }
    fn bump_policy_key(env: &Env, key: &DataKey) {
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

    fn policy_get<T>(env: &Env, key: &DataKey) -> Option<T>
    where
        T: TryFromVal<Env, Val> + IntoVal<Env, Val>,
    {
        let persistent = env.storage().persistent();
        if let Some(value) = persistent.get::<DataKey, T>(key) {
            Self::bump_policy_key(env, key);
            return Some(value);
        }
        let legacy = env.storage().instance().get::<DataKey, T>(key);
        if let Some(value) = legacy {
            persistent.set(key, &value);
            env.storage().instance().remove(key);
            Self::bump_policy_key(env, key);
            return Some(value);
        }
        None
    }

    fn policy_set<T>(env: &Env, key: &DataKey, value: &T)
    where
        T: IntoVal<Env, Val>,
    {
        env.storage().persistent().set(key, value);
        env.storage().instance().remove(key);
        Self::bump_policy_key(env, key);
    }

    fn policy_remove(env: &Env, key: &DataKey) {
        env.storage().persistent().remove(key);
        env.storage().instance().remove(key);
    }

    // The host creates and initializes the instance atomically.
    pub fn __constructor(env: Env, admin: Address) {
        Self::initialize(env, admin);
    }

    // Legacy ABI is intentionally closed, including after code upgrades.
    #[allow(unused_variables)]
    pub fn init(env: Env, admin: Address) {
        panic!("initialization_requires_constructor");
    }

    fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized))
    }

    pub fn set_admin(env: Env, caller: Address, admin: Address) {
        Self::require_admin(&env, &caller);
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn set_governor(env: Env, caller: Address, governor: Option<Address>) {
        Self::require_admin(&env, &caller);
        env.storage().instance().set(&DataKey::Governor, &governor);
    }

    pub fn set_bootstrap_admin_expiry(env: Env, caller: Address, expires_at: u64) {
        Self::require_admin(&env, &caller);
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

    pub fn clear_bootstrap_admin_expiry(env: Env, caller: Address) {
        Self::require_governor(&env, &caller);
        let expired_at: u64 = 0;
        env.storage()
            .instance()
            .set(&DataKey::BootstrapAdminExpiresAt, &expired_at);
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
        Self::require_admin(&env, &caller);
        env.storage()
            .instance()
            .set(&DataKey::LastWasmHash, &new_wasm_hash);
        env.events()
            .publish((Symbol::new(&env, "upgrade"),), new_wasm_hash.clone());
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    pub fn last_wasm_hash(env: Env) -> Option<BytesN<32>> {
        env.storage()
            .instance()
            .get::<DataKey, BytesN<32>>(&DataKey::LastWasmHash)
    }

    pub fn set_guardian(env: Env, caller: Address, guardian: Address, expires_at: u64) {
        Self::require_admin(&env, &caller);
        Self::assert_future_expiry(&env, expires_at);
        guardian.require_auth();
        env.storage().instance().set(&DataKey::Guardian, &guardian);
        env.storage()
            .instance()
            .set(&DataKey::GuardianExpiresAt, &expires_at);
        env.events().publish(
            (Symbol::new(&env, "guardian"), Symbol::new(&env, "set")),
            expires_at,
        );
    }

    pub fn clear_guardian(env: Env, caller: Address) {
        Self::require_admin(&env, &caller);
        env.storage().instance().remove(&DataKey::Guardian);
        env.storage().instance().remove(&DataKey::GuardianExpiresAt);
        env.events().publish(
            (Symbol::new(&env, "guardian"), Symbol::new(&env, "clear")),
            true,
        );
    }

    pub fn guardian(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Guardian)
    }

    pub fn guardian_expires_at(env: Env) -> Option<u64> {
        env.storage().instance().get(&DataKey::GuardianExpiresAt)
    }

    pub fn guardian_config(env: Env) -> GuardianConfig {
        let guardian = Self::guardian(env.clone());
        let expires_at = Self::guardian_expires_at(env.clone()).unwrap_or(0);
        GuardianConfig {
            guardian,
            expires_at,
            active: Self::guardian_active(&env),
        }
    }

    pub fn is_guardian_active(env: Env) -> bool {
        Self::guardian_active(&env)
    }

    pub fn set_stellar_asset_policy(
        env: Env,
        caller: Address,
        asset: Address,
        primary: Address,
        secondary: Address,
        has_secondary: bool,
        max_price_age: u64,
        max_deviation_bps: u32,
        require_secondary: bool,
        divergence_mode: u32,
    ) {
        let oracle_asset = OracleAsset::Stellar(asset);
        Self::set_asset_policy_internal(
            &env,
            &caller,
            oracle_asset,
            primary,
            secondary,
            has_secondary,
            max_price_age,
            max_deviation_bps,
            require_secondary,
            divergence_mode,
        );
    }

    pub fn set_symbol_asset_policy(
        env: Env,
        caller: Address,
        symbol: Symbol,
        primary: Address,
        secondary: Address,
        has_secondary: bool,
        max_price_age: u64,
        max_deviation_bps: u32,
        require_secondary: bool,
        divergence_mode: u32,
    ) {
        let oracle_asset = OracleAsset::Other(symbol);
        Self::set_asset_policy_internal(
            &env,
            &caller,
            oracle_asset,
            primary,
            secondary,
            has_secondary,
            max_price_age,
            max_deviation_bps,
            require_secondary,
            divergence_mode,
        );
    }

    pub fn set_stellar_provider_asset(
        env: Env,
        caller: Address,
        asset: Address,
        provider: Address,
        provider_asset: OracleAsset,
    ) {
        Self::set_provider_asset_internal(
            &env,
            &caller,
            OracleAsset::Stellar(asset),
            provider,
            provider_asset,
        );
    }

    pub fn set_symbol_provider_asset(
        env: Env,
        caller: Address,
        symbol: Symbol,
        provider: Address,
        provider_asset: OracleAsset,
    ) {
        Self::set_provider_asset_internal(
            &env,
            &caller,
            OracleAsset::Other(symbol),
            provider,
            provider_asset,
        );
    }

    pub fn clear_stellar_provider_asset(
        env: Env,
        caller: Address,
        asset: Address,
        provider: Address,
    ) {
        Self::clear_provider_asset_internal(&env, &caller, OracleAsset::Stellar(asset), provider);
    }

    pub fn clear_symbol_provider_asset(
        env: Env,
        caller: Address,
        symbol: Symbol,
        provider: Address,
    ) {
        Self::clear_provider_asset_internal(&env, &caller, OracleAsset::Other(symbol), provider);
    }

    pub fn stellar_provider_asset(
        env: Env,
        asset: Address,
        provider: Address,
    ) -> Option<OracleAsset> {
        Self::provider_asset_get(&env, &OracleAsset::Stellar(asset), &provider)
    }

    pub fn symbol_provider_asset(
        env: Env,
        symbol: Symbol,
        provider: Address,
    ) -> Option<OracleAsset> {
        Self::provider_asset_get(&env, &OracleAsset::Other(symbol), &provider)
    }

    pub fn clear_stellar_asset_policy(env: Env, caller: Address, asset: Address) {
        Self::clear_asset_policy_internal(&env, &caller, OracleAsset::Stellar(asset));
    }

    pub fn clear_symbol_asset_policy(env: Env, caller: Address, symbol: Symbol) {
        Self::clear_asset_policy_internal(&env, &caller, OracleAsset::Other(symbol));
    }

    pub fn pause_stellar_asset_policy(env: Env, caller: Address, asset: Address) {
        Self::pause_asset_policy_internal(&env, &caller, OracleAsset::Stellar(asset));
    }

    pub fn pause_symbol_asset_policy(env: Env, caller: Address, symbol: Symbol) {
        Self::pause_asset_policy_internal(&env, &caller, OracleAsset::Other(symbol));
    }

    pub fn resume_stellar_asset_policy(env: Env, caller: Address, asset: Address) {
        Self::resume_asset_policy_internal(&env, &caller, OracleAsset::Stellar(asset));
    }

    pub fn resume_symbol_asset_policy(env: Env, caller: Address, symbol: Symbol) {
        Self::resume_asset_policy_internal(&env, &caller, OracleAsset::Other(symbol));
    }

    pub fn stellar_asset_policy(env: Env, asset: Address) -> Option<AssetPolicy> {
        Self::read_policy(&env, &OracleAsset::Stellar(asset))
    }

    pub fn symbol_asset_policy(env: Env, symbol: Symbol) -> Option<AssetPolicy> {
        Self::read_policy(&env, &OracleAsset::Other(symbol))
    }

    pub fn stellar_asset_policy_paused(env: Env, asset: Address) -> bool {
        Self::is_paused_internal(&env, &OracleAsset::Stellar(asset))
    }

    pub fn symbol_asset_policy_paused(env: Env, symbol: Symbol) -> bool {
        Self::is_paused_internal(&env, &OracleAsset::Other(symbol))
    }

    pub fn inspect_stellar(env: Env, asset: Address) -> AssetInspection {
        Self::inspect_internal(&env, OracleAsset::Stellar(asset))
    }

    pub fn inspect_symbol(env: Env, symbol: Symbol) -> AssetInspection {
        Self::inspect_internal(&env, OracleAsset::Other(symbol))
    }

    pub fn lastprice(env: Env, asset: OracleAsset) -> OraclePriceData {
        let inspection = Self::inspect_internal(&env, asset);
        OraclePriceData {
            price: inspection.price,
            timestamp: inspection.timestamp,
        }
    }

    fn require_admin(env: &Env, caller: &Address) {
        let store = env.storage().instance();
        if let Some(admin) = store.get::<DataKey, Address>(&DataKey::Admin) {
            if *caller == admin && !Self::bootstrap_admin_expired(env) {
                caller.require_auth();
                return;
            }
        }
        if let Some(governor) = store.get::<DataKey, Option<Address>>(&DataKey::Governor).flatten() {
            if *caller == governor {
                caller.require_auth();
                return;
            }
        }
        panic_with_error!(env, Error::Unauthorized);
    }

    fn require_governor(env: &Env, caller: &Address) {
        let Some(governor) = env
            .storage()
            .instance()
            .get::<DataKey, Option<Address>>(&DataKey::Governor).flatten()
        else {
            panic_with_error!(env, Error::Unauthorized);
        };
        if *caller != governor {
            panic_with_error!(env, Error::Unauthorized);
        }
        caller.require_auth();
    }

    fn bootstrap_admin_expired(env: &Env) -> bool {
        let Some(expires_at) = env
            .storage()
            .instance()
            .get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
        else {
            return false;
        };
        env.ledger().timestamp() > expires_at
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

    fn assert_future_expiry(env: &Env, expires_at: u64) {
        if expires_at <= env.ledger().timestamp() {
            panic_with_error!(env, Error::InvalidGuardian);
        }
    }

    fn guardian_active(env: &Env) -> bool {
        let Some(expires_at) = env
            .storage()
            .instance()
            .get::<DataKey, u64>(&DataKey::GuardianExpiresAt)
        else {
            return false;
        };
        expires_at > env.ledger().timestamp()
            && env
                .storage()
                .instance()
                .get::<DataKey, Address>(&DataKey::Guardian)
                .is_some()
    }

    fn require_emergency_pause_auth(env: &Env, caller: &Address) {
        let store = env.storage().instance();
        if let Some(admin) = store.get::<DataKey, Address>(&DataKey::Admin) {
            if *caller == admin && !Self::bootstrap_admin_expired(env) {
                caller.require_auth();
                return;
            }
        }
        if let Some(governor) = store.get::<DataKey, Option<Address>>(&DataKey::Governor).flatten() {
            if *caller == governor {
                caller.require_auth();
                return;
            }
        }
        if Self::guardian_active(env) {
            if let Some(guardian) = env
                .storage()
                .instance()
                .get::<DataKey, Address>(&DataKey::Guardian)
            {
                if *caller == guardian {
                    caller.require_auth();
                    return;
                }
            }
        }
        panic_with_error!(env, Error::Unauthorized);
    }

    #[allow(clippy::too_many_arguments)]
    fn set_asset_policy_internal(
        env: &Env,
        caller: &Address,
        asset: OracleAsset,
        primary: Address,
        secondary: Address,
        has_secondary: bool,
        max_price_age: u64,
        max_deviation_bps: u32,
        require_secondary: bool,
        divergence_mode: u32,
    ) {
        Self::require_admin(env, caller);
        Self::assert_policy(env, max_price_age, max_deviation_bps, divergence_mode);
        if has_secondary && primary == secondary {
            panic_with_error!(env, Error::InvalidPolicy);
        }
        Self::policy_set(
            env,
            &DataKey::Policy(asset.clone()),
            &AssetPolicy {
                primary,
                secondary,
                has_secondary,
                max_price_age,
                max_deviation_bps,
                require_secondary,
                divergence_mode,
            },
        );
        Self::policy_remove(env, &DataKey::Paused(asset));
    }

    fn clear_asset_policy_internal(env: &Env, caller: &Address, asset: OracleAsset) {
        Self::require_admin(env, caller);
        Self::policy_remove(env, &DataKey::Policy(asset.clone()));
        Self::policy_remove(env, &DataKey::Paused(asset));
    }

    fn set_provider_asset_internal(
        env: &Env,
        caller: &Address,
        asset: OracleAsset,
        provider: Address,
        provider_asset: OracleAsset,
    ) {
        Self::require_admin(env, caller);
        Self::policy_set(
            env,
            &DataKey::ProviderAsset(asset, provider),
            &provider_asset,
        );
    }

    fn clear_provider_asset_internal(
        env: &Env,
        caller: &Address,
        asset: OracleAsset,
        provider: Address,
    ) {
        Self::require_admin(env, caller);
        Self::policy_remove(env, &DataKey::ProviderAsset(asset, provider));
    }

    fn provider_asset_get(
        env: &Env,
        asset: &OracleAsset,
        provider: &Address,
    ) -> Option<OracleAsset> {
        Self::policy_get::<OracleAsset>(
            env,
            &DataKey::ProviderAsset(asset.clone(), provider.clone()),
        )
    }

    fn pause_asset_policy_internal(env: &Env, caller: &Address, asset: OracleAsset) {
        Self::require_emergency_pause_auth(env, caller);
        Self::policy_set(env, &DataKey::Paused(asset.clone()), &true);
        env.events()
            .publish((Symbol::new(env, "oracle_pause"), asset), true);
    }

    fn resume_asset_policy_internal(env: &Env, caller: &Address, asset: OracleAsset) {
        Self::require_admin(env, caller);
        Self::policy_remove(env, &DataKey::Paused(asset.clone()));
        env.events()
            .publish((Symbol::new(env, "oracle_resume"), asset), true);
    }

    fn read_policy(env: &Env, asset: &OracleAsset) -> Option<AssetPolicy> {
        Self::policy_get::<AssetPolicy>(env, &DataKey::Policy(asset.clone()))
    }

    fn is_paused_internal(env: &Env, asset: &OracleAsset) -> bool {
        Self::policy_get::<bool>(env, &DataKey::Paused(asset.clone())).unwrap_or(false)
    }

    fn assert_policy(env: &Env, max_price_age: u64, max_deviation_bps: u32, divergence_mode: u32) {
        if max_price_age == 0 || max_deviation_bps > 10_000 {
            panic_with_error!(env, Error::InvalidPolicy);
        }
        if divergence_mode > DIVERGENCE_USE_LOWER_PRICE {
            panic_with_error!(env, Error::InvalidPolicy);
        }
    }

    fn inspect_internal(env: &Env, asset: OracleAsset) -> AssetInspection {
        if Self::is_paused_internal(env, &asset) {
            return AssetInspection {
                price: 0,
                timestamp: 0,
                primary_price: 0,
                primary_timestamp: 0,
                secondary_price: 0,
                secondary_timestamp: 0,
                primary_usable: false,
                secondary_configured: false,
                secondary_usable: false,
                selected_source: SOURCE_NONE,
                deviation_bps: 0,
                diverged: false,
            };
        }

        let Some(policy) = Self::read_policy(env, &asset) else {
            return AssetInspection {
                price: 0,
                timestamp: 0,
                primary_price: 0,
                primary_timestamp: 0,
                secondary_price: 0,
                secondary_timestamp: 0,
                primary_usable: false,
                secondary_configured: false,
                secondary_usable: false,
                selected_source: SOURCE_NONE,
                deviation_bps: 0,
                diverged: false,
            };
        };

        let primary = Self::read_provider(env, &policy.primary, &asset, policy.max_price_age);
        let primary_usable = Self::is_usable(env, &primary, policy.max_price_age);

        let (secondary, secondary_usable) = if policy.has_secondary {
            let price = Self::read_provider(env, &policy.secondary, &asset, policy.max_price_age);
            let usable = Self::is_usable(env, &price, policy.max_price_age);
            (price, usable)
        } else {
            (
                OraclePriceData {
                    price: 0,
                    timestamp: 0,
                },
                false,
            )
        };

        let mut inspection = AssetInspection {
            price: 0,
            timestamp: 0,
            primary_price: primary.price,
            primary_timestamp: primary.timestamp,
            secondary_price: secondary.price,
            secondary_timestamp: secondary.timestamp,
            primary_usable,
            secondary_configured: policy.has_secondary,
            secondary_usable,
            selected_source: SOURCE_NONE,
            deviation_bps: 0,
            diverged: false,
        };

        if !policy.has_secondary {
            if primary_usable {
                inspection.price = primary.price;
                inspection.timestamp = primary.timestamp;
                inspection.selected_source = SOURCE_PRIMARY;
            } else {
                inspection.timestamp = primary.timestamp;
            }
            return inspection;
        }

        if policy.require_secondary && (!primary_usable || !secondary_usable) {
            inspection.timestamp = Self::max_timestamp(primary.timestamp, secondary.timestamp);
            return inspection;
        }

        if primary_usable && !secondary_usable {
            inspection.price = primary.price;
            inspection.timestamp = primary.timestamp;
            inspection.selected_source = SOURCE_PRIMARY;
            return inspection;
        }

        if !primary_usable && secondary_usable {
            inspection.price = secondary.price;
            inspection.timestamp = secondary.timestamp;
            inspection.selected_source = SOURCE_SECONDARY;
            return inspection;
        }

        if !primary_usable && !secondary_usable {
            inspection.timestamp = Self::max_timestamp(primary.timestamp, secondary.timestamp);
            return inspection;
        }

        inspection.deviation_bps = Self::deviation_bps(env, primary.price, secondary.price);
        inspection.diverged = inspection.deviation_bps > policy.max_deviation_bps;
        if !inspection.diverged {
            if secondary.timestamp > primary.timestamp {
                inspection.price = secondary.price;
                inspection.timestamp = secondary.timestamp;
                inspection.selected_source = SOURCE_SECONDARY;
            } else {
                inspection.price = primary.price;
                inspection.timestamp = primary.timestamp;
                inspection.selected_source = SOURCE_PRIMARY;
            }
            return inspection;
        }

        match policy.divergence_mode {
            DIVERGENCE_FAIL_CLOSED => {
                inspection.timestamp = Self::max_timestamp(primary.timestamp, secondary.timestamp);
            }
            DIVERGENCE_USE_SECONDARY => {
                inspection.price = secondary.price;
                inspection.timestamp = secondary.timestamp;
                inspection.selected_source = SOURCE_SECONDARY;
            }
            DIVERGENCE_USE_LOWER_PRICE => {
                if secondary.price < primary.price {
                    inspection.price = secondary.price;
                    inspection.timestamp = secondary.timestamp;
                } else {
                    inspection.price = primary.price;
                    inspection.timestamp = primary.timestamp;
                }
                inspection.selected_source = SOURCE_LOWER_PRICE;
            }
            _ => panic_with_error!(env, Error::InvalidPolicy),
        }
        inspection
    }

    fn read_provider(env: &Env, oracle: &Address, asset: &OracleAsset, max_age: u64) -> OraclePriceData {
        let provider_asset =
            Self::provider_asset_get(env, asset, oracle).unwrap_or_else(|| asset.clone());
        let mut price = Self::raw_provider_price(env, oracle, &provider_asset);
        let unavailable = || OraclePriceData { price: 0, timestamp: price.timestamp };
        if !Self::is_usable(env, &price, max_age) {
            return unavailable();
        }
        let Some(base) = Self::provider_base(env, oracle) else { return unavailable(); };
        let Some(decimals) = Self::provider_decimals(env, oracle) else { return unavailable(); };
        let configured = Self::policy_get::<ProviderNormalization>(
            env, &DataKey::ProviderNormalization(oracle.clone()),
        );
        if let Some(expected) = &configured {
            if expected.base_asset != base { return unavailable(); }
        }
        if base == Self::usd(env) {
            price.price = Self::scaled_product(env, price.price, decimals, 1, 0).unwrap_or(0);
            return price;
        }
        let Some(conversion) = configured else { return unavailable(); };
        if conversion.base_asset != base || Self::is_paused_internal(env, &conversion.base_asset)
            || conversion.conversion_oracle == *oracle
            || conversion.conversion_oracle == env.current_contract_address()
            || Self::provider_base(env, &conversion.conversion_oracle) != Some(Self::usd(env))
        {
            return unavailable();
        }
        let Some(rate_decimals) = Self::provider_decimals(env, &conversion.conversion_oracle)
            else { return unavailable(); };
        let rate = Self::raw_provider_price(env, &conversion.conversion_oracle, &conversion.conversion_asset);
        if !Self::is_usable(env, &rate, max_age) {
            return OraclePriceData { price: 0, timestamp: core::cmp::min(price.timestamp, rate.timestamp) };
        }
        price.price = Self::scaled_product(env, price.price, decimals, rate.price, rate_decimals).unwrap_or(0);
        price.timestamp = core::cmp::min(price.timestamp, rate.timestamp);
        price
    }

    fn usd(env: &Env) -> OracleAsset {
        OracleAsset::Other(Symbol::new(env, "USD"))
    }

    fn provider_base(env: &Env, oracle: &Address) -> Option<OracleAsset> {
        match env.try_invoke_contract::<OracleAsset, soroban_sdk::InvokeError>(
            oracle, &Symbol::new(env, "base"), soroban_sdk::vec![env],
        ) { Ok(Ok(base)) => Some(base), _ => None }
    }

    fn provider_decimals(env: &Env, oracle: &Address) -> Option<u32> {
        match env.try_invoke_contract::<u32, soroban_sdk::InvokeError>(
            oracle, &Symbol::new(env, "decimals"), soroban_sdk::vec![env],
        ) { Ok(Ok(d)) if d <= 38 => Some(d), _ => None }
    }

    // Both positive i128 operands multiply safely within a signed 256-bit word.
    // Scale once after multiplication; no intermediate rounding or i128 wrap.
    fn scaled_product(env: &Env, left: i128, left_decimals: u32, right: i128, right_decimals: u32) -> Option<i128> {
        if left <= 0 || right <= 0 || left_decimals > 38 || right_decimals > 38 { return None; }
        let product = I256::from_i128(env, left).mul(&I256::from_i128(env, right));
        let decimals = left_decimals + right_decimals;
        let value = if decimals >= 14 {
            product.div(&I256::from_i32(env, 10).pow(decimals - 14)).to_i128()?
        } else {
            product.to_i128()?.checked_mul(10i128.pow(14 - decimals))?
        };
        if value > 0 { Some(value) } else { None }
    }

    fn raw_provider_price(env: &Env, oracle: &Address, asset: &OracleAsset) -> OraclePriceData {
        let raw = match env.try_invoke_contract::<Val, soroban_sdk::InvokeError>(
            oracle,
            &Symbol::new(env, "lastprice"),
            soroban_sdk::vec![env, asset.clone().into_val(env)],
        ) { Ok(Ok(raw)) => raw, _ => return OraclePriceData { price: 0, timestamp: 0 } };
        if let Ok(price) = OraclePriceData::try_from_val(env, &raw) {
            return price;
        }
        if let Ok(price) = Option::<OraclePriceData>::try_from_val(env, &raw) {
            return price.unwrap_or(OraclePriceData {
                price: 0,
                timestamp: 0,
            });
        }
        OraclePriceData {
            price: 0,
            timestamp: 0,
        }
    }

    fn is_usable(env: &Env, price: &OraclePriceData, max_price_age: u64) -> bool {
        if price.price <= 0 || price.timestamp == 0 {
            return false;
        }
        let now = env.ledger().timestamp();
        if price.timestamp > now {
            return false;
        }
        now - price.timestamp <= max_price_age
    }

    fn max_timestamp(left: u64, right: u64) -> u64 {
        if left > right {
            left
        } else {
            right
        }
    }

    fn deviation_bps(env: &Env, left: i128, right: i128) -> u32 {
        const BPS_SCALE: i128 = 10_000;
        if left <= 0 || right <= 0 {
            return BPS_SCALE as u32;
        }
        let base = left.min(right);
        let diff = left.max(right) - base;
        if diff >= base {
            return BPS_SCALE as u32;
        }
        let raw = match diff.checked_mul(BPS_SCALE) {
            Some(scaled) => scaled / base,
            // Preserve exact rounding for large prices. Since diff < base,
            // the quotient is below BPS_SCALE and always fits in i128.
            None => I256::from_i128(env, diff)
                .mul(&I256::from_i128(env, BPS_SCALE))
                .div(&I256::from_i128(env, base))
                .to_i128()
                .unwrap(),
        };
        raw as u32
    }
}

#[cfg(test)]
mod test;
