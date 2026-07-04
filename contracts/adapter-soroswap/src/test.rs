use super::*;
use soroban_sdk::{contract, contractimpl, testutils::Address as _, Address, Env};

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
    pub fn router_pair_for(_env: Env, _token_a: Address, _token_b: Address) -> Address {
        Address::generate(&_env)
    }

    pub fn swap_exact_tokens_for_tokens(
        _env: Env,
        amount_in: i128,
        amount_out_min: i128,
        _path: Vec<Address>,
        _to: Address,
        _deadline: u64,
    ) -> Vec<i128> {
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
    let path = Vec::from_array(&env, [token_a.clone(), token_b.clone()]);
    client.init(&admin, &router, &path);
    assert_eq!(client.router(), router);
    env.mock_all_auths();
    let pool_path = Vec::from_array(&env, [token_a, token_b]);
    client.set_path_for_pool(&admin, &7u128, &pool_path);
    assert_eq!(client.path_for_pool(&7u128), pool_path);
    let caller = Address::generate(&env);
    let out = client.execute(&caller, &7u128, &22i128, &21i128, &Address::generate(&env));
    assert!(out >= 21);
}

#[test]
#[should_panic]
fn test_execute_requires_caller_auth() {
    let env = Env::default();
    let id = env.register_contract(None, SoroSwapAdapter);
    let client = SoroSwapAdapterClient::new(&env, &id);
    let admin = Address::generate(&env);
    let router = env.register_contract(None, DummyRouter);
    let token_a = env.register_contract(None, DummyToken);
    let token_b = env.register_contract(None, DummyToken);
    let path = Vec::from_array(&env, [token_a, token_b]);

    client.init(&admin, &router, &path);
    client.execute(
        &Address::generate(&env),
        &7u128,
        &22i128,
        &21i128,
        &Address::generate(&env),
    );
}
