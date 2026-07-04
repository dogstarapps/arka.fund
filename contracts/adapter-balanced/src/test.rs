use super::*;
use soroban_sdk::{contract, contractimpl, testutils::Address as _, Address, Env};

#[contract]
struct DummyRouter;
#[contractimpl]
impl DummyRouter {
    pub fn swap(
        _env: Env,
        _caller: Address,
        _pool_id: u128,
        amount_in: i128,
        _min_out: i128,
        _receiver: Address,
    ) -> i128 {
        amount_in - (amount_in / 100)
    }
}

#[test]
fn test_execute_with_router() {
    let env = Env::default();
    let id = env.register_contract(None, BalancedAdapter);
    let client = BalancedAdapterClient::new(&env, &id);
    let admin = Address::generate(&env);
    let router = env.register_contract(None, DummyRouter);
    client.init(&admin, &router);
    let caller = Address::generate(&env);
    env.mock_all_auths();
    client.set_supported_pool(&admin, &1u128, &true);
    let out = client.execute(
        &caller,
        &1u128,
        &1_000i128,
        &980i128,
        &Address::generate(&env),
    );
    assert_eq!(out, 990);
}

#[test]
#[should_panic(expected = "pool_not_supported")]
fn test_execute_requires_supported_pool() {
    let env = Env::default();
    let id = env.register_contract(None, BalancedAdapter);
    let client = BalancedAdapterClient::new(&env, &id);
    let admin = Address::generate(&env);
    let router = env.register_contract(None, DummyRouter);
    client.init(&admin, &router);
    let caller = Address::generate(&env);
    env.mock_all_auths();
    let _ = client.execute(
        &caller,
        &9u128,
        &1_000i128,
        &980i128,
        &Address::generate(&env),
    );
}
