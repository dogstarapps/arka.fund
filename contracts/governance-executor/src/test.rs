extern crate std;

use super::*;
use governance_token::{GovToken, GovTokenClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo, MockAuth, MockAuthInvoke},
    IntoVal,
};

mod sushi {
    soroban_sdk::contractimport!(file = "../../release/wasm/adapter-sushi.wasm");
}

fn authorize(env: &Env, caller: &Address, executor: &Address, method: &str, args: Vec<Val>) {
    env.mock_auths(&[MockAuth {
        address: caller,
        invoke: &MockAuthInvoke {
            contract: executor,
            fn_name: method,
            args,
            sub_invokes: &[],
        },
    }]);
}

fn sushi_deployment(env: &Env, owner: &Address, seed: u8) -> ContractDeployment {
    ContractDeployment {
        wasm_hash: env
            .deployer()
            .upload_contract_wasm(&include_bytes!("../../../release/wasm/adapter-sushi.wasm")[..]),
        salt: BytesN::from_array(env, &[seed; 32]),
        constructor_args: vec![
            env,
            owner.into_val(env),
            Address::generate(env).into_val(env),
        ],
    }
}

#[test]
fn governed_deployment_constructs_real_sushi_and_controls_callers_without_source_auth() {
    let env = Env::default();
    set_default_ledger(&env);
    let admin = Address::generate(&env);
    let executor_id = env.register(GovernanceExecutor, (&admin, &3u32, &20u32));
    let executor = GovernanceExecutorClient::new(&env, &executor_id);
    let id = operation_id(&env, 90);
    let deployment = sushi_deployment(&env, &executor_id, 1);
    authorize(
        &env,
        &admin,
        &executor_id,
        "schedule_deployment",
        (&admin, &id, &deployment).into_val(&env),
    );
    let queued = executor.schedule_deployment(&admin, &id, &deployment);
    assert_eq!(queued.ready_at, 103);
    assert!(executor.operation(&id).is_none());
    assert!(executor.deployment_operation(&id).is_some());
    assert!(matches!(
        executor.try_execute(&id),
        Err(Ok(error)) if error == Error::OperationNotReady.into()
    ));
    jump(&env, 3);
    let address = executor.deployment_address(&id).unwrap();
    assert_eq!(executor.execute(&id).action_count, 1);
    assert!(env.auths().is_empty());
    let sushi = sushi::Client::new(&env, &address);
    let fund = Address::generate(&env);
    assert!(!sushi.is_caller(&fund));
    let actions = vec![
        &env,
        GovernanceAction {
            contract_id: address,
            function: Symbol::new(&env, "set_caller"),
            args: (&executor_id, &fund, true).into_val(&env),
        },
    ];
    let caller_op = operation_id(&env, 91);
    authorize(
        &env,
        &admin,
        &executor_id,
        "schedule",
        (&admin, &caller_op, &actions).into_val(&env),
    );
    executor.schedule(&admin, &caller_op, &actions);
    jump(&env, 3);
    executor.execute(&caller_op);
    assert!(env.auths().is_empty());
    assert!(sushi.is_caller(&fund));
    assert!(matches!(
        executor.try_execute(&id),
        Err(Ok(error)) if error == Error::OperationAlreadyExecuted.into()
    ));
}

#[test]
fn constructor_auth_failure_leaves_deployment_pending() {
    let env = Env::default();
    set_default_ledger(&env);
    let admin = Address::generate(&env);
    let executor_id = env.register(GovernanceExecutor, (&admin, &2u32, &10u32));
    let executor = GovernanceExecutorClient::new(&env, &executor_id);
    let id = operation_id(&env, 92);
    let deployment = sushi_deployment(&env, &Address::generate(&env), 2);
    authorize(
        &env,
        &admin,
        &executor_id,
        "schedule_deployment",
        (&admin, &id, &deployment).into_val(&env),
    );
    executor.schedule_deployment(&admin, &id, &deployment);
    jump(&env, 2);
    assert!(executor.try_execute(&id).is_err());
    assert!(matches!(
        executor.current_operation_status(&id),
        Some(OperationStatus::Pending)
    ));
    assert_eq!(
        executor.deployment_operation(&id).unwrap().deployment.salt,
        deployment.salt
    );
}

