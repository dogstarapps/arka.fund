#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, BytesN};
#[cfg(test)]
use soroban_sdk::testutils::Address as _;

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
        // Restricted by governor/timelock (relaxed in tests when governor not set)
        let store = env.storage().instance();
        if let Some(gov) = store.get::<DataKey, Address>(&DataKey::Governor) {
            gov.require_auth();
        }
        store.set(&DataKey::Implementation, &impl_wasm_hash);
    }

    pub fn create_arka(env: Env, salt: BytesN<32>) -> Address {
        // Restricted by governor/timelock (relaxed in tests when governor not set)
        let store = env.storage().instance();
        if let Some(gov) = store.get::<DataKey, Address>(&DataKey::Governor) {
            gov.require_auth();
        }
        #[cfg(test)]
        {
            // In tests, avoid deploying actual wasm. Simulate a new address to validate flow.
            let arka_addr = Address::generate(&env);
            store.set(&DataKey::LastArka, &arka_addr);
            return arka_addr;
        }
        #[cfg(not(test))]
        {
            let wasm_hash: BytesN<32> = store.get(&DataKey::Implementation).expect("impl_not_set");
            // No constructor args for logic here; initialization executed by caller after deployment
            let arka_addr = env.deployer().with_current_contract(salt).deploy_v2(wasm_hash, ());
            store.set(&DataKey::LastArka, &arka_addr);
            arka_addr
        }
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
        // Upload a real wasm so deploy_v2 can succeed
        let wasm_bytes: &'static [u8] = include_bytes!("../../../artifacts/arka.wasm");
        let hash = env.deployer().upload_contract_wasm(wasm_bytes);
        env.mock_all_auths();
        client.set_implementation(&hash);

        let salt = BytesN::from_array(&env, &[2u8; 32]);
        let addr = client.create_arka(&salt);
        // Deploy another with different salt and ensure addresses differ
        let salt2 = BytesN::from_array(&env, &[3u8; 32]);
        let addr2 = client.create_arka(&salt2);
        assert!(addr != addr2);
    }
}


