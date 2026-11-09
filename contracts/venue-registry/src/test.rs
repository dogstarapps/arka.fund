use super::*;
use soroban_sdk::{testutils::Address as _, testutils::Ledger, Env};

#[test]
fn governor_can_enable_disable_and_query_venues() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    
    
    let admin = Address::generate(&env);
    let venue = Address::generate(&env);

    env.mock_all_auths();
    let id = env.register(VenueRegistry, (&admin, &Some(admin.clone()), &2_000u64,));
    let client = VenueRegistryClient::new(&env, &id);
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
    
    
    let admin = Address::generate(&env);
    let guardian = Address::generate(&env);
    let venue = Address::generate(&env);

    env.mock_all_auths();
    let id = env.register(VenueRegistry, (&admin, &Some(admin.clone()), &2_000u64,));
    let client = VenueRegistryClient::new(&env, &id);
    client.set_guardian(&admin, &Some(guardian.clone()));
    client.set_venue_status(&admin, &venue, &STATUS_AUTO);
    client.disable_venue(&guardian, &venue);
    assert!(!client.is_allowed(&venue));
    assert!(client.try_set_venue_status(&guardian, &venue, &STATUS_AUTO).is_err());
    assert!(client.try_set_venue_status(&guardian, &venue, &STATUS_MANUAL_ONLY).is_err());
}

#[test]
fn lifecycle_matrix_distinguishes_drain_from_emergency_and_persists_one_identity() {
    let env=Env::default();env.mock_all_auths();env.ledger().set_timestamp(1000);
    let admin=Address::generate(&env);let governor=Address::generate(&env);let stranger=Address::generate(&env);let venue=Address::generate(&env);
    let id=env.register(VenueRegistry,(&admin,&Some(governor.clone()),&2000u64));let c=VenueRegistryClient::new(&env,&id);
    assert!(!c.is_allowed(&venue)&&!c.is_auto_allowed(&venue)&&!c.is_exit_allowed(&venue));
    for (status,manual,auto,exit) in [(STATUS_MANUAL_ONLY,true,false,true),(STATUS_AUTO,true,true,true),(STATUS_DEPRECATED,false,false,true),(STATUS_DISABLED,false,false,false)] {
        c.set_venue_status(&governor,&venue,&status);assert_eq!(c.is_allowed(&venue),manual);assert_eq!(c.is_auto_allowed(&venue),auto);assert_eq!(c.is_exit_allowed(&venue),exit);
        let record=c.venue_config(&venue).unwrap();assert_eq!(record.status,status);assert_eq!(record.updated_by,governor);assert_eq!(record.updated_at,1000);
    }
    assert_eq!(c.venues(&0,&50).len(),1);assert!(c.try_set_venue_status(&stranger,&venue,&STATUS_AUTO).is_err());assert!(c.try_disable_venue(&stranger,&venue).is_err());
    assert!(c.try_set_venue_status(&governor,&venue,&4).is_err());assert_eq!(c.venue_config(&venue).unwrap().status,STATUS_DISABLED);
    env.ledger().set_timestamp(2001);assert!(c.try_set_venue_status(&admin,&venue,&STATUS_AUTO).is_err());c.set_venue_status(&governor,&venue,&STATUS_MANUAL_ONLY);assert!(c.is_allowed(&venue));assert!(!c.is_auto_allowed(&venue));
    assert!(c.mock_auths(&[]).try_set_venue_status(&governor,&venue,&STATUS_AUTO).is_err());
}

#[test]
#[should_panic(expected = "bootstrap_admin_expiry_locked")]
fn bootstrap_admin_cannot_extend_expiry() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    
    
    let admin = Address::generate(&env);

    env.mock_all_auths();
    let id = env.register(VenueRegistry, (&admin, &Some(admin.clone()), &2_000u64,));
    let client = VenueRegistryClient::new(&env, &id);
    client.set_bootstrap_admin(&admin, &admin, &2_001);
}


#[test]
fn optional_roles_clear_preserves_pause_fallback_and_cannot_restore_bootstrap() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let governor = Address::generate(&env);
    let guardian = Address::generate(&env);
    let stranger = Address::generate(&env);
    let venue = Address::generate(&env);
    let id = env.register(VenueRegistry, (&admin, &None::<Address>, &2_000u64));
    let client = VenueRegistryClient::new(&env, &id);
    assert_eq!(client.governor(), None);
    assert_eq!(client.guardian(), None);
    client.set_guardian(&admin, &None);
    assert_eq!(client.guardian(), None);
    client.set_venue_status(&admin, &venue, &STATUS_AUTO);
    client.disable_venue(&admin, &venue);
    assert!(!client.is_allowed(&venue));
    assert!(client.try_disable_venue(&stranger, &venue).is_err());
    client.set_governor(&admin, &Some(governor.clone()));
    client.set_guardian(&governor, &Some(guardian.clone()));
    client.clear_bootstrap_admin(&governor);
    client.set_governor(&governor, &None);
    assert_eq!(client.governor(), None);
    assert!(client.try_set_governor(&admin, &Some(admin.clone())).is_err());
    assert!(client.try_set_venue_status(&guardian, &venue, &STATUS_AUTO).is_err());
    client.disable_venue(&guardian, &venue);
}
