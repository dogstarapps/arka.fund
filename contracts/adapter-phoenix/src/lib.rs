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
        caller: Address,
        pool_id: u128,
        amount_in: i128,
        min_out: i128,
        receiver: Address,
    ) -> i128 {
        caller.require_auth();
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
mod test;
