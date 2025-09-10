#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, IntoVal, Vec, vec, Symbol};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Router,
    Path,
}

#[contract]
pub struct SoroSwapAdapter;

#[contractimpl]
impl SoroSwapAdapter {
    pub fn init(env: Env, admin: Address, router: Address, path: Vec<Address>) {
        let store = env.storage().instance();
        assert!(!store.has(&DataKey::Admin), "already_initialized");
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::Router, &router);
        store.set(&DataKey::Path, &path);
    }

    pub fn set_router(env: Env, caller: Address, router: Address) {
        let store = env.storage().instance();
        let admin: Address = store.get(&DataKey::Admin).expect("not_initialized");
        assert!(caller == admin, "only_admin");
        caller.require_auth();
        store.set(&DataKey::Router, &router);
    }

    pub fn set_path(env: Env, caller: Address, path: Vec<Address>) {
        let store = env.storage().instance();
        let admin: Address = store.get(&DataKey::Admin).expect("not_initialized");
        assert!(caller == admin, "only_admin");
        caller.require_auth();
        store.set(&DataKey::Path, &path);
    }

    // Unified adapter interface: execute(caller, _pool_id, amount_in, min_out, receiver) -> amount_out
    pub fn execute(env: Env, caller: Address, _pool_id: u128, amount_in: i128, min_out: i128, receiver: Address) -> i128 {
        caller.require_auth();
        assert!(amount_in > 0, "amount_zero");
        let store = env.storage().instance();
        let router: Address = store.get(&DataKey::Router).expect("router_not_set");
        let path: Vec<Address> = store.get(&DataKey::Path).expect("path_not_set");
        // deadline: use ledger timestamp + 1800s (30 minutes)
        let deadline: u64 = env.ledger().timestamp() + 1800u64;
        let args = vec![
            &env,
            amount_in.into_val(&env),
            min_out.into_val(&env),
            path.into_val(&env),
            receiver.into_val(&env),
            deadline.into_val(&env),
        ];
        // call Soroswap router swap_exact_tokens_for_tokens
        let func = Symbol::new(&env, "swap_exact_tokens_for_tokens");
        let amounts: Vec<i128> = env.invoke_contract(&router, &func, args);
        // the last element should be amount_out
        let mut out: i128 = 0;
        for v in amounts.iter() { out = v; }
        assert!(out >= min_out, "slippage_exceeded");
        out
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, Address, contract, contractimpl};

    #[contract]
    struct DummyRouter;
    #[contractimpl]
    impl DummyRouter {
        pub fn swap_exact_tokens_for_tokens(_env: Env, amount_in: i128, amount_out_min: i128, _path: Vec<Address>, _to: Address, _deadline: u64) -> Vec<i128> {
            let _ = amount_out_min;
            let env = _env.clone();
            Vec::from_array(&env, [amount_in / 2, amount_in])
        }
    }

    #[test]
    fn test_execute_placeholder() {
        let env = Env::default();
        let id = env.register_contract(None, SoroSwapAdapter);
        let client = SoroSwapAdapterClient::new(&env, &id);
        let admin = Address::generate(&env);
        let router = env.register_contract(None, DummyRouter);
        let token_a = Address::generate(&env);
        let token_b = Address::generate(&env);
        let path = Vec::from_array(&env, [token_a, token_b]);
        client.init(&admin, &router, &path);
        let caller = Address::generate(&env);
        env.mock_all_auths();
        let out = client.execute(&caller, &0u128, &22i128, &21i128, &Address::generate(&env));
        assert!(out >= 21);
    }
}

