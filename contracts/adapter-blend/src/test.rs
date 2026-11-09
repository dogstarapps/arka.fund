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
    
    
    let admin = Address::generate(&env);
    let router = env.register_contract(None, DummyBlendRouter);
    let id = env.register(BlendAdapter, (&admin, &router,));
    let client = BlendAdapterClient::new(&env, &id);
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
    
    
    let admin = Address::generate(&env);
    let router = env.register_contract(None, DummySubmitRouter);
    let asset = Address::generate(&env);
    let id = env.register(BlendAdapter, (&admin, &router,));
    let client = BlendAdapterClient::new(&env, &id);
    env.mock_all_auths();
    client.set_market_asset(&admin, &7u128, &asset);

    let caller = Address::generate(&env);
    let receiver = Address::generate(&env);
    let out_lend = client.execute(&caller, &Action::Lend, &7u128, &500i128, &receiver);
    assert_eq!(out_lend, 500);

    let out_withdraw = client.execute(&caller, &Action::Withdraw, &7u128, &200i128, &receiver);
    assert_eq!(out_withdraw, 200);
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
    let id = env.register(BlendAdapter, (&admin, &Address::generate(&env)));
    let client = BlendAdapterClient::new(&env, &id);
    client.set_governor(&admin, &Some(governor));
    client.set_governor(&admin, &None);
    client.set_admin(&admin, &replacement);
    assert!(client.try_set_governor(&admin, &Some(admin.clone())).is_err());
    client.set_bootstrap_admin_expiry(&replacement, &1_010u64);
    env.ledger().set_timestamp(1_020);
    assert!(client.try_set_governor(&replacement, &Some(replacement.clone())).is_err());
}
