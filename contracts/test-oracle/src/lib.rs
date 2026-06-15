#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, IntoVal,
    Symbol, TryFromVal, Val,
};

#[derive(Clone)]
#[contracttype]
pub enum OracleAsset {
    Stellar(Address),
    Other(Symbol),
}

#[derive(Clone)]
#[contracttype]
pub struct OraclePriceData {
    pub price: i128,
    pub timestamp: u64,
}

#[derive(Clone)]
#[contracttype]
enum DataKey {
    Admin,
    Feed(OracleAsset),
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidPrice = 4,
}

#[contract]
pub struct TestOracle;

#[contractimpl]
impl TestOracle {
    fn bump_feed_key(env: &Env, key: &DataKey) {
        let max_ttl = env.storage().max_ttl();
        if max_ttl == 0 {
            return;
        }
        let store = env.storage().persistent();
        if store.has(key) {
            let threshold = core::cmp::max(max_ttl / 2, 1);
            store.extend_ttl(key, threshold, max_ttl);
        }
    }

    fn feed_get<T>(env: &Env, key: &DataKey) -> Option<T>
    where
        T: TryFromVal<Env, Val> + IntoVal<Env, Val>,
    {
        let persistent = env.storage().persistent();
        if let Some(value) = persistent.get::<DataKey, T>(key) {
            Self::bump_feed_key(env, key);
            return Some(value);
        }
        let legacy = env.storage().instance().get::<DataKey, T>(key);
        if let Some(value) = legacy {
            persistent.set(key, &value);
            env.storage().instance().remove(key);
            Self::bump_feed_key(env, key);
            return Some(value);
        }
        None
    }

    fn feed_set<T>(env: &Env, key: &DataKey, value: &T)
    where
        T: IntoVal<Env, Val>,
    {
        env.storage().persistent().set(key, value);
        env.storage().instance().remove(key);
        Self::bump_feed_key(env, key);
    }

    fn feed_remove(env: &Env, key: &DataKey) {
        env.storage().persistent().remove(key);
        env.storage().instance().remove(key);
    }

    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized))
    }

    pub fn set_admin(env: Env, caller: Address, admin: Address) {
        Self::require_admin(&env, &caller);
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn set_stellar_price(
        env: Env,
        caller: Address,
        asset: Address,
        price: i128,
        timestamp: u64,
    ) {
        Self::set_price_internal(&env, &caller, OracleAsset::Stellar(asset), price, timestamp);
    }

    pub fn set_symbol_price(
        env: Env,
        caller: Address,
        symbol: Symbol,
        price: i128,
        timestamp: u64,
    ) {
        Self::set_price_internal(&env, &caller, OracleAsset::Other(symbol), price, timestamp);
    }

    pub fn clear_stellar_price(env: Env, caller: Address, asset: Address) {
        Self::clear_price_internal(&env, &caller, OracleAsset::Stellar(asset));
    }

    pub fn clear_symbol_price(env: Env, caller: Address, symbol: Symbol) {
        Self::clear_price_internal(&env, &caller, OracleAsset::Other(symbol));
    }

    pub fn inspect_stellar(env: Env, asset: Address) -> OraclePriceData {
        Self::read_price(&env, OracleAsset::Stellar(asset))
    }

    pub fn inspect_symbol(env: Env, symbol: Symbol) -> OraclePriceData {
        Self::read_price(&env, OracleAsset::Other(symbol))
    }

    pub fn lastprice(env: Env, asset: OracleAsset) -> OraclePriceData {
        Self::read_price(&env, asset)
    }

    fn require_admin(env: &Env, caller: &Address) {
        let admin = Self::admin(env.clone());
        if *caller != admin {
            panic_with_error!(env, Error::Unauthorized);
        }
        caller.require_auth();
    }

    fn set_price_internal(
        env: &Env,
        caller: &Address,
        asset: OracleAsset,
        price: i128,
        timestamp: u64,
    ) {
        Self::require_admin(env, caller);
        if price <= 0 || timestamp == 0 {
            panic_with_error!(env, Error::InvalidPrice);
        }
        Self::feed_set(
            env,
            &DataKey::Feed(asset),
            &OraclePriceData { price, timestamp },
        );
    }

    fn clear_price_internal(env: &Env, caller: &Address, asset: OracleAsset) {
        Self::require_admin(env, caller);
        Self::feed_remove(env, &DataKey::Feed(asset));
    }

    fn read_price(env: &Env, asset: OracleAsset) -> OraclePriceData {
        Self::feed_get(env, &DataKey::Feed(asset)).unwrap_or(OraclePriceData {
            price: 0,
            timestamp: 0,
        })
    }
}

#[cfg(test)]
mod test {
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
}
