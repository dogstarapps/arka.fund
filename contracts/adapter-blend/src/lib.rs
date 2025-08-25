#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[derive(Clone)]
#[contracttype]
pub enum Action { Lend, Borrow, Repay, Liquidate }

#[derive(Clone)]
#[contracttype]
pub struct ActionParams {
    pub market_id: u128,
    pub amount: i128,
    pub receiver: Address,
}

#[contract]
pub struct BlendAdapter;

#[contractimpl]
impl BlendAdapter {
    pub fn execute(env: Env, caller: Address, action: Action, params: ActionParams) -> i128 {
        caller.require_auth();
        // Placeholder: will call Blend protocol
        match action { _ => params.amount }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_execute_placeholder() {
        let env = Env::default();
        let id = env.register_contract(None, BlendAdapter);
        let client = BlendAdapterClient::new(&env, &id);
        let caller = Address::generate(&env);
        env.mock_all_auths();
        let params = ActionParams { market_id: 7, amount: 66, receiver: Address::generate(&env) };
        let out = client.execute(&caller, &Action::Lend, &params);
        assert_eq!(out, 66);
    }
}



