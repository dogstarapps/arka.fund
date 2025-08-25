#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[derive(Clone)]
#[contracttype]
pub enum DataKey { Manager, LockBps, Balance }

#[contract]
pub struct CoverageVault;

#[contractimpl]
impl CoverageVault {
    pub fn init(env: Env, manager: Address, lock_bps: i32) {
        let store = env.storage().instance();
        assert!(!store.has(&DataKey::Manager), "already_initialized");
        store.set(&DataKey::Manager, &manager);
        store.set(&DataKey::LockBps, &lock_bps);
        store.set(&DataKey::Balance, &0i128);
    }

    pub fn set_lock_bps(env: Env, caller: Address, lock_bps: i32) {
        let store = env.storage().instance();
        let mgr: Address = store.get(&DataKey::Manager).expect("not_initialized");
        assert!(caller == mgr, "only_manager");
        caller.require_auth();
        store.set(&DataKey::LockBps, &lock_bps);
    }

    pub fn deposit(env: Env, from: Address, amount: i128) {
        from.require_auth();
        let store = env.storage().instance();
        let bal: i128 = store.get(&DataKey::Balance).unwrap_or(0);
        store.set(&DataKey::Balance, &(bal + amount));
    }

    pub fn withdraw(env: Env, caller: Address, amount: i128) {
        let store = env.storage().instance();
        let mgr: Address = store.get(&DataKey::Manager).expect("not_initialized");
        assert!(caller == mgr, "only_manager");
        caller.require_auth();
        let bal: i128 = store.get(&DataKey::Balance).unwrap_or(0);
        assert!(amount <= bal, "insufficient");
        store.set(&DataKey::Balance, &(bal - amount));
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, Address};

    #[test]
    fn test_flow() {
        let env = Env::default();
        let id = env.register_contract(None, CoverageVault);
        let client = CoverageVaultClient::new(&env, &id);
        let mgr = Address::generate(&env);
        client.init(&mgr, &1000);
        let user = Address::generate(&env);
        client.deposit(&user, &50);
        client.withdraw(&mgr, &20);
    }
}


