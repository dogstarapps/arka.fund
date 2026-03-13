#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Governor,
    Tier1Threshold,
    Tier2Threshold,
    Tier3Threshold,
    Points(Address),
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidThresholds = 4,
    InvalidPoints = 5,
}

#[contract]
pub struct ManagerTier;

#[contractimpl]
impl ManagerTier {
    fn require_policy_auth(env: &Env, caller: &Address) {
        let store = env.storage().instance();
        if let Some(governor) = store.get::<DataKey, Address>(&DataKey::Governor) {
            if *caller != governor {
                panic_with_error!(env, Error::Unauthorized);
            }
            caller.require_auth();
            return;
        }
        let admin: Address = match store.get(&DataKey::Admin) {
            Some(a) => a,
            None => panic_with_error!(env, Error::NotInitialized),
        };
        if *caller != admin {
            panic_with_error!(env, Error::Unauthorized);
        }
        caller.require_auth();
    }

    fn validate_thresholds(env: &Env, t1: i128, t2: i128, t3: i128) {
        if t1 < 0 || t2 < 0 || t3 < 0 || !(t1 <= t2 && t2 <= t3) {
            panic_with_error!(env, Error::InvalidThresholds);
        }
    }

    pub fn init(env: Env, admin: Address, tier1_threshold: i128, tier2_threshold: i128, tier3_threshold: i128) {
        let store = env.storage().instance();
        if store.has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        Self::validate_thresholds(&env, tier1_threshold, tier2_threshold, tier3_threshold);
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::Tier1Threshold, &tier1_threshold);
        store.set(&DataKey::Tier2Threshold, &tier2_threshold);
        store.set(&DataKey::Tier3Threshold, &tier3_threshold);
    }

    pub fn set_governor(env: Env, caller: Address, governor: Address) {
        Self::require_policy_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Governor, &governor);
    }

    pub fn set_thresholds(env: Env, caller: Address, tier1_threshold: i128, tier2_threshold: i128, tier3_threshold: i128) {
        Self::require_policy_auth(&env, &caller);
        Self::validate_thresholds(&env, tier1_threshold, tier2_threshold, tier3_threshold);
        let store = env.storage().instance();
        store.set(&DataKey::Tier1Threshold, &tier1_threshold);
        store.set(&DataKey::Tier2Threshold, &tier2_threshold);
        store.set(&DataKey::Tier3Threshold, &tier3_threshold);
    }

    pub fn set_points(env: Env, caller: Address, manager: Address, points: i128) {
        Self::require_policy_auth(&env, &caller);
        if points < 0 {
            panic_with_error!(&env, Error::InvalidPoints);
        }
        env.storage().instance().set(&DataKey::Points(manager), &points);
    }

    pub fn add_points(env: Env, caller: Address, manager: Address, delta: i128) {
        Self::require_policy_auth(&env, &caller);
        let store = env.storage().instance();
        let prev: i128 = store.get(&DataKey::Points(manager.clone())).unwrap_or(0);
        let next = prev + delta;
        if next < 0 {
            panic_with_error!(&env, Error::InvalidPoints);
        }
        store.set(&DataKey::Points(manager), &next);
    }

    pub fn points_of(env: Env, manager: Address) -> i128 {
        env.storage().instance().get(&DataKey::Points(manager)).unwrap_or(0)
    }

    pub fn tier_of(env: Env, manager: Address) -> u32 {
        let p = Self::points_of(env.clone(), manager);
        let store = env.storage().instance();
        let t1: i128 = store.get(&DataKey::Tier1Threshold).unwrap_or(0);
        let t2: i128 = store.get(&DataKey::Tier2Threshold).unwrap_or(0);
        let t3: i128 = store.get(&DataKey::Tier3Threshold).unwrap_or(0);
        if p >= t3 {
            3
        } else if p >= t2 {
            2
        } else if p >= t1 {
            1
        } else {
            0
        }
    }

    pub fn thresholds(env: Env) -> (i128, i128, i128) {
        let store = env.storage().instance();
        (
            store.get(&DataKey::Tier1Threshold).unwrap_or(0),
            store.get(&DataKey::Tier2Threshold).unwrap_or(0),
            store.get(&DataKey::Tier3Threshold).unwrap_or(0),
        )
    }

    pub fn governor(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Governor)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    #[test]
    fn test_points_and_tiers() {
        let env = Env::default();
        let id = env.register_contract(None, ManagerTier);
        let client = ManagerTierClient::new(&env, &id);
        let admin = Address::generate(&env);
        let manager = Address::generate(&env);
        env.mock_all_auths();
        client.init(&admin, &100, &500, &1000);
        client.add_points(&admin, &manager, &120);
        assert_eq!(client.points_of(&manager), 120);
        assert_eq!(client.tier_of(&manager), 1);
        client.add_points(&admin, &manager, &900);
        assert_eq!(client.tier_of(&manager), 3);
    }

    #[test]
    fn test_governor_control() {
        let env = Env::default();
        let id = env.register_contract(None, ManagerTier);
        let client = ManagerTierClient::new(&env, &id);
        let admin = Address::generate(&env);
        let governor = Address::generate(&env);
        let manager = Address::generate(&env);
        env.mock_all_auths();
        client.init(&admin, &100, &500, &1000);
        client.set_governor(&admin, &governor);
        client.set_thresholds(&governor, &200, &700, &1500);
        client.set_points(&governor, &manager, &1600);
        assert_eq!(client.tier_of(&manager), 3);
    }

    #[test]
    #[should_panic]
    fn test_invalid_thresholds_rejected() {
        let env = Env::default();
        let id = env.register_contract(None, ManagerTier);
        let client = ManagerTierClient::new(&env, &id);
        let admin = Address::generate(&env);
        client.init(&admin, &500, &100, &1000);
    }
}

