use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn init_token(env: &Env) -> (Address, ArkaTokenClient<'_>, Address) {
    let id = env.register_contract(None, ArkaToken);
    let client = ArkaTokenClient::new(env, &id);
    let admin = Address::generate(env);
    client.init(
        &admin,
        &String::from_str(env, "Arka Token"),
        &String::from_str(env, "ARKA"),
        &7u32,
        &Some(1_000i128),
    );
    (id, client, admin)
}

#[test]
fn test_transfer_and_allowance_flow() {
    let env = Env::default();
    env.mock_all_auths();
    let (_id, token, admin) = init_token(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let spender = Address::generate(&env);

    token.mint(&alice, &500);
    token.approve(&alice, &spender, &200);
    token.transfer_from(&spender, &alice, &bob, &150);

    assert_eq!(token.balance(&alice), 350);
    assert_eq!(token.balance(&bob), 150);
    assert_eq!(token.allowance(&alice, &spender), 50);
    assert_eq!(token.total_supply(), 500);
    assert_eq!(token.admin(), admin);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_cap_is_enforced() {
    let env = Env::default();
    env.mock_all_auths();
    let (_id, token, _admin) = init_token(&env);
    let alice = Address::generate(&env);
    token.mint(&alice, &900);
    token.mint(&alice, &200);
}

#[test]
fn test_admin_rotation_and_burn() {
    let env = Env::default();
    env.mock_all_auths();
    let (_id, token, admin) = init_token(&env);
    let next_admin = Address::generate(&env);
    let alice = Address::generate(&env);

    token.mint(&alice, &300);
    token.set_admin(&admin, &next_admin);
    token.admin_burn(&alice, &50);

    assert_eq!(token.admin(), next_admin);
    assert_eq!(token.balance(&alice), 250);
    assert_eq!(token.total_supply(), 250);
}
