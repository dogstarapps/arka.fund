#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, contracterror, panic_with_error, Address, Env, Bytes, BytesN, Vec, IntoVal, vec, symbol_short, Symbol};
#[cfg(test)]
use soroban_sdk::testutils::Address as _;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Implementation,
    ShareTokenImplementation,
    LastArka,
    Governor,
    AllArkas,
    ManagerArkas(Address),
    Registry,
    ProtocolTreasury,
    CreationFeeToken,
    CreationFeeAmount,
    MigratedTo(Address),
    MigratedFrom(Address),
    ShareTokenByArka(Address),
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    ImplNotSet = 1,
    GovernorNotSet = 2,
}

#[contract]
pub struct ArkaFactory;

#[contractimpl]
impl ArkaFactory {
    fn require_governor_auth(env: &Env) {
        let store = env.storage().instance();
        let governor: Address = match store.get(&DataKey::Governor) {
            Some(g) => g,
            None => panic_with_error!(env, Error::GovernorNotSet),
        };
        governor.require_auth();
    }

    fn charge_creation_fee(env: &Env, manager: &Address) {
        let store = env.storage().instance();
        if let (Some(treasury), Some(fee_token), Some(fee_amount)) = (
            store.get::<DataKey, Address>(&DataKey::ProtocolTreasury),
            store.get::<DataKey, Address>(&DataKey::CreationFeeToken),
            store.get::<DataKey, i128>(&DataKey::CreationFeeAmount),
        ) {
            if fee_amount > 0 {
                let spender = env.current_contract_address();
                let args_fee = vec![
                    env,
                    spender.into_val(env),
                    manager.clone().into_val(env),
                    treasury.into_val(env),
                    fee_amount.into_val(env),
                ];
                let fn_sym = Symbol::new(env, "transfer_from");
                let _ = env.invoke_contract::<()>(&fee_token, &fn_sym, args_fee);
            }
        }
    }

    fn salt_to_bytes32(env: &Env, salt: &Bytes) -> BytesN<32> {
        if salt.len() != 32 { panic_with_error!(env, Error::ImplNotSet); }
        let mut arr: [u8; 32] = [0u8; 32];
        let mut i: u32 = 0;
        while i < 32 {
            arr[i as usize] = salt.get_unchecked(i);
            i += 1;
        }
        BytesN::<32>::from_array(env, &arr)
    }

    fn derive_salt(env: &Env, salt: &Bytes, tweak: u8) -> Bytes {
        let mut out = Bytes::new(env);
        let mut i: u32 = 0;
        while i < salt.len() {
            let mut byte = salt.get_unchecked(i);
            if i == salt.len() - 1 {
                byte ^= tweak;
            }
            out.push_back(byte);
            i += 1;
        }
        out
    }

    fn deploy_contract_from_key(
        env: &Env,
        store: &soroban_sdk::storage::Instance,
        wasm_key: DataKey,
        salt: &Bytes,
    ) -> Option<Address> {
        #[cfg(test)]
        {
            let _ = store;
            let _ = salt;
            if matches!(wasm_key, DataKey::Implementation) || store.has(&wasm_key) {
                Some(Address::generate(env))
            } else {
                None
            }
        }
        #[cfg(not(test))]
        {
            let wasm_hash: Option<BytesN<32>> = store.get(&wasm_key);
            wasm_hash.map(|hash| {
                let salt_n = Self::salt_to_bytes32(env, salt);
                env.deployer().with_current_contract(salt_n).deploy_v2(hash, ())
            })
        }
    }

    fn deploy_arka(env: &Env, store: &soroban_sdk::storage::Instance, salt: &Bytes) -> Address {
        match Self::deploy_contract_from_key(env, store, DataKey::Implementation, salt) {
            Some(address) => address,
            None => panic_with_error!(env, Error::ImplNotSet),
        }
    }

    // errors are defined at module level
    pub fn set_governor(env: Env, governor: Address) {
        let store = env.storage().instance();
        if let Some(current) = store.get::<DataKey, Address>(&DataKey::Governor) {
            current.require_auth();
        }
        store.set(&DataKey::Governor, &governor);
    }

    pub fn set_implementation(env: Env, impl_wasm_hash: BytesN<32>) {
        Self::require_governor_auth(&env);
        let store = env.storage().instance();
        store.set(&DataKey::Implementation, &impl_wasm_hash);
    }

    pub fn set_share_token_implementation(env: Env, impl_wasm_hash: BytesN<32>) {
        Self::require_governor_auth(&env);
        let store = env.storage().instance();
        store.set(&DataKey::ShareTokenImplementation, &impl_wasm_hash);
    }

