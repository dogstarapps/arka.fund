extern crate std;

use arka_token::{ArkaToken, ArkaTokenClient};
use locked_arka::{LockedArka, LockedArkaClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    Address, Env, String,
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

#[test]
fn integration_round_trips_underlying_and_lock_state() {
    let env = Env::default();
    env.mock_all_auths();
    set_default_ledger(&env);

    let admin = Address::generate(&env);
    let alice = Address::generate(&env);

    let token_id = env.register_contract(None, ArkaToken);
    let token = ArkaTokenClient::new(&env, &token_id);
    token.init(
        &admin,
        &String::from_str(&env, "Arka Token"),
        &String::from_str(&env, "ARKA"),
        &7u32,
        &Some(1_000_000i128),
    );
    token.mint(&alice, &1_000);

    let locked_id = env.register_contract(None, LockedArka);
    let locked = LockedArkaClient::new(&env, &locked_id);
    locked.init(
        &admin,
        &token_id,
        &5u32,
        &500u32,
        &String::from_str(&env, "Locked ARKA"),
        &String::from_str(&env, "lARKA"),
    );

    locked.create_lock(&alice, &300, &140);
    jump(&env, 5);
    locked.increase_amount(&alice, &100);
    locked.extend_lock(&alice, &220);

    let position = locked.lock_position(&alice).expect("lock should exist");
    assert_eq!(position.amount, 400);
    assert_eq!(position.unlock_ledger, 220);
    assert_eq!(token.balance(&alice), 600);
    assert_eq!(token.balance(&locked_id), 400);
    assert_eq!(locked.total_supply(), 400);

    jump(&env, 115);
    locked.withdraw(&alice);
    assert_eq!(token.balance(&alice), 1_000);
    assert_eq!(token.balance(&locked_id), 0);
    assert_eq!(locked.total_supply(), 0);
    assert!(locked.lock_position(&alice).is_none());
}
