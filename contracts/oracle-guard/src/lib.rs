#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, BytesN, Env,
    IntoVal, Symbol, TryFromVal, Val,
};

#[derive(Clone)]
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

    pub fn init(env: Env, admin: Address) {
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
        if let Some(governor) = store.get::<DataKey, Address>(&DataKey::Governor) {
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
            .get::<DataKey, Address>(&DataKey::Governor)
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
        if let Some(governor) = store.get::<DataKey, Address>(&DataKey::Governor) {
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

        let primary = Self::read_provider(env, &policy.primary, &asset);
        let primary_usable = Self::is_usable(env, &primary, policy.max_price_age);

        let (secondary, secondary_usable) = if policy.has_secondary {
            let price = Self::read_provider(env, &policy.secondary, &asset);
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

        inspection.deviation_bps = Self::deviation_bps(primary.price, secondary.price);
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

    fn read_provider(env: &Env, oracle: &Address, asset: &OracleAsset) -> OraclePriceData {
        let provider_asset =
            Self::provider_asset_get(env, asset, oracle).unwrap_or_else(|| asset.clone());
        let raw = env.invoke_contract::<Val>(
            oracle,
            &Symbol::new(env, "lastprice"),
            soroban_sdk::vec![env, provider_asset.into_val(env)],
        );
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

    fn deviation_bps(left: i128, right: i128) -> u32 {
        if left <= 0 || right <= 0 {
            return 10_000;
        }
        let base = if left < right { left } else { right };
        if base <= 0 {
            return 10_000;
        }
        let diff = if left > right {
            left - right
        } else {
            right - left
        };
        let raw = (diff * 10_000i128) / base;
        if raw > 10_000i128 {
            10_000
        } else {
            raw as u32
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        contract, contractimpl,
        testutils::{Address as _, Ledger as _},
        Env,
    };

    #[derive(Clone)]
    #[contracttype]
    enum FeedKey {
        Price(OracleAsset),
        Timestamp(OracleAsset),
    }

    #[contract]
    struct DummyOracle;

    #[contractimpl]
    impl DummyOracle {
        pub fn set_price(env: Env, asset: OracleAsset, price: i128, timestamp: u64) {
            env.storage()
                .instance()
                .set(&FeedKey::Price(asset.clone()), &price);
            env.storage()
                .instance()
                .set(&FeedKey::Timestamp(asset), &timestamp);
        }

        pub fn lastprice(env: Env, asset: OracleAsset) -> OraclePriceData {
            OraclePriceData {
                price: env
                    .storage()
                    .instance()
                    .get(&FeedKey::Price(asset.clone()))
                    .unwrap_or(0),
                timestamp: env
                    .storage()
                    .instance()
                    .get(&FeedKey::Timestamp(asset))
                    .unwrap_or(0u64),
            }
        }
    }

    fn setup_guard<'a>(env: &'a Env) -> (OracleGuardClient<'a>, Address, OracleAsset) {
        if env.ledger().timestamp() == 0 {
            env.ledger().set_timestamp(1_000);
        }
        let guard_id = env.register_contract(None, OracleGuard);
        let guard = OracleGuardClient::new(env, &guard_id);
        let admin = Address::generate(env);
        env.mock_all_auths();
        guard.init(&admin);
        let asset = OracleAsset::Stellar(Address::generate(env));
        (guard, admin, asset)
    }

    fn deploy_oracle<'a>(env: &'a Env) -> (Address, DummyOracleClient<'a>) {
        let id = env.register_contract(None, DummyOracle);
        let client = DummyOracleClient::new(env, &id);
        (id, client)
    }

    #[test]
    fn uses_primary_when_single_feed_is_healthy() {
        let env = Env::default();
        let (guard, admin, asset) = setup_guard(&env);
        let (primary_id, primary) = deploy_oracle(&env);
        primary.set_price(&asset, &10_000_000i128, &990u64);
        guard.set_stellar_asset_policy(
            &admin,
            &match asset.clone() {
                OracleAsset::Stellar(address) => address,
                _ => panic!("unexpected_asset"),
            },
            &primary_id,
            &primary_id,
            &false,
            &120u64,
            &500u32,
            &false,
            &DIVERGENCE_FAIL_CLOSED,
        );

        let price = guard.lastprice(&asset);
        assert_eq!(price.price, 10_000_000);
        let inspection = guard.inspect_stellar(&match asset {
            OracleAsset::Stellar(address) => address,
            _ => panic!("unexpected_asset"),
        });
        assert_eq!(inspection.selected_source, SOURCE_PRIMARY);
    }

    #[test]
    fn falls_back_to_secondary_when_primary_is_invalid() {
        let env = Env::default();
        let (guard, admin, asset) = setup_guard(&env);
        let asset_id = match asset.clone() {
            OracleAsset::Stellar(address) => address,
            _ => panic!("unexpected_asset"),
        };
        let (primary_id, primary) = deploy_oracle(&env);
        let (secondary_id, secondary) = deploy_oracle(&env);
        primary.set_price(&asset, &0i128, &990u64);
        secondary.set_price(&asset, &9_900_000i128, &995u64);
        guard.set_stellar_asset_policy(
            &admin,
            &asset_id,
            &primary_id,
            &secondary_id,
            &true,
            &120u64,
            &500u32,
            &false,
            &DIVERGENCE_FAIL_CLOSED,
        );

        let price = guard.lastprice(&asset);
        assert_eq!(price.price, 9_900_000);
        let inspection = guard.inspect_stellar(&asset_id);
        assert_eq!(inspection.selected_source, SOURCE_SECONDARY);
    }

    #[test]
    fn fail_closes_when_secondary_confirmation_is_required() {
        let env = Env::default();
        let (guard, admin, asset) = setup_guard(&env);
        let asset_id = match asset.clone() {
            OracleAsset::Stellar(address) => address,
            _ => panic!("unexpected_asset"),
        };
        let (primary_id, primary) = deploy_oracle(&env);
        let (secondary_id, _secondary) = deploy_oracle(&env);
        primary.set_price(&asset, &10_000_000i128, &995u64);
        guard.set_stellar_asset_policy(
            &admin,
            &asset_id,
            &primary_id,
            &secondary_id,
            &true,
            &120u64,
            &500u32,
            &true,
            &DIVERGENCE_FAIL_CLOSED,
        );

        let price = guard.lastprice(&asset);
        assert_eq!(price.price, 0);
        let inspection = guard.inspect_stellar(&asset_id);
        assert_eq!(inspection.selected_source, SOURCE_NONE);
    }

    #[test]
    fn uses_secondary_on_divergence_when_configured() {
        let env = Env::default();
        let (guard, admin, asset) = setup_guard(&env);
        let asset_id = match asset.clone() {
            OracleAsset::Stellar(address) => address,
            _ => panic!("unexpected_asset"),
        };
        let (primary_id, primary) = deploy_oracle(&env);
        let (secondary_id, secondary) = deploy_oracle(&env);
        primary.set_price(&asset, &100_000_000i128, &990u64);
        secondary.set_price(&asset, &10_000_000i128, &995u64);
        guard.set_stellar_asset_policy(
            &admin,
            &asset_id,
            &primary_id,
            &secondary_id,
            &true,
            &120u64,
            &500u32,
            &false,
            &DIVERGENCE_USE_SECONDARY,
        );

        let price = guard.lastprice(&asset);
        assert_eq!(price.price, 10_000_000);
        let inspection = guard.inspect_stellar(&asset_id);
        assert!(inspection.diverged);
        assert_eq!(inspection.selected_source, SOURCE_SECONDARY);
    }

    #[test]
    fn uses_lower_price_on_divergence_when_configured() {
        let env = Env::default();
        let (guard, admin, asset) = setup_guard(&env);
        let asset_id = match asset.clone() {
            OracleAsset::Stellar(address) => address,
            _ => panic!("unexpected_asset"),
        };
        let (primary_id, primary) = deploy_oracle(&env);
        let (secondary_id, secondary) = deploy_oracle(&env);
        primary.set_price(&asset, &11_000_000i128, &995u64);
        secondary.set_price(&asset, &10_000_000i128, &990u64);
        guard.set_stellar_asset_policy(
            &admin,
            &asset_id,
            &primary_id,
            &secondary_id,
            &true,
            &120u64,
            &200u32,
            &false,
            &DIVERGENCE_USE_LOWER_PRICE,
        );

        let price = guard.lastprice(&asset);
        assert_eq!(price.price, 10_000_000);
        let inspection = guard.inspect_stellar(&asset_id);
        assert_eq!(inspection.selected_source, SOURCE_LOWER_PRICE);
    }

    #[test]
    fn rejects_stale_primary_feed() {
        let env = Env::default();
        let (guard, admin, asset) = setup_guard(&env);
        let asset_id = match asset.clone() {
            OracleAsset::Stellar(address) => address,
            _ => panic!("unexpected_asset"),
        };
        let (primary_id, primary) = deploy_oracle(&env);
        primary.set_price(&asset, &10_000_000i128, &100u64);
        guard.set_stellar_asset_policy(
            &admin,
            &asset_id,
            &primary_id,
            &primary_id,
            &false,
            &60u64,
            &500u32,
            &false,
            &DIVERGENCE_FAIL_CLOSED,
        );

        let price = guard.lastprice(&asset);
        assert_eq!(price.price, 0);
        let inspection = guard.inspect_stellar(&asset_id);
        assert!(!inspection.primary_usable);
    }

    #[test]
    fn guardian_can_pause_asset_policy_but_admin_resumes_it() {
        let env = Env::default();
        let (guard, admin, asset) = setup_guard(&env);
        let asset_id = match asset.clone() {
            OracleAsset::Stellar(address) => address,
            _ => panic!("unexpected_asset"),
        };
        let guardian = Address::generate(&env);
        let (primary_id, primary) = deploy_oracle(&env);
        primary.set_price(&asset, &10_000_000i128, &995u64);
        guard.set_stellar_asset_policy(
            &admin,
            &asset_id,
            &primary_id,
            &primary_id,
            &false,
            &120u64,
            &500u32,
            &false,
            &DIVERGENCE_FAIL_CLOSED,
        );
        guard.set_guardian(&admin, &guardian, &1_500u64);

        guard.pause_stellar_asset_policy(&guardian, &asset_id);

        assert!(guard.stellar_asset_policy_paused(&asset_id));
        assert!(guard.is_guardian_active());
        let paused_price = guard.lastprice(&asset);
        assert_eq!(paused_price.price, 0);
        assert_eq!(
            guard.inspect_stellar(&asset_id).selected_source,
            SOURCE_NONE
        );

        guard.resume_stellar_asset_policy(&admin, &asset_id);

        assert!(!guard.stellar_asset_policy_paused(&asset_id));
        let live_price = guard.lastprice(&asset);
        assert_eq!(live_price.price, 10_000_000);
    }

    #[test]
    fn setting_policy_by_admin_clears_emergency_pause() {
        let env = Env::default();
        let (guard, admin, asset) = setup_guard(&env);
        let asset_id = match asset.clone() {
            OracleAsset::Stellar(address) => address,
            _ => panic!("unexpected_asset"),
        };
        let guardian = Address::generate(&env);
        let (primary_id, primary) = deploy_oracle(&env);
        primary.set_price(&asset, &10_000_000i128, &995u64);
        guard.set_stellar_asset_policy(
            &admin,
            &asset_id,
            &primary_id,
            &primary_id,
            &false,
            &120u64,
            &500u32,
            &false,
            &DIVERGENCE_FAIL_CLOSED,
        );
        guard.set_guardian(&admin, &guardian, &1_500u64);
        guard.pause_stellar_asset_policy(&guardian, &asset_id);
        assert!(guard.stellar_asset_policy_paused(&asset_id));

        guard.set_stellar_asset_policy(
            &admin,
            &asset_id,
            &primary_id,
            &primary_id,
            &false,
            &120u64,
            &500u32,
            &false,
            &DIVERGENCE_FAIL_CLOSED,
        );

        assert!(!guard.stellar_asset_policy_paused(&asset_id));
        assert_eq!(guard.lastprice(&asset).price, 10_000_000);
    }

    #[test]
    fn guardian_expiry_is_reported_from_config() {
        let env = Env::default();
        let (guard, admin, _asset) = setup_guard(&env);
        let guardian = Address::generate(&env);
        guard.set_guardian(&admin, &guardian, &1_100u64);
        let config = guard.guardian_config();
        assert_eq!(config.guardian, Some(guardian));
        assert_eq!(config.expires_at, 1_100);
        assert!(config.active);

        env.ledger().set_timestamp(1_101);

        let expired = guard.guardian_config();
        assert!(!expired.active);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #3)")]
    fn expired_guardian_cannot_pause_asset_policy() {
        let env = Env::default();
        let (guard, admin, asset) = setup_guard(&env);
        let asset_id = match asset {
            OracleAsset::Stellar(address) => address,
            _ => panic!("unexpected_asset"),
        };
        let guardian = Address::generate(&env);
        guard.set_guardian(&admin, &guardian, &1_001u64);
        env.ledger().set_timestamp(1_002);

        guard.pause_stellar_asset_policy(&guardian, &asset_id);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #3)")]
    fn guardian_cannot_resume_paused_asset_policy() {
        let env = Env::default();
        let (guard, admin, asset) = setup_guard(&env);
        let asset_id = match asset {
            OracleAsset::Stellar(address) => address,
            _ => panic!("unexpected_asset"),
        };
        let guardian = Address::generate(&env);
        guard.set_guardian(&admin, &guardian, &1_500u64);
        guard.pause_stellar_asset_policy(&guardian, &asset_id);

        guard.resume_stellar_asset_policy(&guardian, &asset_id);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #3)")]
    fn non_admin_cannot_set_guardian() {
        let env = Env::default();
        let (guard, _admin, _asset) = setup_guard(&env);
        let attacker = Address::generate(&env);
        let guardian = Address::generate(&env);

        guard.set_guardian(&attacker, &guardian, &1_500u64);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #5)")]
    fn guardian_expiry_must_be_in_the_future() {
        let env = Env::default();
        let (guard, admin, _asset) = setup_guard(&env);
        let guardian = Address::generate(&env);

        guard.set_guardian(&admin, &guardian, &1_000u64);
    }
}
