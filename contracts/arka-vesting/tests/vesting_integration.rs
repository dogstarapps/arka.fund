extern crate std;

use arka_token::{ArkaToken, ArkaTokenClient};
use arka_vesting::{ArkaVesting, ArkaVestingClient};
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
fn integration_claim_all_round_trips_multiple_grants() {
    let env = Env::default();
    env.mock_all_auths();
    set_ledger(&env, 1_000, 10);

    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let beneficiary = Address::generate(&env);

    let token_id = env.register_contract(None, ArkaToken);
    let token = ArkaTokenClient::new(&env, &token_id);
    token.init(
        &admin,
        &soroban_sdk::String::from_str(&env, "ARKA"),
        &soroban_sdk::String::from_str(&env, "ARKA"),
        &7u32,
        &Some(1_000_000i128),
    );
    token.mint(&treasury, &1_000);

    let vesting_id = env.register_contract(None, ArkaVesting);
    let vesting = ArkaVestingClient::new(&env, &vesting_id);
    vesting.init(&admin, &token_id);
    token.approve(&treasury, &vesting_id, &700);

    let grant_a = vesting.create_grant(
        &admin,
        &treasury,
        &beneficiary,
        &1_000,
        &1_100,
        &1_300,
        &400,
        &true,
    );
    let grant_b = vesting.create_grant(
        &admin,
        &treasury,
        &beneficiary,
        &1_000,
        &1_050,
        &1_200,
        &300,
        &false,
    );
    assert_eq!(vesting.grant_ids(&beneficiary).len(), 2);

    set_ledger(&env, 1_150, 11);
    assert_eq!(vesting.claimable(&grant_a), 200);
    assert_eq!(vesting.claimable(&grant_b), 225);
    assert_eq!(vesting.claim_all(&beneficiary), 425);
    assert_eq!(token.balance(&beneficiary), 425);

    set_ledger(&env, 1_300, 12);
    assert_eq!(vesting.claim_all(&beneficiary), 275);
    assert_eq!(token.balance(&beneficiary), 700);
    assert_eq!(vesting.claimable(&grant_a), 0);
    assert_eq!(vesting.claimable(&grant_b), 0);
}
