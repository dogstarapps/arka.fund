extern crate std;

use super::*;
use governance_token::{GovToken, GovTokenClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    IntoVal,
};

const ONE_DAY_LEDGERS: u32 = 17_280;

fn operation_id(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
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

#[test]
fn test_schedule_execute_against_real_governance_token() {
    let env = Env::default();
    env.mock_all_auths();
    set_default_ledger(&env);

    let executor_id = env.register_contract(None, GovernanceExecutor);
    let executor = GovernanceExecutorClient::new(&env, &executor_id);
    let admin = Address::generate(&env);
    executor.init(&admin, &5, &20);

    let token_id = env.register_contract(None, GovToken);
    let token = GovTokenClient::new(&env, &token_id);
    token.init(&executor_id);

    let user = Address::generate(&env);
    let actions = vec![
        &env,
        GovernanceAction {
            contract_id: token_id.clone(),
            function: Symbol::new(&env, "mint"),
            args: vec![&env, user.clone().into_val(&env), 250i128.into_val(&env)],
        },
    ];
    let op_id = operation_id(&env, 7);
    executor.schedule(&admin, &op_id, &actions);

    jump(&env, 5);
    let receipt = executor.execute(&op_id);
    assert_eq!(receipt.action_count, 1);
    assert_eq!(token.balance(&user), 250);
    assert!(matches!(
        executor.current_operation_status(&op_id),
        Some(OperationStatus::Executed)
    ));
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_execute_before_ready_panics() {
    let env = Env::default();
    env.mock_all_auths();
    set_default_ledger(&env);

    let executor_id = env.register_contract(None, GovernanceExecutor);
    let executor = GovernanceExecutorClient::new(&env, &executor_id);
    let admin = Address::generate(&env);
    executor.init(&admin, &3, &10);

    let token_id = env.register_contract(None, GovToken);
    let token = GovTokenClient::new(&env, &token_id);
    token.init(&executor_id);

    let user = Address::generate(&env);
    let actions = vec![
        &env,
        GovernanceAction {
            contract_id: token_id,
            function: Symbol::new(&env, "mint"),
            args: vec![&env, user.into_val(&env), 10i128.into_val(&env)],
        },
    ];
    let op_id = operation_id(&env, 8);
    executor.schedule(&admin, &op_id, &actions);
    executor.execute(&op_id);
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn test_cancelled_operation_cannot_execute() {
    let env = Env::default();
    env.mock_all_auths();
    set_default_ledger(&env);

    let executor_id = env.register_contract(None, GovernanceExecutor);
    let executor = GovernanceExecutorClient::new(&env, &executor_id);
    let admin = Address::generate(&env);
    executor.init(&admin, &2, &10);

    let token_id = env.register_contract(None, GovToken);
    let token = GovTokenClient::new(&env, &token_id);
    token.init(&executor_id);

    let user = Address::generate(&env);
    let actions = vec![
        &env,
        GovernanceAction {
            contract_id: token_id,
            function: Symbol::new(&env, "mint"),
            args: vec![&env, user.into_val(&env), 5i128.into_val(&env)],
        },
    ];
    let op_id = operation_id(&env, 9);
    executor.schedule(&admin, &op_id, &actions);
    executor.cancel(&admin, &op_id);
    jump(&env, 2);
    executor.execute(&op_id);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn test_expired_bootstrap_admin_cannot_schedule() {
    let env = Env::default();
    env.mock_all_auths();
    set_default_ledger(&env);

    let executor_id = env.register_contract(None, GovernanceExecutor);
    let executor = GovernanceExecutorClient::new(&env, &executor_id);
    let admin = Address::generate(&env);
    executor.init(&admin, &2, &10);
    executor.set_bootstrap_admin_expiry(&admin, &(env.ledger().timestamp() + 10));

    let token_id = env.register_contract(None, GovToken);
    let user = Address::generate(&env);
    let actions = vec![
        &env,
        GovernanceAction {
            contract_id: token_id,
            function: Symbol::new(&env, "mint"),
            args: vec![&env, user.into_val(&env), 5i128.into_val(&env)],
        },
    ];
    let op_id = operation_id(&env, 10);
    jump(&env, 3);

    executor.schedule(&admin, &op_id, &actions);
}

#[test]
fn test_governor_can_rotate_admin_after_bootstrap_expiry() {
    let env = Env::default();
    env.mock_all_auths();
    set_default_ledger(&env);

    let executor_id = env.register_contract(None, GovernanceExecutor);
    let executor = GovernanceExecutorClient::new(&env, &executor_id);
    let admin = Address::generate(&env);
    let governor = Address::generate(&env);
    let dao_admin = Address::generate(&env);
    executor.init(&admin, &2, &10);
    executor.set_governor(&admin, &Some(governor.clone()));
    executor.set_bootstrap_admin_expiry(&admin, &(env.ledger().timestamp() + 10));
    jump(&env, 3);

    assert!(!executor.bootstrap_admin_active());
    executor.set_admin(&governor, &dao_admin);

    assert_eq!(executor.config().admin, dao_admin);
}

#[test]
#[should_panic(expected = "Error(Contract, #12)")]
fn test_bootstrap_admin_expiry_rejects_windows_over_one_year() {
    let env = Env::default();
    env.mock_all_auths();
    set_default_ledger(&env);

    let executor_id = env.register_contract(None, GovernanceExecutor);
    let executor = GovernanceExecutorClient::new(&env, &executor_id);
    let admin = Address::generate(&env);
    executor.init(&admin, &2, &10);

    executor.set_bootstrap_admin_expiry(
        &admin,
        &(env.ledger().timestamp() + MAX_BOOTSTRAP_ADMIN_SECONDS + 1),
    );
}

#[test]
#[should_panic(expected = "bootstrap_admin_expiry_locked")]
fn test_bootstrap_admin_expiry_cannot_be_extended() {
    let env = Env::default();
    env.mock_all_auths();
    set_default_ledger(&env);

    let executor_id = env.register_contract(None, GovernanceExecutor);
    let executor = GovernanceExecutorClient::new(&env, &executor_id);
    let admin = Address::generate(&env);
    executor.init(&admin, &2, &10);

    let first_expiry = env.ledger().timestamp() + 10;
    executor.set_bootstrap_admin_expiry(&admin, &first_expiry);
    executor.set_bootstrap_admin_expiry(&admin, &(first_expiry + 1));
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn test_admin_cannot_clear_bootstrap_expiry_without_governor() {
    let env = Env::default();
    env.mock_all_auths();
    set_default_ledger(&env);

    let executor_id = env.register_contract(None, GovernanceExecutor);
    let executor = GovernanceExecutorClient::new(&env, &executor_id);
    let admin = Address::generate(&env);
    executor.init(&admin, &2, &10);
    executor.set_bootstrap_admin_expiry(&admin, &(env.ledger().timestamp() + 10));

    executor.clear_bootstrap_admin_expiry(&admin);
}

#[test]
fn test_governor_clears_bootstrap_expiry_after_handoff() {
    let env = Env::default();
    env.mock_all_auths();
    set_default_ledger(&env);

    let executor_id = env.register_contract(None, GovernanceExecutor);
    let executor = GovernanceExecutorClient::new(&env, &executor_id);
    let admin = Address::generate(&env);
    let governor = Address::generate(&env);
    executor.init(&admin, &2, &10);
    executor.set_governor(&admin, &Some(governor.clone()));
    executor.set_bootstrap_admin_expiry(&admin, &(env.ledger().timestamp() + 10));

    executor.clear_bootstrap_admin_expiry(&governor);

    assert_eq!(executor.bootstrap_admin_expires_at(), Some(0));
    assert!(!executor.bootstrap_admin_active());
}
