use super::*;
use soroban_sdk::{contract, contractimpl, testutils::Address as _, Address, Env};

#[contract]
struct DummyBlendRouter;
#[contractimpl]
impl DummyBlendRouter {
    pub fn execute_action(
        _env: Env,
        _caller: Address,
        action: u32,
        _market_id: u128,
        amount: i128,
        _receiver: Address,
    ) -> i128 {
        match action {
            0 => amount,
            1 => (amount * 95) / 100,
            2 => amount,
            3 => (amount * 90) / 100,
            _ => 0,
        }
    }
}

#[contract]
struct DummySubmitRouter;
#[contractimpl]
impl DummySubmitRouter {
    pub fn submit(
        _env: Env,
        _from: Address,
        _spender: Address,
        _to: Address,
        _requests: soroban_sdk::Vec<Request>,
    ) {
    }
}

#[test]
fn test_execute_lend_and_borrow() {
    let env = Env::default();
    let id = env.register_contract(None, BlendAdapter);
    let client = BlendAdapterClient::new(&env, &id);
    let admin = Address::generate(&env);
    let router = env.register_contract(None, DummyBlendRouter);
    client.init(&admin, &router);
    let caller = Address::generate(&env);
    let receiver = Address::generate(&env);
    env.mock_all_auths();

    let out_lend = client.execute(&caller, &Action::Lend, &7u128, &1_000i128, &receiver);
    assert_eq!(out_lend, 1_000);
    let out_borrow = client.execute(&caller, &Action::Borrow, &7u128, &1_000i128, &receiver);
    assert_eq!(out_borrow, 950);
}

#[test]
fn test_execute_submit_path_with_market_asset() {
    let env = Env::default();
    let id = env.register_contract(None, BlendAdapter);
    let client = BlendAdapterClient::new(&env, &id);
    let admin = Address::generate(&env);
    let router = env.register_contract(None, DummySubmitRouter);
    let asset = Address::generate(&env);
    client.init(&admin, &router);
    env.mock_all_auths();
    client.set_market_asset(&admin, &7u128, &asset);

    let caller = Address::generate(&env);
    let receiver = Address::generate(&env);
    let out_lend = client.execute(&caller, &Action::Lend, &7u128, &500i128, &receiver);
    assert_eq!(out_lend, 500);

    let out_withdraw = client.execute(&caller, &Action::Withdraw, &7u128, &200i128, &receiver);
    assert_eq!(out_withdraw, 200);
}
