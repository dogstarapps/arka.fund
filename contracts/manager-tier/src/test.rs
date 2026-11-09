use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn test_points_and_tiers() {
    let env = Env::default();
    
    
    let admin = Address::generate(&env);
    let manager = Address::generate(&env);
    env.mock_all_auths();
    let id = env.register(ManagerTier, (&admin, &100i128, &500i128, &1000i128,));
    let client = ManagerTierClient::new(&env, &id);
    client.add_points(&admin, &manager, &120);
    assert_eq!(client.points_of(&manager), 120);
    assert_eq!(client.tier_of(&manager), 1);
    client.add_points(&admin, &manager, &900);
    assert_eq!(client.tier_of(&manager), 3);
}

#[test]
fn test_governor_control() {
    let env = Env::default();
    
    
    let admin = Address::generate(&env);
    let governor = Address::generate(&env);
    let manager = Address::generate(&env);
    env.mock_all_auths();
    let id = env.register(ManagerTier, (&admin, &100i128, &500i128, &1000i128,));
    let client = ManagerTierClient::new(&env, &id);
    client.set_governor(&admin, &governor);
    client.set_thresholds(&governor, &200, &700, &1500);
    client.set_points(&governor, &manager, &1600);
    assert_eq!(client.tier_of(&manager), 3);
}

#[test]
#[should_panic]
fn test_invalid_thresholds_rejected() {
    let env = Env::default();
    
    
    let admin = Address::generate(&env);
    let id = env.register(ManagerTier, (&admin, &500i128, &100i128, &1000i128,));
    let client = ManagerTierClient::new(&env, &id);
}
