#![no_std]
// Isolated candidate. Normalizes a source; it does not establish market quality,
// independent source coverage, TWAP, or permission to replace a deployed provider.
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env, IntoVal, Symbol, TryFromVal, U256, Val};

#[derive(Clone, Eq, PartialEq)]
#[contracttype]
pub enum OracleAsset { Stellar(Address), Other(Symbol) }

#[derive(Clone)]
#[contracttype]
pub struct PriceData { pub price: i128, pub timestamp: u64 }

#[derive(Clone)]
#[contracttype]
pub struct Config {
    pub usdc: Address,
    pub native: Address,
    pub source: Address,
    pub source_base: OracleAsset,
    pub source_decimals: u32,
    pub bridge: Option<Address>,
    pub bridge_base: OracleAsset,
    pub bridge_asset: OracleAsset,
    pub bridge_decimals: u32,
    pub max_age: u64,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey { Config }

#[contract]
pub struct UsdcOracleAdapter;

fn call(env: &Env, target: &Address, method: &str, args: soroban_sdk::Vec<Val>) -> Option<Val> {
    match env.try_invoke_contract::<Val, soroban_sdk::Error>(target, &Symbol::new(env, method), args) {
        Ok(Ok(value)) => Some(value),
        _ => None,
    }
}

fn metadata_matches(env: &Env, source: &Address, base: &OracleAsset, decimals: u32) -> bool {
    let base_raw = match call(env, source, "base", soroban_sdk::vec![env]) { Some(v) => v, None => return false };
    let scale_raw = match call(env, source, "decimals", soroban_sdk::vec![env]) { Some(v) => v, None => return false };
    OracleAsset::try_from_val(env, &base_raw).ok().as_ref() == Some(base)
        && u32::try_from_val(env, &scale_raw).ok() == Some(decimals)
}

fn feed(env: &Env, source: &Address, asset: &OracleAsset, max_age: u64) -> Option<PriceData> {
    let raw = call(env, source, "lastprice", soroban_sdk::vec![env, asset.clone().into_val(env)])?;
    let price = PriceData::try_from_val(env, &raw).ok()
        .or_else(|| Option::<PriceData>::try_from_val(env, &raw).ok().flatten())?;
    let now = env.ledger().timestamp();
    if price.price <= 0 || price.timestamp == 0 || price.timestamp > now || now - price.timestamp > max_age { return None; }
    Some(price)
}

fn ten(env: &Env, exponent: u32) -> U256 { U256::from_u128(env, 10).pow(exponent) }

fn multiply(env: &Env, left: &U256, right: &U256) -> Option<U256> {
    let zero = U256::from_u128(env, 0);
    if *right == zero { return Some(zero); }
    let max = U256::from_be_bytes(env, &Bytes::from_array(env, &[255u8; 32]));
    if *left > max.div(right) { return None; }
    Some(left.mul(right))
}

fn output(value: U256) -> Option<i128> {
    let raw = value.to_u128()?;
    if raw == 0 || raw > i128::MAX as u128 { None } else { Some(raw as i128) }
}

fn rescale(env: &Env, raw: i128, decimals: u32) -> Option<i128> {
    let value = U256::from_u128(env, raw as u128);
    output(if decimals > 14 { value.div(&ten(env, decimals - 14)) }
        else { multiply(env, &value, &ten(env, 14 - decimals))? })
}

fn product_price(env: &Env, a: i128, da: u32, b: i128, db: u32) -> Option<i128> {
    let value = multiply(env, &U256::from_u128(env, a as u128), &U256::from_u128(env, b as u128))?;
    let decimals = da + db;
    output(if decimals >= 14 { value.div(&ten(env, decimals - 14)) }
        else { multiply(env, &value, &ten(env, 14 - decimals))? })
}

fn quotient_price(env: &Env, a: i128, da: u32, b: i128, db: u32) -> Option<i128> {
    let mut numerator = U256::from_u128(env, a as u128);
    let mut denominator = U256::from_u128(env, b as u128);
    if db + 14 >= da { numerator = multiply(env, &numerator, &ten(env, db + 14 - da))?; }
    else { denominator = multiply(env, &denominator, &ten(env, da - db - 14))?; }
    output(numerator.div(&denominator))
}

#[contractimpl]
impl UsdcOracleAdapter {
    pub fn __constructor(env: Env, config: Config) {
        assert!(config.max_age > 0 && config.source_decimals <= 38 && config.bridge_decimals <= 38);
        assert!(config.source != env.current_contract_address());
        assert!(config.bridge.as_ref() != Some(&env.current_contract_address()));
        env.storage().instance().set(&DataKey::Config, &config);
    }

    pub fn base(env: Env) -> OracleAsset {
        let config: Config = env.storage().instance().get(&DataKey::Config).unwrap();
        OracleAsset::Stellar(config.usdc)
    }

    pub fn decimals(_env: Env) -> u32 { 14 }

    pub fn lastprice(env: Env, asset: OracleAsset) -> Option<PriceData> {
        let config: Config = env.storage().instance().get(&DataKey::Config)?;
        if config.max_age == 0 || config.source_decimals > 38 || config.bridge_decimals > 38 { return None; }
        if !metadata_matches(&env, &config.source, &config.source_base, config.source_decimals) { return None; }
        let source = feed(&env, &config.source, &asset, config.max_age)?;
        if config.source_base == OracleAsset::Stellar(config.usdc.clone()) {
            return Some(PriceData { price: rescale(&env, source.price, config.source_decimals)?, timestamp: source.timestamp });
        }
        let bridge_id = config.bridge.as_ref()?;
        if !metadata_matches(&env, bridge_id, &config.bridge_base, config.bridge_decimals) { return None; }
        let bridge = feed(&env, bridge_id, &config.bridge_asset, config.max_age)?;
        let price = if config.source_base == OracleAsset::Stellar(config.native.clone())
            && config.bridge_base == OracleAsset::Stellar(config.usdc.clone())
            && config.bridge_asset == OracleAsset::Stellar(config.native.clone()) {
            product_price(&env, source.price, config.source_decimals, bridge.price, config.bridge_decimals)?
        } else if config.source_base == OracleAsset::Other(Symbol::new(&env, "USD"))
            && config.bridge_base == OracleAsset::Other(Symbol::new(&env, "USD"))
            && config.bridge_asset == OracleAsset::Other(Symbol::new(&env, "USDC")) {
            quotient_price(&env, source.price, config.source_decimals, bridge.price, config.bridge_decimals)?
        } else { return None; };
        Some(PriceData { price, timestamp: core::cmp::min(source.timestamp, bridge.timestamp) })
    }
}
