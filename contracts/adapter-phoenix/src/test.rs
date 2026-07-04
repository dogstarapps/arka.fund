use super::*;
use soroban_sdk::{contract, contractimpl, symbol_short, testutils::Address as _, Address, Env};

#[derive(Clone)]
#[contracttype]
enum TokenKey {
    Balance(Address),
}

#[contract]
struct DummyToken;

#[contractimpl]
impl DummyToken {
    pub fn mint(env: Env, to: Address, amount: i128) {
        let key = TokenKey::Balance(to.clone());
        let current = Self::balance(env.clone(), to);
        env.storage().instance().set(&key, &(current + amount));
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage()
            .instance()
            .get(&TokenKey::Balance(id))
            .unwrap_or(0)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        let from_key = TokenKey::Balance(from.clone());
        let to_key = TokenKey::Balance(to.clone());
        let from_balance: i128 = env.storage().instance().get(&from_key).unwrap_or(0);
        assert!(from_balance >= amount, "insufficient_balance");
        let to_balance: i128 = env.storage().instance().get(&to_key).unwrap_or(0);
        env.storage()
            .instance()
            .set(&from_key, &(from_balance - amount));
        env.storage()
            .instance()
            .set(&to_key, &(to_balance + amount));
    }
}

#[derive(Clone)]
#[contracttype]
enum PoolKey {
    TokenOut,
}

#[contract]
struct DummyPhoenixPool;

#[contractimpl]
impl DummyPhoenixPool {
    pub fn init(env: Env, token_out: Address) {
        env.storage().instance().set(&PoolKey::TokenOut, &token_out);
    }

    pub fn swap(
        env: Env,
        sender: Address,
        offer_asset: Address,
        offer_amount: i128,
        ask_asset_min_amount: Option<i128>,
        _max_spread_bps: Option<i64>,
        deadline: Option<u64>,
        _max_allowed_fee_bps: Option<i64>,
    ) -> i128 {
        sender.require_auth();
        if let Some(deadline) = deadline {
            assert!(env.ledger().timestamp() <= deadline, "deadline_elapsed");
        }
        let output = offer_amount + 7;
        if let Some(min_out) = ask_asset_min_amount {
            assert!(output >= min_out, "min_out_not_met");
        }
        let token_out: Address = env
            .storage()
            .instance()
            .get(&PoolKey::TokenOut)
            .expect("token_out_not_set");
        let pool = env.current_contract_address();
        env.invoke_contract::<()>(
            &offer_asset,
            &symbol_short!("transfer"),
            vec![
                &env,
                sender.clone().into_val(&env),
                pool.clone().into_val(&env),
                offer_amount.into_val(&env),
            ],
        );
        env.invoke_contract::<()>(
            &token_out,
            &symbol_short!("transfer"),
            vec![
                &env,
                pool.into_val(&env),
                sender.into_val(&env),
                output.into_val(&env),
            ],
        );
        output
    }
}

#[test]
fn test_execute_swaps_through_phoenix_pool_and_sends_output_to_receiver() {
    let env = Env::default();
    let id = env.register_contract(None, PhoenixAdapter);
    let client = PhoenixAdapterClient::new(&env, &id);
    let admin = Address::generate(&env);
    let caller = Address::generate(&env);
    let receiver = Address::generate(&env);
    let token_in = env.register_contract(None, DummyToken);
    let token_out = env.register_contract(None, DummyToken);
    let token_in_client = DummyTokenClient::new(&env, &token_in);
    let token_out_client = DummyTokenClient::new(&env, &token_out);
    let pool = env.register_contract(None, DummyPhoenixPool);
    let pool_client = DummyPhoenixPoolClient::new(&env, &pool);

    client.init(&admin);
    env.mock_all_auths();
    pool_client.init(&token_out);
    client.set_pool_route(&admin, &1u128, &pool, &token_in, &token_out, &100, &30);
    token_in_client.mint(&id, &100);
    token_out_client.mint(&pool, &200);

    let out = client.execute(&caller, &1u128, &100, &95, &receiver);

    assert_eq!(out, 107);
    assert_eq!(token_in_client.balance(&id), 0);
    assert_eq!(token_in_client.balance(&pool), 100);
    assert_eq!(token_out_client.balance(&id), 0);
    assert_eq!(token_out_client.balance(&receiver), 107);
}

#[test]
#[should_panic]
fn test_execute_requires_caller_auth() {
    let env = Env::default();
    let id = env.register_contract(None, PhoenixAdapter);
    let client = PhoenixAdapterClient::new(&env, &id);
    let admin = Address::generate(&env);
    let caller = Address::generate(&env);
    let receiver = Address::generate(&env);
    let token_in = env.register_contract(None, DummyToken);
    let token_out = env.register_contract(None, DummyToken);
    let pool = env.register_contract(None, DummyPhoenixPool);

    client.init(&admin);
    client
        .mock_all_auths()
        .set_pool_route(&admin, &1u128, &pool, &token_in, &token_out, &100, &30);

    client.execute(&caller, &1u128, &100, &95, &receiver);
}

#[test]
#[should_panic(expected = "pool_route_not_set")]
fn test_execute_requires_pool_route() {
    let env = Env::default();
    let id = env.register_contract(None, PhoenixAdapter);
    let client = PhoenixAdapterClient::new(&env, &id);
    env.mock_all_auths();
    client.execute(
        &Address::generate(&env),
        &7u128,
        &100,
        &90,
        &Address::generate(&env),
    );
}

#[test]
#[should_panic(expected = "only_admin")]
fn test_pool_route_is_admin_gated() {
    let env = Env::default();
    let id = env.register_contract(None, PhoenixAdapter);
    let client = PhoenixAdapterClient::new(&env, &id);
    let admin = Address::generate(&env);
    let caller = Address::generate(&env);
    let pool = Address::generate(&env);
    let token_in = Address::generate(&env);
    let token_out = Address::generate(&env);

    client.init(&admin);
    env.mock_all_auths();
    client.set_pool_route(&caller, &1u128, &pool, &token_in, &token_out, &100, &30);
}
