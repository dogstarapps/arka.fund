use super::*;

const SCALE: i128 = 100_000_000_000_000;

struct Fixture<'a> {
    guard: OracleGuardClient<'a>,
    admin: Address,
    asset: Address,
    base: OracleAsset,
    provider: Address,
    primary: DummyOracleClient<'a>,
    converter: Address,
    conversion: DummyOracleClient<'a>,
    conversion_asset: OracleAsset,
}

fn fixture(env: &Env) -> Fixture<'_> {
    let (guard, admin, asset) = setup_guard(env);
    let OracleAsset::Stellar(asset) = asset else { unreachable!() };
    let base = OracleAsset::Stellar(Address::generate(env));
    let (provider, primary) = deploy_oracle(env);
    let (converter, conversion) = deploy_oracle(env);
    let conversion_asset = OracleAsset::Other(Symbol::new(env, "USDC"));
    primary.set_metadata(&base, &14);
    primary.set_price(&OracleAsset::Stellar(asset.clone()), &15_366_546_279_266, &995);
    conversion.set_price(&conversion_asset, &100_100_614_833_119, &995);
    conversion.set_price(&OracleAsset::Stellar(asset.clone()), &15_297_424_897_950, &995);
    guard.set_stellar_asset_policy(&admin, &asset, &provider, &converter, &true, &120, &300, &true, &DIVERGENCE_FAIL_CLOSED);
    Fixture { guard, admin, asset, base, provider, primary, converter, conversion, conversion_asset }
}

impl Fixture<'_> {
    fn config(&self) -> ProviderNormalization {
        ProviderNormalization { base_asset: self.base.clone(), conversion_oracle: self.converter.clone(), conversion_asset: self.conversion_asset.clone() }
    }
    fn configure(&self) {
        self.guard.set_provider_normalization(&self.admin, &self.provider, &self.config());
    }
    fn inspect(&self) -> AssetInspection {
        self.guard.inspect_stellar(&self.asset)
    }
}

#[test]
fn r55_01_requires_explicit_conversion_and_returns_usd() {
    let env = Env::default(); let f = fixture(&env);
    assert_eq!(f.inspect().price, 0);
    f.configure();
    let i = f.inspect();
    assert_eq!(i.primary_price, 15_382_007_304_161);
    assert_eq!(i.price, 15_382_007_304_161);
    assert_eq!(i.selected_source, SOURCE_PRIMARY);
    assert!(i.primary_usable && i.secondary_usable && !i.diverged);
    assert_eq!(f.guard.base(), OracleAsset::Other(Symbol::new(&env, "USD")));
    assert_eq!(f.guard.decimals(), 14);
}

#[test]
fn conversion_uses_the_older_timestamp() {
    let env = Env::default(); let f = fixture(&env); f.configure();
    f.conversion.set_price(&f.conversion_asset, &SCALE, &900);
    let i = f.inspect(); assert_eq!(i.primary_timestamp, 900);
    assert_eq!(i.selected_source, SOURCE_SECONDARY);
}

#[test]
fn stale_zero_negative_and_future_conversion_do_not_pass_confirmation() {
    let env = Env::default(); let f = fixture(&env); f.configure();
    for (price, timestamp) in [(SCALE, 879), (0, 995), (-1, 995), (SCALE, 1001)] {
        f.conversion.set_price(&f.conversion_asset, &price, &timestamp);
        let i = f.inspect(); assert_eq!(i.price, 0); assert!(!i.primary_usable); assert!(i.secondary_usable);
    }
    f.conversion.set_price(&f.conversion_asset, &SCALE, &880);
    assert!(f.inspect().primary_usable);
}

#[test]
fn source_age_also_remains_required() {
    let env = Env::default(); let f = fixture(&env); f.configure();
    f.primary.set_price(&OracleAsset::Stellar(f.asset.clone()), &15_366_546_279_266, &879);
    let i = f.inspect(); assert_eq!(i.price, 0); assert!(!i.primary_usable);
}

#[test]
fn pausing_the_quote_currency_also_stops_its_conversion() {
    let env = Env::default(); let f = fixture(&env); f.configure();
    let OracleAsset::Stellar(base) = &f.base else { unreachable!() };
    f.guard.pause_stellar_asset_policy(&f.admin, base);
    assert_eq!(f.inspect().price, 0);
    assert!(!f.inspect().primary_usable);
    f.guard.resume_stellar_asset_policy(&f.admin, base);
    assert_eq!(f.inspect().primary_price, 15_382_007_304_161);
}

#[test]
fn base_drift_on_either_leg_fails_closed() {
    let env = Env::default(); let f = fixture(&env); f.configure();
    for symbol in ["EUR", "USD"] {
        f.primary.set_metadata(&OracleAsset::Other(Symbol::new(&env, symbol)), &14);
        assert_eq!(f.inspect().price, 0);
    }
    f.primary.set_metadata(&f.base, &14);
    f.conversion.set_metadata(&OracleAsset::Other(Symbol::new(&env, "EUR")), &14);
    assert_eq!(f.inspect().price, 0);
}

