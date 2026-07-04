#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    BytesN, Env, IntoVal, TryFromVal, Val,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Governor,
    BootstrapAdminExpiresAt,
    Tier1Threshold,
    Tier2Threshold,
    Tier3Threshold,
    Points(Address),
    LastWasmHash,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidThresholds = 4,
    InvalidPoints = 5,
    InvalidBootstrapAdmin = 6,
}

const MAX_BOOTSTRAP_ADMIN_SECONDS: u64 = 365 * 24 * 60 * 60;

#[contract]
pub struct ManagerTier;

#[contractimpl]
impl ManagerTier {
    fn bump_points_key(env: &Env, key: &DataKey) {
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

    fn points_get<T>(env: &Env, key: &DataKey) -> Option<T>
    where
        T: TryFromVal<Env, Val> + IntoVal<Env, Val>,
    {
        let persistent = env.storage().persistent();
        if let Some(value) = persistent.get::<DataKey, T>(key) {
            Self::bump_points_key(env, key);
            return Some(value);
        }
        let legacy = env.storage().instance().get::<DataKey, T>(key);
        if let Some(value) = legacy {
            persistent.set(key, &value);
            env.storage().instance().remove(key);
            Self::bump_points_key(env, key);
            return Some(value);
        }
        None
    }

    fn points_set<T>(env: &Env, key: &DataKey, value: &T)
    where
        T: IntoVal<Env, Val>,
    {
        env.storage().persistent().set(key, value);
        env.storage().instance().remove(key);
        Self::bump_points_key(env, key);
    }

    fn require_policy_auth(env: &Env, caller: &Address) {
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

    fn require_governor_auth(env: &Env, caller: &Address) {
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

    fn validate_thresholds(env: &Env, t1: i128, t2: i128, t3: i128) {
        if t1 < 0 || t2 < 0 || t3 < 0 || !(t1 <= t2 && t2 <= t3) {
            panic_with_error!(env, Error::InvalidThresholds);
        }
    }

    pub fn init(
        env: Env,
        admin: Address,
        tier1_threshold: i128,
        tier2_threshold: i128,
        tier3_threshold: i128,
    ) {
        let store = env.storage().instance();
        if store.has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        Self::validate_thresholds(&env, tier1_threshold, tier2_threshold, tier3_threshold);
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::Tier1Threshold, &tier1_threshold);
        store.set(&DataKey::Tier2Threshold, &tier2_threshold);
        store.set(&DataKey::Tier3Threshold, &tier3_threshold);
    }

    pub fn set_governor(env: Env, caller: Address, governor: Address) {
        Self::require_policy_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Governor, &governor);
    }

    pub fn set_admin(env: Env, caller: Address, admin: Address) {
        Self::require_policy_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn set_bootstrap_admin_expiry(env: Env, caller: Address, expires_at: u64) {
        Self::require_policy_auth(&env, &caller);
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
        Self::require_governor_auth(&env, &caller);
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
        Self::require_policy_auth(&env, &caller);
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

    pub fn set_thresholds(
        env: Env,
        caller: Address,
        tier1_threshold: i128,
        tier2_threshold: i128,
        tier3_threshold: i128,
    ) {
        Self::require_policy_auth(&env, &caller);
        Self::validate_thresholds(&env, tier1_threshold, tier2_threshold, tier3_threshold);
        let store = env.storage().instance();
        store.set(&DataKey::Tier1Threshold, &tier1_threshold);
        store.set(&DataKey::Tier2Threshold, &tier2_threshold);
        store.set(&DataKey::Tier3Threshold, &tier3_threshold);
    }

    pub fn set_points(env: Env, caller: Address, manager: Address, points: i128) {
        Self::require_policy_auth(&env, &caller);
        if points < 0 {
            panic_with_error!(&env, Error::InvalidPoints);
        }
        Self::points_set(&env, &DataKey::Points(manager), &points);
    }

    pub fn add_points(env: Env, caller: Address, manager: Address, delta: i128) {
        Self::require_policy_auth(&env, &caller);
        let prev: i128 = Self::points_get(&env, &DataKey::Points(manager.clone())).unwrap_or(0);
        let next = prev + delta;
        if next < 0 {
            panic_with_error!(&env, Error::InvalidPoints);
        }
        Self::points_set(&env, &DataKey::Points(manager), &next);
    }

    pub fn points_of(env: Env, manager: Address) -> i128 {
        Self::points_get(&env, &DataKey::Points(manager)).unwrap_or(0)
    }

    pub fn tier_of(env: Env, manager: Address) -> u32 {
        let p = Self::points_of(env.clone(), manager);
        let store = env.storage().instance();
        let t1: i128 = store.get(&DataKey::Tier1Threshold).unwrap_or(0);
        let t2: i128 = store.get(&DataKey::Tier2Threshold).unwrap_or(0);
        let t3: i128 = store.get(&DataKey::Tier3Threshold).unwrap_or(0);
        if p >= t3 {
            3
        } else if p >= t2 {
            2
        } else if p >= t1 {
            1
        } else {
            0
        }
    }

    pub fn thresholds(env: Env) -> (i128, i128, i128) {
        let store = env.storage().instance();
        (
            store.get(&DataKey::Tier1Threshold).unwrap_or(0),
            store.get(&DataKey::Tier2Threshold).unwrap_or(0),
            store.get(&DataKey::Tier3Threshold).unwrap_or(0),
        )
    }

    pub fn governor(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Governor)
    }
}

#[cfg(test)]
mod test;
