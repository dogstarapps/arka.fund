extern crate std;

use super::*;
use arka_token::{ArkaToken, ArkaTokenClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    Address,
};

fn set_ledger(env: &Env, timestamp: u64, sequence: u32) {
    env.ledger().set(LedgerInfo {
        timestamp,
        protocol_version: 23,
        sequence_number: sequence,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 17_280,
        min_persistent_entry_ttl: 172_800,
        max_entry_ttl: 31_536_000,
    });
}

#[test]
fn test_release_and_cancel_stream() {
    let env = Env::default();
    env.mock_all_auths();
    set_ledger(&env, 1_000, 10);

    let token_id = env.register_contract(None, ArkaToken);
    let token = ArkaTokenClient::new(&env, &token_id);
    let admin = Address::generate(&env);
    token.init(
        &admin,
        &soroban_sdk::String::from_str(&env, "ARKA"),
        &soroban_sdk::String::from_str(&env, "ARKA"),
        &7u32,
        &Some(1_000_000i128),
    );

    let treasury = Address::generate(&env);
    let program = Address::generate(&env);
    token.mint(&treasury, &1_000);

    let controller_id = env.register_contract(None, EmissionsController);
    let controller = EmissionsControllerClient::new(&env, &controller_id);
    controller.init(&admin, &token_id);
    token.approve(&treasury, &controller_id, &900);

    let stream_id = controller.create_stream(&admin, &treasury, &program, &1_000, &1_400, &900);
    assert_eq!(stream_id, 1);
    assert_eq!(token.balance(&treasury), 100);

    set_ledger(&env, 1_200, 11);
    assert_eq!(controller.releasable(&stream_id), 450);
    assert_eq!(controller.release(&stream_id), 450);
    assert_eq!(token.balance(&program), 450);

    set_ledger(&env, 1_250, 12);
    let receipt = controller.cancel_stream(&admin, &stream_id, &treasury);
    assert_eq!(receipt.vested_amount, 562);
    assert_eq!(receipt.refunded_amount, 338);
    assert_eq!(token.balance(&treasury), 438);

    assert_eq!(controller.releasable(&stream_id), 112);
    assert_eq!(controller.release(&stream_id), 112);
    assert_eq!(token.balance(&program), 562);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_invalid_schedule_is_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    set_ledger(&env, 1_000, 10);

    let token_id = env.register_contract(None, ArkaToken);
    let token = ArkaTokenClient::new(&env, &token_id);
    let admin = Address::generate(&env);
    token.init(
        &admin,
        &soroban_sdk::String::from_str(&env, "ARKA"),
        &soroban_sdk::String::from_str(&env, "ARKA"),
        &7u32,
        &Some(1_000_000i128),
    );
    let treasury = Address::generate(&env);
    let recipient = Address::generate(&env);
    token.mint(&treasury, &100);

    let controller_id = env.register_contract(None, EmissionsController);
    let controller = EmissionsControllerClient::new(&env, &controller_id);
    controller.init(&admin, &token_id);
    token.approve(&treasury, &controller_id, &100);
    controller.create_stream(&admin, &treasury, &recipient, &1_200, &1_200, &100);
}
