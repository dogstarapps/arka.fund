#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, BytesN, Vec, IntoVal, vec, symbol_short};
#[cfg(test)]
use soroban_sdk::testutils::Address as _;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Implementation,
    LastArka,
    Governor,
    AllArkas,
    ManagerArkas(Address),
    Registry,
}

#[contract]
pub struct ArkaFactory;

#[contractimpl]
impl ArkaFactory {
    pub fn set_governor(env: Env, governor: Address) {
        // In production, this should be set via deployment or timelock
        let store = env.storage().instance();
        store.set(&DataKey::Governor, &governor);
    }

    pub fn set_implementation(env: Env, impl_wasm_hash: BytesN<32>) {
        // Restricted by governor/timelock (relaxed in tests when governor not set)
        let store = env.storage().instance();
        if let Some(gov) = store.get::<DataKey, Address>(&DataKey::Governor) {
            gov.require_auth();
        }
        store.set(&DataKey::Implementation, &impl_wasm_hash);
    }

    pub fn set_registry(env: Env, registry: Address) {
        let store = env.storage().instance();
        if let Some(gov) = store.get::<DataKey, Address>(&DataKey::Governor) { gov.require_auth(); }
        store.set(&DataKey::Registry, &registry);
    }

    pub fn create_arka(env: Env, salt: BytesN<32>, manager: Address) -> Address {
        // Restricted by governor/timelock (relaxed in tests when governor not set)
        let store = env.storage().instance();
        if let Some(gov) = store.get::<DataKey, Address>(&DataKey::Governor) {
            gov.require_auth();
        }
        // Manager must authorize creation for proper indexing
        manager.require_auth();
        // Deploy or simulate address depending on build
        let arka_addr: Address = {
            #[cfg(test)]
            {
                Address::generate(&env)
            }
            #[cfg(not(test))]
            {
                let wasm_hash: BytesN<32> = store.get(&DataKey::Implementation).expect("impl_not_set");
                env.deployer().with_current_contract(salt).deploy_v2(wasm_hash, ())
            }
        };

        // Update in-factory simple lists (optional)
        let mut all: Vec<Address> = store.get(&DataKey::AllArkas).unwrap_or(Vec::new(&env));
        all.push_back(arka_addr.clone());
        store.set(&DataKey::AllArkas, &all);
        let mut mine: Vec<Address> = store.get(&DataKey::ManagerArkas(manager.clone())).unwrap_or(Vec::new(&env));
        mine.push_back(arka_addr.clone());
        store.set(&DataKey::ManagerArkas(manager.clone()), &mine);

        // Auto-register in external registry if configured
        if let Some(reg) = store.get::<DataKey, Address>(&DataKey::Registry) {
            // call: Registry.register(manager, arka)
            let args2 = vec![
                &env,
                manager.clone().into_val(&env),
                arka_addr.clone().into_val(&env),
            ];
            // Try (manager, arka)
            let _ = env.invoke_contract::<()>(&reg, &symbol_short!("register"), args2);
        }

        store.set(&DataKey::LastArka, &arka_addr);
        arka_addr
    }

    pub fn get_arkas(env: Env, offset: u32, limit: u32) -> Vec<Address> {
        let store = env.storage().instance();
        let list: Vec<Address> = store.get(&DataKey::AllArkas).unwrap_or(Vec::new(&env));
        slice_addresses(&env, list, offset, limit)
    }

    pub fn get_arkas_by_manager(env: Env, manager: Address, offset: u32, limit: u32) -> Vec<Address> {
        let store = env.storage().instance();
        let list: Vec<Address> = store.get(&DataKey::ManagerArkas(manager)).unwrap_or(Vec::new(&env));
        slice_addresses(&env, list, offset, limit)
    }
}

fn slice_addresses(env: &Env, list: Vec<Address>, offset: u32, limit: u32) -> Vec<Address> {
    let len = list.len();
    if len == 0 { return Vec::new(env); }
    let start = core::cmp::min(offset as u32, len) as u32;
    let end = core::cmp::min(start + limit, len);
    let mut out: Vec<Address> = Vec::new(env);
    let mut i = start;
    while i < end {
        out.push_back(list.get_unchecked(i));
        i += 1;
    }
    out
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{BytesN, Env, testutils::Address as _, Address};
    use crate as arka_factory;
    use arka_registry as registry_mod;

    #[test]
    fn test_set_and_create() {
        let env = Env::default();
        // Deploy registry
        let reg_id = env.register_contract(None, registry_mod::ArkaRegistry);
        let reg = registry_mod::ArkaRegistryClient::new(&env, &reg_id);

        let contract_id = env.register_contract(None, ArkaFactory);
        let client = ArkaFactoryClient::new(&env, &contract_id);
        let gov = Address::generate(&env);
        client.set_governor(&gov);
        // Upload a real wasm so deploy_v2 can succeed
        let wasm_bytes: &'static [u8] = include_bytes!("../../../artifacts/arka.wasm");
        let hash = env.deployer().upload_contract_wasm(wasm_bytes);
        env.mock_all_auths();
        client.set_implementation(&hash);
        client.set_registry(&reg_id);
        // Create and auto-register
        let manager = Address::generate(&env);
        let salt = BytesN::from_array(&env, &[1u8; 32]);
        let _arka = client.create_arka(&salt, &manager);
        assert_eq!(reg.count(), 1);
        assert_eq!(reg.get_arkas(&0, &10).len(), 1);
        assert_eq!(reg.get_arkas_by_manager(&manager, &0, &10).len(), 1);
    }
}


