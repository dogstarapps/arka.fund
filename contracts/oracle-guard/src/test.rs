use super::*;
use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Ledger as _},
    Env,
};

#[derive(Clone)]
#[contracttype]
enum FeedKey {
    Price(OracleAsset),
    Timestamp(OracleAsset),
}

#[contract]
struct DummyOracle;

#[contractimpl]
impl DummyOracle {
    pub fn set_price(env: Env, asset: OracleAsset, price: i128, timestamp: u64) {
        env.storage()
            .instance()
            .set(&FeedKey::Price(asset.clone()), &price);
        env.storage()
            .instance()
            .set(&FeedKey::Timestamp(asset), &timestamp);
    }

    pub fn lastprice(env: Env, asset: OracleAsset) -> OraclePriceData {
        OraclePriceData {
            price: env
                .storage()
                .instance()
                .get(&FeedKey::Price(asset.clone()))
                .unwrap_or(0),
            timestamp: env
                .storage()
                .instance()
                .get(&FeedKey::Timestamp(asset))
                .unwrap_or(0u64),
        }
    }
}

fn setup_guard<'a>(env: &'a Env) -> (OracleGuardClient<'a>, Address, OracleAsset) {
    if env.ledger().timestamp() == 0 {
        env.ledger().set_timestamp(1_000);
    }
    let guard_id = env.register_contract(None, OracleGuard);
    let guard = OracleGuardClient::new(env, &guard_id);
    let admin = Address::generate(env);
    env.mock_all_auths();
    guard.init(&admin);
    let asset = OracleAsset::Stellar(Address::generate(env));
    (guard, admin, asset)
}

fn deploy_oracle<'a>(env: &'a Env) -> (Address, DummyOracleClient<'a>) {
    let id = env.register_contract(None, DummyOracle);
    let client = DummyOracleClient::new(env, &id);
    (id, client)
}

#[test]
fn uses_primary_when_single_feed_is_healthy() {
    let env = Env::default();
    let (guard, admin, asset) = setup_guard(&env);
    let (primary_id, primary) = deploy_oracle(&env);
    primary.set_price(&asset, &10_000_000i128, &990u64);
    guard.set_stellar_asset_policy(
        &admin,
        &match asset.clone() {
            OracleAsset::Stellar(address) => address,
            _ => panic!("unexpected_asset"),
        },
        &primary_id,
        &primary_id,
        &false,
        &120u64,
        &500u32,
        &false,
        &DIVERGENCE_FAIL_CLOSED,
    );

    let price = guard.lastprice(&asset);
    assert_eq!(price.price, 10_000_000);
    let inspection = guard.inspect_stellar(&match asset {
        OracleAsset::Stellar(address) => address,
        _ => panic!("unexpected_asset"),
    });
    assert_eq!(inspection.selected_source, SOURCE_PRIMARY);
}

#[test]
fn falls_back_to_secondary_when_primary_is_invalid() {
    let env = Env::default();
    let (guard, admin, asset) = setup_guard(&env);
    let asset_id = match asset.clone() {
        OracleAsset::Stellar(address) => address,
        _ => panic!("unexpected_asset"),
    };
    let (primary_id, primary) = deploy_oracle(&env);
    let (secondary_id, secondary) = deploy_oracle(&env);
    primary.set_price(&asset, &0i128, &990u64);
    secondary.set_price(&asset, &9_900_000i128, &995u64);
    guard.set_stellar_asset_policy(
        &admin,
        &asset_id,
        &primary_id,
        &secondary_id,
        &true,
        &120u64,
        &500u32,
        &false,
        &DIVERGENCE_FAIL_CLOSED,
    );

    let price = guard.lastprice(&asset);
    assert_eq!(price.price, 9_900_000);
    let inspection = guard.inspect_stellar(&asset_id);
    assert_eq!(inspection.selected_source, SOURCE_SECONDARY);
}

