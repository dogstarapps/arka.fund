use oracle_guard::{OracleAsset, OracleGuard, OracleGuardClient, OraclePriceData};
use soroban_sdk::{
    contract, contractimpl, contracttype,
    testutils::{Address as _, Ledger as _},
    Address, Env, Symbol,
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

mod optional_provider {
    use super::*;

    #[contract]
    pub struct OptionalOracle;

    #[contractimpl]
    impl OptionalOracle {
        pub fn set_price(env: Env, asset: OracleAsset, price: OraclePriceData) {
            env.storage()
                .instance()
                .set(&FeedKey::Price(asset.clone()), &price.price);
            env.storage()
                .instance()
                .set(&FeedKey::Timestamp(asset), &price.timestamp);
        }

        pub fn lastprice(env: Env, asset: OracleAsset) -> Option<OraclePriceData> {
            let price = env
                .storage()
                .instance()
                .get::<FeedKey, i128>(&FeedKey::Price(asset.clone()))?;
            let timestamp = env
                .storage()
                .instance()
                .get::<FeedKey, u64>(&FeedKey::Timestamp(asset))?;
            Some(OraclePriceData { price, timestamp })
        }
    }
}

fn deploy_oracle<'a>(env: &'a Env) -> (Address, DummyOracleClient<'a>) {
    let id = env.register_contract(None, DummyOracle);
    let client = DummyOracleClient::new(env, &id);
    (id, client)
}

fn deploy_optional_oracle<'a>(
    env: &'a Env,
) -> (Address, optional_provider::OptionalOracleClient<'a>) {
    let id = env.register_contract(None, optional_provider::OptionalOracle);
    let client = optional_provider::OptionalOracleClient::new(env, &id);
    (id, client)
}

#[test]
fn public_api_supports_symbol_assets_and_policy_clearing() {
    let env = Env::default();
    env.ledger().set_timestamp(5_000);
    let guard_id = env.register_contract(None, OracleGuard);
    let guard = OracleGuardClient::new(&env, &guard_id);
    let admin = Address::generate(&env);
    let next_admin = Address::generate(&env);
    let symbol = Symbol::new(&env, "USDX");
    let asset = OracleAsset::Other(symbol.clone());
    let (primary_id, primary) = deploy_oracle(&env);

    env.mock_all_auths();
    guard.init(&admin);
    primary.set_price(&asset, &10_000_000i128, &4_990u64);
    guard.set_symbol_asset_policy(
        &admin,
        &symbol,
        &primary_id,
        &primary_id,
        &false,
        &120u64,
        &500u32,
        &false,
        &0u32,
    );
    assert_eq!(guard.lastprice(&asset).price, 10_000_000);

    guard.set_admin(&admin, &next_admin);
    guard.clear_symbol_asset_policy(&next_admin, &symbol);
    let inspection = guard.inspect_symbol(&symbol);
    assert_eq!(inspection.price, 0);
    assert_eq!(inspection.selected_source, 0);
}

#[test]
fn public_api_fail_closes_divergent_symbol_feeds() {
    let env = Env::default();
    env.ledger().set_timestamp(8_000);
    let guard_id = env.register_contract(None, OracleGuard);
    let guard = OracleGuardClient::new(&env, &guard_id);
    let admin = Address::generate(&env);
    let symbol = Symbol::new(&env, "BTC");
    let asset = OracleAsset::Other(symbol.clone());
    let (primary_id, primary) = deploy_oracle(&env);
    let (secondary_id, secondary) = deploy_oracle(&env);

    env.mock_all_auths();
    guard.init(&admin);
    primary.set_price(&asset, &90_000_000_000i128, &7_995u64);
    secondary.set_price(&asset, &10_000_000_000i128, &7_997u64);
    guard.set_symbol_asset_policy(
        &admin,
        &symbol,
        &primary_id,
        &secondary_id,
        &true,
        &120u64,
        &500u32,
        &false,
        &0u32,
    );

    let price = guard.lastprice(&asset);
    let inspection = guard.inspect_symbol(&symbol);
    assert_eq!(price.price, 0);
    assert!(inspection.diverged);
    assert_eq!(inspection.selected_source, 0);
}

#[test]
fn stellar_asset_can_query_provider_symbol_asset() {
    let env = Env::default();
    env.ledger().set_timestamp(12_000);
    let guard_id = env.register_contract(None, OracleGuard);
    let guard = OracleGuardClient::new(&env, &guard_id);
    let admin = Address::generate(&env);
    let vault_asset = Address::generate(&env);
    let provider_symbol = Symbol::new(&env, "USDC");
    let provider_asset = OracleAsset::Other(provider_symbol);
    let (provider_id, provider) = deploy_optional_oracle(&env);

    env.mock_all_auths();
    guard.init(&admin);
    provider.set_price(
        &provider_asset,
        &OraclePriceData {
            price: 100_000_000_000_000,
            timestamp: 11_990,
        },
    );
    guard.set_stellar_asset_policy(
        &admin,
        &vault_asset,
        &provider_id,
        &provider_id,
        &false,
        &120u64,
        &100u32,
        &false,
        &0u32,
    );
    guard.set_stellar_provider_asset(&admin, &vault_asset, &provider_id, &provider_asset);

    let price = guard.lastprice(&OracleAsset::Stellar(vault_asset.clone()));
    let inspection = guard.inspect_stellar(&vault_asset);
    assert_eq!(price.price, 100_000_000_000_000);
    assert_eq!(inspection.selected_source, 1);
    let stored = guard
        .stellar_provider_asset(&vault_asset, &provider_id)
        .expect("provider asset override");
    match stored {
        OracleAsset::Other(symbol) => assert_eq!(symbol, Symbol::new(&env, "USDC")),
        OracleAsset::Stellar(_) => panic!("expected symbol provider asset"),
    }
}

#[test]
fn optional_provider_none_is_treated_as_unusable_price() {
    let env = Env::default();
    env.ledger().set_timestamp(13_000);
    let guard_id = env.register_contract(None, OracleGuard);
    let guard = OracleGuardClient::new(&env, &guard_id);
    let admin = Address::generate(&env);
    let vault_asset = Address::generate(&env);
    let (provider_id, _provider) = deploy_optional_oracle(&env);

    env.mock_all_auths();
    guard.init(&admin);
    guard.set_stellar_asset_policy(
        &admin,
        &vault_asset,
        &provider_id,
        &provider_id,
        &false,
        &120u64,
        &100u32,
        &false,
        &0u32,
    );

    let price = guard.lastprice(&OracleAsset::Stellar(vault_asset.clone()));
    let inspection = guard.inspect_stellar(&vault_asset);
    assert_eq!(price.price, 0);
    assert_eq!(price.timestamp, 0);
    assert!(!inspection.primary_usable);
    assert_eq!(inspection.selected_source, 0);
}
