use super::*;
use soroban_sdk::{testutils::Ledger, Address, Bytes, Env};
extern crate arka_registry as registry_mod;

#[test]
fn test_set_and_create() {
    let env = Env::default();
    // Deploy registry
    let reg_id = env.register_contract(None, registry_mod::ArkaRegistry);
    let reg = registry_mod::ArkaRegistryClient::new(&env, &reg_id);

    let contract_id = env.register_contract(None, ArkaFactory);
    let client = ArkaFactoryClient::new(&env, &contract_id);
    let gov = Address::generate(&env);
    let registry_admin = Address::generate(&env);
    client.set_governor(&gov);
    env.mock_all_auths_allowing_non_root_auth();
    reg.init_admin(&registry_admin);
    reg.set_registrar(&registry_admin, &contract_id, &true);
    client.set_registry(&reg_id);
    // Create and auto-register
    let manager = Address::generate(&env);
    let mut salt = Bytes::new(&env);
    for _ in 0..32 {
        salt.push_back(1u8);
    }
    let _arka = client.create_arka(&salt, &manager);
    assert_eq!(reg.count(), 1);
    assert_eq!(reg.get_arkas(&0, &10).len(), 1);
    assert_eq!(reg.get_arkas_by_manager(&manager, &0, &10).len(), 1);
}

#[test]
fn test_migrate_tracks_old_new_mapping() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ArkaFactory);
    let client = ArkaFactoryClient::new(&env, &contract_id);
    let governor = Address::generate(&env);
    client.set_governor(&governor);

    let old_arka = Address::generate(&env);
    let manager = Address::generate(&env);
    let mut salt = Bytes::new(&env);
    for _ in 0..32 {
        salt.push_back(9u8);
    }
    let denom = Address::generate(&env);
    let whitelist = Vec::from_array(&env, [denom.clone()]);
    let router = Address::generate(&env);

    env.mock_all_auths();
    let new_arka = client.migrate_arka(
        &old_arka, &salt, &manager, &denom, &0, &0, &0, &0, &whitelist, &router,
    );
    assert_eq!(client.migrated_to(&old_arka), Some(new_arka.clone()));
    assert_eq!(client.migrated_from(&new_arka), Some(old_arka));
}

#[test]
fn test_create_and_init_records_share_token_for_arka() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ArkaFactory);
    let client = ArkaFactoryClient::new(&env, &contract_id);
    let governor = Address::generate(&env);
    client.set_governor(&governor);

    env.mock_all_auths();
    let share_token_impl = BytesN::from_array(&env, &[7u8; 32]);
    client.set_share_token_implementation(&share_token_impl);

    let manager = Address::generate(&env);
    let mut salt = Bytes::new(&env);
    for _ in 0..32 {
        salt.push_back(2u8);
    }
    let denom = Address::generate(&env);
    let whitelist = Vec::from_array(&env, [denom.clone()]);
    let router = Address::generate(&env);

    let arka = client.create_and_init(&salt, &manager, &denom, &0, &0, &0, &0, &whitelist, &router);

    assert_eq!(
        client.get_share_token_implementation(),
        Some(share_token_impl)
    );
    assert!(client.share_token_of(&arka).is_some());
}

#[test]
fn test_protocol_fee_defaults_round_trip() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ArkaFactory);
    let client = ArkaFactoryClient::new(&env, &contract_id);
    let governor = Address::generate(&env);
    let treasury = Address::generate(&env);
    client.set_governor(&governor);

    env.mock_all_auths();
    client.set_protocol_treasury(&treasury);
    client.set_protocol_fee_splits(&1_500, &2_500);

    assert_eq!(client.get_protocol_treasury(), Some(treasury));
    assert_eq!(client.get_protocol_mgmt_fee_bps(), 1_500);
    assert_eq!(client.get_protocol_perf_fee_bps(), 2_500);
}

#[test]
fn test_default_execution_policy_round_trip() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ArkaFactory);
    let client = ArkaFactoryClient::new(&env, &contract_id);
    let governor = Address::generate(&env);
    let registry = Address::generate(&env);
    let oracle = Address::generate(&env);
    let router = Address::generate(&env);
    let adapter = Address::generate(&env);

    client.set_governor(&governor);
    env.mock_all_auths();
    client.set_default_venue_registry(&registry);
    client.set_default_swap_oracle(&oracle);
    client.set_default_allowed_venues(
        &Vec::from_array(&env, [router.clone()]),
        &Vec::from_array(&env, [adapter.clone()]),
    );
    client.set_default_swap_risk_policy(&true, &true, &300, &300, &350, &60, &2_500);

    assert_eq!(client.get_default_venue_registry(), Some(registry));
    assert_eq!(client.get_default_swap_oracle(), Some(oracle));
    assert_eq!(client.get_default_allowed_routers().get(0).unwrap(), router);
    assert_eq!(
        client.get_default_allowed_adapters().get(0).unwrap(),
        adapter
    );

    let policy = client.get_default_swap_risk_policy().unwrap();
    assert!(policy.enabled);
    assert!(policy.oracle_checks_enabled);
    assert_eq!(policy.max_price_impact_bps, 300);
    assert_eq!(policy.max_slippage_bps, 300);
    assert_eq!(policy.max_twap_deviation_bps, 350);
    assert_eq!(policy.max_oracle_age_seconds, 60);
    assert_eq!(policy.max_trade_size_bps, 2_500);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_default_swap_policy_rejects_invalid_limits() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ArkaFactory);
    let client = ArkaFactoryClient::new(&env, &contract_id);
    let governor = Address::generate(&env);

    client.set_governor(&governor);
    env.mock_all_auths();
    client.set_default_swap_risk_policy(&true, &true, &10_001, &300, &350, &60, &2_500);
}

#[test]
#[should_panic(expected = "bootstrap_admin_expiry_locked")]
fn test_bootstrap_admin_cannot_extend_expiry() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    let contract_id = env.register_contract(None, ArkaFactory);
    let client = ArkaFactoryClient::new(&env, &contract_id);
    let governor = Address::generate(&env);
    let admin = Address::generate(&env);
    client.set_governor(&governor);

    env.mock_all_auths();
    client.set_bootstrap_admin(&governor, &admin, &2_000);
    client.set_bootstrap_admin(&admin, &admin, &2_001);
}
