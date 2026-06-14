#![no_std]
use soroban_sdk::auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation};
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, vec, Address, BytesN, Env, IntoVal, Symbol,
    TryFromVal, Val, Vec,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Governor,
    BootstrapAdminExpiresAt,
    Router,
    PoolRoute(u128),
    LastWasmHash,
}

const MAX_BOOTSTRAP_ADMIN_SECONDS: u64 = 365 * 24 * 60 * 60;

#[derive(Clone)]
#[contracttype]
pub struct AquariusPoolRoute {
    pub token_in: Address,
    pub token_out: Address,
    pub tokens: Vec<Address>,
    pub pool_index: soroban_sdk::BytesN<32>,
}

#[contract]
pub struct AquariusAdapter;

#[contractimpl]
impl AquariusAdapter {
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

    fn require_admin_or_governor_auth(env: &Env, caller: &Address) {
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

    fn require_governor_auth(env: &Env, caller: &Address) {
        let governor: Address = env
            .storage()
            .instance()
            .get(&DataKey::Governor)
            .expect("governor_not_set");
        assert!(*caller == governor, "only_governor");
        caller.require_auth();
    }

    fn contract_auth(
        env: &Env,
        contract: &Address,
        fn_name: &str,
        args: &Vec<Val>,
    ) -> InvokerContractAuthEntry {
        InvokerContractAuthEntry::Contract(SubContractInvocation {
            context: ContractContext {
                contract: contract.clone(),
                fn_name: Symbol::new(env, fn_name),
                args: args.clone(),
            },
            sub_invocations: vec![env],
        })
    }

    fn authorize_current_contract_call(
        env: &Env,
        contract: &Address,
        fn_name: &str,
        args: &Vec<Val>,
    ) {
        let auth = Self::contract_auth(env, contract, fn_name, args);
        env.authorize_as_current_contract(vec![env, auth]);
    }

    fn invoke_with_contract_auth<T>(
        env: &Env,
        contract: &Address,
        fn_name: &str,
        args: Vec<Val>,
    ) -> T
    where
        T: TryFromVal<Env, Val>,
    {
        Self::authorize_current_contract_call(env, contract, fn_name, &args);
        env.invoke_contract::<T>(contract, &Symbol::new(env, fn_name), args)
    }

    fn transfer_auth(
        env: &Env,
        token: &Address,
        from: &Address,
        to: &Address,
        amount: i128,
    ) -> InvokerContractAuthEntry {
        let args = vec![
            env,
            from.clone().into_val(env),
            to.clone().into_val(env),
            amount.into_val(env),
        ];
        InvokerContractAuthEntry::Contract(SubContractInvocation {
            context: ContractContext {
                contract: token.clone(),
                fn_name: Symbol::new(env, "transfer"),
                args,
            },
            sub_invocations: vec![env],
        })
    }

    pub fn init(env: Env, admin: Address, router: Address) {
        let store = env.storage().instance();
        assert!(!store.has(&DataKey::Admin), "already_initialized");
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::Router, &router);
    }

    pub fn set_admin(env: Env, caller: Address, admin: Address) {
        Self::require_admin_or_governor_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn set_governor(env: Env, caller: Address, governor: Option<Address>) {
        Self::require_admin_or_governor_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Governor, &governor);
    }

    pub fn set_bootstrap_admin_expiry(env: Env, caller: Address, expires_at: u64) {
        Self::require_admin_or_governor_auth(&env, &caller);
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
        Self::require_governor_auth(&env, &caller);
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

    pub fn set_router(env: Env, caller: Address, router: Address) {
        Self::require_admin_or_governor_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Router, &router);
    }

