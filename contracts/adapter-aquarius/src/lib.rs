#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, IntoVal, Vec, vec};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Router,
}

#[contract]
pub struct AquariusAdapter;

#[contractimpl]
impl AquariusAdapter {
    pub fn init(env: Env, admin: Address, router: Address) {
        let store = env.storage().instance();
        assert!(!store.has(&DataKey::Admin), "already_initialized");
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::Router, &router);
    }

    pub fn set_router(env: Env, caller: Address, router: Address) {
        let store = env.storage().instance();
        let admin: Address = store.get(&DataKey::Admin).expect("not_initialized");
        assert!(caller == admin, "only_admin");
        caller.require_auth();
        store.set(&DataKey::Router, &router);
    }

    pub fn execute(env: Env, caller: Address, pool_id: u128, amount_in: i128, min_out: i128, receiver: Address) -> i128 {
        caller.require_auth();
        assert!(amount_in > 0, "amount_zero");
        let store = env.storage().instance();
        let router: Address = store.get(&DataKey::Router).expect("router_not_set");
        let args = vec![
            &env,
            caller.into_val(&env),
            pool_id.into_val(&env),
            amount_in.into_val(&env),
            min_out.into_val(&env),
            receiver.into_val(&env),
        ];
        let out: u128 = env.invoke_contract(&router, &symbol_short!("swap"), args);
        assert!((out as i128) >= min_out, "slippage_exceeded");
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
        let store = env.storage().instance();
        let router: Address = store.get(&DataKey::Router).expect("router_not_set");

        let tokens = vec![&env, token_in.clone(), token_out.clone()];
        let args = vec![
            &env,
            receiver.into_val(&env),                // user
            tokens.into_val(&env),                  // tokens vector (ordered)
            token_in.into_val(&env),
            token_out.into_val(&env),
            pool_index.into_val(&env),
            (in_amount as u128).into_val(&env),
            (out_min as u128).into_val(&env),
        ];
        let out: u128 = env.invoke_contract(&router, &symbol_short!("swap"), args);
        assert!((out as i128) >= out_min, "slippage_exceeded");
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
        let router: Address = env.storage().instance().get(&DataKey::Router).expect("router_not_set");
        let args = vec![
            &env,
            receiver.into_val(&env),                // user
            tokens.into_val(&env),                  // tokens vector (ordered)
            token_in.into_val(&env),
            token_out.into_val(&env),
            pool_index.into_val(&env),
            (in_amount as u128).into_val(&env),
            (out_min as u128).into_val(&env),
        ];
        let out: u128 = env.invoke_contract(&router, &symbol_short!("swap"), args);
        assert!((out as i128) >= out_min, "slippage_exceeded");
        out as i128
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
        pub fn swap(_env: Env, _caller: Address, _pool_id: u128, amount_in: i128, _min_out: i128, _receiver: Address) -> i128 {
            amount_in
        }
    }

    #[test]
    fn test_execute_placeholder() {
        let env = Env::default();
        let id = env.register_contract(None, AquariusAdapter);
        let client = AquariusAdapterClient::new(&env, &id);
        let admin = Address::generate(&env);
        let router = env.register_contract(None, DummyRouter);
        client.init(&admin, &router);
        let caller = Address::generate(&env);
        env.mock_all_auths();
        let out = client.execute(&caller, &1u128, &42i128, &40i128, &Address::generate(&env));
        assert_eq!(out, 42);
    }
}