#[test]
fn fail_closes_when_secondary_confirmation_is_required() {
    let env = Env::default();
    let (guard, admin, asset) = setup_guard(&env);
    let asset_id = match asset.clone() {
        OracleAsset::Stellar(address) => address,
        _ => panic!("unexpected_asset"),
    };
    let (primary_id, primary) = deploy_oracle(&env);
    let (secondary_id, _secondary) = deploy_oracle(&env);
    primary.set_price(&asset, &10_000_000i128, &995u64);
    guard.set_stellar_asset_policy(
        &admin,
        &asset_id,
        &primary_id,
        &secondary_id,
        &true,
        &120u64,
        &500u32,
        &true,
        &DIVERGENCE_FAIL_CLOSED,
    );

    let price = guard.lastprice(&asset);
    assert_eq!(price.price, 0);
    let inspection = guard.inspect_stellar(&asset_id);
    assert_eq!(inspection.selected_source, SOURCE_NONE);
}

#[test]
fn uses_secondary_on_divergence_when_configured() {
    let env = Env::default();
    let (guard, admin, asset) = setup_guard(&env);
    let asset_id = match asset.clone() {
        OracleAsset::Stellar(address) => address,
        _ => panic!("unexpected_asset"),
    };
    let (primary_id, primary) = deploy_oracle(&env);
    let (secondary_id, secondary) = deploy_oracle(&env);
    primary.set_price(&asset, &100_000_000i128, &990u64);
    secondary.set_price(&asset, &10_000_000i128, &995u64);
    guard.set_stellar_asset_policy(
        &admin,
        &asset_id,
        &primary_id,
        &secondary_id,
        &true,
        &120u64,
        &500u32,
        &false,
        &DIVERGENCE_USE_SECONDARY,
    );

    let price = guard.lastprice(&asset);
    assert_eq!(price.price, 10_000_000);
    let inspection = guard.inspect_stellar(&asset_id);
    assert!(inspection.diverged);
    assert_eq!(inspection.selected_source, SOURCE_SECONDARY);
}

#[test]
fn uses_lower_price_on_divergence_when_configured() {
    let env = Env::default();
    let (guard, admin, asset) = setup_guard(&env);
    let asset_id = match asset.clone() {
        OracleAsset::Stellar(address) => address,
        _ => panic!("unexpected_asset"),
    };
    let (primary_id, primary) = deploy_oracle(&env);
    let (secondary_id, secondary) = deploy_oracle(&env);
    primary.set_price(&asset, &11_000_000i128, &995u64);
    secondary.set_price(&asset, &10_000_000i128, &990u64);
    guard.set_stellar_asset_policy(
        &admin,
        &asset_id,
        &primary_id,
        &secondary_id,
        &true,
        &120u64,
        &200u32,
        &false,
        &DIVERGENCE_USE_LOWER_PRICE,
    );

    let price = guard.lastprice(&asset);
    assert_eq!(price.price, 10_000_000);
    let inspection = guard.inspect_stellar(&asset_id);
    assert_eq!(inspection.selected_source, SOURCE_LOWER_PRICE);
}

#[test]
fn rejects_stale_primary_feed() {
    let env = Env::default();
    let (guard, admin, asset) = setup_guard(&env);
    let asset_id = match asset.clone() {
        OracleAsset::Stellar(address) => address,
        _ => panic!("unexpected_asset"),
    };
    let (primary_id, primary) = deploy_oracle(&env);
    primary.set_price(&asset, &10_000_000i128, &100u64);
    guard.set_stellar_asset_policy(
        &admin,
        &asset_id,
        &primary_id,
        &primary_id,
        &false,
        &60u64,
        &500u32,
        &false,
        &DIVERGENCE_FAIL_CLOSED,
    );

    let price = guard.lastprice(&asset);
    assert_eq!(price.price, 0);
    let inspection = guard.inspect_stellar(&asset_id);
    assert!(!inspection.primary_usable);
}

