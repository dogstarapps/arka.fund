use super::*;
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Events as _, Ledger},
    BytesN, Env, IntoVal,
};

#[test]
fn arka_admin_can_mint_and_burn_shares() {
    let env = Env::default();
    
    
    let arka = Address::generate(&env);
    let holder = Address::generate(&env);

    env.mock_all_auths();
    let token_id = env.register(ShareToken, (&arka, &None::<Address>, &None::<Address>, &0u64,));
    let client = ShareTokenClient::new(&env, &token_id);
    client.mint(&holder, &100);
    assert_eq!(client.balance(&holder), 100);
    client.burn(&holder, &40);
    assert_eq!(client.balance(&holder), 60);
}

#[test]
fn ownership_changes_emit_indexable_token_events() {
    let env = Env::default();
    
    
    let arka = Address::generate(&env);
    let first_holder = Address::generate(&env);
    let second_holder = Address::generate(&env);

    env.mock_all_auths();
    let token_id = env.register(ShareToken, (&arka, &None::<Address>, &None::<Address>, &0u64,));
    let client = ShareTokenClient::new(&env, &token_id);
    client.mint(&first_holder, &100);
    assert_eq!(
        env.events().all(),
        soroban_sdk::vec![
            &env,
            (
                token_id.clone(),
                (symbol_short!("mint"), first_holder.clone()).into_val(&env),
                100i128.into_val(&env),
            ),
        ]
    );

    client.approve(&first_holder, &arka, &25, &500);
    assert_eq!(
        env.events().all(),
        soroban_sdk::vec![
            &env,
            (
                token_id.clone(),
                (symbol_short!("approve"), first_holder.clone(), arka).into_val(&env),
                (25i128, 500u32).into_val(&env),
            ),
        ]
    );

    client.transfer(&first_holder, &second_holder, &40);
    assert_eq!(
        env.events().all(),
        soroban_sdk::vec![
            &env,
            (
                token_id.clone(),
                (
                    symbol_short!("transfer"),
                    first_holder,
                    second_holder.clone(),
                )
                    .into_val(&env),
                40i128.into_val(&env),
            ),
        ]
    );

    client.burn(&second_holder, &10);
    assert_eq!(
        env.events().all(),
        soroban_sdk::vec![
            &env,
            (
                token_id,
                (symbol_short!("burn"), second_holder).into_val(&env),
                10i128.into_val(&env),
            ),
        ]
    );
}

#[test]
fn init_with_upgrade_authority_keeps_share_admin_separate() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    
    
    let arka = Address::generate(&env);
    let upgrade_admin = Address::generate(&env);
    let governor = Address::generate(&env);

    let token_id = env.register(ShareToken, (&arka, &Some((upgrade_admin).clone()), &Some(governor.clone()), &2_000u64,));
    let client = ShareTokenClient::new(&env, &token_id);

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
    
    
    let arka = Address::generate(&env);
    let upgrade_admin = Address::generate(&env);
    let governor = Address::generate(&env);
    let wasm_hash = BytesN::from_array(&env, &[9u8; 32]);

    let token_id = env.register(ShareToken, (&arka, &Some((upgrade_admin).clone()), &Some(governor), &2_000u64,));
    let client = ShareTokenClient::new(&env, &token_id);
    client.upgrade(&upgrade_admin, &wasm_hash);
}

#[test]
#[should_panic(expected = "Wasm does not exist")]
fn governor_can_upgrade_after_bootstrap_expiry() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000);
    
    
    let arka = Address::generate(&env);
    let upgrade_admin = Address::generate(&env);
    let governor = Address::generate(&env);
    let wasm_hash = BytesN::from_array(&env, &[8u8; 32]);

    let token_id = env.register(ShareToken, (&arka, &Some((upgrade_admin).clone()), &Some(governor.clone()), &1_010u64,));
    let client = ShareTokenClient::new(&env, &token_id);
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
    
    
    let arka = Address::generate(&env);
    let upgrade_admin = Address::generate(&env);
    let governor = Address::generate(&env);
    let stranger = Address::generate(&env);
    let wasm_hash = BytesN::from_array(&env, &[7u8; 32]);

    let token_id = env.register(ShareToken, (&arka, &Some((upgrade_admin).clone()), &Some(governor), &2_000u64,));
    let client = ShareTokenClient::new(&env, &token_id);
    client.upgrade(&stranger, &wasm_hash);
}

#[test]
#[should_panic(expected = "only_upgrade_authority")]
fn expired_bootstrap_admin_cannot_upgrade() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000);
    
    
    let arka = Address::generate(&env);
    let upgrade_admin = Address::generate(&env);
    let governor = Address::generate(&env);
    let wasm_hash = BytesN::from_array(&env, &[6u8; 32]);

    let token_id = env.register(ShareToken, (&arka, &Some((upgrade_admin).clone()), &Some(governor), &1_010u64,));
    let client = ShareTokenClient::new(&env, &token_id);
    env.ledger().set_timestamp(1_011);
    client.upgrade(&upgrade_admin, &wasm_hash);
}

#[test]
#[should_panic(expected = "bootstrap_admin_expiry_locked")]
fn bootstrap_admin_cannot_extend_expiry() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000);
    
    
    let arka = Address::generate(&env);
    let upgrade_admin = Address::generate(&env);
    let governor = Address::generate(&env);

    let token_id = env.register(ShareToken, (&arka, &Some((upgrade_admin).clone()), &Some(governor), &2_000u64,));
    let client = ShareTokenClient::new(&env, &token_id);
    client.set_upgrade_admin(&upgrade_admin, &upgrade_admin, &2_001);
}

#[test]
#[should_panic(expected = "invalid_bootstrap_admin")]
fn bootstrap_admin_window_cannot_exceed_one_year() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    
    
    let arka = Address::generate(&env);
    let upgrade_admin = Address::generate(&env);

    let token_id = env.register(ShareToken, (&arka, &Some((upgrade_admin).clone()), &None::<Address>, &(1_000 + MAX_BOOTSTRAP_ADMIN_SECONDS + 1),));
    let client = ShareTokenClient::new(&env, &token_id);
}


#[test]
fn optional_governor_clear_preserves_share_issuer_and_retired_upgrade_authority() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    env.mock_all_auths();
    let issuer = Address::generate(&env);
    let admin = Address::generate(&env);
    let governor = Address::generate(&env);
    let holder = Address::generate(&env);
    let id = env.register(ShareToken, (&issuer, &Some(admin.clone()), &None::<Address>, &2_000u64));
    let client = ShareTokenClient::new(&env, &id);
    client.set_governor(&admin, &None);
    assert_eq!(client.governor(), None);
    client.mint(&holder, &100);
    client.set_governor(&admin, &Some(governor.clone()));
    client.clear_upgrade_admin(&governor);
    client.set_governor(&governor, &None);
    assert!(client.try_set_governor(&admin, &Some(admin.clone())).is_err());
    client.mint(&holder, &1);
    assert_eq!(client.balance(&holder), 101);
}
