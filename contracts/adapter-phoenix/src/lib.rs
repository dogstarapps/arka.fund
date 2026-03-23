#![no_std]
//! Experimental adapter reserved for future Phoenix integration work.

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[derive(Clone)]
#[contracttype]
pub struct SwapParams {
    pub pool_id: u128,
    pub amount_in: i128,
    pub min_out: i128,
    pub receiver: Address,
}

#[contract]
pub struct PhoenixAdapter;

#[contractimpl]
impl PhoenixAdapter {
    pub fn execute(_env: Env, caller: Address, params: SwapParams) -> i128 {
        caller.require_auth();
        params.amount_in
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_execute_smoke() {
        let env = Env::default();
        let id = env.register_contract(None, PhoenixAdapter);
        let client = PhoenixAdapterClient::new(&env, &id);
        let caller = Address::generate(&env);
        env.mock_all_auths();
        let params = SwapParams { pool_id: 1, amount_in: 33, min_out: 30, receiver: Address::generate(&env) };
        let out = client.execute(&caller, &params);
        assert_eq!(out, 33);
    }
}

