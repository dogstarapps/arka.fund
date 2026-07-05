use super::*;
use soroban_sdk::{contract, contractimpl, symbol_short, testutils::Address as _, Env};

#[contract]
struct DummyToken;

#[contractimpl]
impl DummyToken {
    pub fn mint(env: Env, to: Address, amount: i128) {
        let key = (symbol_short!("bal"), to);
        let prev: i128 = env.storage().instance().get(&key).unwrap_or(0);
        env.storage().instance().set(&key, &(prev + amount));
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        let from_key = (symbol_short!("bal"), from.clone());
        let to_key = (symbol_short!("bal"), to);
        let from_bal: i128 = env.storage().instance().get(&from_key).unwrap_or(0);
        assert!(from_bal >= amount, "insufficient_balance");
        env.storage()
            .instance()
            .set(&from_key, &(from_bal - amount));
        let to_bal: i128 = env.storage().instance().get(&to_key).unwrap_or(0);
        env.storage().instance().set(&to_key, &(to_bal + amount));
    }

    pub fn balance(env: Env, owner: Address) -> i128 {
        env.storage()
            .instance()
            .get(&(symbol_short!("bal"), owner))
            .unwrap_or(0)
    }
}

#[test]
fn execute_transfers_default_bonus_and_returns_augmented_amount() {
    let env = Env::default();
    let adapter_id = env.register_contract(None, TestProfitAdapter);
    let adapter = TestProfitAdapterClient::new(&env, &adapter_id);
    let token_id = env.register_contract(None, DummyToken);
    let token = DummyTokenClient::new(&env, &token_id);
    let admin = Address::generate(&env);
    let router = Address::generate(&env);
    let caller = Address::generate(&env);
    let receiver = Address::generate(&env);

    env.mock_all_auths();
    adapter.init(&admin, &router, &token_id, &10i128);
    token.mint(&adapter_id, &125i128);

    let out = adapter.execute(&caller, &1u128, &100i128, &100i128, &receiver);
    assert_eq!(out, 110);
    assert_eq!(token.balance(&receiver), 110);
    assert_eq!(token.balance(&adapter_id), 15);
}

#[test]
fn pool_bonus_overrides_default_bonus() {
    let env = Env::default();
    let adapter_id = env.register_contract(None, TestProfitAdapter);
    let adapter = TestProfitAdapterClient::new(&env, &adapter_id);
    let token_id = env.register_contract(None, DummyToken);
    let token = DummyTokenClient::new(&env, &token_id);
    let admin = Address::generate(&env);
    let router = Address::generate(&env);
    let caller = Address::generate(&env);
    let receiver = Address::generate(&env);

    env.mock_all_auths();
    adapter.init(&admin, &router, &token_id, &5i128);
    adapter.set_pool_bonus(&admin, &7u128, &25i128);
    token.mint(&adapter_id, &140i128);

    let out = adapter.execute(&caller, &7u128, &100i128, &100i128, &receiver);
    assert_eq!(out, 125);
    assert_eq!(adapter.bonus_for(&7u128), 25);
    assert_eq!(token.balance(&receiver), 125);
    assert_eq!(token.balance(&adapter_id), 15);
}
