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
    
    
    let admin = Address::generate(&env);
    let router = env.register_contract(None, DummyRouter);
    let id = env.register(BalancedAdapter, (&admin, &router,));
    let client = BalancedAdapterClient::new(&env, &id);
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
    
    
    let admin = Address::generate(&env);
    let router = env.register_contract(None, DummyRouter);
    let id = env.register(BalancedAdapter, (&admin, &router,));
    let client = BalancedAdapterClient::new(&env, &id);
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


#[test]
fn optional_governor_clear_keeps_admin_rotation_and_expiry_enforced() {
    use soroban_sdk::testutils::Ledger as _;
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let governor = Address::generate(&env);
    let replacement = Address::generate(&env);
    let id = env.register(BalancedAdapter, (&admin, &Address::generate(&env)));
    let client = BalancedAdapterClient::new(&env, &id);
    client.set_governor(&admin, &Some(governor));
    client.set_governor(&admin, &None);
    client.set_admin(&admin, &replacement);
    assert!(client.try_set_governor(&admin, &Some(admin.clone())).is_err());
    client.set_bootstrap_admin_expiry(&replacement, &1_010u64);
    env.ledger().set_timestamp(1_020);
    assert!(client.try_set_governor(&replacement, &Some(replacement.clone())).is_err());
}