#[test]
fn deployment_and_call_ids_share_one_namespace_and_cancellation_lifecycle() {
    let env = Env::default();
    set_default_ledger(&env);
    let admin = Address::generate(&env);
    let executor_id = env.register(GovernanceExecutor, (&admin, &2u32, &10u32));
    let executor = GovernanceExecutorClient::new(&env, &executor_id);
    let deployment = sushi_deployment(&env, &executor_id, 3);
    let id = operation_id(&env, 93);
    authorize(
        &env,
        &admin,
        &executor_id,
        "schedule_deployment",
        (&admin, &id, &deployment).into_val(&env),
    );
    executor.schedule_deployment(&admin, &id, &deployment);
    let actions = vec![
        &env,
        GovernanceAction {
            contract_id: executor_id.clone(),
            function: Symbol::new(&env, "unused"),
            args: vec![&env],
        },
    ];
    authorize(
        &env,
        &admin,
        &executor_id,
        "schedule",
        (&admin, &id, &actions).into_val(&env),
    );
    assert!(matches!(
        executor.try_schedule(&admin, &id, &actions),
        Err(Ok(error)) if error == Error::OperationExists.into()
    ));
    authorize(
        &env,
        &admin,
        &executor_id,
        "cancel_deployment",
        (&admin, &id).into_val(&env),
    );
    assert!(matches!(
        executor.cancel_deployment(&admin, &id).status,
        OperationStatus::Cancelled
    ));
    assert!(!executor.is_ready(&id));
    jump(&env, 2);
    assert!(matches!(
        executor.try_execute(&id),
        Err(Ok(error)) if error == Error::OperationCancelled.into()
    ));

    let call_id = operation_id(&env, 94);
    authorize(
        &env,
        &admin,
        &executor_id,
        "schedule",
        (&admin, &call_id, &actions).into_val(&env),
    );
    executor.schedule(&admin, &call_id, &actions);
    authorize(
        &env,
        &admin,
        &executor_id,
        "schedule_deployment",
        (&admin, &call_id, &deployment).into_val(&env),
    );
    assert!(matches!(
        executor.try_schedule_deployment(&admin, &call_id, &deployment),
        Err(Ok(error)) if error == Error::OperationExists.into()
    ));
}

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

    let admin = Address::generate(&env);
    let executor_id = env.register(GovernanceExecutor, (&admin, &5u32, &20u32));
    let executor = GovernanceExecutorClient::new(&env, &executor_id);

    let token_id = env.register(GovToken, (&executor_id,));
    let token = GovTokenClient::new(&env, &token_id);

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

    let admin = Address::generate(&env);
    let executor_id = env.register(GovernanceExecutor, (&admin, &3u32, &10u32));
    let executor = GovernanceExecutorClient::new(&env, &executor_id);

    let token_id = env.register(GovToken, (&executor_id,));
    let token = GovTokenClient::new(&env, &token_id);

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

    let admin = Address::generate(&env);
    let executor_id = env.register(GovernanceExecutor, (&admin, &2u32, &10u32));
    let executor = GovernanceExecutorClient::new(&env, &executor_id);

    let token_id = env.register(GovToken, (&executor_id,));
    let token = GovTokenClient::new(&env, &token_id);

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

    let admin = Address::generate(&env);
    let executor_id = env.register(GovernanceExecutor, (&admin, &2u32, &10u32));
    let executor = GovernanceExecutorClient::new(&env, &executor_id);
    executor.set_bootstrap_admin_expiry(&admin, &(env.ledger().timestamp() + 10));

    let token_id = env.register(GovToken, (&admin,));
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

    let admin = Address::generate(&env);
    let governor = Address::generate(&env);
    let dao_admin = Address::generate(&env);
    let executor_id = env.register(GovernanceExecutor, (&admin, &2u32, &10u32));
    let executor = GovernanceExecutorClient::new(&env, &executor_id);
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

    let admin = Address::generate(&env);
    let executor_id = env.register(GovernanceExecutor, (&admin, &2u32, &10u32));
    let executor = GovernanceExecutorClient::new(&env, &executor_id);

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

    let admin = Address::generate(&env);
    let executor_id = env.register(GovernanceExecutor, (&admin, &2u32, &10u32));
    let executor = GovernanceExecutorClient::new(&env, &executor_id);

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

    let admin = Address::generate(&env);
    let executor_id = env.register(GovernanceExecutor, (&admin, &2u32, &10u32));
    let executor = GovernanceExecutorClient::new(&env, &executor_id);
    executor.set_bootstrap_admin_expiry(&admin, &(env.ledger().timestamp() + 10));

    executor.clear_bootstrap_admin_expiry(&admin);
}

#[test]
fn test_governor_clears_bootstrap_expiry_after_handoff() {
    let env = Env::default();
    env.mock_all_auths();
    set_default_ledger(&env);

    let admin = Address::generate(&env);
    let governor = Address::generate(&env);
    let executor_id = env.register(GovernanceExecutor, (&admin, &2u32, &10u32));
    let executor = GovernanceExecutorClient::new(&env, &executor_id);
    executor.set_governor(&admin, &Some(governor.clone()));
    executor.set_bootstrap_admin_expiry(&admin, &(env.ledger().timestamp() + 10));

    executor.clear_bootstrap_admin_expiry(&governor);

    assert_eq!(executor.bootstrap_admin_expires_at(), Some(0));
    assert!(!executor.bootstrap_admin_active());
}


#[test]
fn optional_governor_clear_keeps_scheduler_fallback_and_never_revives_retired_admin() {
    let env = Env::default();
    set_default_ledger(&env);
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let governor = Address::generate(&env);
    let stranger = Address::generate(&env);
    let id = env.register(GovernanceExecutor, (&admin, &3u32, &20u32));
    let client = GovernanceExecutorClient::new(&env, &id);
    let token_id = env.register(GovToken, (&id,));
    let recipient = Address::generate(&env);
    let actions = vec![&env, GovernanceAction {
        contract_id: token_id.clone(),
        function: Symbol::new(&env, "mint"),
        args: (&recipient, &100i128).into_val(&env),
    }];
    assert_eq!(client.config().governor, None);
    client.set_governor(&admin, &None);
    let op = operation_id(&env, 210);
    assert!(client.try_schedule(&stranger, &op, &actions).is_err());
    client.schedule(&admin, &op, &actions);
    assert!(client.try_execute(&op).is_err());
    jump(&env, 3);
    client.execute(&op);
    assert_eq!(GovTokenClient::new(&env, &token_id).balance(&recipient), 100);
    client.set_governor(&admin, &Some(governor.clone()));
    client.clear_bootstrap_admin_expiry(&governor);
    client.set_governor(&governor, &None);
    assert!(!client.bootstrap_admin_active());
    assert!(client.try_set_governor(&admin, &Some(admin.clone())).is_err());
    assert!(client.try_schedule(&admin, &operation_id(&env, 211), &actions).is_err());
}
