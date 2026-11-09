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
    
    
    let admin = Address::generate(&env);
    let router = env.register_contract(None, DummyRouter);
    let token_a = env.register_contract(None, DummyToken);
    let token_b = env.register_contract(None, DummyToken);
    let path = Vec::from_array(&env, [token_a.clone(), token_b.clone()]);
    let id = env.register(SoroSwapAdapter, (&admin, &router, &path,));
    let client = SoroSwapAdapterClient::new(&env, &id);
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
    
    
    let admin = Address::generate(&env);
    let router = env.register_contract(None, DummyRouter);
    let token_a = env.register_contract(None, DummyToken);
    let token_b = env.register_contract(None, DummyToken);
    let path = Vec::from_array(&env, [token_a, token_b]);

    let id = env.register(SoroSwapAdapter, (&admin, &router, &path,));
    let client = SoroSwapAdapterClient::new(&env, &id);
    client.execute(
        &Address::generate(&env),
        &7u128,
        &22i128,
        &21i128,
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
    let id = env.register(SoroSwapAdapter, (&admin, &Address::generate(&env), &Vec::<Address>::new(&env)));
    let client = SoroSwapAdapterClient::new(&env, &id);
    client.set_governor(&admin, &Some(governor));
    client.set_governor(&admin, &None);
    client.set_admin(&admin, &replacement);
    assert!(client.try_set_governor(&admin, &Some(admin.clone())).is_err());
    client.set_bootstrap_admin_expiry(&replacement, &1_010u64);
    env.ledger().set_timestamp(1_020);
    assert!(client.try_set_governor(&replacement, &Some(replacement.clone())).is_err());
}
