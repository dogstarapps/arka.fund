#![no_std]
mod managed_routes_creation;
pub use managed_routes_creation::{ManagedRouteBinding, ManagedRouteFamily};
#[cfg(test)]
use soroban_sdk::testutils::Address as _;
use soroban_sdk::xdr::ToXdr;
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
pub struct DefaultValuationOracle {
    pub oracle: Address,
    pub max_price_age: u64,
}

/// Wire-compatible with Arka's ManagedPolicy. Configuration is governed and
/// activated inside creation, before ownership/governance handoff or registration.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct ManagedPolicy {
    pub epoch_seconds: u64,
    pub manager_window: u64,
    pub min_request_shares: i128,
    pub buffer_bps: u32,
    pub blend_market_id: u128,
    pub blend_adapter: Option<Address>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct ManagedTemplate {
    pub denomination: Address,
    pub policy: ManagedPolicy,
    pub enabled: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct ManagedSpotRoute {
    pub asset: Address,
    pub router: Address,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct ManagedPortfolioPolicy {
    pub routes: Vec<ManagedSpotRoute>,
    pub instant_cash: bool,
    pub auto_payout: bool,
    pub max_slippage_bps: u32,
    pub cancel_lock_seconds: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct ManagedCreateConfig {
    pub template_hash: BytesN<32>,
    pub denomination: Address,
    pub mgmt_bps: i32,
    pub perf_bps: i32,
    pub deposit_bps: i32,
    pub router: Address,
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
    DefaultValuationOracle,
    DefaultAllowedRouters,
    DefaultAllowedAdapters,
    DefaultSwapRiskPolicy,
    MigratedTo(Address),
    MigratedFrom(Address),
    ShareTokenByArka(Address),
    BootstrapAdmin,
    BootstrapAdminExpiresAt,
    LastWasmHash,
    ManagedTemplate,
    ManagedPortfolioTemplate,
    ManagedRoutesTemplate,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    ImplNotSet = 1,
    GovernorNotSet = 2,
    Unauthorized = 3,
    InvalidBootstrapAdmin = 4,
    InvalidSwapRiskPolicy = 5,
    InvalidValuationOracle = 6,
    ManagedCreationDisabled = 7,
    InvalidManagedTemplate = 8,
}

const MAX_BOOTSTRAP_ADMIN_SECONDS: u64 = 365 * 24 * 60 * 60;

#[contract]
pub struct ArkaFactory;

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct AtomicAuxiliaries {
    pub oracle_guard: Address,
    pub venue_registry: Address,
    pub aquarius_route: Address,
}

#[contractimpl]
impl ArkaFactory {
    /// Create the three constructor-only auxiliary implementations atomically.
    /// Code identities are fixed; this is not an arbitrary privileged executor.
    pub fn bootstrap_auxiliaries(
        env: Env,
        guard_salt: BytesN<32>,
        registry_salt: BytesN<32>,
        route_salt: BytesN<32>,
        router: Address,
        expires_at: u64,
    ) -> AtomicAuxiliaries {
        Self::require_governor_auth(&env);
        let governor: Address = env.storage().instance().get(&DataKey::Governor)
            .unwrap_or_else(|| panic_with_error!(&env, Error::GovernorNotSet));
        let guard_hash = BytesN::from_array(&env, &[0x56, 0xc3, 0x4c, 0x20, 0x6c, 0x6f, 0xab, 0x4d, 0x0c, 0xb1, 0x5a, 0x0c, 0x51, 0xb5, 0x04, 0xd6, 0xf9, 0x82, 0xd0, 0x49, 0x71, 0xc5, 0xa3, 0x59, 0xec, 0x67, 0xe7, 0xa8, 0xdd, 0x2e, 0x53, 0x89]);
        let registry_hash = BytesN::from_array(&env, &[0x57, 0x83, 0x7b, 0x47, 0x93, 0x18, 0xbf, 0x08, 0xcd, 0x05, 0x45, 0x28, 0x0b, 0xaf, 0xa0, 0xc0, 0x47, 0x17, 0xaa, 0x4e, 0x1f, 0x25, 0x0a, 0x99, 0xa2, 0x22, 0xa2, 0xbf, 0x65, 0x22, 0x8d, 0x44]);
        let route_hash = BytesN::from_array(&env, &[0x2f, 0xce, 0x41, 0x21, 0x3e, 0x9c, 0x84, 0x54, 0x58, 0xc8, 0x3f, 0x73, 0x73, 0x97, 0x06, 0xd2, 0x0a, 0x09, 0xdf, 0x68, 0xc8, 0xd7, 0x7d, 0xb2, 0x1b, 0xb0, 0x60, 0xe7, 0xa9, 0xd3, 0xfa, 0x58]);
        let bootstrap = env.current_contract_address();
        let guard_deployer = env.deployer().with_address(governor.clone(), guard_salt);
        // The constructor is below a host create frame. Authorize this exact
        // one-time constructor call for the factory's temporary admin role.
        env.authorize_as_current_contract(vec![&env,
            InvokerContractAuthEntry::Contract(SubContractInvocation {
                context: ContractContext {
                    contract: guard_deployer.deployed_address(),
                    fn_name: Symbol::new(&env, "__constructor"),
                    args: (bootstrap.clone(),).into_val(&env),
                },
                sub_invocations: Vec::new(&env),
            }),
        ]);
        let oracle_guard = guard_deployer.deploy_v2(guard_hash, (bootstrap.clone(),));
        let venue_registry = env.deployer().with_address(governor.clone(), registry_salt)
            .deploy_v2(registry_hash, (governor.clone(), Some(governor.clone()), expires_at));
        let aquarius_route = env.deployer().with_address(governor.clone(), route_salt)
            .deploy_v2(route_hash, (governor.clone(), router));
        env.invoke_contract::<()>(&oracle_guard, &Symbol::new(&env, "set_governor"),
            (bootstrap.clone(), Some(governor.clone())).into_val(&env));
        env.invoke_contract::<()>(&oracle_guard, &Symbol::new(&env, "set_guardian"),
            (bootstrap.clone(), governor.clone(), expires_at).into_val(&env));
        env.invoke_contract::<()>(&oracle_guard, &Symbol::new(&env, "set_admin"),
            (bootstrap, governor.clone()).into_val(&env));
        env.invoke_contract::<()>(&venue_registry, &Symbol::new(&env, "set_guardian"),
            (governor.clone(), Some(governor.clone())).into_val(&env));
        env.invoke_contract::<()>(&aquarius_route, &Symbol::new(&env, "set_governor"),
            (governor.clone(), Some(governor)).into_val(&env));
        AtomicAuxiliaries { oracle_guard, venue_registry, aquarius_route }
    }

    /// New instances are owned inside the host's atomic create invocation.
    /// No public post-deployment initialization or implicit deployer privilege.
    /// A separate governor is supported, but must authorize its assignment.
    pub fn __constructor(env: Env, governor: Address) {
        let store = env.storage().instance();
        if store.has(&DataKey::Governor) {
            panic_with_error!(&env, Error::Unauthorized);
        }
        governor.require_auth();
        store.set(&DataKey::Governor, &governor);
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

    fn charge_creation_fee(env: &Env, manager: &Address, direct: bool) {
        let store = env.storage().instance();
        if direct {
            let amount: i128 = store.get(&DataKey::CreationFeeAmount).unwrap_or(0);
            if amount < 0 { panic_with_error!(env, Error::InvalidManagedTemplate); }
            if amount > 0 {
                let treasury: Address = store.get(&DataKey::ProtocolTreasury)
                    .unwrap_or_else(|| panic_with_error!(env, Error::InvalidManagedTemplate));
                let token: Address = store.get(&DataKey::CreationFeeToken)
                    .unwrap_or_else(|| panic_with_error!(env, Error::InvalidManagedTemplate));
                // The signed routed-template digest binds these exact values.
                // Charge within creation; no allowance is created or consumed.
                soroban_sdk::token::TokenClient::new(env, &token).transfer(manager, &treasury, &amount);
            }
            return;
        }
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

    fn deploy_managed_from_key(
        env: &Env,
        store: &soroban_sdk::storage::Instance,
        key: DataKey,
        salt: &Bytes,
        manager: &Address,
    ) -> Option<Address> {
        #[cfg(test)]
        {
            let _ = manager;
            Self::deploy_contract_from_key(env, store, key, salt)
        }
        #[cfg(not(test))]
        {
            // Use the authenticated manager's deployment namespace. A legacy
            // permissionless factory call cannot occupy this address first.
            let hash: Option<BytesN<32>> = store.get(&key);
            hash.map(|hash| {
                env.deployer()
                    .with_address(manager.clone(), Self::salt_to_bytes32(env, salt))
                    .deploy_v2(hash, ())
            })
        }
    }

    /// The selected share implementation must implement the explicit constructor
    /// profile. Legacy share implementations are deliberately incompatible.
    fn deploy_share(env: &Env, store: &soroban_sdk::storage::Instance, salt: &Bytes,
        namespace: Option<&Address>, arka: &Address) -> Option<Address> {
        #[cfg(test)] {
            let _ = namespace; let _ = arka;
            Self::deploy_contract_from_key(env, store, DataKey::ShareTokenImplementation, salt)
        }
        #[cfg(not(test))] {
            let hash: Option<BytesN<32>> = store.get(&DataKey::ShareTokenImplementation);
            hash.map(|hash| {
                let admin: Option<Address> = store.get(&DataKey::BootstrapAdmin);
                let expiry: Option<u64> = store.get(&DataKey::BootstrapAdminExpiresAt);
                let (upgrade_admin, governor, expires_at) = match (admin, expiry) {
                    (Some(admin), Some(expiry)) => (Some(admin), store.get::<DataKey, Address>(&DataKey::Governor), expiry),
                    _ => (None, None, 0u64),
                };
                let deployer = match namespace {
                    Some(owner) => env.deployer().with_address(owner.clone(), Self::salt_to_bytes32(env, salt)),
                    None => env.deployer().with_current_contract(Self::salt_to_bytes32(env, salt)),
                };
                deployer.deploy_v2(hash, (arka.clone(), upgrade_admin, governor, expires_at))
            })
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
        // This remains a governed handover, never a first-claim initializer.
        let current: Address = store
            .get(&DataKey::Governor)
            .unwrap_or_else(|| panic_with_error!(&env, Error::GovernorNotSet));
        current.require_auth();
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

    pub fn set_default_valuation_oracle(env: Env, oracle: Address, max_price_age: u64) {
        Self::require_governor_auth(&env);
        if max_price_age == 0 {
            panic_with_error!(&env, Error::InvalidValuationOracle);
        }
        env.storage().instance().set(
            &DataKey::DefaultValuationOracle,
            &DefaultValuationOracle {
                oracle,
                max_price_age,
            },
        );
    }

    pub fn clear_default_valuation_oracle(env: Env) {
        Self::require_governor_auth(&env);
        env.storage()
            .instance()
            .remove(&DataKey::DefaultValuationOracle);
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
        Self::charge_creation_fee(&env, &manager, false);
        let arka_addr: Address = Self::deploy_arka(&env, &store, &salt);

        // Bind the otherwise uninitialized instance before registering or
        // publishing it. Any failed reservation rolls back deployment and fee.
        #[cfg(not(test))]
        env.invoke_contract::<()>(&arka_addr, &Symbol::new(&env, "set_manager"),
            (manager.clone(), manager.clone()).into_val(&env));

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

    pub fn set_managed_template(env: Env, caller: Address, template: ManagedTemplate) {
        Self::require_bootstrap_or_governor_auth(&env, &caller);
        let p = &template.policy;
        if p.epoch_seconds < 60
            || p.epoch_seconds > 86_400
            || p.manager_window < p.epoch_seconds
            || p.manager_window > 604_800
            || p.min_request_shares <= 0
            || p.buffer_bps > 5_000
        {
            panic_with_error!(&env, Error::InvalidManagedTemplate);
        }
        env.storage()
            .instance()
            .set(&DataKey::ManagedTemplate, &template);
        env.events()
            .publish((Symbol::new(&env, "managed_template"),), template);
    }

    pub fn managed_creation_template(env: Env) -> Option<ManagedTemplate> {
        env.storage().instance().get(&DataKey::ManagedTemplate)
    }

    pub fn set_portfolio_template(
        env: Env,
        caller: Address,
        portfolio: Option<ManagedPortfolioPolicy>,
    ) {
        Self::require_bootstrap_or_governor_auth(&env, &caller);
        if let Some(p) = &portfolio {
            if p.routes.len() > 16 || p.max_slippage_bps > 500 || p.cancel_lock_seconds > 604_800 {
                panic_with_error!(&env, Error::InvalidManagedTemplate);
            }
        }
        env.storage()
            .instance()
            .set(&DataKey::ManagedPortfolioTemplate, &portfolio);
    }

    pub fn portfolio_creation_template(env: Env) -> Option<ManagedPortfolioPolicy> {
        env.storage()
            .instance()
            .get(&DataKey::ManagedPortfolioTemplate)
            .unwrap_or(None)
    }

    pub fn managed_template_digest(env: Env) -> Option<BytesN<32>> {
        let template = Self::managed_creation_template(env.clone())?;
        let s = env.storage().instance();
        let fields: Vec<Val> = vec![
            &env,
            template.into_val(&env),
            s.get::<_, BytesN<32>>(&DataKey::Implementation)
                .into_val(&env),
            s.get::<_, BytesN<32>>(&DataKey::ShareTokenImplementation)
                .into_val(&env),
            s.get::<_, Address>(&DataKey::Governor).into_val(&env),
            s.get::<_, Address>(&DataKey::Registry).into_val(&env),
            s.get::<_, Address>(&DataKey::ProtocolTreasury)
                .into_val(&env),
            s.get::<_, i32>(&DataKey::ProtocolMgmtFeeBps).into_val(&env),
            s.get::<_, i32>(&DataKey::ProtocolPerfFeeBps).into_val(&env),
            s.get::<_, Address>(&DataKey::CreationFeeToken)
                .into_val(&env),
            s.get::<_, i128>(&DataKey::CreationFeeAmount).into_val(&env),
            s.get::<_, DefaultValuationOracle>(&DataKey::DefaultValuationOracle)
                .into_val(&env),
            s.get::<_, Address>(&DataKey::DefaultVenueRegistry)
                .into_val(&env),
            s.get::<_, Address>(&DataKey::DefaultSwapOracle)
                .into_val(&env),
            s.get::<_, Vec<Address>>(&DataKey::DefaultAllowedRouters)
                .into_val(&env),
            s.get::<_, Vec<Address>>(&DataKey::DefaultAllowedAdapters)
                .into_val(&env),
            s.get::<_, DefaultSwapRiskPolicy>(&DataKey::DefaultSwapRiskPolicy)
                .into_val(&env),
            s.get::<_, Address>(&DataKey::BootstrapAdmin).into_val(&env),
            s.get::<_, u64>(&DataKey::BootstrapAdminExpiresAt)
                .into_val(&env),
            Self::portfolio_creation_template(env.clone()).into_val(&env),
        ];
        Some(env.crypto().sha256(&fields.to_xdr(&env)).into())
    }

    pub fn create_managed(
        env: Env,
        salt: Bytes,
        manager: Address,
        config: ManagedCreateConfig,
    ) -> Address {
        let store = env.storage().instance();
        let template: ManagedTemplate = store
            .get(&DataKey::ManagedTemplate)
            .unwrap_or_else(|| panic_with_error!(&env, Error::ManagedCreationDisabled));
        if !template.enabled || !store.has(&DataKey::ShareTokenImplementation) {
            panic_with_error!(&env, Error::ManagedCreationDisabled);
        }
        let digest = Self::managed_template_digest(env.clone()).unwrap();
        let portfolio = Self::portfolio_creation_template(env.clone());
        if config.template_hash != digest
            || config.denomination != template.denomination
            || salt.len() != 32
            || ((template.policy.blend_adapter.is_some() || portfolio.is_some())
                && !store.has(&DataKey::DefaultValuationOracle))
        {
            panic_with_error!(&env, Error::InvalidManagedTemplate);
        }
        // The manager's identity namespaces salts: another creator cannot front-run
        // a published salt to occupy the intended deployment address.
        let hash: BytesN<32> = env
            .crypto()
            .sha256(&(env.current_contract_address(), manager.clone(), salt).to_xdr(&env))
            .into();
        let namespaced_salt = Bytes::from_array(&env, &hash.to_array());
        let mut whitelist = vec![&env, config.denomination.clone()];
        if let Some(p) = &portfolio {
            for r in p.routes.iter() {
                whitelist.push_back(r.asset);
            }
        }
        Self::create_and_init_internal(
            env.clone(),
            namespaced_salt,
            manager,
            config.denomination.clone(),
            config.mgmt_bps,
            config.perf_bps,
            config.deposit_bps,
            0,
            whitelist,
            config.router,
            true,
            Some(template.policy),
            portfolio,
            None,
        )
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
        managed_policy: Option<ManagedPolicy>,
        managed_portfolio: Option<ManagedPortfolioPolicy>,
        managed_bindings: Option<Vec<ManagedRouteBinding>>,
    ) -> Address {
        let store = env.storage().instance();
        if require_manager_auth {
            manager.require_auth();
        }
        Self::charge_creation_fee(&env, &manager, managed_bindings.is_some());
        let managed = managed_policy.is_some();
        let arka_addr: Address = if managed {
            Self::deploy_managed_from_key(&env, &store, DataKey::Implementation, &salt, &manager)
                .unwrap_or_else(|| panic_with_error!(&env, Error::ImplNotSet))
        } else {
            Self::deploy_arka(&env, &store, &salt)
        };
        let share_token_salt = Self::derive_salt(&env, &salt, 1u8);
        let share_token_addr = Self::deploy_share(&env, &store, &share_token_salt,
            if managed { Some(&manager) } else { None }, &arka_addr);

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
            env.invoke_contract::<()>(&arka_addr, &Symbol::new(&env, "set_manager"),
                (init_manager.clone(), init_manager.clone()).into_val(&env));
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

            if let Some(valuation) =
                store.get::<DataKey, DefaultValuationOracle>(&DataKey::DefaultValuationOracle)
            {
                let args_valuation = vec![
                    &env,
                    policy_caller.clone().into_val(&env),
                    valuation.oracle.into_val(&env),
                    valuation.max_price_age.into_val(&env),
                ];
                let _ = env.invoke_contract::<()>(
                    &arka_addr,
                    &Symbol::new(&env, "set_valuation_oracle"),
                    args_valuation,
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

            // The new mode is configured before the final governor can take over.
            // Any failure rolls back deployment, share token, fee and registry state.
            if let Some(policy) = managed_policy {
                if let Some(adapter) = policy.blend_adapter.clone() {
                    let args = vec![
                        &env,
                        policy_caller.clone().into_val(&env),
                        vec![&env, Symbol::new(&env, "Blend")].into_val(&env),
                        policy.blend_market_id.into_val(&env),
                        adapter.into_val(&env),
                        true.into_val(&env),
                        false.into_val(&env),
                        false.into_val(&env),
                        true.into_val(&env),
                        true.into_val(&env),
                    ];
                    env.invoke_contract::<()>(
                        &arka_addr,
                        &Symbol::new(&env, "configure_credit_market"),
                        args,
                    );
                }
                let mut args = vec![
                    &env,
                    policy_caller.clone().into_val(&env),
                    policy.into_val(&env),
                ];
                let method = if let Some(portfolio) = managed_portfolio {
                    args.push_back(portfolio.into_val(&env));
                    if let Some(bindings) = managed_bindings {
                        args.push_back(bindings.into_val(&env));
                        "enable_managed_routes"
                    } else {
                        "enable_managed_portfolio"
                    }
                } else {
                    "enable_managed_withdrawals"
                };
                env.invoke_contract::<()>(&arka_addr, &Symbol::new(&env, method), args);
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
            None,
            None,
            None,
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
            None,
            None,
            None,
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

    pub fn get_default_valuation_oracle(env: Env) -> Option<DefaultValuationOracle> {
        env.storage()
            .instance()
            .get(&DataKey::DefaultValuationOracle)
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

    /// Returns the WASM hash used when the factory creates a new Arka.
    pub fn get_implementation(env: Env) -> Option<BytesN<32>> {
        env.storage().instance().get(&DataKey::Implementation)
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
mod test;
