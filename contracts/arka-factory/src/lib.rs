#![no_std]
#[cfg(test)]
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, vec,
    Address, Bytes, BytesN, Env, IntoVal, Symbol, TryFromVal, Val, Vec,
};

#[derive(Clone)]
#[contracttype]
pub struct DefaultSwapRiskPolicy {
    pub enabled: bool,
    pub oracle_checks_enabled: bool,
    pub max_price_impact_bps: i32,
    pub max_slippage_bps: i32,
    pub max_twap_deviation_bps: i32,
    pub max_oracle_age_seconds: u64,
    pub max_trade_size_bps: i32,
}

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
    ProtocolMgmtFeeBps,
    ProtocolPerfFeeBps,
    CreationFeeToken,
    CreationFeeAmount,
    DefaultVenueRegistry,
    DefaultSwapOracle,
    DefaultAllowedRouters,
    DefaultAllowedAdapters,
    DefaultSwapRiskPolicy,
    MigratedTo(Address),
    MigratedFrom(Address),
    ShareTokenByArka(Address),
    BootstrapAdmin,
    BootstrapAdminExpiresAt,
    LastWasmHash,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    ImplNotSet = 1,
    GovernorNotSet = 2,
    Unauthorized = 3,
    InvalidBootstrapAdmin = 4,
    InvalidSwapRiskPolicy = 5,
}

const MAX_BOOTSTRAP_ADMIN_SECONDS: u64 = 365 * 24 * 60 * 60;

#[contract]
pub struct ArkaFactory;

#[contractimpl]
impl ArkaFactory {
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

    fn require_governor_auth(env: &Env) {
        let store = env.storage().instance();
        let governor: Address = match store.get(&DataKey::Governor) {
            Some(g) => g,
            None => panic_with_error!(env, Error::GovernorNotSet),
        };
        governor.require_auth();
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
        if expires_at <= now || expires_at.saturating_sub(now) > MAX_BOOTSTRAP_ADMIN_SECONDS {
            panic_with_error!(env, Error::InvalidBootstrapAdmin);
        }
    }

    fn require_governor_caller_auth(env: &Env, caller: &Address) {
        let store = env.storage().instance();
        let governor: Address = match store.get(&DataKey::Governor) {
            Some(g) => g,
            None => panic_with_error!(env, Error::GovernorNotSet),
        };
        if *caller != governor {
            panic_with_error!(env, Error::Unauthorized);
        }
        caller.require_auth();
    }