    pub fn router(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Router)
            .expect("router_not_set")
    }

    pub fn set_pool_route(
        env: Env,
        caller: Address,
        pool_id: u128,
        token_in: Address,
        token_out: Address,
        tokens: Vec<Address>,
        pool_index: soroban_sdk::BytesN<32>,
    ) {
        Self::require_admin_or_governor_auth(&env, &caller);
        let store = env.storage().instance();
        let route = AquariusPoolRoute {
            token_in,
            token_out,
            tokens,
            pool_index,
        };
        store.set(&DataKey::PoolRoute(pool_id), &route);
    }

    pub fn upgrade(env: Env, caller: Address, new_wasm_hash: BytesN<32>) {
        Self::require_admin_or_governor_auth(&env, &caller);
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

    pub fn pool_route(env: Env, pool_id: u128) -> AquariusPoolRoute {
        env.storage()
            .instance()
            .get(&DataKey::PoolRoute(pool_id))
            .expect("pool_route_not_set")
    }

    pub fn execute(
        env: Env,
        caller: Address,
        pool_id: u128,
        amount_in: i128,
        min_out: i128,
        receiver: Address,
    ) -> i128 {
        caller.require_auth();
        assert!(amount_in > 0, "amount_zero");
        assert!(min_out >= 0, "invalid_min_out");
        let store = env.storage().instance();
        let router: Address = store.get(&DataKey::Router).expect("router_not_set");
        if let Some(route) = store.get::<DataKey, AquariusPoolRoute>(&DataKey::PoolRoute(pool_id)) {
            let self_addr = env.current_contract_address();
            let token_in = route.token_in.clone();
            let token_out = route.token_out.clone();
            let tokens = route.tokens.clone();
            let pool_index = route.pool_index.clone();
            let exp: u32 = env.ledger().sequence() + 100_000u32;
            let args_approve = vec![
                &env,
                self_addr.clone().into_val(&env),
                router.clone().into_val(&env),
                amount_in.into_val(&env),
                exp.into_val(&env),
            ];
            Self::invoke_with_contract_auth::<()>(&env, &token_in, "approve", args_approve);
            let args = vec![
                &env,
                self_addr.clone().into_val(&env),
                tokens.into_val(&env),
                token_in.into_val(&env),
                token_out.clone().into_val(&env),
                pool_index.into_val(&env),
                (amount_in as u128).into_val(&env),
                (min_out as u128).into_val(&env),
            ];
            let pool_args = vec![
                &env,
                tokens.clone().into_val(&env),
                pool_index.clone().into_val(&env),
            ];
            let pool: Address =
                env.invoke_contract(&router, &Symbol::new(&env, "get_pool"), pool_args);
            let router_auth = Self::contract_auth(&env, &router, "swap", &args);
            let mut token_in_index: u32 = 0;
            let mut token_out_index: u32 = 0;
            let mut idx: u32 = 0;
            for token in tokens.iter() {
                if token == token_in {
                    token_in_index = idx;
                }
                if token == token_out {
                    token_out_index = idx;
                }
                idx += 1;
            }
            let pool_swap_args = vec![
                &env,
                self_addr.clone().into_val(&env),
                token_in_index.into_val(&env),
                token_out_index.into_val(&env),
                (amount_in as u128).into_val(&env),
                (min_out as u128).into_val(&env),
            ];
            let pool_swap_auth = Self::contract_auth(&env, &pool, "swap", &pool_swap_args);
            let pool_transfer_auth =
                Self::transfer_auth(&env, &token_in, &self_addr, &pool, amount_in);
            env.authorize_as_current_contract(vec![
                &env,
                router_auth,
                pool_swap_auth,
                pool_transfer_auth,
            ]);
            let out: u128 = env.invoke_contract(&router, &symbol_short!("swap"), args);
            assert!(out >= min_out as u128, "slippage_exceeded");
            let args_xfer = vec![
                &env,
                self_addr.clone().into_val(&env),
                receiver.into_val(&env),
                (out as i128).into_val(&env),
            ];
            Self::invoke_with_contract_auth::<()>(&env, &token_out, "transfer", args_xfer);
            return out as i128;
        }
        let args = vec![
            &env,
            caller.into_val(&env),
            pool_id.into_val(&env),
            amount_in.into_val(&env),
            min_out.into_val(&env),
            receiver.into_val(&env),
        ];
        let out: u128 = env.invoke_contract(&router, &symbol_short!("swap"), args);
        assert!(out >= min_out as u128, "slippage_exceeded");
        out as i128
    }

    // Direct swap against Aquarius router using its swap signature.
    // Arguments follow Aquarius router expectations: token_in, token_out, out_min, user, tokens, pool_index, in_amount
    pub fn swap_direct(
        env: Env,
        caller: Address,
        token_in: Address,
        token_out: Address,
        pool_index: soroban_sdk::BytesN<32>,
        in_amount: i128,
        out_min: i128,
        receiver: Address,
    ) -> i128 {
        caller.require_auth();
        assert!(in_amount > 0, "amount_zero");
        assert!(out_min >= 0, "invalid_min_out");
        let store = env.storage().instance();
        let router: Address = store.get(&DataKey::Router).expect("router_not_set");

        let tokens = vec![&env, token_in.clone(), token_out.clone()];
        let args = vec![
            &env,
            receiver.into_val(&env), // user
            tokens.into_val(&env),   // tokens vector (ordered)
            token_in.into_val(&env),
            token_out.into_val(&env),
            pool_index.into_val(&env),
            (in_amount as u128).into_val(&env),
            (out_min as u128).into_val(&env),
        ];
        let out: u128 = env.invoke_contract(&router, &symbol_short!("swap"), args);
        assert!(out >= out_min as u128, "slippage_exceeded");
        out as i128
    }

    // Same as swap_direct but the caller provides the `tokens` vector in the exact order required by Aquarius.
    pub fn swap_with_tokens(
        env: Env,
        caller: Address,
        token_in: Address,
        token_out: Address,
        tokens: Vec<Address>,
        pool_index: soroban_sdk::BytesN<32>,
        in_amount: i128,
        out_min: i128,
        receiver: Address,
    ) -> i128 {
        caller.require_auth();
        assert!(in_amount > 0, "amount_zero");
        assert!(out_min >= 0, "invalid_min_out");
        let router: Address = env
            .storage()
            .instance()
            .get(&DataKey::Router)
            .expect("router_not_set");
        let args = vec![
            &env,
            receiver.into_val(&env), // user
            tokens.into_val(&env),   // tokens vector (ordered)
            token_in.into_val(&env),
            token_out.into_val(&env),
            pool_index.into_val(&env),
            (in_amount as u128).into_val(&env),
            (out_min as u128).into_val(&env),
        ];
        let out: u128 = env.invoke_contract(&router, &symbol_short!("swap"), args);
        assert!(out >= out_min as u128, "slippage_exceeded");
        out as i128
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{contract, contractimpl, testutils::Address as _, Address, Env};

    #[contract]
    struct DummyRouter;
    #[contractimpl]
    impl DummyRouter {
        // Match the adapter.execute signature expectations in tests: returns i128
        pub fn swap(
            _env: Env,
            _caller: Address,
            _pool_id: u128,
            amount_in: i128,
            _min_out: i128,
            _receiver: Address,
        ) -> u128 {
            amount_in as u128
        }
    }

    #[contract]
    struct DummyToken;
    #[contractimpl]
    impl DummyToken {
        pub fn approve(
            _env: Env,
            _from: Address,
            _spender: Address,
            _amount: i128,
            _expiration: u32,
        ) {
        }
        pub fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {}
    }

    mod live_router {
        use super::*;

        #[contract]
        pub struct DummyLiveRouter;
        #[contractimpl]
        impl DummyLiveRouter {
            pub fn get_pool(
                _env: Env,
                _tokens: Vec<Address>,
                _pool_index: soroban_sdk::BytesN<32>,
            ) -> Address {
                Address::generate(&_env)
            }

            #[allow(clippy::too_many_arguments)]
            pub fn swap(
                _env: Env,
                _user: Address,
                _tokens: Vec<Address>,
                _token_in: Address,
                _token_out: Address,
                _pool_index: soroban_sdk::BytesN<32>,
                _in_amount: u128,
                _out_min: u128,
            ) -> u128 {
                133
            }
        }
    }

    #[test]
    fn test_execute_smoke() {
        let env = Env::default();
        let id = env.register_contract(None, AquariusAdapter);
        let client = AquariusAdapterClient::new(&env, &id);
        let admin = Address::generate(&env);
        let router = env.register_contract(None, DummyRouter);
        client.init(&admin, &router);
        assert_eq!(client.router(), router);
        let caller = Address::generate(&env);
        env.mock_all_auths();
        let out = client.execute(&caller, &1u128, &42i128, &40i128, &Address::generate(&env));
        assert_eq!(out, 42);
    }

    #[test]
    fn test_swap_with_tokens_live_signature() {
        let env = Env::default();
        let id = env.register_contract(None, AquariusAdapter);
        let client = AquariusAdapterClient::new(&env, &id);
        let admin = Address::generate(&env);
        let router = env.register_contract(None, live_router::DummyLiveRouter);
        client.init(&admin, &router);
        let caller = Address::generate(&env);
        let receiver = Address::generate(&env);
        let token_in = env.register_contract(None, DummyToken);
        let token_out = env.register_contract(None, DummyToken);
        let tokens = vec![&env, token_in.clone(), token_out.clone()];
        let pool_index = soroban_sdk::BytesN::from_array(&env, &[7u8; 32]);
        env.mock_all_auths();
        client.set_pool_route(&admin, &5u128, &token_in, &token_out, &tokens, &pool_index);
        assert_eq!(client.pool_route(&5u128).pool_index, pool_index.clone());

        let out = client.swap_with_tokens(
            &caller,
            &token_in,
            &token_out,
            &tokens,
            &pool_index,
            &200i128,
            &1i128,
            &receiver,
        );
        assert_eq!(out, 133);
        let routed_out = client.execute(&caller, &5u128, &200i128, &1i128, &receiver);
        assert_eq!(routed_out, 133);
    }
}
