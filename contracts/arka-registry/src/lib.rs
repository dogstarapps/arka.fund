#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Vec, BytesN};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    All,
    ByManager(Address),
    CuratedManager(Address),
}

#[contract]
pub struct ArkaRegistry;

#[contractimpl]
impl ArkaRegistry {
    pub fn register(env: Env, manager: Address, arka: Address) {
        // Manager auth is enforced by Factory during create_arka; keep registry write simple
        let store = env.storage().instance();
        // global
        let mut all: Vec<Address> = store.get(&DataKey::All).unwrap_or(Vec::new(&env));
        if !contains(&all, &arka) { all.push_back(arka.clone()); }
        store.set(&DataKey::All, &all);
        // by manager
        let mut mine: Vec<Address> = store.get(&DataKey::ByManager(manager.clone())).unwrap_or(Vec::new(&env));
        if !contains(&mine, &arka) { mine.push_back(arka.clone()); }
        store.set(&DataKey::ByManager(manager), &mine);
    }

    pub fn get_arkas(env: Env, offset: u32, limit: u32) -> Vec<Address> {
        let list: Vec<Address> = env.storage().instance().get(&DataKey::All).unwrap_or(Vec::new(&env));
        slice(&env, list, offset, limit)
    }

    pub fn get_arkas_by_manager(env: Env, manager: Address, offset: u32, limit: u32) -> Vec<Address> {
        let list: Vec<Address> = env.storage().instance().get(&DataKey::ByManager(manager)).unwrap_or(Vec::new(&env));
        slice(&env, list, offset, limit)
    }

    pub fn count(env: Env) -> u32 {
        env.storage().instance().get::<DataKey, Vec<Address>>(&DataKey::All).map(|v| v.len()).unwrap_or(0)
    }

    pub fn count_by_manager(env: Env, manager: Address) -> u32 {
        env.storage().instance().get::<DataKey, Vec<Address>>(&DataKey::ByManager(manager)).map(|v| v.len()).unwrap_or(0)
    }

    // Governor-gated in production; simplified here (manager auth)
    pub fn set_manager_curated(env: Env, caller: Address, manager: Address, curated: bool) {
        caller.require_auth();
        let store = env.storage().instance();
        if curated {
            store.set(&DataKey::CuratedManager(manager), &true);
        } else {
            // remove by setting false
            store.set(&DataKey::CuratedManager(manager), &false);
        }
    }

    pub fn is_manager_curated(env: Env, manager: Address) -> bool {
        env.storage().instance().get::<DataKey, bool>(&DataKey::CuratedManager(manager)).unwrap_or(false)
    }
}

fn contains(list: &Vec<Address>, item: &Address) -> bool {
    let mut i: u32 = 0;
    let len = list.len();
    while i < len { if list.get_unchecked(i) == *item { return true; } i += 1; }
    false
}

fn slice(env: &Env, list: Vec<Address>, offset: u32, limit: u32) -> Vec<Address> {
    let len = list.len();
    if len == 0 { return Vec::new(env); }
    let start = core::cmp::min(offset, len);
    let end = core::cmp::min(start + limit, len);
    let mut out: Vec<Address> = Vec::new(env);
    let mut i = start;
    while i < end { out.push_back(list.get_unchecked(i)); i += 1; }
    out
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};
    #[test]
    fn registry_basics() {
        let env = Env::default();
        let id = env.register_contract(None, ArkaRegistry);
        let client = ArkaRegistryClient::new(&env, &id);
        let m = Address::generate(&env);
        let a = Address::generate(&env);
        env.mock_all_auths();
        client.register(&m, &a);
        assert_eq!(client.count(), 1);
        assert_eq!(client.get_arkas(&0, &10).len(), 1);
        assert_eq!(client.get_arkas_by_manager(&m, &0, &10).len(), 1);
    }
}


