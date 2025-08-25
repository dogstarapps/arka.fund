#![no_std]
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
pub struct BalancedAdapter;

#[contractimpl]
impl BalancedAdapter {
    pub fn execute(env: Env, caller: Address, params: SwapParams) -> i128 {
        caller.require_auth();
        params.amount_in
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_execute_placeholder() {
        let env = Env::default();
        let id = env.register_contract(None, BalancedAdapter);
        let client = BalancedAdapterClient::new(&env, &id);
        let caller = Address::generate(&env);
        let params = SwapParams { pool_id: 1, amount_in: 55, min_out: 50, receiver: Address::generate(&env) };
        let out = client.execute(&caller, &params);
        assert_eq!(out, 55);
    }
}



