use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn init_token(env: &Env) -> (Address, ArkaTokenClient<'_>, Address) {
    
    
    let admin = Address::generate(env);
    let id = env.register(ArkaToken, (&admin,
        &String::from_str(env, "Arka Token"),
        &String::from_str(env, "ARKA"),
        &7u32,
        &Some(1_000i128),));
    let client = ArkaTokenClient::new(env, &id);
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


#[test]
fn optional_governor_clear_keeps_admin_rotation_and_expiry_enforced() {
    use soroban_sdk::testutils::Ledger as _;
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let replacement = Address::generate(&env);
    let id = env.register(ArkaToken, (&admin, &String::from_str(&env,"Arka"), &String::from_str(&env,"ARKA"), &7u32, &None::<i128>));
    let client = ArkaTokenClient::new(&env, &id);
    client.set_governor(&admin, &None);
    client.set_admin(&admin, &replacement);
    assert!(client.try_set_governor(&admin, &Some(admin.clone())).is_err());
    client.set_bootstrap_admin_expiry(&replacement, &1_010u64);
    env.ledger().set_timestamp(1_020);
    assert!(client.try_set_governor(&replacement, &Some(replacement.clone())).is_err());
}
