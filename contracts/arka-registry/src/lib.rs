#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Vec, BytesN};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    All,
    ByManager(Address),
    CuratedManager(Address),
    Delisted(Address),
    Admin,
}

#[contract]
pub struct ArkaRegistry;

#[contractimpl]
impl ArkaRegistry {
    // One-time admin initializer
    pub fn init_admin(env: Env, admin: Address) {
        let store = env.storage().instance();
        if store.has(&DataKey::Admin) { return; }
        store.set(&DataKey::Admin, &admin);
    }

    fn require_admin(env: &Env, caller: &Address) {
        let store = env.storage().instance();
        let admin: Address = store.get(&DataKey::Admin).expect("admin_not_set");
        if *caller != admin { panic!("only_admin"); }
        caller.require_auth();
    }
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
        filter_and_slice(&env, list, offset, limit)
    }

    pub fn get_arkas_by_manager(env: Env, manager: Address, offset: u32, limit: u32) -> Vec<Address> {
        let list: Vec<Address> = env.storage().instance().get(&DataKey::ByManager(manager)).unwrap_or(Vec::new(&env));
        filter_and_slice(&env, list, offset, limit)
    }

    pub fn count(env: Env) -> u32 {
        let list: Vec<Address> = env.storage().instance().get(&DataKey::All).unwrap_or(Vec::new(&env));
        count_active(&env, list)
    }

    pub fn count_by_manager(env: Env, manager: Address) -> u32 {
        let list: Vec<Address> = env.storage().instance().get(&DataKey::ByManager(manager)).unwrap_or(Vec::new(&env));
        count_active(&env, list)
    }

    // Admin-only in production
    pub fn set_manager_curated(env: Env, caller: Address, manager: Address, curated: bool) {
        Self::require_admin(&env, &caller);
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

    // Admin-only: Mark an Arka as delisted/inactive
    pub fn set_delisted(env: Env, caller: Address, arka: Address, delisted: bool) {
        Self::require_admin(&env, &caller);
        let store = env.storage().instance();
        if delisted {
            store.set(&DataKey::Delisted(arka), &true);
        } else {
            store.set(&DataKey::Delisted(arka), &false);
        }
    }

    pub fn is_delisted(env: Env, arka: Address) -> bool {
        env.storage().instance().get::<DataKey, bool>(&DataKey::Delisted(arka)).unwrap_or(false)
    }

    // Admin-only: register legacy Arkas
    pub fn register_admin(env: Env, caller: Address, manager: Address, arka: Address) {
        Self::require_admin(&env, &caller);
        Self::register(env, manager, arka);
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

fn filter_and_slice(env: &Env, list: Vec<Address>, offset: u32, limit: u32) -> Vec<Address> {
    // Build filtered list excluding delisted entries
    let mut filtered: Vec<Address> = Vec::new(env);
    let mut i: u32 = 0;
    let len = list.len();
    while i < len {
        let a = list.get_unchecked(i);
        if !ArkaRegistry::is_delisted(env.clone(), a.clone()) {
            filtered.push_back(a);
        }
        i += 1;
    }
    slice(env, filtered, offset, limit)
}

fn count_active(env: &Env, list: Vec<Address>) -> u32 {
    let mut n: u32 = 0;
    let mut i: u32 = 0;
    let len = list.len();
    while i < len {
        let a = list.get_unchecked(i);
        if !ArkaRegistry::is_delisted(env.clone(), a) { n += 1; }
        i += 1;
    }
    n
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


