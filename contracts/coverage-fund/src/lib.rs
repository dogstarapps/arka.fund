#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[derive(Clone)]
#[contracttype]
pub enum DataKey { Total, StakeBy(Address) }

#[contract]
pub struct CoverageFund;

#[contractimpl]
impl CoverageFund {
    pub fn stake(env: Env, user: Address, amount: i128) {
        user.require_auth();
        let store = env.storage().instance();
        let total: i128 = store.get(&DataKey::Total).unwrap_or(0);
        store.set(&DataKey::Total, &(total + amount));

        let key = DataKey::StakeBy(user.clone());
        let prev: i128 = store.get(&key).unwrap_or(0);
        store.set(&key, &(prev + amount));
    }

    pub fn unstake(env: Env, user: Address, amount: i128) {
        user.require_auth();
        let store = env.storage().instance();
        let key = DataKey::StakeBy(user.clone());
        let prev: i128 = store.get(&key).unwrap_or(0);
        assert!(amount <= prev, "insufficient");
        store.set(&key, &(prev - amount));
        let total: i128 = store.get(&DataKey::Total).unwrap_or(0);
        store.set(&DataKey::Total, &(total - amount));
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, Address};

    #[test]
    fn test_stake_unstake() {
        let env = Env::default();
        let id = env.register_contract(None, CoverageFund);
        let client = CoverageFundClient::new(&env, &id);
        let user = Address::generate(&env);
        env.mock_all_auths();
        client.stake(&user, &100);
        client.unstake(&user, &40);
    }
}


