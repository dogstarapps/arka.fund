#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, panic_with_error, symbol_short, Address, Env};

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    InvalidAction = 1,
    AmountZero = 2,
}

#[contract]
pub struct BlendRouterMock;

#[contractimpl]
impl BlendRouterMock {
    // action: 0=Lend, 1=Borrow, 2=Repay, 3=Liquidate
    pub fn execute_action(
        env: Env,
        caller: Address,
        action: u32,
        _market_id: u128,
        amount: i128,
        _receiver: Address,
    ) -> i128 {
        caller.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::AmountZero);
        }
        let out = match action {
            0 => amount,              // lend
            1 => (amount * 95) / 100, // borrow haircut
            2 => amount,              // repay
            3 => (amount * 90) / 100, // liquidate
            _ => panic_with_error!(&env, Error::InvalidAction),
        };
        env.events().publish((symbol_short!("blend"),), (action, amount, out));
        out
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_execute_action() {
        let env = Env::default();
        let id = env.register_contract(None, BlendRouterMock);
        let client = BlendRouterMockClient::new(&env, &id);
        let caller = soroban_sdk::Address::generate(&env);
        env.mock_all_auths();
        let out = client.execute_action(&caller, &1u32, &7u128, &1_000i128, &soroban_sdk::Address::generate(&env));
        assert_eq!(out, 950);
    }
}

