#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, BytesN};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Implementation,
    LastArka,
    Governor,
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
        // Restricted by governor/timelock
        let store = env.storage().instance();
        let gov: Address = store.get(&DataKey::Governor).expect("governor_not_set");
        gov.require_auth();
        store.set(&DataKey::Implementation, &impl_wasm_hash);
    }

    pub fn create_arka(env: Env, salt: BytesN<32>) -> Address {
        // Restricted by governor/timelock
        let store = env.storage().instance();
        let gov: Address = store.get(&DataKey::Governor).expect("governor_not_set");
        gov.require_auth();
        let wasm_hash: BytesN<32> = store.get(&DataKey::Implementation).expect("impl_not_set");
        // No constructor args for logic here; initialization executed by caller after deployment
        let arka_addr = env.deployer().with_current_contract(salt).deploy_v2(wasm_hash, ());
        store.set(&DataKey::LastArka, &arka_addr);
        arka_addr
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{BytesN, Env, testutils::Address as _, Address};

    #[test]
    fn test_set_and_create() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ArkaFactory);
        let client = ArkaFactoryClient::new(&env, &contract_id);
        let gov = Address::generate(&env);
        client.set_governor(&gov);
        let hash = BytesN::from_array(&env, &[1u8; 32]);
        env.as_contract(&gov, || { client.set_implementation(&hash); });

        let salt = BytesN::from_array(&env, &[2u8; 32]);
        let addr = env.as_contract(&gov, || client.create_arka(&salt));
        assert!(addr.contract_id().to_string().len() > 0);
    }
}


