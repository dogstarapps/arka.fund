use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn test_points_and_tiers() {
    let env = Env::default();
    let id = env.register_contract(None, ManagerTier);
    let client = ManagerTierClient::new(&env, &id);
    let admin = Address::generate(&env);
    let manager = Address::generate(&env);
    env.mock_all_auths();
    client.init(&admin, &100, &500, &1000);
    client.add_points(&admin, &manager, &120);
    assert_eq!(client.points_of(&manager), 120);
    assert_eq!(client.tier_of(&manager), 1);
    client.add_points(&admin, &manager, &900);
    assert_eq!(client.tier_of(&manager), 3);
}

#[test]
fn test_governor_control() {
    let env = Env::default();
    let id = env.register_contract(None, ManagerTier);
    let client = ManagerTierClient::new(&env, &id);
    let admin = Address::generate(&env);
    let governor = Address::generate(&env);
    let manager = Address::generate(&env);
    env.mock_all_auths();
    client.init(&admin, &100, &500, &1000);
    client.set_governor(&admin, &governor);
    client.set_thresholds(&governor, &200, &700, &1500);
    client.set_points(&governor, &manager, &1600);
    assert_eq!(client.tier_of(&manager), 3);
}

#[test]
#[should_panic]
fn test_invalid_thresholds_rejected() {
    let env = Env::default();
    let id = env.register_contract(None, ManagerTier);
    let client = ManagerTierClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.init(&admin, &500, &100, &1000);
}