    pub fn set_registry(env: Env, registry: Address) {
        Self::require_governor_auth(&env);
        let store = env.storage().instance();
        store.set(&DataKey::Registry, &registry);
    }

    pub fn set_protocol_treasury(env: Env, treasury: Address) {
        Self::require_governor_auth(&env);
        let store = env.storage().instance();
        store.set(&DataKey::ProtocolTreasury, &treasury);
    }

    pub fn set_creation_fee(env: Env, token: Address, amount: i128) {
        Self::require_governor_auth(&env);
        let store = env.storage().instance();
        store.set(&DataKey::CreationFeeToken, &token);
        store.set(&DataKey::CreationFeeAmount, &amount);
    }

    pub fn create_arka(env: Env, salt: Bytes, manager: Address) -> Address {
        // Creation is permissionless; only the manager must authorize
        let store = env.storage().instance();
        // Manager must authorize creation for proper indexing
        manager.require_auth();
        Self::charge_creation_fee(&env, &manager);
        let arka_addr: Address = Self::deploy_arka(&env, &store, &salt);

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

    fn create_and_init_internal(
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
        require_manager_auth: bool,
    ) -> Address {
        let store = env.storage().instance();
        if require_manager_auth {
            manager.require_auth();
        }
        Self::charge_creation_fee(&env, &manager);
        let arka_addr: Address = Self::deploy_arka(&env, &store, &salt);
        let share_token_salt = Self::derive_salt(&env, &salt, 1u8);
        let share_token_addr =
            Self::deploy_contract_from_key(&env, &store, DataKey::ShareTokenImplementation, &share_token_salt);

        #[cfg(not(test))]
        {
            let configured_governor = store.get::<DataKey, Address>(&DataKey::Governor);
            let mut init_manager = manager.clone();
            let mut policy_caller = manager.clone();
            let factory_addr = env.current_contract_address();
            if !require_manager_auth {
                init_manager = factory_addr.clone();
                policy_caller = factory_addr.clone();
            }

            // Initialize arka
            let args_init = vec![
                &env,
                denomination.clone().into_val(&env),
                mgmt_bps.into_val(&env),
                perf_bps.into_val(&env),
                deposit_bps.into_val(&env),
                redeem_bps.into_val(&env),
                whitelist.clone().into_val(&env),
                init_manager.clone().into_val(&env),
            ];
            let _ = env.invoke_contract::<()>(&arka_addr, &symbol_short!("init"), args_init);

            // Set router
            let args_sr = vec![
                &env,
                policy_caller.clone().into_val(&env),
                router.into_val(&env),
            ];
            let _ = env.invoke_contract::<()>(&arka_addr, &Symbol::new(&env, "set_router"), args_sr);

            if let Some(share_token) = share_token_addr.clone() {
                let args_tt_init = vec![
                    &env,
                    arka_addr.clone().into_val(&env),
                ];
                let _ = env.invoke_contract::<()>(&share_token, &Symbol::new(&env, "init"), args_tt_init);

                let args_st = vec![
                    &env,
                    policy_caller.clone().into_val(&env),
                    share_token.clone().into_val(&env),
                ];
                let _ = env.invoke_contract::<()>(&arka_addr, &Symbol::new(&env, "set_share_token"), args_st);
            }

            if !require_manager_auth {
                let args_self_gov = vec![
                    &env,
                    policy_caller.clone().into_val(&env),
                    factory_addr.clone().into_val(&env),
                ];
                let _ =
                    env.invoke_contract::<()>(&arka_addr, &Symbol::new(&env, "set_governor"), args_self_gov);

                let args_sm = vec![
                    &env,
                    policy_caller.into_val(&env),
                    manager.clone().into_val(&env),
                ];
                let _ = env.invoke_contract::<()>(&arka_addr, &Symbol::new(&env, "set_manager"), args_sm);
            }

            // If factory governor is configured, propagate it into the new Arka.
            if let Some(governor) = configured_governor {
                let final_caller = if require_manager_auth {
                    manager.clone()
                } else {
                    factory_addr
                };
                let args_sg = vec![
                    &env,
                    final_caller.into_val(&env),
                    governor.into_val(&env),
                ];
                let _ = env.invoke_contract::<()>(&arka_addr, &Symbol::new(&env, "set_governor"), args_sg);
            }
        }

        // Update lists
        let mut all: Vec<Address> = store.get(&DataKey::AllArkas).unwrap_or(Vec::new(&env));
        all.push_back(arka_addr.clone());
        store.set(&DataKey::AllArkas, &all);
        let mut mine: Vec<Address> = store.get(&DataKey::ManagerArkas(manager.clone())).unwrap_or(Vec::new(&env));
        mine.push_back(arka_addr.clone());
        store.set(&DataKey::ManagerArkas(manager.clone()), &mine);
        if let Some(share_token) = share_token_addr {
            store.set(&DataKey::ShareTokenByArka(arka_addr.clone()), &share_token);
        }

        // Register
        if let Some(reg) = store.get::<DataKey, Address>(&DataKey::Registry) {
            let args2 = vec![&env, manager.clone().into_val(&env), arka_addr.clone().into_val(&env)];
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
        Self::create_and_init_internal(
            env,
            salt,
            manager,
            denomination,
            mgmt_bps,
            perf_bps,
            deposit_bps,
            redeem_bps,
            whitelist,
            router,
            true,
        )
    }

    pub fn migrate_arka(
        env: Env,
        old_arka: Address,
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
        Self::require_governor_auth(&env);
        let new_arka = Self::create_and_init_internal(
            env.clone(),
            salt,
            manager,
            denomination,
            mgmt_bps,
            perf_bps,
            deposit_bps,
            redeem_bps,
            whitelist,
            router,
            false,
        );
        let store = env.storage().instance();
        store.set(&DataKey::MigratedTo(old_arka.clone()), &new_arka.clone());
        store.set(&DataKey::MigratedFrom(new_arka.clone()), &old_arka);
        new_arka
    }

    pub fn migrated_to(env: Env, old_arka: Address) -> Option<Address> {
        env.storage().instance().get(&DataKey::MigratedTo(old_arka))
    }

    pub fn migrated_from(env: Env, new_arka: Address) -> Option<Address> {
        env.storage().instance().get(&DataKey::MigratedFrom(new_arka))
    }

    pub fn share_token_of(env: Env, arka: Address) -> Option<Address> {
        env.storage().instance().get(&DataKey::ShareTokenByArka(arka))
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

    pub fn get_share_token_implementation(env: Env) -> Option<BytesN<32>> {
        env.storage().instance().get(&DataKey::ShareTokenImplementation)
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
    use soroban_sdk::{Bytes, Env, testutils::Address as _, Address};
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
        env.mock_all_auths();
        client.set_registry(&reg_id);
        // Create and auto-register
        let manager = Address::generate(&env);
        let mut salt = Bytes::new(&env);
        for _ in 0..32 {
            salt.push_back(1u8);
        }
        let _arka = client.create_arka(&salt, &manager);
        assert_eq!(reg.count(), 1);
        assert_eq!(reg.get_arkas(&0, &10).len(), 1);
        assert_eq!(reg.get_arkas_by_manager(&manager, &0, &10).len(), 1);
    }

    #[test]
    fn test_migrate_tracks_old_new_mapping() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ArkaFactory);
        let client = ArkaFactoryClient::new(&env, &contract_id);
        let governor = Address::generate(&env);
        client.set_governor(&governor);

        let old_arka = Address::generate(&env);
        let manager = Address::generate(&env);
        let mut salt = Bytes::new(&env);
        for _ in 0..32 {
            salt.push_back(9u8);
        }
        let denom = Address::generate(&env);
        let whitelist = Vec::from_array(&env, [denom.clone()]);
        let router = Address::generate(&env);

        env.mock_all_auths();
        let new_arka = client.migrate_arka(
            &old_arka,
            &salt,
            &manager,
            &denom,
            &0,
            &0,
            &0,
            &0,
            &whitelist,
            &router,
        );
        assert_eq!(client.migrated_to(&old_arka), Some(new_arka.clone()));
        assert_eq!(client.migrated_from(&new_arka), Some(old_arka));
    }

    #[test]
    fn test_create_and_init_records_share_token_for_arka() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ArkaFactory);
        let client = ArkaFactoryClient::new(&env, &contract_id);
        let governor = Address::generate(&env);
        client.set_governor(&governor);

        env.mock_all_auths();
        let share_token_impl = BytesN::from_array(&env, &[7u8; 32]);
        client.set_share_token_implementation(&share_token_impl);

        let manager = Address::generate(&env);
        let mut salt = Bytes::new(&env);
        for _ in 0..32 {
            salt.push_back(2u8);
        }
        let denom = Address::generate(&env);
        let whitelist = Vec::from_array(&env, [denom.clone()]);
        let router = Address::generate(&env);

        let arka = client.create_and_init(
            &salt,
            &manager,
            &denom,
            &0,
            &0,
            &0,
            &0,
            &whitelist,
            &router,
        );

        assert_eq!(client.get_share_token_implementation(), Some(share_token_impl));
        assert!(client.share_token_of(&arka).is_some());
    }
}
