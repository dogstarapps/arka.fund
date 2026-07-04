use super::*;
use soroban_sdk::{testutils::Address as _, testutils::Ledger, BytesN, Env};

#[test]
fn arka_admin_can_mint_and_burn_shares() {
    let env = Env::default();
    let token_id = env.register_contract(None, ShareToken);
    let client = ShareTokenClient::new(&env, &token_id);
    let arka = Address::generate(&env);
    let holder = Address::generate(&env);

    env.mock_all_auths();
    client.init(&arka);
    client.mint(&holder, &100);
    assert_eq!(client.balance(&holder), 100);
    client.burn(&holder, &40);
    assert_eq!(client.balance(&holder), 60);
}

#[test]
fn init_with_upgrade_authority_keeps_share_admin_separate() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    let token_id = env.register_contract(None, ShareToken);
    let client = ShareTokenClient::new(&env, &token_id);
    let arka = Address::generate(&env);
    let upgrade_admin = Address::generate(&env);
    let governor = Address::generate(&env);

    client.init_with_upgrade_authority(&arka, &upgrade_admin, &Some(governor.clone()), &2_000);

    assert_eq!(client.admin(), arka);
    assert_eq!(client.upgrade_admin(), Some(upgrade_admin));
    assert_eq!(client.governor(), Some(governor));
    assert_eq!(client.bootstrap_admin_expires_at(), Some(2_000));
    assert!(client.bootstrap_admin_active());
}

#[test]
#[should_panic(expected = "Wasm does not exist")]
fn bootstrap_admin_can_upgrade_before_expiry() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000);
    let token_id = env.register_contract(None, ShareToken);
    let client = ShareTokenClient::new(&env, &token_id);
    let arka = Address::generate(&env);
    let upgrade_admin = Address::generate(&env);
    let governor = Address::generate(&env);
    let wasm_hash = BytesN::from_array(&env, &[9u8; 32]);

    client.init_with_upgrade_authority(&arka, &upgrade_admin, &Some(governor), &2_000);
    client.upgrade(&upgrade_admin, &wasm_hash);
}

#[test]
#[should_panic(expected = "Wasm does not exist")]
fn governor_can_upgrade_after_bootstrap_expiry() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000);
    let token_id = env.register_contract(None, ShareToken);
    let client = ShareTokenClient::new(&env, &token_id);
    let arka = Address::generate(&env);
    let upgrade_admin = Address::generate(&env);
    let governor = Address::generate(&env);
    let wasm_hash = BytesN::from_array(&env, &[8u8; 32]);

    client.init_with_upgrade_authority(&arka, &upgrade_admin, &Some(governor.clone()), &1_010);
    env.ledger().set_timestamp(1_011);
    assert!(!client.bootstrap_admin_active());

    client.upgrade(&governor, &wasm_hash);
}

#[test]
#[should_panic(expected = "only_upgrade_authority")]
fn third_party_cannot_upgrade() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000);
    let token_id = env.register_contract(None, ShareToken);
    let client = ShareTokenClient::new(&env, &token_id);
    let arka = Address::generate(&env);
    let upgrade_admin = Address::generate(&env);
    let governor = Address::generate(&env);
    let stranger = Address::generate(&env);
    let wasm_hash = BytesN::from_array(&env, &[7u8; 32]);

    client.init_with_upgrade_authority(&arka, &upgrade_admin, &Some(governor), &2_000);
    client.upgrade(&stranger, &wasm_hash);
}

#[test]
#[should_panic(expected = "only_upgrade_authority")]
fn expired_bootstrap_admin_cannot_upgrade() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000);
    let token_id = env.register_contract(None, ShareToken);
    let client = ShareTokenClient::new(&env, &token_id);
    let arka = Address::generate(&env);
    let upgrade_admin = Address::generate(&env);
    let governor = Address::generate(&env);
    let wasm_hash = BytesN::from_array(&env, &[6u8; 32]);

    client.init_with_upgrade_authority(&arka, &upgrade_admin, &Some(governor), &1_010);
    env.ledger().set_timestamp(1_011);
    client.upgrade(&upgrade_admin, &wasm_hash);
}

#[test]
#[should_panic(expected = "bootstrap_admin_expiry_locked")]
fn bootstrap_admin_cannot_extend_expiry() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000);
    let token_id = env.register_contract(None, ShareToken);
    let client = ShareTokenClient::new(&env, &token_id);
    let arka = Address::generate(&env);
    let upgrade_admin = Address::generate(&env);
    let governor = Address::generate(&env);

    client.init_with_upgrade_authority(&arka, &upgrade_admin, &Some(governor), &2_000);
    client.set_upgrade_admin(&upgrade_admin, &upgrade_admin, &2_001);
}

#[test]
#[should_panic(expected = "invalid_bootstrap_admin")]
fn bootstrap_admin_window_cannot_exceed_one_year() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    let token_id = env.register_contract(None, ShareToken);
    let client = ShareTokenClient::new(&env, &token_id);
    let arka = Address::generate(&env);
    let upgrade_admin = Address::generate(&env);

    client.init_with_upgrade_authority(
        &arka,
        &upgrade_admin,
        &None,
        &(1_000 + MAX_BOOTSTRAP_ADMIN_SECONDS + 1),
    );
}
