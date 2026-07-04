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
    Path,
    PathForPool(u128),
    LastWasmHash,
}

const MAX_BOOTSTRAP_ADMIN_SECONDS: u64 = 365 * 24 * 60 * 60;

#[contract]
pub struct SoroSwapAdapter;

#[contractimpl]
impl SoroSwapAdapter {
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

    pub fn init(env: Env, admin: Address, router: Address, path: Vec<Address>) {
        let store = env.storage().instance();
        assert!(!store.has(&DataKey::Admin), "already_initialized");
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::Router, &router);
        store.set(&DataKey::Path, &path);
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

    pub fn set_path(env: Env, caller: Address, path: Vec<Address>) {
        Self::require_admin_or_governor_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Path, &path);
    }

    pub fn set_path_for_pool(env: Env, caller: Address, pool_id: u128, path: Vec<Address>) {
        Self::require_admin_or_governor_auth(&env, &caller);
        env.storage()
            .instance()
            .set(&DataKey::PathForPool(pool_id), &path);
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

    pub fn path_for_pool(env: Env, pool_id: u128) -> Vec<Address> {
        let store = env.storage().instance();
        store
            .get(&DataKey::PathForPool(pool_id))
            .or_else(|| store.get(&DataKey::Path))
            .expect("path_not_set")
    }

    // Unified adapter interface: execute(caller, _pool_id, amount_in, min_out, receiver) -> amount_out
    // Assumptions:
    //  - Token_in amount has already been transferred into this adapter contract by the caller
    //  - `receiver` is where resulting token_out will be transferred after swap
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
        let store = env.storage().instance();
        let router: Address = store.get(&DataKey::Router).expect("router_not_set");
        let path: Vec<Address> = store
            .get(&DataKey::PathForPool(pool_id))
            .or_else(|| store.get(&DataKey::Path))
            .expect("path_not_set");
        let self_addr = env.current_contract_address();
        // Determine token_in as the first address in the path
        let mut token_in_opt: Option<Address> = None;
        for addr in path.iter() {
            token_in_opt = Some(addr);
            break;
        }
        let token_in: Address = token_in_opt.expect("path_empty");
        // Approve router to spend from this adapter balance
        let exp: u32 = env.ledger().sequence() + 100_000u32;
        let args_approve = vec![
            &env,
            self_addr.clone().into_val(&env),
            router.clone().into_val(&env),
            amount_in.into_val(&env),
            exp.into_val(&env),
        ];
        Self::invoke_with_contract_auth::<()>(&env, &token_in, "approve", args_approve);
        // deadline: use ledger timestamp + 1800s (30 minutes)
        let deadline: u64 = env.ledger().timestamp() + 1800u64;
        let args = vec![
            &env,
            amount_in.into_val(&env),
            min_out.into_val(&env),
            path.into_val(&env),
            self_addr.clone().into_val(&env),
            deadline.into_val(&env),
        ];
        let mut token_out_opt: Option<Address> = None;
        for addr in path.iter() {
            token_out_opt = Some(addr);
        }
        let token_out = token_out_opt.expect("path_empty");
        let pair_args = vec![
            &env,
            token_in.clone().into_val(&env),
            token_out.clone().into_val(&env),
        ];
        let pair: Address =
            env.invoke_contract(&router, &Symbol::new(&env, "router_pair_for"), pair_args);
        let router_transfer_auth =
            Self::transfer_auth(&env, &token_in, &self_addr, &pair, amount_in);
        let router_auth = Self::contract_auth(&env, &router, "swap_exact_tokens_for_tokens", &args);
        env.authorize_as_current_contract(vec![&env, router_auth, router_transfer_auth]);
        // call Soroswap router swap_exact_tokens_for_tokens
        let func = Symbol::new(&env, "swap_exact_tokens_for_tokens");
        let amounts: Vec<i128> = env.invoke_contract(&router, &func, args);
        // the last element should be amount_out
        let mut out: i128 = 0;
        for v in amounts.iter() {
            out = v;
        }
        assert!(out >= min_out, "slippage_exceeded");
        // Transfer token_out from adapter to receiver
        // token_out is the last element in path
        let args_xfer = vec![
            &env,
            self_addr.clone().into_val(&env),
            receiver.into_val(&env),
            out.into_val(&env),
        ];
        Self::invoke_with_contract_auth::<()>(&env, &token_out, "transfer", args_xfer);
        out
    }
}

#[cfg(test)]
mod test;
