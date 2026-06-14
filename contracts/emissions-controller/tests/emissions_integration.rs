extern crate std;

use arka_token::{ArkaToken, ArkaTokenClient};
use emissions_controller::{EmissionsController, EmissionsControllerClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    Address, Env,
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
fn integration_release_all_round_trips_multiple_streams() {
    let env = Env::default();
    env.mock_all_auths();
    set_ledger(&env, 1_000, 10);

    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let recipient = Address::generate(&env);

    let token_id = env.register_contract(None, ArkaToken);
    let token = ArkaTokenClient::new(&env, &token_id);
    token.init(
        &admin,
        &soroban_sdk::String::from_str(&env, "ARKA"),
        &soroban_sdk::String::from_str(&env, "ARKA"),
        &7u32,
        &Some(1_000_000i128),
    );
    token.mint(&treasury, &1_200);

    let controller_id = env.register_contract(None, EmissionsController);
    let controller = EmissionsControllerClient::new(&env, &controller_id);
    controller.init(&admin, &token_id);
    token.approve(&treasury, &controller_id, &900);

    let stream_a = controller.create_stream(&admin, &treasury, &recipient, &1_000, &1_400, &500);
    let stream_b = controller.create_stream(&admin, &treasury, &recipient, &1_100, &1_300, &400);

    set_ledger(&env, 1_200, 11);
    assert_eq!(controller.releasable(&stream_a), 250);
    assert_eq!(controller.releasable(&stream_b), 200);
    assert_eq!(controller.release_all(&recipient), 450);
    assert_eq!(token.balance(&recipient), 450);

    set_ledger(&env, 1_400, 12);
    assert_eq!(controller.release_all(&recipient), 450);
    assert_eq!(token.balance(&recipient), 900);
    assert_eq!(controller.releasable(&stream_a), 0);
    assert_eq!(controller.releasable(&stream_b), 0);
}
