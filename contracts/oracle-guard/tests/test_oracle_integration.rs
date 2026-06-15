use oracle_guard::{OracleAsset, OracleGuard, OracleGuardClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    Address, Env,
};
use test_oracle::{TestOracle, TestOracleClient};

fn deploy_test_oracle<'a>(env: &'a Env) -> (Address, Address, TestOracleClient<'a>) {
    let id = env.register_contract(None, TestOracle);
    let client = TestOracleClient::new(env, &id);
    let admin = Address::generate(env);
    client.init(&admin);
    (id, admin, client)
}

#[test]
fn uses_secondary_test_oracle_when_feeds_diverge() {
    let env = Env::default();
    env.ledger().set_timestamp(10_000);
    env.mock_all_auths();

    let guard_id = env.register_contract(None, OracleGuard);
    let guard = OracleGuardClient::new(&env, &guard_id);
    let guard_admin = Address::generate(&env);
    let asset = Address::generate(&env);

    guard.init(&guard_admin);
    let (primary_id, primary_admin, primary) = deploy_test_oracle(&env);
    let (secondary_id, secondary_admin, secondary) = deploy_test_oracle(&env);

    primary.set_stellar_price(&primary_admin, &asset, &11_000_000i128, &9_995u64);
    secondary.set_stellar_price(&secondary_admin, &asset, &10_000_000i128, &9_998u64);

    guard.set_stellar_asset_policy(
        &guard_admin,
        &asset,
        &primary_id,
        &secondary_id,
        &true,
        &120u64,
        &500u32,
        &false,
        &1u32,
    );

    let inspection = guard.inspect_stellar(&asset);
    let price = guard.lastprice(&OracleAsset::Stellar(asset.clone()));
    assert!(inspection.diverged);
    assert_eq!(inspection.selected_source, 2);
    assert_eq!(inspection.price, 10_000_000);
    assert_eq!(price.price, 10_000_000);
    assert_eq!(price.timestamp, 9_998);
}

#[test]
fn fail_closes_when_secondary_confirmation_is_required_and_missing() {
    let env = Env::default();
    env.ledger().set_timestamp(20_000);
    env.mock_all_auths();

    let guard_id = env.register_contract(None, OracleGuard);
    let guard = OracleGuardClient::new(&env, &guard_id);
    let guard_admin = Address::generate(&env);
    let asset = Address::generate(&env);

    guard.init(&guard_admin);
    let (primary_id, primary_admin, primary) = deploy_test_oracle(&env);
    let (secondary_id, _secondary_admin, _secondary) = deploy_test_oracle(&env);

    primary.set_stellar_price(&primary_admin, &asset, &2_000_000i128, &19_999u64);

    guard.set_stellar_asset_policy(
        &guard_admin,
        &asset,
        &primary_id,
        &secondary_id,
        &true,
        &120u64,
        &500u32,
        &true,
        &0u32,
    );

    let inspection = guard.inspect_stellar(&asset);
    let price = guard.lastprice(&OracleAsset::Stellar(asset));
    assert_eq!(inspection.selected_source, 0);
    assert_eq!(inspection.price, 0);
    assert_eq!(price.price, 0);
    assert_eq!(price.timestamp, 19_999);
    assert!(!inspection.secondary_usable);
    assert!(inspection.secondary_configured);
}
