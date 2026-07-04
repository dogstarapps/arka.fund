use super::*;
use soroban_sdk::{testutils::Address as _, testutils::Ledger, Env};

#[test]
fn governor_can_enable_disable_and_query_venues() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    let id = env.register_contract(None, VenueRegistry);
    let client = VenueRegistryClient::new(&env, &id);
    let admin = Address::generate(&env);
    let venue = Address::generate(&env);

    env.mock_all_auths();
    client.init(&admin, &Some(admin.clone()), &2_000);
    client.set_venue_status(&admin, &venue, &STATUS_AUTO);
    assert!(client.is_allowed(&venue));
    assert!(client.is_auto_allowed(&venue));
    assert_eq!(client.venues(&0, &10).len(), 1);

    client.disable_venue(&admin, &venue);
    assert!(!client.is_allowed(&venue));
    assert!(!client.is_auto_allowed(&venue));
}

#[test]
fn guardian_can_only_disable() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    let id = env.register_contract(None, VenueRegistry);
    let client = VenueRegistryClient::new(&env, &id);
    let admin = Address::generate(&env);
    let guardian = Address::generate(&env);
    let venue = Address::generate(&env);

    env.mock_all_auths();
    client.init(&admin, &Some(admin.clone()), &2_000);
    client.set_guardian(&admin, &Some(guardian.clone()));
    client.set_venue_status(&admin, &venue, &STATUS_AUTO);
    client.disable_venue(&guardian, &venue);
    assert!(!client.is_allowed(&venue));
}

#[test]
#[should_panic(expected = "bootstrap_admin_expiry_locked")]
fn bootstrap_admin_cannot_extend_expiry() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    let id = env.register_contract(None, VenueRegistry);
    let client = VenueRegistryClient::new(&env, &id);
    let admin = Address::generate(&env);

    env.mock_all_auths();
    client.init(&admin, &Some(admin.clone()), &2_000);
    client.set_bootstrap_admin(&admin, &admin, &2_001);
}
