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
fn test_linear_vesting_claim_and_revoke() {
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
    let team = Address::generate(&env);
    token.mint(&treasury, &1_000);

    let vesting_id = env.register_contract(None, ArkaVesting);
    let vesting = ArkaVestingClient::new(&env, &vesting_id);
    vesting.init(&admin, &token_id);
    token.approve(&treasury, &vesting_id, &600);

    let grant_id = vesting.create_grant(
        &admin, &treasury, &team, &1_000, &1_100, &1_400, &600, &true,
    );
    assert_eq!(grant_id, 1);
    assert_eq!(token.balance(&treasury), 400);

    set_ledger(&env, 1_050, 11);
    assert_eq!(vesting.claimable(&grant_id), 0);

    set_ledger(&env, 1_200, 12);
    assert_eq!(vesting.claimable(&grant_id), 300);
    assert_eq!(vesting.claim(&grant_id), 300);
    assert_eq!(token.balance(&team), 300);

    set_ledger(&env, 1_250, 13);
    let receipt = vesting.revoke(&admin, &grant_id, &treasury);
    assert_eq!(receipt.vested_amount, 375);
    assert_eq!(receipt.refunded_amount, 225);
    assert_eq!(token.balance(&treasury), 625);

    assert_eq!(vesting.claimable(&grant_id), 75);
    assert_eq!(vesting.claim(&grant_id), 75);
    assert_eq!(token.balance(&team), 375);
    assert_eq!(vesting.claimable(&grant_id), 0);
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
    let beneficiary = Address::generate(&env);
    token.mint(&treasury, &100);

    let vesting_id = env.register_contract(None, ArkaVesting);
    let vesting = ArkaVestingClient::new(&env, &vesting_id);
    vesting.init(&admin, &token_id);
    token.approve(&treasury, &vesting_id, &100);
    vesting.create_grant(
        &admin,
        &treasury,
        &beneficiary,
        &1_000,
        &900,
        &1_200,
        &100,
        &true,
    );
}
