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
    // Assumptions:
    //  - Token_in amount has already been transferred into this adapter contract by the caller
    //  - `receiver` is where resulting token_out will be transferred after swap
    pub fn execute(env: Env, _caller: Address, _pool_id: u128, amount_in: i128, min_out: i128, receiver: Address) -> i128 {
        assert!(amount_in > 0, "amount_zero");
        let store = env.storage().instance();
        let router: Address = store.get(&DataKey::Router).expect("router_not_set");
        let path: Vec<Address> = store.get(&DataKey::Path).expect("path_not_set");
        let self_addr = env.current_contract_address();
        // Determine token_in as the first address in the path
        let mut token_in_opt: Option<Address> = None;
        for addr in path.iter() { token_in_opt = Some(addr); break; }
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
        let _ = env.invoke_contract::<()>(&token_in, &Symbol::new(&env, "approve"), args_approve);
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
        // call Soroswap router swap_exact_tokens_for_tokens
        let func = Symbol::new(&env, "swap_exact_tokens_for_tokens");
        let amounts: Vec<i128> = env.invoke_contract(&router, &func, args);
        // the last element should be amount_out
        let mut out: i128 = 0;
        for v in amounts.iter() { out = v; }
        assert!(out >= min_out, "slippage_exceeded");
        // Transfer token_out from adapter to receiver
        // token_out is the last element in path
        let mut token_out_opt: Option<Address> = None;
        for addr in path.iter() { token_out_opt = Some(addr); }
        let token_out = token_out_opt.expect("path_empty");
        let args_xfer = vec![
            &env,
            self_addr.clone().into_val(&env),
            receiver.into_val(&env),
            out.into_val(&env),
        ];
        let _ = env.invoke_contract::<()>(&token_out, &Symbol::new(&env, "transfer"), args_xfer);
        out
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, Address, contract, contractimpl};

    #[contract]
    struct DummyToken;
    #[contractimpl]
    impl DummyToken {
        pub fn approve(_env: Env, _from: Address, _spender: Address, _amount: i128, _expiration: u32) {}
        pub fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {}
    }

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
    fn test_execute_smoke() {
        let env = Env::default();
        let id = env.register_contract(None, SoroSwapAdapter);
        let client = SoroSwapAdapterClient::new(&env, &id);
        let admin = Address::generate(&env);
        let router = env.register_contract(None, DummyRouter);
        let token_a = env.register_contract(None, DummyToken);
        let token_b = env.register_contract(None, DummyToken);
        let path = Vec::from_array(&env, [token_a, token_b]);
        client.init(&admin, &router, &path);
        let caller = Address::generate(&env);
        env.mock_all_auths();
        let out = client.execute(&caller, &0u128, &22i128, &21i128, &Address::generate(&env));
        assert!(out >= 21);
    }
}
