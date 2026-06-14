extern crate std;

use arka::{ArkaContract, ArkaContractClient};
use coverage_fund::{CoverageFund, CoverageFundClient};
use governance_executor::{GovernanceAction, GovernanceExecutor, GovernanceExecutorClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    vec, Address, BytesN, Env, IntoVal, Symbol, Vec as SorobanVec,
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
fn e2e_executor_controls_arka_and_coverage_after_handoff() {
    let env = Env::default();
    env.mock_all_auths();
    set_default_ledger(&env);

    let admin = Address::generate(&env);
    let manager = Address::generate(&env);
    let executor_id = env.register_contract(None, GovernanceExecutor);
    let executor = GovernanceExecutorClient::new(&env, &executor_id);
    executor.init(&admin, &6, &40);

    let arka_id = env.register_contract(None, ArkaContract);
    let arka = ArkaContractClient::new(&env, &arka_id);
    let denom = Address::generate(&env);
    let whitelist = SorobanVec::new(&env);
    arka.init(&denom, &0, &0, &0, &0, &whitelist, &manager);
    arka.set_governor(&manager, &executor_id);

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
            contract_id: arka_id.clone(),
            function: Symbol::new(&env, "set_fees"),
            args: vec![
                &env,
                executor_id.clone().into_val(&env),
                200i32.into_val(&env),
                1_500i32.into_val(&env),
                10i32.into_val(&env),
                20i32.into_val(&env),
            ],
        },
        GovernanceAction {
            contract_id: fund_id.clone(),
            function: Symbol::new(&env, "set_treasury"),
            args: vec![
                &env,
                executor_id.clone().into_val(&env),
                Some(treasury.clone()).into_val(&env),
            ],
        },
        GovernanceAction {
            contract_id: fund_id,
            function: Symbol::new(&env, "set_covered_vault_policy"),
            args: vec![
                &env,
                executor_id.clone().into_val(&env),
                arka_id.clone().into_val(&env),
                600i32.into_val(&env),
                50_000i128.into_val(&env),
            ],
        },
    ];

    let queued = executor.schedule(&admin, &op_id(&env, 33), &actions);
    assert_eq!(queued.ready_at, 106);
    assert!(executor.operation(&op_id(&env, 33)).is_some());

    jump(&env, 6);
    let receipt = executor.execute(&op_id(&env, 33));
    assert_eq!(receipt.action_count, 3);

    let fees = arka.fees();
    assert_eq!(fees.mgmt_bps, 200);
    assert_eq!(fees.perf_bps, 1_500);
    assert_eq!(fees.deposit_bps, 10);
    assert_eq!(fees.redeem_bps, 20);

    assert_eq!(fund.treasury(), Some(treasury));
    let policy = fund
        .covered_vault_policy(&arka_id)
        .expect("policy should exist");
    assert_eq!(policy.annual_premium_bps, 600);
    assert_eq!(policy.coverage_limit, 50_000);
}
