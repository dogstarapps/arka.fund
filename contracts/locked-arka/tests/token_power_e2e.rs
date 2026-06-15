extern crate std;

use arka_token::{ArkaToken, ArkaTokenClient};
use governance_executor::{GovernanceAction, GovernanceExecutor, GovernanceExecutorClient};
use locked_arka::{LockedArka, LockedArkaClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    vec, Address, Env, IntoVal, String, Symbol,
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
fn e2e_executor_controls_token_and_snapshot_fence_over_locked_arka() {
    let env = Env::default();
    env.mock_all_auths();
    set_default_ledger(&env);

    let admin = Address::generate(&env);
    let voter = Address::generate(&env);
    let recipient = Address::generate(&env);

    let token_id = env.register_contract(None, ArkaToken);
    let token = ArkaTokenClient::new(&env, &token_id);
    token.init(
        &admin,
        &String::from_str(&env, "Arka Token"),
        &String::from_str(&env, "ARKA"),
        &7u32,
        &Some(1_000_000i128),
    );
    token.mint(&voter, &1_000);

    let executor_id = env.register_contract(None, GovernanceExecutor);
    let executor = GovernanceExecutorClient::new(&env, &executor_id);
    executor.init(&admin, &4u32, &25u32);

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
    locked.create_lock(&voter, &300, &200);

    token.set_admin(&admin, &executor_id);
    locked.set_governor(&admin, &executor_id);

    let actions = vec![
        &env,
        GovernanceAction {
            contract_id: locked_id.clone(),
            function: Symbol::new(&env, "set_vote_sequence"),
            args: vec![&env, 103u32.into_val(&env)],
        },
        GovernanceAction {
            contract_id: token_id.clone(),
            function: Symbol::new(&env, "mint"),
            args: vec![
                &env,
                recipient.clone().into_val(&env),
                25i128.into_val(&env),
            ],
        },
    ];

    let operation_id = soroban_sdk::BytesN::from_array(&env, &[42u8; 32]);
    executor.schedule(&admin, &operation_id, &actions);
    jump(&env, 4);
    executor.execute(&operation_id);

    jump(&env, 4);
    locked.increase_amount(&voter, &100);

    assert_eq!(token.balance(&recipient), 25);
    assert_eq!(locked.get_votes(&voter), 400);
    assert_eq!(locked.get_past_votes(&voter, &103), 300);
    assert_eq!(locked.get_past_total_supply(&103), 300);
}
