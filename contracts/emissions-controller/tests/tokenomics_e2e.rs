extern crate std;

use arka_token::{ArkaToken, ArkaTokenClient};
use arka_vesting::{ArkaVesting, ArkaVestingClient};
use emissions_controller::{EmissionsController, EmissionsControllerClient};
use governance_executor::{GovernanceAction, GovernanceExecutor, GovernanceExecutorClient};
use locked_arka::{LockedArka, LockedArkaClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    vec, Address, BytesN, Env, IntoVal, Symbol,
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

fn op_id(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

#[test]
fn e2e_governed_tokenomics_flows_release_vesting_emissions_and_lock_votes() {
    let env = Env::default();
    env.mock_all_auths();
    set_ledger(&env, 1_000, 100);

    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let team = Address::generate(&env);
    let ecosystem = Address::generate(&env);

    let token_id = env.register_contract(None, ArkaToken);
    let token = ArkaTokenClient::new(&env, &token_id);
    token.init(
        &admin,
        &soroban_sdk::String::from_str(&env, "ARKA"),
        &soroban_sdk::String::from_str(&env, "ARKA"),
        &7u32,
        &Some(1_000_000i128),
    );
    token.mint(&treasury, &10_000);

    let executor_id = env.register_contract(None, GovernanceExecutor);
    let executor = GovernanceExecutorClient::new(&env, &executor_id);
    executor.init(&admin, &6, &40);

    let vesting_id = env.register_contract(None, ArkaVesting);
    let vesting = ArkaVestingClient::new(&env, &vesting_id);
    vesting.init(&admin, &token_id);
    vesting.set_governor(&admin, &Some(executor_id.clone()));

    let emissions_id = env.register_contract(None, EmissionsController);
    let emissions = EmissionsControllerClient::new(&env, &emissions_id);
    emissions.init(&admin, &token_id);
    emissions.set_governor(&admin, &Some(executor_id.clone()));

    let locked_id = env.register_contract(None, LockedArka);
    let locked = LockedArkaClient::new(&env, &locked_id);
    locked.init(
        &admin,
        &token_id,
        &10u32,
        &500u32,
        &soroban_sdk::String::from_str(&env, "locked ARKA"),
        &soroban_sdk::String::from_str(&env, "lARKA"),
    );

    token.approve(&treasury, &vesting_id, &3_000);
    token.approve(&treasury, &emissions_id, &2_400);

    let scheduled_actions = vec![
        &env,
        GovernanceAction {
            contract_id: vesting_id.clone(),
            function: Symbol::new(&env, "create_grant"),
            args: vec![
                &env,
                executor_id.clone().into_val(&env),
                treasury.clone().into_val(&env),
                team.clone().into_val(&env),
                1_000u64.into_val(&env),
                1_100u64.into_val(&env),
                1_400u64.into_val(&env),
                3_000i128.into_val(&env),
                true.into_val(&env),
            ],
        },
        GovernanceAction {
            contract_id: emissions_id.clone(),
            function: Symbol::new(&env, "create_stream"),
            args: vec![
                &env,
                executor_id.clone().into_val(&env),
                treasury.clone().into_val(&env),
                ecosystem.clone().into_val(&env),
                1_000u64.into_val(&env),
                1_400u64.into_val(&env),
                2_400i128.into_val(&env),
            ],
        },
    ];
    executor.schedule(&admin, &op_id(&env, 51), &scheduled_actions);
    set_ledger(&env, 1_030, 106);
    executor.execute(&op_id(&env, 51));

    assert_eq!(token.balance(&treasury), 4_600);
    assert_eq!(vesting.grant_ids(&team).len(), 1);
    assert_eq!(emissions.stream_ids(&ecosystem).len(), 1);

    set_ledger(&env, 1_200, 120);
    assert_eq!(vesting.claimable(&1), 1_500);
    assert_eq!(vesting.claim(&1), 1_500);
    assert_eq!(emissions.releasable(&1), 1_200);
    assert_eq!(emissions.release(&1), 1_200);
    assert_eq!(token.balance(&team), 1_500);
    assert_eq!(token.balance(&ecosystem), 1_200);

    token.approve(&team, &locked_id, &1_000);
    locked.create_lock(&team, &1_000, &200u32);
    assert_eq!(locked.get_votes(&team), 1_000);
    assert_eq!(token.balance(&team), 500);

    let unwind_actions = vec![
        &env,
        GovernanceAction {
            contract_id: vesting_id.clone(),
            function: Symbol::new(&env, "revoke"),
            args: vec![
                &env,
                executor_id.clone().into_val(&env),
                1u32.into_val(&env),
                treasury.clone().into_val(&env),
            ],
        },
        GovernanceAction {
            contract_id: emissions_id.clone(),
            function: Symbol::new(&env, "cancel_stream"),
            args: vec![
                &env,
                executor_id.clone().into_val(&env),
                1u32.into_val(&env),
                treasury.clone().into_val(&env),
            ],
        },
    ];
    executor.schedule(&admin, &op_id(&env, 52), &unwind_actions);
    set_ledger(&env, 1_250, 126);
    executor.execute(&op_id(&env, 52));

    assert_eq!(vesting.claimable(&1), 375);
    assert_eq!(emissions.releasable(&1), 300);
    assert_eq!(vesting.claim(&1), 375);
    assert_eq!(emissions.release(&1), 300);
    assert_eq!(token.balance(&team), 875);
    assert_eq!(token.balance(&ecosystem), 1_500);
    assert_eq!(token.balance(&treasury), 6_625);
}
