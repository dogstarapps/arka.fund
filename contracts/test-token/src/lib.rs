#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
}

#[contract]
pub struct TestToken;

#[contractimpl]
impl TestToken {
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
        let prev: i128 = store.get(&key).unwrap_or(0);
        store.set(&key, &(prev + amount));
    }

    pub fn approve(env: Env, owner: Address, spender: Address, amount: i128) {
        owner.require_auth();
        let store = env.storage().instance();
        let key = (symbol_short!("allow"), owner.clone(), spender.clone());
        store.set(&key, &amount);
    }

    pub fn allowance(env: Env, owner: Address, spender: Address) -> i128 {
        let store = env.storage().instance();
        let key = (symbol_short!("allow"), owner, spender);
        store.get(&key).unwrap_or(0)
    }

    pub fn balance(env: Env, owner: Address) -> i128 {
        let store = env.storage().instance();
        let key = (symbol_short!("bal"), owner);
        store.get(&key).unwrap_or(0)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        Self::xfer(&env, from, to, amount);
    }

    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        let store = env.storage().instance();
        let akey = (symbol_short!("allow"), from.clone(), spender.clone());
        let allow: i128 = store.get(&akey).unwrap_or(0);
        assert!(allow >= amount, "insufficient_allowance");
        store.set(&akey, &(allow - amount));
        Self::xfer(&env, from, to, amount);
    }

    fn xfer(env: &Env, from: Address, to: Address, amount: i128) {
        assert!(amount > 0, "amount_zero");
        let store = env.storage().instance();
        let fkey = (symbol_short!("bal"), from.clone());
        let tkey = (symbol_short!("bal"), to.clone());
        let fb: i128 = store.get(&fkey).unwrap_or(0);
        assert!(fb >= amount, "insufficient_balance");
        store.set(&fkey, &(fb - amount));
        let tb: i128 = store.get(&tkey).unwrap_or(0);
        store.set(&tkey, &(tb + amount));
    }
}
