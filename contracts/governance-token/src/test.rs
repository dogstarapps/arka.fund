use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn test_mint_balance() {
    let env = Env::default();
    
    
    let admin = Address::generate(&env);
    let id = env.register(GovToken, (&admin,));
    let client = GovTokenClient::new(&env, &id);

    let user = Address::generate(&env);
    env.mock_all_auths();
    client.mint(&user, &100);
    let b = client.balance(&user);
    assert_eq!(b, 100);
}


#[test]
fn optional_governor_clear_keeps_admin_rotation_and_expiry_enforced() {
    use soroban_sdk::testutils::Ledger as _;
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let replacement = Address::generate(&env);
    let id = env.register(GovToken, (&admin,));
    let client = GovTokenClient::new(&env, &id);
    client.set_governor(&admin, &None);
    client.set_admin(&admin, &replacement);
    assert!(client.try_set_governor(&admin, &Some(admin.clone())).is_err());
    client.set_bootstrap_admin_expiry(&replacement, &1_010u64);
    env.ledger().set_timestamp(1_020);
    assert!(client.try_set_governor(&replacement, &Some(replacement.clone())).is_err());
}
