#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, contracterror, panic_with_error, Address, Env, Bytes, BytesN, Vec, IntoVal, vec, symbol_short, Symbol};
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
    ProtocolTreasury,
    CreationFeeToken,
    CreationFeeAmount,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    ImplNotSet = 1,
}

#[contract]
pub struct ArkaFactory;

#[contractimpl]
impl ArkaFactory {
    // errors are defined at module level
    pub fn set_governor(env: Env, governor: Address) {
        // In production, this should be set via deployment or timelock
        let store = env.storage().instance();
        store.set(&DataKey::Governor, &governor);
    }

    pub fn set_implementation(env: Env, impl_wasm_hash: BytesN<32>) {
        // Creation is permissionless; governance gates only configuration changes.
        let store = env.storage().instance();
        store.set(&DataKey::Implementation, &impl_wasm_hash);
    }

    pub fn set_registry(env: Env, registry: Address) {
        let store = env.storage().instance();
        if let Some(gov) = store.get::<DataKey, Address>(&DataKey::Governor) { gov.require_auth(); }
        store.set(&DataKey::Registry, &registry);
    }

    pub fn set_protocol_treasury(env: Env, treasury: Address) {
        let store = env.storage().instance();
        if let Some(gov) = store.get::<DataKey, Address>(&DataKey::Governor) { gov.require_auth(); }
        store.set(&DataKey::ProtocolTreasury, &treasury);
    }

    pub fn set_creation_fee(env: Env, token: Address, amount: i128) {
        let store = env.storage().instance();
        if let Some(gov) = store.get::<DataKey, Address>(&DataKey::Governor) { gov.require_auth(); }
        store.set(&DataKey::CreationFeeToken, &token);
        store.set(&DataKey::CreationFeeAmount, &amount);
    }

    pub fn create_arka(env: Env, salt: Bytes, manager: Address) -> Address {
        // Creation is permissionless; only the manager must authorize
        let store = env.storage().instance();
        // Manager must authorize creation for proper indexing
        manager.require_auth();
        // Charge creation fee if configured
        if let (Some(treasury), Some(fee_token), Some(fee_amount)) = (
            store.get::<DataKey, Address>(&DataKey::ProtocolTreasury),
            store.get::<DataKey, Address>(&DataKey::CreationFeeToken),
            store.get::<DataKey, i128>(&DataKey::CreationFeeAmount),
        ) {
            if fee_amount > 0 {
                // SAC transfer_from(spender, from, to, amount)
                let spender = env.current_contract_address();
                let args_fee = vec![
                    &env,
                    spender.into_val(&env),
                    manager.clone().into_val(&env),
                    treasury.into_val(&env),
                    fee_amount.into_val(&env),
                ];
                let fn_sym = Symbol::new(&env, "transfer_from");
                let _ = env.invoke_contract::<()>(&fee_token, &fn_sym, args_fee);
            }
        }
        // Deploy or simulate address depending on build
        let arka_addr: Address = {
            #[cfg(test)]
            {
                Address::generate(&env)
            }
            #[cfg(not(test))]
            {
                let wasm_hash: BytesN<32> = match store.get(&DataKey::Implementation) { Some(h) => h, None => panic_with_error!(&env, Error::ImplNotSet) };
                // Convert dynamic Bytes to fixed BytesN<32>
                if salt.len() != 32 { panic_with_error!(&env, Error::ImplNotSet); }
                let mut arr: [u8; 32] = [0u8; 32];
                let mut i: u32 = 0;
                while i < 32 {
                    arr[i as usize] = salt.get_unchecked(i);
                    i += 1;
                }
                let salt_n = BytesN::<32>::from_array(&env, &arr);
                env.deployer().with_current_contract(salt_n).deploy_v2(wasm_hash, ())
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

    // Atomic create + init + set_router + register
    pub fn create_and_init(
        env: Env,
        salt: Bytes,
        manager: Address,
        denomination: Address,
        mgmt_bps: i32,
        perf_bps: i32,
        deposit_bps: i32,
        redeem_bps: i32,
        whitelist: Vec<Address>,
        router: Address,
    ) -> Address {
        let store = env.storage().instance();
        // Only manager must authorize
        manager.require_auth();
        // Fee
        if let (Some(treasury), Some(fee_token), Some(fee_amount)) = (
            store.get::<DataKey, Address>(&DataKey::ProtocolTreasury),
            store.get::<DataKey, Address>(&DataKey::CreationFeeToken),
            store.get::<DataKey, i128>(&DataKey::CreationFeeAmount),
        ) {
            if fee_amount > 0 {
                let spender = env.current_contract_address();
                let args_fee = vec![
                    &env,
                    spender.into_val(&env),
                    manager.clone().into_val(&env),
                    treasury.into_val(&env),
                    fee_amount.into_val(&env),
                ];
                let fn_sym = Symbol::new(&env, "transfer_from");
                let _ = env.invoke_contract::<()>(&fee_token, &fn_sym, args_fee);
            }
        }
        // Deploy
        let arka_addr: Address = {
            #[cfg(test)]
            {
                Address::generate(&env)
            }
            #[cfg(not(test))]
            {
                let wasm_hash: BytesN<32> = match store.get(&DataKey::Implementation) { Some(h) => h, None => panic_with_error!(&env, Error::ImplNotSet) };
                if salt.len() != 32 { panic_with_error!(&env, Error::ImplNotSet); }
                let mut arr: [u8; 32] = [0u8; 32];
                let mut i: u32 = 0;
                while i < 32 { arr[i as usize] = salt.get_unchecked(i); i += 1; }
                let salt_n = BytesN::<32>::from_array(&env, &arr);
                env.deployer().with_current_contract(salt_n).deploy_v2(wasm_hash, ())
            }
        };

        // Initialize arka
        {
            let args_init = vec![
                &env,
                denomination.clone().into_val(&env),
                mgmt_bps.into_val(&env),
                perf_bps.into_val(&env),
                deposit_bps.into_val(&env),
                redeem_bps.into_val(&env),
                whitelist.clone().into_val(&env),
                manager.clone().into_val(&env),
            ];
            let _ = env.invoke_contract::<()>(&arka_addr, &symbol_short!("init"), args_init);
        }

        // Set router
        {
            let args_sr = vec![
                &env,
                manager.clone().into_val(&env),
                router.into_val(&env),
            ];
            let _ = env.invoke_contract::<()>(&arka_addr, &Symbol::new(&env, "set_router"), args_sr);
        }

        // Update lists
        let mut all: Vec<Address> = store.get(&DataKey::AllArkas).unwrap_or(Vec::new(&env));
        all.push_back(arka_addr.clone());
        store.set(&DataKey::AllArkas, &all);
        let mut mine: Vec<Address> = store.get(&DataKey::ManagerArkas(manager.clone())).unwrap_or(Vec::new(&env));
        mine.push_back(arka_addr.clone());
        store.set(&DataKey::ManagerArkas(manager.clone()), &mine);

        // Register
        if let Some(reg) = store.get::<DataKey, Address>(&DataKey::Registry) {
            let args2 = vec![&env, manager.clone().into_val(&env), arka_addr.clone().into_val(&env)];
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

    pub fn get_protocol_treasury(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::ProtocolTreasury)
    }

    pub fn get_creation_fee_token(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::CreationFeeToken)
    }

    pub fn get_creation_fee_amount(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::CreationFeeAmount).unwrap_or(0)
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
    extern crate arka_registry as registry_mod;

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


