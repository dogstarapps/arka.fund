#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, IntoVal, String, Val,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    UpgradeAdmin,
    Governor,
    BootstrapAdminExpiresAt,
    LastWasmHash,
}

#[contract]
pub struct ShareToken;

const MAX_BOOTSTRAP_ADMIN_SECONDS: u64 = 365 * 24 * 60 * 60;

#[contractimpl]
impl ShareToken {
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

    fn require_governor_auth(env: &Env, caller: &Address) {
        let governor: Address = env
            .storage()
            .instance()
            .get(&DataKey::Governor)
            .expect("governor_not_set");
        assert!(*caller == governor, "only_governor");
        caller.require_auth();
    }

    fn require_upgrade_auth(env: &Env, caller: &Address) {
        let store = env.storage().instance();
        if !Self::bootstrap_admin_expired(env) {
            if let Some(admin) = store.get::<DataKey, Address>(&DataKey::UpgradeAdmin) {
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
        panic!("only_upgrade_authority");
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
        assert!(!store.has(&DataKey::Admin), "already_init");
        store.set(&DataKey::Admin, &admin);
    }

    pub fn init_with_upgrade_authority(
        env: Env,
        admin: Address,
        upgrade_admin: Address,
        governor: Option<Address>,
        expires_at: u64,
    ) {
        Self::require_future_bootstrap_expiry(&env, expires_at);
        let store = env.storage().instance();
        assert!(!store.has(&DataKey::Admin), "already_init");
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::UpgradeAdmin, &upgrade_admin);
        store.set(&DataKey::Governor, &governor);
        store.set(&DataKey::BootstrapAdminExpiresAt, &expires_at);
    }

    pub fn set_upgrade_admin(env: Env, caller: Address, admin: Address, expires_at: u64) {
        Self::require_upgrade_auth(&env, &caller);
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
        store.set(&DataKey::UpgradeAdmin, &admin);
        store.set(&DataKey::BootstrapAdminExpiresAt, &expires_at);
    }

    pub fn set_governor(env: Env, caller: Address, governor: Option<Address>) {
        Self::require_upgrade_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Governor, &governor);
    }

    pub fn clear_upgrade_admin(env: Env, caller: Address) {
        Self::require_governor_auth(&env, &caller);
        env.storage().instance().remove(&DataKey::UpgradeAdmin);
        env.storage()
            .instance()
            .set(&DataKey::BootstrapAdminExpiresAt, &0u64);
    }

    pub fn upgrade_admin(env: Env) -> Option<Address> {
        env.storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::UpgradeAdmin)
    }

    pub fn governor(env: Env) -> Option<Address> {
        env.storage()
            .instance()
            .get::<DataKey, Option<Address>>(&DataKey::Governor)
            .unwrap_or(None)
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
        Self::require_upgrade_auth(&env, &caller);
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

    pub fn mint(env: Env, to: Address, amount: i128) {
        let store = env.storage().instance();
        let admin: Address = store.get(&DataKey::Admin).expect("no_admin");
        admin.require_auth();
        assert!(amount > 0, "amount_zero");
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

    pub fn burn(env: Env, from: Address, amount: i128) {
        let store = env.storage().instance();
        let admin: Address = store.get(&DataKey::Admin).expect("no_admin");
        admin.require_auth();
        assert!(amount > 0, "amount_zero");
        let key = (symbol_short!("bal"), from.clone());
        let prev: i128 = env
            .storage()
            .persistent()
            .get(&key)
            .or_else(|| store.get::<_, i128>(&key))
            .unwrap_or(0);
        assert!(prev >= amount, "insufficient_balance");
        let next = prev - amount;
        if next == 0 {
            env.storage().persistent().remove(&key);
            store.remove(&key);
            return;
        }
        env.storage().persistent().set(&key, &next);
        store.remove(&key);
        Self::bump_persistent_key(&env, &key);
    }

    pub fn approve(
        env: Env,
        owner: Address,
        spender: Address,
        amount: i128,
        expiration_ledger: u32,
    ) {
        let _ = expiration_ledger;
        owner.require_auth();
        assert!(amount >= 0, "negative_amount");
        let store = env.storage().instance();
        let key = (symbol_short!("allow"), owner.clone(), spender.clone());
        if amount == 0 {
            env.storage().persistent().remove(&key);
            store.remove(&key);
            return;
        }
        env.storage().persistent().set(&key, &amount);
        store.remove(&key);
        Self::bump_persistent_key(&env, &key);
    }

    pub fn allowance(env: Env, owner: Address, spender: Address) -> i128 {
        let key = (symbol_short!("allow"), owner, spender);
        if let Some(allowance) = env.storage().persistent().get::<_, i128>(&key) {
            Self::bump_persistent_key(&env, &key);
            return allowance;
        }
        let legacy = env.storage().instance().get::<_, i128>(&key).unwrap_or(0);
        if legacy > 0 {
            env.storage().persistent().set(&key, &legacy);
            env.storage().instance().remove(&key);
            Self::bump_persistent_key(&env, &key);
        }
        legacy
    }

    pub fn admin(env: Env) -> Address {
        let store = env.storage().instance();
        store.get(&DataKey::Admin).expect("no_admin")
    }

    pub fn decimals(_env: Env) -> u32 {
        7
    }

    pub fn name(env: Env) -> String {
        String::from_str(&env, "Arka Share Token")
    }

    pub fn symbol(env: Env) -> String {
        String::from_str(&env, "ARKA-SHARE")
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

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        Self::xfer(&env, from, to, amount);
    }

    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        let store = env.storage().instance();
        let akey = (symbol_short!("allow"), from.clone(), spender.clone());
        let allow: i128 = env
            .storage()
            .persistent()
            .get(&akey)
            .or_else(|| store.get::<_, i128>(&akey))
            .unwrap_or(0);
        assert!(allow >= amount, "insufficient_allowance");
        let next_allowance = allow - amount;
        if next_allowance == 0 {
            env.storage().persistent().remove(&akey);
            store.remove(&akey);
        } else {
            env.storage().persistent().set(&akey, &next_allowance);
            store.remove(&akey);
            Self::bump_persistent_key(&env, &akey);
        }
        Self::xfer(&env, from, to, amount);
    }

    fn xfer(env: &Env, from: Address, to: Address, amount: i128) {
        assert!(amount > 0, "amount_zero");
        let store = env.storage().instance();
        let fkey = (symbol_short!("bal"), from.clone());
        let tkey = (symbol_short!("bal"), to.clone());
        let fb: i128 = env
            .storage()
            .persistent()
            .get(&fkey)
            .or_else(|| store.get::<_, i128>(&fkey))
            .unwrap_or(0);
        assert!(fb >= amount, "insufficient_balance");
        let next_from = fb - amount;
        if next_from == 0 {
            env.storage().persistent().remove(&fkey);
            store.remove(&fkey);
        } else {
            env.storage().persistent().set(&fkey, &next_from);
            store.remove(&fkey);
            Self::bump_persistent_key(env, &fkey);
        }
        let tb: i128 = env
            .storage()
            .persistent()
            .get(&tkey)
            .or_else(|| store.get::<_, i128>(&tkey))
            .unwrap_or(0);
        let next_to = tb + amount;
        env.storage().persistent().set(&tkey, &next_to);
        store.remove(&tkey);
        Self::bump_persistent_key(env, &tkey);
    }
}

#[cfg(test)]
mod test;
