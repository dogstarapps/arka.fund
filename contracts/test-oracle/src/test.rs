use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    Env, Symbol,
};

#[test]
fn manages_stellar_and_symbol_prices() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    let id = env.register_contract(None, TestOracle);
    let oracle = TestOracleClient::new(&env, &id);
    let admin = Address::generate(&env);
    let asset = Address::generate(&env);
    let symbol = Symbol::new(&env, "USDC");

    env.mock_all_auths();
    oracle.init(&admin);
    oracle.set_stellar_price(&admin, &asset, &123_456_789i128, &990u64);
    oracle.set_symbol_price(&admin, &symbol, &1_000_000i128, &995u64);

    let stellar = oracle.inspect_stellar(&asset);
    let symbol_price = oracle.inspect_symbol(&symbol);
    assert_eq!(stellar.price, 123_456_789);
    assert_eq!(stellar.timestamp, 990);
    assert_eq!(symbol_price.price, 1_000_000);
    assert_eq!(symbol_price.timestamp, 995);
}

#[test]
fn rotates_admin_and_clears_prices() {
    let env = Env::default();
    env.ledger().set_timestamp(2_000);
    let id = env.register_contract(None, TestOracle);
    let oracle = TestOracleClient::new(&env, &id);
    let admin = Address::generate(&env);
    let next_admin = Address::generate(&env);
    let asset = Address::generate(&env);

    env.mock_all_auths();
    oracle.init(&admin);
    oracle.set_stellar_price(&admin, &asset, &42i128, &1_999u64);
    oracle.set_admin(&admin, &next_admin);
    oracle.clear_stellar_price(&next_admin, &asset);

    let price = oracle.inspect_stellar(&asset);
    assert_eq!(price.price, 0);
    assert_eq!(price.timestamp, 0);
    assert_eq!(oracle.admin(), next_admin);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn rejects_zero_prices() {
    let env = Env::default();
    let id = env.register_contract(None, TestOracle);
    let oracle = TestOracleClient::new(&env, &id);
    let admin = Address::generate(&env);
    let asset = Address::generate(&env);

    env.mock_all_auths();
    oracle.init(&admin);
    oracle.set_stellar_price(&admin, &asset, &0i128, &1u64);
}
