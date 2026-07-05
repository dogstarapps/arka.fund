use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn test_mint_balance() {
    let env = Env::default();
    let id = env.register_contract(None, GovToken);
    let client = GovTokenClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.init(&admin);

    let user = Address::generate(&env);
    env.mock_all_auths();
    client.mint(&user, &100);
    let b = client.balance(&user);
    assert_eq!(b, 100);
}
