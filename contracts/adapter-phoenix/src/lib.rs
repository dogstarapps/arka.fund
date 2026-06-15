#![no_std]
use soroban_sdk::auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation};
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, vec, Address, BytesN, Env, IntoVal, Symbol,
    TryFromVal, Val, Vec,
};

const DEFAULT_DEADLINE_SECS: u64 = 1_800;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Governor,
    BootstrapAdminExpiresAt,
    PoolRoute(u128),
    LastWasmHash,
}

const MAX_BOOTSTRAP_ADMIN_SECONDS: u64 = 365 * 24 * 60 * 60;

#[derive(Clone)]
#[contracttype]
pub struct PhoenixPoolRoute {
    pub pool: Address,
    pub token_in: Address,
    pub token_out: Address,
    pub max_spread_bps: i64,
    pub max_allowed_fee_bps: i64,
}

#[contract]
pub struct PhoenixAdapter;

#[contractimpl]
impl PhoenixAdapter {
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

    pub fn init(env: Env, admin: Address) {
        let store = env.storage().instance();
        assert!(!store.has(&DataKey::Admin), "already_initialized");
        store.set(&DataKey::Admin, &admin);
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

    pub fn set_pool_route(
        env: Env,
        caller: Address,
        pool_id: u128,
        pool: Address,
        token_in: Address,
        token_out: Address,
        max_spread_bps: i64,
        max_allowed_fee_bps: i64,
    ) {
        Self::require_admin_or_governor_auth(&env, &caller);
        assert!(max_spread_bps >= 0, "invalid_max_spread");
        assert!(max_allowed_fee_bps >= 0, "invalid_max_fee");
        env.storage().instance().set(
            &DataKey::PoolRoute(pool_id),
            &PhoenixPoolRoute {
                pool,
                token_in,
                token_out,
                max_spread_bps,
                max_allowed_fee_bps,
            },
        );
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

    pub fn pool_route(env: Env, pool_id: u128) -> PhoenixPoolRoute {
        env.storage()
            .instance()
            .get(&DataKey::PoolRoute(pool_id))
            .expect("pool_route_not_set")
    }

    pub fn execute(
        env: Env,
        _caller: Address,
        pool_id: u128,
        amount_in: i128,
        min_out: i128,
        receiver: Address,
    ) -> i128 {
        assert!(amount_in > 0, "amount_zero");
        assert!(min_out >= 0, "invalid_min_out");

        let route: PhoenixPoolRoute = env
            .storage()
            .instance()
            .get(&DataKey::PoolRoute(pool_id))
            .expect("pool_route_not_set");
        let self_addr = env.current_contract_address();
        let ask_asset_min_amount: Option<i128> = if min_out > 0 { Some(min_out) } else { None };
        let max_spread_bps: Option<i64> = if route.max_spread_bps > 0 {
            Some(route.max_spread_bps)
        } else {
            None
        };
        let deadline: Option<u64> = Some(env.ledger().timestamp() + DEFAULT_DEADLINE_SECS);
        let max_allowed_fee_bps: Option<i64> = if route.max_allowed_fee_bps > 0 {
            Some(route.max_allowed_fee_bps)
        } else {
            None
        };
        let args = vec![
            &env,
            self_addr.clone().into_val(&env),
            route.token_in.clone().into_val(&env),
            amount_in.into_val(&env),
            ask_asset_min_amount.into_val(&env),
            max_spread_bps.into_val(&env),
            deadline.into_val(&env),
            max_allowed_fee_bps.into_val(&env),
        ];
        let pool_swap_auth = Self::contract_auth(&env, &route.pool, "swap", &args);
        let pool_transfer_auth =
            Self::transfer_auth(&env, &route.token_in, &self_addr, &route.pool, amount_in);
        env.authorize_as_current_contract(vec![&env, pool_swap_auth, pool_transfer_auth]);

        let out: i128 = env.invoke_contract(&route.pool, &Symbol::new(&env, "swap"), args);
        assert!(out >= min_out, "slippage_exceeded");

        let transfer_args = vec![
            &env,
            self_addr.clone().into_val(&env),
            receiver.into_val(&env),
            out.into_val(&env),
        ];
        Self::invoke_with_contract_auth::<()>(&env, &route.token_out, "transfer", transfer_args);
        out
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        contract, contractimpl, symbol_short, testutils::Address as _, Address, Env,
    };

    #[derive(Clone)]
    #[contracttype]
    enum TokenKey {
        Balance(Address),
    }

    #[contract]
    struct DummyToken;

    #[contractimpl]
    impl DummyToken {
        pub fn mint(env: Env, to: Address, amount: i128) {
            let key = TokenKey::Balance(to.clone());
            let current = Self::balance(env.clone(), to);
            env.storage().instance().set(&key, &(current + amount));
        }

        pub fn balance(env: Env, id: Address) -> i128 {
            env.storage()
                .instance()
                .get(&TokenKey::Balance(id))
                .unwrap_or(0)
        }

        pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
            from.require_auth();
            let from_key = TokenKey::Balance(from.clone());
            let to_key = TokenKey::Balance(to.clone());
            let from_balance: i128 = env.storage().instance().get(&from_key).unwrap_or(0);
            assert!(from_balance >= amount, "insufficient_balance");
            let to_balance: i128 = env.storage().instance().get(&to_key).unwrap_or(0);
            env.storage()
                .instance()
                .set(&from_key, &(from_balance - amount));
            env.storage()
                .instance()
                .set(&to_key, &(to_balance + amount));
        }
    }

    #[derive(Clone)]
    #[contracttype]
    enum PoolKey {
        TokenOut,
    }

    #[contract]
    struct DummyPhoenixPool;

    #[contractimpl]
    impl DummyPhoenixPool {
        pub fn init(env: Env, token_out: Address) {
            env.storage().instance().set(&PoolKey::TokenOut, &token_out);
        }

        pub fn swap(
            env: Env,
            sender: Address,
            offer_asset: Address,
            offer_amount: i128,
            ask_asset_min_amount: Option<i128>,
            _max_spread_bps: Option<i64>,
            deadline: Option<u64>,
            _max_allowed_fee_bps: Option<i64>,
        ) -> i128 {
            sender.require_auth();
            if let Some(deadline) = deadline {
                assert!(env.ledger().timestamp() <= deadline, "deadline_elapsed");
            }
            let output = offer_amount + 7;
            if let Some(min_out) = ask_asset_min_amount {
                assert!(output >= min_out, "min_out_not_met");
            }
            let token_out: Address = env
                .storage()
                .instance()
                .get(&PoolKey::TokenOut)
                .expect("token_out_not_set");
            let pool = env.current_contract_address();
            env.invoke_contract::<()>(
                &offer_asset,
                &symbol_short!("transfer"),
                vec![
                    &env,
                    sender.clone().into_val(&env),
                    pool.clone().into_val(&env),
                    offer_amount.into_val(&env),
                ],
            );
            env.invoke_contract::<()>(
                &token_out,
                &symbol_short!("transfer"),
                vec![
                    &env,
                    pool.into_val(&env),
                    sender.into_val(&env),
                    output.into_val(&env),
                ],
            );
            output
        }
    }

    #[test]
    fn test_execute_swaps_through_phoenix_pool_and_sends_output_to_receiver() {
        let env = Env::default();
        let id = env.register_contract(None, PhoenixAdapter);
        let client = PhoenixAdapterClient::new(&env, &id);
        let admin = Address::generate(&env);
        let caller = Address::generate(&env);
        let receiver = Address::generate(&env);
        let token_in = env.register_contract(None, DummyToken);
        let token_out = env.register_contract(None, DummyToken);
        let token_in_client = DummyTokenClient::new(&env, &token_in);
        let token_out_client = DummyTokenClient::new(&env, &token_out);
        let pool = env.register_contract(None, DummyPhoenixPool);
        let pool_client = DummyPhoenixPoolClient::new(&env, &pool);

        client.init(&admin);
        env.mock_all_auths();
        pool_client.init(&token_out);
        client.set_pool_route(&admin, &1u128, &pool, &token_in, &token_out, &100, &30);
        token_in_client.mint(&id, &100);
        token_out_client.mint(&pool, &200);

        let out = client.execute(&caller, &1u128, &100, &95, &receiver);

        assert_eq!(out, 107);
        assert_eq!(token_in_client.balance(&id), 0);
        assert_eq!(token_in_client.balance(&pool), 100);
        assert_eq!(token_out_client.balance(&id), 0);
        assert_eq!(token_out_client.balance(&receiver), 107);
    }

    #[test]
    #[should_panic(expected = "pool_route_not_set")]
    fn test_execute_requires_pool_route() {
        let env = Env::default();
        let id = env.register_contract(None, PhoenixAdapter);
        let client = PhoenixAdapterClient::new(&env, &id);
        env.mock_all_auths();
        client.execute(
            &Address::generate(&env),
            &7u128,
            &100,
            &90,
            &Address::generate(&env),
        );
    }

    #[test]
    #[should_panic(expected = "only_admin")]
    fn test_pool_route_is_admin_gated() {
        let env = Env::default();
        let id = env.register_contract(None, PhoenixAdapter);
        let client = PhoenixAdapterClient::new(&env, &id);
        let admin = Address::generate(&env);
        let caller = Address::generate(&env);
        let pool = Address::generate(&env);
        let token_in = Address::generate(&env);
        let token_out = Address::generate(&env);

        client.init(&admin);
        env.mock_all_auths();
        client.set_pool_route(&caller, &1u128, &pool, &token_in, &token_out, &100, &30);
    }
}