#[test]
fn guardian_can_pause_asset_policy_but_admin_resumes_it() {
    let env = Env::default();
    let (guard, admin, asset) = setup_guard(&env);
    let asset_id = match asset.clone() {
        OracleAsset::Stellar(address) => address,
        _ => panic!("unexpected_asset"),
    };
    let guardian = Address::generate(&env);
    let (primary_id, primary) = deploy_oracle(&env);
    primary.set_price(&asset, &10_000_000i128, &995u64);
    guard.set_stellar_asset_policy(
        &admin,
        &asset_id,
        &primary_id,
        &primary_id,
        &false,
        &120u64,
        &500u32,
        &false,
        &DIVERGENCE_FAIL_CLOSED,
    );
    guard.set_guardian(&admin, &guardian, &1_500u64);

    guard.pause_stellar_asset_policy(&guardian, &asset_id);

    assert!(guard.stellar_asset_policy_paused(&asset_id));
    assert!(guard.is_guardian_active());
    let paused_price = guard.lastprice(&asset);
    assert_eq!(paused_price.price, 0);
    assert_eq!(
        guard.inspect_stellar(&asset_id).selected_source,
        SOURCE_NONE
    );

    guard.resume_stellar_asset_policy(&admin, &asset_id);

    assert!(!guard.stellar_asset_policy_paused(&asset_id));
    let live_price = guard.lastprice(&asset);
    assert_eq!(live_price.price, 10_000_000);
}

#[test]
fn setting_policy_by_admin_clears_emergency_pause() {
    let env = Env::default();
    let (guard, admin, asset) = setup_guard(&env);
    let asset_id = match asset.clone() {
        OracleAsset::Stellar(address) => address,
        _ => panic!("unexpected_asset"),
    };
    let guardian = Address::generate(&env);
    let (primary_id, primary) = deploy_oracle(&env);
    primary.set_price(&asset, &10_000_000i128, &995u64);
    guard.set_stellar_asset_policy(
        &admin,
        &asset_id,
        &primary_id,
        &primary_id,
        &false,
        &120u64,
        &500u32,
        &false,
        &DIVERGENCE_FAIL_CLOSED,
    );
    guard.set_guardian(&admin, &guardian, &1_500u64);
    guard.pause_stellar_asset_policy(&guardian, &asset_id);
    assert!(guard.stellar_asset_policy_paused(&asset_id));

    guard.set_stellar_asset_policy(
        &admin,
        &asset_id,
        &primary_id,
        &primary_id,
        &false,
        &120u64,
        &500u32,
        &false,
        &DIVERGENCE_FAIL_CLOSED,
    );

    assert!(!guard.stellar_asset_policy_paused(&asset_id));
    assert_eq!(guard.lastprice(&asset).price, 10_000_000);
}

#[test]
fn guardian_expiry_is_reported_from_config() {
    let env = Env::default();
    let (guard, admin, _asset) = setup_guard(&env);
    let guardian = Address::generate(&env);
    guard.set_guardian(&admin, &guardian, &1_100u64);
    let config = guard.guardian_config();
    assert_eq!(config.guardian, Some(guardian));
    assert_eq!(config.expires_at, 1_100);
    assert!(config.active);

    env.ledger().set_timestamp(1_101);

    let expired = guard.guardian_config();
    assert!(!expired.active);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn expired_guardian_cannot_pause_asset_policy() {
    let env = Env::default();
    let (guard, admin, asset) = setup_guard(&env);
    let asset_id = match asset {
        OracleAsset::Stellar(address) => address,
        _ => panic!("unexpected_asset"),
    };
    let guardian = Address::generate(&env);
    guard.set_guardian(&admin, &guardian, &1_001u64);
    env.ledger().set_timestamp(1_002);

    guard.pause_stellar_asset_policy(&guardian, &asset_id);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn guardian_cannot_resume_paused_asset_policy() {
    let env = Env::default();
    let (guard, admin, asset) = setup_guard(&env);
    let asset_id = match asset {
        OracleAsset::Stellar(address) => address,
        _ => panic!("unexpected_asset"),
    };
    let guardian = Address::generate(&env);
    guard.set_guardian(&admin, &guardian, &1_500u64);
    guard.pause_stellar_asset_policy(&guardian, &asset_id);

    guard.resume_stellar_asset_policy(&guardian, &asset_id);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn non_admin_cannot_set_guardian() {
    let env = Env::default();
    let (guard, _admin, _asset) = setup_guard(&env);
    let attacker = Address::generate(&env);
    let guardian = Address::generate(&env);

    guard.set_guardian(&attacker, &guardian, &1_500u64);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn guardian_expiry_must_be_in_the_future() {
    let env = Env::default();
    let (guard, admin, _asset) = setup_guard(&env);
    let guardian = Address::generate(&env);

    guard.set_guardian(&admin, &guardian, &1_000u64);
}