    fn require_bootstrap_or_governor_auth(env: &Env, caller: &Address) {
        let store = env.storage().instance();
        if Self::bootstrap_admin_active_internal(env) {
            if let Some(admin) = store.get::<DataKey, Address>(&DataKey::BootstrapAdmin) {
                if *caller == admin {
                    caller.require_auth();
                    return;
                }
            }
        }
        if let Some(governor) = store.get::<DataKey, Address>(&DataKey::Governor) {
            if *caller == governor {
                caller.require_auth();
                return;
            }
        }
        panic_with_error!(env, Error::Unauthorized);
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

    fn assert_swap_risk_policy(env: &Env, policy: &DefaultSwapRiskPolicy) {
        if !(0..=10_000).contains(&policy.max_price_impact_bps)
            || !(0..=10_000).contains(&policy.max_slippage_bps)
            || !(0..=10_000).contains(&policy.max_twap_deviation_bps)
            || !(1..=10_000).contains(&policy.max_trade_size_bps)
            || policy.max_oracle_age_seconds == 0
        {
            panic_with_error!(env, Error::InvalidSwapRiskPolicy);
        }
    }

    fn salt_to_bytes32(env: &Env, salt: &Bytes) -> BytesN<32> {
        if salt.len() != 32 {
            panic_with_error!(env, Error::ImplNotSet);
        }
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
                env.deployer()
                    .with_current_contract(salt_n)
                    .deploy_v2(hash, ())
            })
        }
    }

    fn deploy_arka(env: &Env, store: &soroban_sdk::storage::Instance, salt: &Bytes) -> Address {
        match Self::deploy_contract_from_key(env, store, DataKey::Implementation, salt) {
            Some(address) => address,
            None => panic_with_error!(env, Error::ImplNotSet),
        }
    }

    fn register_arka(env: &Env, registry: &Address, manager: &Address, arka_addr: &Address) {
        let caller = env.current_contract_address();
        let args = vec![
            env,
            caller.into_val(env),
            manager.clone().into_val(env),
            arka_addr.clone().into_val(env),
        ];
        let auth = InvokerContractAuthEntry::Contract(SubContractInvocation {
            context: ContractContext {
                contract: registry.clone(),
                fn_name: symbol_short!("register"),
                args: args.clone(),
            },
            sub_invocations: vec![env],
        });
        env.authorize_as_current_contract(vec![env, auth]);
        let _ = env.invoke_contract::<()>(registry, &symbol_short!("register"), args);
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

    pub fn set_bootstrap_admin(env: Env, caller: Address, admin: Address, expires_at: u64) {
        Self::require_bootstrap_or_governor_auth(&env, &caller);
        Self::require_future_bootstrap_expiry(&env, expires_at);
        let store = env.storage().instance();
        if let Some(current_expires_at) =
            store.get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
        {
            assert!(
                expires_at <= current_expires_at,
                "bootstrap_admin_expiry_locked"
            );
        }
        store.set(&DataKey::BootstrapAdmin, &admin);
        store.set(&DataKey::BootstrapAdminExpiresAt, &expires_at);
    }

    pub fn clear_bootstrap_admin(env: Env, caller: Address) {
        Self::require_governor_caller_auth(&env, &caller);
        let store = env.storage().instance();
        store.remove(&DataKey::BootstrapAdmin);
        store.remove(&DataKey::BootstrapAdminExpiresAt);
    }

    pub fn bootstrap_admin(env: Env) -> Option<Address> {
        env.storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::BootstrapAdmin)
    }

    pub fn bootstrap_admin_expires_at(env: Env) -> Option<u64> {
        env.storage()
            .instance()
            .get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
    }

    pub fn bootstrap_admin_active(env: Env) -> bool {
        Self::bootstrap_admin_active_internal(&env)
    }

    pub fn set_implementation_controlled(env: Env, caller: Address, impl_wasm_hash: BytesN<32>) {
        Self::require_bootstrap_or_governor_auth(&env, &caller);
        env.storage()
            .instance()
            .set(&DataKey::Implementation, &impl_wasm_hash);
    }

    pub fn set_share_impl_controlled(env: Env, caller: Address, impl_wasm_hash: BytesN<32>) {
        Self::require_bootstrap_or_governor_auth(&env, &caller);
        env.storage()
            .instance()
            .set(&DataKey::ShareTokenImplementation, &impl_wasm_hash);
    }

    pub fn upgrade(env: Env, caller: Address, new_wasm_hash: BytesN<32>) {
        Self::require_bootstrap_or_governor_auth(&env, &caller);
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

    pub fn set_protocol_fee_splits(env: Env, mgmt_protocol_bps: i32, perf_protocol_bps: i32) {
        Self::require_governor_auth(&env);
        let store = env.storage().instance();
        store.set(&DataKey::ProtocolMgmtFeeBps, &mgmt_protocol_bps);
        store.set(&DataKey::ProtocolPerfFeeBps, &perf_protocol_bps);
    }

    pub fn set_creation_fee(env: Env, token: Address, amount: i128) {
        Self::require_governor_auth(&env);
        let store = env.storage().instance();
        store.set(&DataKey::CreationFeeToken, &token);
        store.set(&DataKey::CreationFeeAmount, &amount);
    }

    pub fn set_default_venue_registry(env: Env, registry: Address) {
        Self::require_governor_auth(&env);
        env.storage()
            .instance()
            .set(&DataKey::DefaultVenueRegistry, &registry);
    }

    pub fn clear_default_venue_registry(env: Env) {
        Self::require_governor_auth(&env);
        env.storage()
            .instance()
            .remove(&DataKey::DefaultVenueRegistry);
    }

    pub fn set_default_swap_oracle(env: Env, oracle: Address) {
        Self::require_governor_auth(&env);
        env.storage()
            .instance()
            .set(&DataKey::DefaultSwapOracle, &oracle);
    }

    pub fn clear_default_swap_oracle(env: Env) {
        Self::require_governor_auth(&env);
        env.storage().instance().remove(&DataKey::DefaultSwapOracle);
    }

    pub fn set_default_allowed_venues(
        env: Env,
        allowed_routers: Vec<Address>,
        allowed_adapters: Vec<Address>,
    ) {
        Self::require_governor_auth(&env);
        let store = env.storage().instance();
        store.set(&DataKey::DefaultAllowedRouters, &allowed_routers);
        store.set(&DataKey::DefaultAllowedAdapters, &allowed_adapters);
    }

    pub fn set_default_swap_risk_policy(
        env: Env,
        enabled: bool,
        oracle_checks_enabled: bool,
        max_price_impact_bps: i32,
        max_slippage_bps: i32,
        max_twap_deviation_bps: i32,
        max_oracle_age_seconds: u64,
        max_trade_size_bps: i32,
    ) {
        Self::require_governor_auth(&env);
        let policy = DefaultSwapRiskPolicy {
            enabled,
            oracle_checks_enabled,
            max_price_impact_bps,
            max_slippage_bps,
            max_twap_deviation_bps,
            max_oracle_age_seconds,
            max_trade_size_bps,
        };
        Self::assert_swap_risk_policy(&env, &policy);
        env.storage()
            .instance()
            .set(&DataKey::DefaultSwapRiskPolicy, &policy);
    }

    pub fn create_arka(env: Env, salt: Bytes, manager: Address) -> Address {
        // Creation is permissionless; only the manager must authorize
        let store = env.storage().instance();
        // Manager must authorize creation for proper indexing
        manager.require_auth();
        Self::charge_creation_fee(&env, &manager);
        let arka_addr: Address = Self::deploy_arka(&env, &store, &salt);

        // Update in-factory simple lists (optional)
        let mut all: Vec<Address> =
            Self::dynamic_get(&env, &DataKey::AllArkas).unwrap_or(Vec::new(&env));
        all.push_back(arka_addr.clone());
        Self::dynamic_set(&env, &DataKey::AllArkas, &all);
        let mut mine: Vec<Address> =
            Self::dynamic_get(&env, &DataKey::ManagerArkas(manager.clone()))
                .unwrap_or(Vec::new(&env));
        mine.push_back(arka_addr.clone());
        Self::dynamic_set(&env, &DataKey::ManagerArkas(manager.clone()), &mine);

        // Auto-register in external registry if configured
        if let Some(reg) = store.get::<DataKey, Address>(&DataKey::Registry) {
            Self::register_arka(&env, &reg, &manager, &arka_addr);
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
        let share_token_addr = Self::deploy_contract_from_key(
            &env,
            &store,
            DataKey::ShareTokenImplementation,
            &share_token_salt,
        );

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
            let _ =
                env.invoke_contract::<()>(&arka_addr, &Symbol::new(&env, "set_router"), args_sr);

            if let Some(venue_registry) =
                store.get::<DataKey, Address>(&DataKey::DefaultVenueRegistry)
            {
                let args_vr = vec![
                    &env,
                    policy_caller.clone().into_val(&env),
                    venue_registry.into_val(&env),
                ];
                let _ = env.invoke_contract::<()>(
                    &arka_addr,
                    &Symbol::new(&env, "set_venue_registry"),
                    args_vr,
                );
            }

            if let Some(swap_oracle) = store.get::<DataKey, Address>(&DataKey::DefaultSwapOracle) {
                let args_oracle = vec![
                    &env,
                    policy_caller.clone().into_val(&env),
                    swap_oracle.into_val(&env),
                ];
                let _ = env.invoke_contract::<()>(
                    &arka_addr,
                    &Symbol::new(&env, "set_swap_oracle"),
                    args_oracle,
                );
            }

            let default_routers: Option<Vec<Address>> = store.get(&DataKey::DefaultAllowedRouters);
            let default_adapters: Option<Vec<Address>> =
                store.get(&DataKey::DefaultAllowedAdapters);
            if default_routers.is_some() || default_adapters.is_some() {
                let routers = default_routers.unwrap_or_else(|| Vec::new(&env));
                let adapters = default_adapters.unwrap_or_else(|| Vec::new(&env));
                let args_venues = vec![
                    &env,
                    policy_caller.clone().into_val(&env),
                    routers.into_val(&env),
                    adapters.into_val(&env),
                ];
                let _ = env.invoke_contract::<()>(
                    &arka_addr,
                    &Symbol::new(&env, "set_allowed_venues"),
                    args_venues,
                );
            }

            if let Some(policy) =
                store.get::<DataKey, DefaultSwapRiskPolicy>(&DataKey::DefaultSwapRiskPolicy)
            {
                let args_policy = vec![
                    &env,
                    policy_caller.clone().into_val(&env),
                    policy.enabled.into_val(&env),
                    policy.oracle_checks_enabled.into_val(&env),
                    policy.max_price_impact_bps.into_val(&env),
                    policy.max_slippage_bps.into_val(&env),
                    policy.max_twap_deviation_bps.into_val(&env),
                    policy.max_oracle_age_seconds.into_val(&env),
                    policy.max_trade_size_bps.into_val(&env),
                ];
                let _ = env.invoke_contract::<()>(
                    &arka_addr,
                    &Symbol::new(&env, "set_swap_risk_policy"),
                    args_policy,
                );
            }

            if let Some(share_token) = share_token_addr.clone() {
                let args_tt_init = vec![&env, arka_addr.clone().into_val(&env)];
                let _ = env.invoke_contract::<()>(
                    &share_token,
                    &Symbol::new(&env, "init"),
                    args_tt_init,
                );

                let args_st = vec![
                    &env,
                    policy_caller.clone().into_val(&env),
                    share_token.clone().into_val(&env),
                ];
                let _ = env.invoke_contract::<()>(
                    &arka_addr,
                    &Symbol::new(&env, "set_share_token"),
                    args_st,
                );
            }

            if let Some(protocol_treasury) =
                store.get::<DataKey, Address>(&DataKey::ProtocolTreasury)
            {
                let mgmt_split: i32 = store.get(&DataKey::ProtocolMgmtFeeBps).unwrap_or(0);
                let perf_split: i32 = store.get(&DataKey::ProtocolPerfFeeBps).unwrap_or(0);
                let args_fee_policy = vec![
                    &env,
                    policy_caller.clone().into_val(&env),
                    protocol_treasury.into_val(&env),
                    mgmt_split.into_val(&env),
                    perf_split.into_val(&env),
                ];
                let _ = env.invoke_contract::<()>(
                    &arka_addr,
                    &Symbol::new(&env, "set_protocol_fee_policy"),
                    args_fee_policy,
                );
            }

            if !require_manager_auth {
                let args_self_gov = vec![
                    &env,
                    policy_caller.clone().into_val(&env),
                    factory_addr.clone().into_val(&env),
                ];
                let _ = env.invoke_contract::<()>(
                    &arka_addr,
                    &Symbol::new(&env, "set_governor"),
                    args_self_gov,
                );

                let args_sm = vec![
                    &env,
                    policy_caller.into_val(&env),
                    manager.clone().into_val(&env),
                ];
                let _ = env.invoke_contract::<()>(
                    &arka_addr,
                    &Symbol::new(&env, "set_manager"),
                    args_sm,
                );
            }

            // If factory governor is configured, propagate it into the new Arka.
            if let Some(governor) = configured_governor {
                let final_caller = if require_manager_auth {
                    manager.clone()
                } else {
                    factory_addr
                };
                let args_sg = vec![&env, final_caller.into_val(&env), governor.into_val(&env)];
                let _ = env.invoke_contract::<()>(
                    &arka_addr,
                    &Symbol::new(&env, "set_governor"),
                    args_sg,
                );
            }
        }

        // Update lists
        let mut all: Vec<Address> =
            Self::dynamic_get(&env, &DataKey::AllArkas).unwrap_or(Vec::new(&env));
        all.push_back(arka_addr.clone());
        Self::dynamic_set(&env, &DataKey::AllArkas, &all);
        let mut mine: Vec<Address> =
            Self::dynamic_get(&env, &DataKey::ManagerArkas(manager.clone()))
                .unwrap_or(Vec::new(&env));
        mine.push_back(arka_addr.clone());
        Self::dynamic_set(&env, &DataKey::ManagerArkas(manager.clone()), &mine);
        if let Some(share_token) = share_token_addr {
            Self::dynamic_set(
                &env,
                &DataKey::ShareTokenByArka(arka_addr.clone()),
                &share_token,
            );
        }

        // Register
        if let Some(reg) = store.get::<DataKey, Address>(&DataKey::Registry) {
            Self::register_arka(&env, &reg, &manager, &arka_addr);
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
        Self::dynamic_set(
            &env,
            &DataKey::MigratedTo(old_arka.clone()),
            &new_arka.clone(),
        );
        Self::dynamic_set(&env, &DataKey::MigratedFrom(new_arka.clone()), &old_arka);
        new_arka
    }

    pub fn migrated_to(env: Env, old_arka: Address) -> Option<Address> {
        Self::dynamic_get(&env, &DataKey::MigratedTo(old_arka))
    }

    pub fn migrated_from(env: Env, new_arka: Address) -> Option<Address> {
        Self::dynamic_get(&env, &DataKey::MigratedFrom(new_arka))
    }

    pub fn share_token_of(env: Env, arka: Address) -> Option<Address> {
        Self::dynamic_get(&env, &DataKey::ShareTokenByArka(arka))
    }

    pub fn get_arkas(env: Env, offset: u32, limit: u32) -> Vec<Address> {
        let list: Vec<Address> =
            Self::dynamic_get(&env, &DataKey::AllArkas).unwrap_or(Vec::new(&env));
        slice_addresses(&env, list, offset, limit)
    }

    pub fn get_arkas_by_manager(
        env: Env,
        manager: Address,
        offset: u32,
        limit: u32,
    ) -> Vec<Address> {
        let list: Vec<Address> =
            Self::dynamic_get(&env, &DataKey::ManagerArkas(manager)).unwrap_or(Vec::new(&env));
        slice_addresses(&env, list, offset, limit)
    }

    pub fn get_protocol_treasury(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::ProtocolTreasury)
    }

    pub fn get_protocol_mgmt_fee_bps(env: Env) -> i32 {
        env.storage()
            .instance()
            .get(&DataKey::ProtocolMgmtFeeBps)
            .unwrap_or(0)
    }

    pub fn get_protocol_perf_fee_bps(env: Env) -> i32 {
        env.storage()
            .instance()
            .get(&DataKey::ProtocolPerfFeeBps)
            .unwrap_or(0)
    }

    pub fn get_creation_fee_token(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::CreationFeeToken)
    }

    pub fn get_creation_fee_amount(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::CreationFeeAmount)
            .unwrap_or(0)
    }

    pub fn get_default_venue_registry(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::DefaultVenueRegistry)
    }

    pub fn get_default_swap_oracle(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::DefaultSwapOracle)
    }

    pub fn get_default_allowed_routers(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::DefaultAllowedRouters)
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_default_allowed_adapters(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::DefaultAllowedAdapters)
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_default_swap_risk_policy(env: Env) -> Option<DefaultSwapRiskPolicy> {
        env.storage()
            .instance()
            .get(&DataKey::DefaultSwapRiskPolicy)
    }

    pub fn get_share_token_implementation(env: Env) -> Option<BytesN<32>> {
        env.storage()
            .instance()
            .get(&DataKey::ShareTokenImplementation)
    }
}

