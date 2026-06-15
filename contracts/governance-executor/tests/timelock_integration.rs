extern crate std;

use arka_factory::{ArkaFactory, ArkaFactoryClient};
use coverage_fund::{CoverageFund, CoverageFundClient};
use governance_executor::{GovernanceAction, GovernanceExecutor, GovernanceExecutorClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    vec, Address, BytesN, Env, IntoVal, Symbol,
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

fn op_id(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

#[test]
fn integration_updates_coverage_policy_through_executor() {
    let env = Env::default();
    env.mock_all_auths();
    set_default_ledger(&env);

    let admin = Address::generate(&env);
    let executor_id = env.register_contract(None, GovernanceExecutor);
    let executor = GovernanceExecutorClient::new(&env, &executor_id);
    executor.init(&admin, &4, &25);

    let fund_id = env.register_contract(None, CoverageFund);
    let fund = CoverageFundClient::new(&env, &fund_id);
    let reserve = Address::generate(&env);
    let boot = Address::generate(&env);
    fund.init(&admin, &reserve, &boot);
    fund.set_governor(&admin, &executor_id);

    let treasury = Address::generate(&env);
    let actions = vec![
        &env,
        GovernanceAction {
            contract_id: fund_id.clone(),
            function: Symbol::new(&env, "set_treasury"),
            args: vec![
                &env,
                executor_id.clone().into_val(&env),
                Some(treasury.clone()).into_val(&env),
            ],
        },
    ];

    executor.schedule(&admin, &op_id(&env, 21), &actions);
    jump(&env, 4);
    executor.execute(&op_id(&env, 21));

    assert_eq!(fund.treasury(), Some(treasury));
}

#[test]
fn integration_batches_factory_fee_defaults_through_executor() {
    let env = Env::default();
    env.mock_all_auths();
    set_default_ledger(&env);

    let admin = Address::generate(&env);
    let executor_id = env.register_contract(None, GovernanceExecutor);
    let executor = GovernanceExecutorClient::new(&env, &executor_id);
    executor.init(&admin, &3, &30);

    let factory_id = env.register_contract(None, ArkaFactory);
    let factory = ArkaFactoryClient::new(&env, &factory_id);
    factory.set_governor(&executor_id);

    let treasury = Address::generate(&env);
    let actions = vec![
        &env,
        GovernanceAction {
            contract_id: factory_id.clone(),
            function: Symbol::new(&env, "set_protocol_treasury"),
            args: vec![&env, treasury.clone().into_val(&env)],
        },
        GovernanceAction {
            contract_id: factory_id.clone(),
            function: Symbol::new(&env, "set_protocol_fee_splits"),
            args: vec![&env, 1_250i32.into_val(&env), 2_250i32.into_val(&env)],
        },
    ];

    executor.schedule(&admin, &op_id(&env, 22), &actions);
    jump(&env, 3);
    let receipt = executor.execute(&op_id(&env, 22));

    assert_eq!(receipt.action_count, 2);
    assert_eq!(factory.get_protocol_treasury(), Some(treasury));
    assert_eq!(factory.get_protocol_mgmt_fee_bps(), 1_250);
    assert_eq!(factory.get_protocol_perf_fee_bps(), 2_250);
}
