#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, IntoVal, String, Val,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
}

#[contract]
pub struct TestToken;

#[contractimpl]
impl TestToken {
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

    pub fn mint(env: Env, to: Address, amount: i128) {
        let store = env.storage().instance();
        let admin: Address = store.get(&DataKey::Admin).expect("no_admin");
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

    pub fn burn(env: Env, from: Address, amount: i128) {
        let store = env.storage().instance();
        let admin: Address = store.get(&DataKey::Admin).expect("no_admin");
        admin.require_auth();
        let key = (symbol_short!("bal"), from.clone());
        let prev: i128 = env
            .storage()
            .persistent()
            .get(&key)
            .or_else(|| store.get::<_, i128>(&key))
            .unwrap_or(0);
        assert!(amount > 0, "amount_zero");
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
        String::from_str(&env, "Arka Test Token")
    }

    pub fn symbol(env: Env) -> String {
        String::from_str(&env, "ARKAT")
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
