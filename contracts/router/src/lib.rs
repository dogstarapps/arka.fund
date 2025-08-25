#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Vec, IntoVal, vec};

#[derive(Clone)]
#[contracttype]
pub struct Asset { pub contract: Address }

#[derive(Clone)]
#[contracttype]
pub struct SwapStep {
    pub adapter: Address,
    pub pool_id: u128,
    pub amount_in: i128,
    pub min_out: i128,
    pub asset_out: Asset,
}

#[contract]
pub struct Router;

#[contractimpl]
impl Router {
    pub fn execute(env: Env, caller: Address, steps: Vec<SwapStep>) -> i128 {
        // Multi-hop: forward previous output as next input unless explicit amount_in provided (>0)
        let mut last_out: i128 = 0;
        let mut out_total: i128 = 0;
        let receiver = env.current_contract_address();
        for s in steps.iter() {
            let amount_in = if s.amount_in > 0 { s.amount_in } else { last_out };
            // basic guard
            assert!(amount_in > 0, "amount_in_zero");

            let args = vec![
                &env,
                caller.clone().into_val(&env),
                s.pool_id.into_val(&env),
                amount_in.into_val(&env),
                s.min_out.into_val(&env),
                receiver.clone().into_val(&env),
            ];
            let out: i128 = env.invoke_contract(&s.adapter, &symbol_short!("execute"), args);
            // per-step slippage check already enforced by adapter; keep parity here
            assert!(out >= s.min_out, "slippage_exceeded");
            last_out = out;
            out_total += out;
        }
        out_total
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    use soroban_sdk::{contract, contractimpl};
    #[contract]
    struct DummyAdapter;
    #[contractimpl]
    impl DummyAdapter {
        pub fn execute(_env: Env, _caller: Address, _pool_id: u128, amount_in: i128, _min_out: i128, _receiver: Address) -> i128 {
            amount_in
        }
    }

    #[test]
    fn test_execute_placeholder() {
        let env = Env::default();
        let router_id = env.register_contract(None, Router);
        let client = RouterClient::new(&env, &router_id);
        // Register dummy adapter
        let adapter_id = env.register_contract(None, DummyAdapter);
        let caller = Address::generate(&env);
        let steps = Vec::from_array(&env, [
            SwapStep { adapter: adapter_id.clone(), pool_id: 1, amount_in: 10, min_out: 9, asset_out: Asset { contract: Address::generate(&env) } },
            SwapStep { adapter: adapter_id.clone(), pool_id: 2, amount_in: 5, min_out: 4, asset_out: Asset { contract: Address::generate(&env) } },
        ]);
        let out = client.execute(&caller, &steps);
        assert_eq!(out, 15);
    }
}


