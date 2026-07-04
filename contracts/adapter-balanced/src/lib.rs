#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, vec, Address, BytesN, Env, IntoVal,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Governor,
    BootstrapAdminExpiresAt,
    Router,
    SupportedPool(u128),
    LastWasmHash,
}

const MAX_BOOTSTRAP_ADMIN_SECONDS: u64 = 365 * 24 * 60 * 60;

#[contract]
pub struct BalancedAdapter;

#[contractimpl]
impl BalancedAdapter {
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

    fn require_future_bootstrap_expiry(env: &Env, expires_at: u64) {
        let now = env.ledger().timestamp();
        assert!(
            expires_at > now && expires_at.saturating_sub(now) <= MAX_BOOTSTRAP_ADMIN_SECONDS,
            "invalid_bootstrap_admin"
        );
    }

    fn require_admin_or_governor_auth(env: &Env, caller: &Address) {
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
        panic!("only_admin_or_governor");
    }

    fn require_governor_auth(env: &Env, caller: &Address) {
        let governor: Address = env
            .storage()
            .instance()
            .get(&DataKey::Governor)
            .expect("governor_not_set");
        assert!(*caller == governor, "only_governor");
        caller.require_auth();
    }

    pub fn init(env: Env, admin: Address, router: Address) {
        let store = env.storage().instance();
        assert!(!store.has(&DataKey::Admin), "already_initialized");
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::Router, &router);
    }

    pub fn set_admin(env: Env, caller: Address, admin: Address) {
        Self::require_admin_or_governor_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn set_governor(env: Env, caller: Address, governor: Option<Address>) {
        Self::require_admin_or_governor_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Governor, &governor);
    }

    pub fn set_bootstrap_admin_expiry(env: Env, caller: Address, expires_at: u64) {
        Self::require_admin_or_governor_auth(&env, &caller);
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
        let Some(expires_at) = Self::bootstrap_admin_expires_at(env.clone()) else {
            return false;
        };
        env.ledger().timestamp() <= expires_at
    }

    pub fn set_router(env: Env, caller: Address, router: Address) {
        Self::require_admin_or_governor_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Router, &router);
    }

    pub fn router(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Router)
            .expect("router_not_set")
    }

    pub fn set_supported_pool(env: Env, caller: Address, pool_id: u128, supported: bool) {
        Self::require_admin_or_governor_auth(&env, &caller);
        env.storage()
            .instance()
            .set(&DataKey::SupportedPool(pool_id), &supported);
    }

    pub fn upgrade(env: Env, caller: Address, new_wasm_hash: BytesN<32>) {
        Self::require_admin_or_governor_auth(&env, &caller);
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

    pub fn pool_supported(env: Env, pool_id: u128) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::SupportedPool(pool_id))
            .unwrap_or(false)
    }

    // Unified adapter signature used by Router.execute.
    pub fn execute(
        env: Env,
        caller: Address,
        pool_id: u128,
        amount_in: i128,
        min_out: i128,
        receiver: Address,
    ) -> i128 {
        caller.require_auth();
        assert!(amount_in > 0, "amount_zero");
        let store = env.storage().instance();
        let router: Address = store.get(&DataKey::Router).expect("router_not_set");
        let supported = Self::pool_supported(env.clone(), pool_id);
        assert!(supported, "pool_not_supported");

        let args = vec![
            &env,
            caller.into_val(&env),
            pool_id.into_val(&env),
            amount_in.into_val(&env),
            min_out.into_val(&env),
            receiver.into_val(&env),
        ];
        let out: i128 = env.invoke_contract(&router, &symbol_short!("swap"), args);
        assert!(out >= min_out, "slippage_exceeded");
        out
    }
}

#[cfg(test)]
mod test;
