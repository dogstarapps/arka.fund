#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, panic_with_error, symbol_short, Address, Env};

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    AmountZero = 1,
    SlippageExceeded = 2,
}

#[contract]
pub struct BalancedRouterMock;

#[contractimpl]
impl BalancedRouterMock {
    // Signature expected by adapter-balanced.
    pub fn swap(env: Env, caller: Address, _pool_id: u128, amount_in: i128, min_out: i128, _receiver: Address) -> i128 {
        caller.require_auth();
        if amount_in <= 0 {
            panic_with_error!(&env, Error::AmountZero);
        }
        // deterministic 1% fee model for repeatable integration testing
        let out = amount_in - (amount_in / 100);
        if out < min_out {
            panic_with_error!(&env, Error::SlippageExceeded);
        }
        env.events().publish((symbol_short!("swap"),), (amount_in, out));
        out
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_swap() {
        let env = Env::default();
        let id = env.register_contract(None, BalancedRouterMock);
        let client = BalancedRouterMockClient::new(&env, &id);
        let caller = soroban_sdk::Address::generate(&env);
        env.mock_all_auths();
        let out = client.swap(&caller, &1u128, &1_000i128, &900i128, &soroban_sdk::Address::generate(&env));
        assert_eq!(out, 990);
    }
}

