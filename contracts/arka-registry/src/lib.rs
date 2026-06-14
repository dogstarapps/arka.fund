#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, IntoVal, Symbol,
    TryFromVal, Val, Vec,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    All,
    ByManager(Address),
    CuratedManager(Address),
    Delisted(Address),
    Registrar(Address),
    Admin,
    Governor,
    BootstrapAdminExpiresAt,
    LastWasmHash,
}

const MAX_BOOTSTRAP_ADMIN_SECONDS: u64 = 365 * 24 * 60 * 60;

const EVENT_ADMIN: Symbol = symbol_short!("admin");
const EVENT_WRITER: Symbol = symbol_short!("writer");
const EVENT_REGISTER: Symbol = symbol_short!("register");
const EVENT_CURATE: Symbol = symbol_short!("curate");
const EVENT_DELIST: Symbol = symbol_short!("delist");

#[contract]
pub struct ArkaRegistry;

#[contractimpl]
impl ArkaRegistry {
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

    fn bump_dynamic_key(env: &Env, key: &DataKey) {
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

    fn dynamic_get<T>(env: &Env, key: &DataKey) -> Option<T>
    where
        T: TryFromVal<Env, Val> + IntoVal<Env, Val>,
    {
        let persistent = env.storage().persistent();
        if let Some(value) = persistent.get::<DataKey, T>(key) {
            Self::bump_dynamic_key(env, key);
            return Some(value);
        }
        let legacy = env.storage().instance().get::<DataKey, T>(key);
        if let Some(value) = legacy {
            persistent.set(key, &value);
            env.storage().instance().remove(key);
            Self::bump_dynamic_key(env, key);
            return Some(value);
        }
        None
    }

    fn dynamic_set<T>(env: &Env, key: &DataKey, value: &T)
    where
        T: IntoVal<Env, Val>,
    {
        env.storage().persistent().set(key, value);
        env.storage().instance().remove(key);
        Self::bump_dynamic_key(env, key);
    }

    // One-time admin initializer
    pub fn init_admin(env: Env, admin: Address) {
        let store = env.storage().instance();
        if store.has(&DataKey::Admin) {
            return;
        }
        admin.require_auth();
        store.set(&DataKey::Admin, &admin);
        env.events().publish((EVENT_ADMIN,), admin);
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
        panic!("only_admin_or_governor");
    }

    fn require_governor(env: &Env, caller: &Address) {
        let governor: Address = env
            .storage()
            .instance()
            .get(&DataKey::Governor)
            .expect("governor_not_set");
        if *caller != governor {
            panic!("only_governor");
        }
        caller.require_auth();
    }

    fn require_writer(env: &Env, caller: &Address) {
        let store = env.storage().instance();
        let is_admin = store
            .get::<DataKey, Address>(&DataKey::Admin)
            .map(|admin| admin == *caller && !Self::bootstrap_admin_expired(env))
            .unwrap_or(false);
        let is_governor = store
            .get::<DataKey, Address>(&DataKey::Governor)
            .map(|governor| governor == *caller)
            .unwrap_or(false);
        let is_registrar = store
            .get::<DataKey, bool>(&DataKey::Registrar(caller.clone()))
            .unwrap_or(false);
        let is_registrar = if is_registrar {
            true
        } else {
            Self::dynamic_get::<bool>(env, &DataKey::Registrar(caller.clone())).unwrap_or(false)
        };
        if !is_admin && !is_governor && !is_registrar {
            panic!("only_writer");
        }
        caller.require_auth();
    }

    fn write_registration(env: &Env, manager: Address, arka: Address) -> bool {
        let mut changed = false;
        // global
        let mut all: Vec<Address> = Self::dynamic_get(env, &DataKey::All).unwrap_or(Vec::new(env));
        if !contains(&all, &arka) {
            all.push_back(arka.clone());
            changed = true;
        }
        Self::dynamic_set(env, &DataKey::All, &all);
        // by manager
        let mut mine: Vec<Address> =
            Self::dynamic_get(env, &DataKey::ByManager(manager.clone())).unwrap_or(Vec::new(env));
        if !contains(&mine, &arka) {
            mine.push_back(arka.clone());
            changed = true;
        }
        Self::dynamic_set(env, &DataKey::ByManager(manager), &mine);
        changed
    }

    pub fn set_registrar(env: Env, caller: Address, registrar: Address, allowed: bool) {
        Self::require_admin(&env, &caller);
        Self::dynamic_set(&env, &DataKey::Registrar(registrar.clone()), &allowed);
        env.events()
            .publish((EVENT_WRITER,), (caller, registrar, allowed));
    }

    pub fn set_admin(env: Env, caller: Address, admin: Address) {
        Self::require_admin(&env, &caller);
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
            .publish((symbol_short!("upgrade"),), new_wasm_hash.clone());
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    pub fn last_wasm_hash(env: Env) -> Option<BytesN<32>> {
        env.storage()
            .instance()
            .get::<DataKey, BytesN<32>>(&DataKey::LastWasmHash)
    }

    pub fn is_registrar(env: Env, registrar: Address) -> bool {
        Self::dynamic_get::<bool>(&env, &DataKey::Registrar(registrar)).unwrap_or(false)
    }

    pub fn register(env: Env, caller: Address, manager: Address, arka: Address) {
        Self::require_writer(&env, &caller);
        if Self::write_registration(&env, manager.clone(), arka.clone()) {
            env.events()
                .publish((EVENT_REGISTER,), (caller, manager, arka));
        }
    }

    pub fn get_arkas(env: Env, offset: u32, limit: u32) -> Vec<Address> {
        let list: Vec<Address> = Self::dynamic_get(&env, &DataKey::All).unwrap_or(Vec::new(&env));
        filter_and_slice(&env, list, offset, limit)
    }

    pub fn get_arkas_by_manager(
        env: Env,
        manager: Address,
        offset: u32,
        limit: u32,
    ) -> Vec<Address> {
        let list: Vec<Address> =
            Self::dynamic_get(&env, &DataKey::ByManager(manager)).unwrap_or(Vec::new(&env));
        filter_and_slice(&env, list, offset, limit)
    }

    pub fn count(env: Env) -> u32 {
        let list: Vec<Address> = Self::dynamic_get(&env, &DataKey::All).unwrap_or(Vec::new(&env));
        count_active(&env, list)
    }

    pub fn count_by_manager(env: Env, manager: Address) -> u32 {
        let list: Vec<Address> =
            Self::dynamic_get(&env, &DataKey::ByManager(manager)).unwrap_or(Vec::new(&env));
        count_active(&env, list)
    }

    // Admin-only in production
    pub fn set_manager_curated(env: Env, caller: Address, manager: Address, curated: bool) {
        Self::require_admin(&env, &caller);
        if curated {
            Self::dynamic_set(&env, &DataKey::CuratedManager(manager.clone()), &true);
        } else {
            Self::dynamic_set(&env, &DataKey::CuratedManager(manager.clone()), &false);
        }
        env.events()
            .publish((EVENT_CURATE,), (caller, manager, curated));
    }

    pub fn is_manager_curated(env: Env, manager: Address) -> bool {
        Self::dynamic_get::<bool>(&env, &DataKey::CuratedManager(manager)).unwrap_or(false)
    }

    // Admin-only: Mark an Arka as delisted/inactive
    pub fn set_delisted(env: Env, caller: Address, arka: Address, delisted: bool) {
        Self::require_admin(&env, &caller);
        if delisted {
            Self::dynamic_set(&env, &DataKey::Delisted(arka.clone()), &true);
        } else {
            Self::dynamic_set(&env, &DataKey::Delisted(arka.clone()), &false);
        }
        env.events()
            .publish((EVENT_DELIST,), (caller, arka, delisted));
    }

    pub fn is_delisted(env: Env, arka: Address) -> bool {
        Self::dynamic_get::<bool>(&env, &DataKey::Delisted(arka)).unwrap_or(false)
    }

    // Admin-only: register legacy Arkas
    pub fn register_admin(env: Env, caller: Address, manager: Address, arka: Address) {
        Self::require_admin(&env, &caller);
        if Self::write_registration(&env, manager.clone(), arka.clone()) {
            env.events()
                .publish((EVENT_REGISTER,), (caller, manager, arka));
        }
    }
}

fn contains(list: &Vec<Address>, item: &Address) -> bool {
    let mut i: u32 = 0;
    let len = list.len();
    while i < len {
        if list.get_unchecked(i) == *item {
            return true;
        }
        i += 1;
    }
    false
}

fn slice(env: &Env, list: Vec<Address>, offset: u32, limit: u32) -> Vec<Address> {
    let len = list.len();
    if len == 0 {
        return Vec::new(env);
    }
    let start = core::cmp::min(offset, len);
    let end = core::cmp::min(start + limit, len);
    let mut out: Vec<Address> = Vec::new(env);
    let mut i = start;
    while i < end {
        out.push_back(list.get_unchecked(i));
        i += 1;
    }
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
        if !ArkaRegistry::is_delisted(env.clone(), a) {
            n += 1;
        }
        i += 1;
    }
    n
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Events as _},
        vec, Env, IntoVal,
    };

    #[test]
    #[should_panic(expected = "only_writer")]
    fn register_requires_authorized_caller() {
        let env = Env::default();
        let id = env.register_contract(None, ArkaRegistry);
        let client = ArkaRegistryClient::new(&env, &id);
        let caller = Address::generate(&env);
        let m = Address::generate(&env);
        let a = Address::generate(&env);
        env.mock_all_auths();
        client.register(&caller, &m, &a);
    }

    #[test]
    fn registry_admin_controls_writers_and_listing() {
        let env = Env::default();
        let id = env.register_contract(None, ArkaRegistry);
        let client = ArkaRegistryClient::new(&env, &id);
        let admin = Address::generate(&env);
        let registrar = Address::generate(&env);
        let manager = Address::generate(&env);
        let arka = Address::generate(&env);

        env.mock_all_auths();
        client.init_admin(&admin);
        client.set_registrar(&admin, &registrar, &true);
        assert!(client.is_registrar(&registrar));

        client.register(&registrar, &manager, &arka);
        assert_eq!(client.count(), 1);
        assert_eq!(client.get_arkas(&0, &10).len(), 1);
        assert_eq!(client.get_arkas_by_manager(&manager, &0, &10).len(), 1);

        client.set_delisted(&admin, &arka, &true);
        assert!(client.is_delisted(&arka));
        assert_eq!(client.count(), 0);
        assert_eq!(client.get_arkas(&0, &10).len(), 0);
    }

    #[test]
    fn admin_can_register_legacy_arkas_directly() {
        let env = Env::default();
        let id = env.register_contract(None, ArkaRegistry);
        let client = ArkaRegistryClient::new(&env, &id);
        let admin = Address::generate(&env);
        let manager = Address::generate(&env);
        let arka = Address::generate(&env);

        env.mock_all_auths();
        client.init_admin(&admin);
        client.register_admin(&admin, &manager, &arka);

        assert_eq!(client.count(), 1);
        assert_eq!(client.get_arkas_by_manager(&manager, &0, &10).len(), 1);
    }

    #[test]
    fn registry_emits_indexer_ready_events() {
        let env = Env::default();
        let id = env.register_contract(None, ArkaRegistry);
        let client = ArkaRegistryClient::new(&env, &id);
        let admin = Address::generate(&env);
        let registrar = Address::generate(&env);
        let manager = Address::generate(&env);
        let arka = Address::generate(&env);

        env.mock_all_auths();
        client.init_admin(&admin);
        assert_eq!(
            env.events().all(),
            vec![
                &env,
                (
                    id.clone(),
                    (EVENT_ADMIN,).into_val(&env),
                    admin.clone().into_val(&env)
                )
            ]
        );

        client.set_registrar(&admin, &registrar, &true);
        assert_eq!(
            env.events().all(),
            vec![
                &env,
                (
                    id.clone(),
                    (EVENT_WRITER,).into_val(&env),
                    (admin.clone(), registrar.clone(), true).into_val(&env),
                )
            ]
        );

        client.register(&registrar, &manager, &arka);
        assert_eq!(
            env.events().all(),
            vec![
                &env,
                (
                    id.clone(),
                    (EVENT_REGISTER,).into_val(&env),
                    (registrar, manager.clone(), arka.clone()).into_val(&env),
                )
            ]
        );

        client.set_manager_curated(&admin, &manager, &true);
        assert_eq!(
            env.events().all(),
            vec![
                &env,
                (
                    id.clone(),
                    (EVENT_CURATE,).into_val(&env),
                    (admin.clone(), manager, true).into_val(&env),
                )
            ]
        );

        client.set_delisted(&admin, &arka, &true);
        assert_eq!(
            env.events().all(),
            vec![
                &env,
                (
                    id,
                    (EVENT_DELIST,).into_val(&env),
                    (admin, arka, true).into_val(&env),
                )
            ]
        );
    }
}