#[test]
fn scales_both_legs_without_intermediate_rounding() {
    let env = Env::default(); let f = fixture(&env); f.configure();
    f.primary.set_metadata(&f.base, &7);
    f.primary.set_price(&OracleAsset::Stellar(f.asset.clone()), &20_000_000, &995);
    f.conversion.set_metadata(&OracleAsset::Other(Symbol::new(&env, "USD")), &18);
    f.conversion.set_price(&f.conversion_asset, &1_050_000_000_000_000_000, &995);
    assert_eq!(f.inspect().primary_price, 210_000_000_000_000);
    f.primary.set_metadata(&f.base, &18);
    f.primary.set_price(&OracleAsset::Stellar(f.asset.clone()), &1, &995);
    f.conversion.set_metadata(&OracleAsset::Other(Symbol::new(&env, "USD")), &14);
    f.conversion.set_price(&f.conversion_asset, &10i128.pow(30), &995);
    assert_eq!(f.inspect().primary_price, 1_000_000_000_000);
}

#[test]
fn wide_intermediate_product_is_supported_but_unrepresentable_output_is_not() {
    let env = Env::default();
    assert_eq!(OracleGuard::scaled_product(&env, 10i128.pow(30), 30, 10i128.pow(30), 30), Some(SCALE));
    assert_eq!(OracleGuard::scaled_product(&env, i128::MAX, 0, i128::MAX, 0), None);
    assert_eq!(OracleGuard::scaled_product(&env, 1, 38, 1, 38), None);
    assert_eq!(OracleGuard::scaled_product(&env, 10i128.pow(38), 38, 1, 0), Some(SCALE));
    assert_eq!(OracleGuard::scaled_product(&env, 1, 39, 1, 0), None);
}

#[test]
fn canonical_usd_source_with_other_decimals_needs_no_conversion() {
    let env = Env::default(); let f = fixture(&env);
    f.primary.set_metadata(&OracleAsset::Other(Symbol::new(&env, "USD")), &7);
    f.primary.set_price(&OracleAsset::Stellar(f.asset.clone()), &1_500_000, &995);
    assert_eq!(f.inspect().primary_price, 15_000_000_000_000);
    f.primary.set_metadata(&OracleAsset::Other(Symbol::new(&env, "USD")), &39);
    assert_eq!(f.inspect().price, 0);
}

#[test]
fn divergence_uses_normalized_prices_and_keeps_the_existing_limit() {
    let env = Env::default(); let f = fixture(&env); f.configure();
    f.conversion.set_price(&f.conversion_asset, &(2*SCALE), &995);
    let i = f.inspect(); assert_eq!(i.primary_price, 30_733_092_558_532); assert!(i.diverged); assert_eq!(i.price, 0);
}

#[test]
fn normalization_configuration_stays_under_existing_governance() {
    let env = Env::default(); let f = fixture(&env); let stranger = Address::generate(&env);
    assert!(f.guard.try_set_provider_normalization(&stranger, &f.provider, &f.config()).is_err());
    f.configure();
    assert!(f.guard.try_clear_provider_normalization(&stranger, &f.provider).is_err());
    assert!(f.guard.provider_normalization(&f.provider).is_some());
    f.guard.clear_provider_normalization(&f.admin, &f.provider);
    assert!(f.guard.provider_normalization(&f.provider).is_none()); assert_eq!(f.inspect().price, 0);
}

#[test]
fn invalid_or_self_conversion_is_not_configurable() {
    let env = Env::default(); let f = fixture(&env);
    let mut c=f.config(); c.conversion_oracle=f.provider.clone();
    assert!(f.guard.try_set_provider_normalization(&f.admin,&f.provider,&c).is_err());
    c=f.config(); c.conversion_oracle=f.guard.address.clone();
    assert!(f.guard.try_set_provider_normalization(&f.admin,&f.provider,&c).is_err());
    c=f.config(); c.base_asset=OracleAsset::Other(Symbol::new(&env,"EUR"));
    assert!(f.guard.try_set_provider_normalization(&f.admin,&f.provider,&c).is_err());
}

#[test]
fn repeating_a_feed_is_not_independent_confirmation() {
    let env=Env::default();let f=fixture(&env);
    assert!(f.guard.try_set_stellar_asset_policy(&f.admin,&f.asset,&f.provider,&f.provider,&true,&120,&300,&true,&DIVERGENCE_FAIL_CLOSED).is_err());
}

#[contract]
struct PriceWithoutMetadata;
#[contractimpl]
impl PriceWithoutMetadata { pub fn lastprice(_env: Env, _asset: OracleAsset) -> OraclePriceData { OraclePriceData{price:SCALE,timestamp:995} } }

#[test]
fn missing_sep40_metadata_never_silently_means_usd() {
    let env=Env::default();let f=fixture(&env);let id=env.register(PriceWithoutMetadata,());
    f.guard.set_stellar_asset_policy(&f.admin,&f.asset,&id,&f.converter,&true,&120,&300,&true,&DIVERGENCE_FAIL_CLOSED);
    let i=f.inspect();assert_eq!(i.price,0);assert!(!i.primary_usable);
}
