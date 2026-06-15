#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, IntoVal, Val,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Governor,
    BootstrapAdminExpiresAt,
    LastWasmHash,
}

const MAX_BOOTSTRAP_ADMIN_SECONDS: u64 = 365 * 24 * 60 * 60;

#[contract]
pub struct GovToken;

#[contractimpl]
impl GovToken {
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

    fn bump_persistent_key<K>(env: &Env, key: &K)
    where
        K: IntoVal<Env, Val>,
    {
        let max_ttl = env.storage().max_ttl();
        if max_ttl == 0 {
            return;
        }
        if env.storage().persistent().has(key) {
            let threshold = core::cmp::max(max_ttl / 2, 1);
            env.storage()
                .persistent()
                .extend_ttl(key, threshold, max_ttl);
        }
    }

    pub fn init(env: Env, admin: Address) {
        let store = env.storage().instance();
        assert!(
            store.get::<_, Address>(&DataKey::Admin).is_none(),
            "already_init"
        );
        store.set(&DataKey::Admin, &admin);
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
        Self::bootstrap_admin_active_internal(&env)
    }

    // Minimal surface for governor demos: mint balances tracked in events only is insufficient.
    // For now, we expose a balance map: Address -> i128 (not production token standard).
    pub fn mint(env: Env, to: Address, amount: i128) {
        let store = env.storage().instance();
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("no_admin");
        assert!(!Self::bootstrap_admin_expired(&env), "admin_expired");
        admin.require_auth();
        let key = (symbol_short!("bal"), to.clone());
        let prev: i128 = env
            .storage()
            .persistent()
            .get(&key)
            .or_else(|| store.get::<_, i128>(&key))
            .unwrap_or(0);
        let next = prev + amount;
        env.storage().persistent().set(&key, &next);
        store.remove(&key);
        Self::bump_persistent_key(&env, &key);
    }

    pub fn mint_governed(env: Env, caller: Address, to: Address, amount: i128) {
        Self::require_admin_or_governor_auth(&env, &caller);
        let key = (symbol_short!("bal"), to.clone());
        let prev: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        let next = prev + amount;
        env.storage().persistent().set(&key, &next);
        env.storage().instance().remove(&key);
        Self::bump_persistent_key(&env, &key);
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

    pub fn balance(env: Env, owner: Address) -> i128 {
        let key = (symbol_short!("bal"), owner);
        if let Some(balance) = env.storage().persistent().get::<_, i128>(&key) {
            Self::bump_persistent_key(&env, &key);
            return balance;
        }
        let legacy = env.storage().instance().get::<_, i128>(&key).unwrap_or(0);
        if legacy > 0 {
            env.storage().persistent().set(&key, &legacy);
            env.storage().instance().remove(&key);
            Self::bump_persistent_key(&env, &key);
        }
        legacy
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    #[test]
    fn test_mint_balance() {
        let env = Env::default();
        let id = env.register_contract(None, GovToken);
        let client = GovTokenClient::new(&env, &id);
        let admin = Address::generate(&env);
        client.init(&admin);

        let user = Address::generate(&env);
        env.mock_all_auths();
        client.mint(&user, &100);
        let b = client.balance(&user);
        assert_eq!(b, 100);
    }
}
