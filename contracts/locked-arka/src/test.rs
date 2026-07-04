extern crate std;

use super::*;
use arka_token::{ArkaToken, ArkaTokenClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    String,
};

const ONE_DAY_LEDGERS: u32 = 17_280;

fn set_default_ledger(env: &Env) {
    env.ledger().set(LedgerInfo {
        timestamp: 1_441_065_600,
        protocol_version: 23,
        sequence_number: 100,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: ONE_DAY_LEDGERS,
        min_persistent_entry_ttl: 10 * ONE_DAY_LEDGERS,
        max_entry_ttl: 365 * ONE_DAY_LEDGERS,
    });
}

fn jump(env: &Env, ledgers: u32) {
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp().saturating_add(ledgers as u64 * 5),
        protocol_version: 23,
        sequence_number: env.ledger().sequence().saturating_add(ledgers),
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: ONE_DAY_LEDGERS,
        min_persistent_entry_ttl: 10 * ONE_DAY_LEDGERS,
        max_entry_ttl: 365 * ONE_DAY_LEDGERS,
    });
}

fn setup(
    env: &Env,
) -> (
    Address,
    ArkaTokenClient<'_>,
    Address,
    Address,
    LockedArkaClient<'_>,
    Address,
    Address,
) {
    env.mock_all_auths();
    set_default_ledger(env);

    let token_id = env.register_contract(None, ArkaToken);
    let token = ArkaTokenClient::new(env, &token_id);
    let admin = Address::generate(env);
    token.init(
        &admin,
        &String::from_str(env, "Arka Token"),
        &String::from_str(env, "ARKA"),
        &7u32,
        &Some(1_000_000i128),
    );

    let locked_id = env.register_contract(None, LockedArka);
    let locked = LockedArkaClient::new(env, &locked_id);
    locked.init(
        &admin,
        &token_id,
        &10u32,
        &1_000u32,
        &String::from_str(env, "Locked ARKA"),
        &String::from_str(env, "lARKA"),
    );

    let alice = Address::generate(env);
    let bob = Address::generate(env);
    token.mint(&alice, &500);
    (token_id, token, admin, locked_id, locked, alice, bob)
}

#[test]
fn test_lock_delegate_and_withdraw() {
    let env = Env::default();
    let (_token_id, token, _admin, locked_id, locked, alice, bob) = setup(&env);

    locked.create_lock(&alice, &200, &120);
    locked.delegate(&alice, &bob);
    assert_eq!(locked.get_votes(&alice), 0);
    assert_eq!(locked.get_votes(&bob), 200);
    assert_eq!(token.balance(&alice), 300);
    assert_eq!(token.balance(&locked_id), 200);

    jump(&env, 20);
    locked.withdraw(&alice);
    assert_eq!(locked.total_supply(), 0);
    assert_eq!(locked.get_votes(&bob), 0);
    assert_eq!(token.balance(&alice), 500);
    assert_eq!(token.balance(&locked_id), 0);
}

#[test]
fn test_vote_sequence_fence_preserves_snapshot() {
    let env = Env::default();
    let (_token_id, _token, admin, _locked_id, locked, alice, _bob) = setup(&env);
    let governor = Address::generate(&env);
    locked.set_governor(&admin, &governor);
    locked.create_lock(&alice, &100, &140);

    jump(&env, 2);
    locked.set_vote_sequence(&105);

    jump(&env, 5);
    locked.increase_amount(&alice, &50);

    assert_eq!(locked.get_votes(&alice), 150);
    assert_eq!(locked.get_past_votes(&alice, &105), 100);
    assert_eq!(locked.get_past_total_supply(&105), 100);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn test_cannot_withdraw_before_unlock() {
    let env = Env::default();
    let (_token_id, _token, _admin, _locked_id, locked, alice, _bob) = setup(&env);
    locked.create_lock(&alice, &100, &130);
    locked.withdraw(&alice);
}