fn slice_addresses(env: &Env, list: Vec<Address>, offset: u32, limit: u32) -> Vec<Address> {
    let len = list.len();
    if len == 0 {
        return Vec::new(env);
    }
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
    use soroban_sdk::{testutils::Ledger, Address, Bytes, Env};
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
        let registry_admin = Address::generate(&env);
        client.set_governor(&gov);
        env.mock_all_auths_allowing_non_root_auth();
        reg.init_admin(&registry_admin);
        reg.set_registrar(&registry_admin, &contract_id, &true);
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
            &old_arka, &salt, &manager, &denom, &0, &0, &0, &0, &whitelist, &router,
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

        let arka =
            client.create_and_init(&salt, &manager, &denom, &0, &0, &0, &0, &whitelist, &router);

        assert_eq!(
            client.get_share_token_implementation(),
            Some(share_token_impl)
        );
        assert!(client.share_token_of(&arka).is_some());
    }

    #[test]
    fn test_protocol_fee_defaults_round_trip() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ArkaFactory);
        let client = ArkaFactoryClient::new(&env, &contract_id);
        let governor = Address::generate(&env);
        let treasury = Address::generate(&env);
        client.set_governor(&governor);

        env.mock_all_auths();
        client.set_protocol_treasury(&treasury);
        client.set_protocol_fee_splits(&1_500, &2_500);

        assert_eq!(client.get_protocol_treasury(), Some(treasury));
        assert_eq!(client.get_protocol_mgmt_fee_bps(), 1_500);
        assert_eq!(client.get_protocol_perf_fee_bps(), 2_500);
    }

    #[test]
    fn test_default_execution_policy_round_trip() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ArkaFactory);
        let client = ArkaFactoryClient::new(&env, &contract_id);
        let governor = Address::generate(&env);
        let registry = Address::generate(&env);
        let oracle = Address::generate(&env);
        let router = Address::generate(&env);
        let adapter = Address::generate(&env);

        client.set_governor(&governor);
        env.mock_all_auths();
        client.set_default_venue_registry(&registry);
        client.set_default_swap_oracle(&oracle);
        client.set_default_allowed_venues(
            &Vec::from_array(&env, [router.clone()]),
            &Vec::from_array(&env, [adapter.clone()]),
        );
        client.set_default_swap_risk_policy(&true, &true, &300, &300, &350, &60, &2_500);

        assert_eq!(client.get_default_venue_registry(), Some(registry));
        assert_eq!(client.get_default_swap_oracle(), Some(oracle));
        assert_eq!(client.get_default_allowed_routers().get(0).unwrap(), router);
        assert_eq!(
            client.get_default_allowed_adapters().get(0).unwrap(),
            adapter
        );

        let policy = client.get_default_swap_risk_policy().unwrap();
        assert!(policy.enabled);
        assert!(policy.oracle_checks_enabled);
        assert_eq!(policy.max_price_impact_bps, 300);
        assert_eq!(policy.max_slippage_bps, 300);
        assert_eq!(policy.max_twap_deviation_bps, 350);
        assert_eq!(policy.max_oracle_age_seconds, 60);
        assert_eq!(policy.max_trade_size_bps, 2_500);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #5)")]
    fn test_default_swap_policy_rejects_invalid_limits() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ArkaFactory);
        let client = ArkaFactoryClient::new(&env, &contract_id);
        let governor = Address::generate(&env);

        client.set_governor(&governor);
        env.mock_all_auths();
        client.set_default_swap_risk_policy(&true, &true, &10_001, &300, &350, &60, &2_500);
    }

    #[test]
    #[should_panic(expected = "bootstrap_admin_expiry_locked")]
    fn test_bootstrap_admin_cannot_extend_expiry() {
        let env = Env::default();
        env.ledger().set_timestamp(1_000);
        let contract_id = env.register_contract(None, ArkaFactory);
        let client = ArkaFactoryClient::new(&env, &contract_id);
        let governor = Address::generate(&env);
        let admin = Address::generate(&env);
        client.set_governor(&governor);

        env.mock_all_auths();
        client.set_bootstrap_admin(&governor, &admin, &2_000);
        client.set_bootstrap_admin(&admin, &admin, &2_001);
    }
}
