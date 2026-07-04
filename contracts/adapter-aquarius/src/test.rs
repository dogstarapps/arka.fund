use super::*;
use soroban_sdk::{contract, contractimpl, testutils::Address as _, Address, Env};

#[contract]
struct DummyRouter;
#[contractimpl]
impl DummyRouter {
    // Match the adapter.execute signature expectations in tests: returns i128
    pub fn swap(
        _env: Env,
        _caller: Address,
        _pool_id: u128,
        amount_in: i128,
        _min_out: i128,
        _receiver: Address,
    ) -> u128 {
        amount_in as u128
    }
}

#[contract]
struct DummyToken;
#[contractimpl]
impl DummyToken {
    pub fn approve(_env: Env, _from: Address, _spender: Address, _amount: i128, _expiration: u32) {}
    pub fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {}
}

mod live_router {
    use super::*;

    #[contract]
    pub struct DummyLiveRouter;
    #[contractimpl]
    impl DummyLiveRouter {
        pub fn get_pool(
            _env: Env,
            _tokens: Vec<Address>,
            _pool_index: soroban_sdk::BytesN<32>,
        ) -> Address {
            Address::generate(&_env)
        }

        #[allow(clippy::too_many_arguments)]
        pub fn swap(
            _env: Env,
            _user: Address,
            _tokens: Vec<Address>,
            _token_in: Address,
            _token_out: Address,
            _pool_index: soroban_sdk::BytesN<32>,
            _in_amount: u128,
            _out_min: u128,
        ) -> u128 {
            133
        }
    }
}

#[test]
fn test_execute_smoke() {
    let env = Env::default();
    let id = env.register_contract(None, AquariusAdapter);
    let client = AquariusAdapterClient::new(&env, &id);
    let admin = Address::generate(&env);
    let router = env.register_contract(None, DummyRouter);
    client.init(&admin, &router);
    assert_eq!(client.router(), router);
    let caller = Address::generate(&env);
    env.mock_all_auths();
    let out = client.execute(&caller, &1u128, &42i128, &40i128, &Address::generate(&env));
    assert_eq!(out, 42);
}

#[test]
fn test_swap_with_tokens_live_signature() {
    let env = Env::default();
    let id = env.register_contract(None, AquariusAdapter);
    let client = AquariusAdapterClient::new(&env, &id);
    let admin = Address::generate(&env);
    let router = env.register_contract(None, live_router::DummyLiveRouter);
    client.init(&admin, &router);
    let caller = Address::generate(&env);
    let receiver = Address::generate(&env);
    let token_in = env.register_contract(None, DummyToken);
    let token_out = env.register_contract(None, DummyToken);
    let tokens = vec![&env, token_in.clone(), token_out.clone()];
    let pool_index = soroban_sdk::BytesN::from_array(&env, &[7u8; 32]);
    env.mock_all_auths();
    client.set_pool_route(&admin, &5u128, &token_in, &token_out, &tokens, &pool_index);
    assert_eq!(client.pool_route(&5u128).pool_index, pool_index.clone());

    let out = client.swap_with_tokens(
        &caller,
        &token_in,
        &token_out,
        &tokens,
        &pool_index,
        &200i128,
        &1i128,
        &receiver,
    );
    assert_eq!(out, 133);
    let routed_out = client.execute(&caller, &5u128, &200i128, &1i128, &receiver);
    assert_eq!(routed_out, 133);
}
