#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, IntoVal, Symbol, vec};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Router,
    PairByPool(u128),
}

#[derive(Clone)]
#[contracttype]
pub struct PairConfig {
    pub token_in: Address,
    pub token_out: Address,
    pub max_price: i128,
}

#[contract]
pub struct BalancedAdapter;

#[contractimpl]
impl BalancedAdapter {
    pub fn init(env: Env, admin: Address, router: Address) {
        let store = env.storage().instance();
        assert!(!store.has(&DataKey::Admin), "already_initialized");
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::Router, &router);
    }

    pub fn set_router(env: Env, caller: Address, router: Address) {
        let store = env.storage().instance();
        let admin: Address = store.get(&DataKey::Admin).expect("not_initialized");
        assert!(caller == admin, "only_admin");
        caller.require_auth();
        store.set(&DataKey::Router, &router);
    }

    pub fn router(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Router).expect("router_not_set")
    }

    pub fn set_pair(env: Env, caller: Address, pool_id: u128, token_in: Address, token_out: Address, max_price: i128) {
        let store = env.storage().instance();
        let admin: Address = store.get(&DataKey::Admin).expect("not_initialized");
        assert!(caller == admin, "only_admin");
        caller.require_auth();
        assert!(max_price > 0, "max_price_zero");
        store.set(
            &DataKey::PairByPool(pool_id),
            &PairConfig {
                token_in,
                token_out,
                max_price,
            },
        );
    }

    pub fn pair_of(env: Env, pool_id: u128) -> Option<PairConfig> {
        env.storage().instance().get(&DataKey::PairByPool(pool_id))
    }

    // Unified adapter signature used by Router.execute.
    pub fn execute(env: Env, caller: Address, pool_id: u128, amount_in: i128, min_out: i128, receiver: Address) -> i128 {
        caller.require_auth();
        assert!(amount_in > 0, "amount_zero");
        let store = env.storage().instance();
        let router: Address = store.get(&DataKey::Router).expect("router_not_set");
        if let Some(pair) = store.get::<DataKey, PairConfig>(&DataKey::PairByPool(pool_id)) {
            let args = vec![
                &env,
                pair.token_in.into_val(&env),
                amount_in.into_val(&env),
                pair.token_out.into_val(&env),
                min_out.into_val(&env),
                pair.max_price.into_val(&env),
                receiver.into_val(&env),
            ];
            let out_and_price: (i128, i128) =
                env.invoke_contract(&router, &Symbol::new(&env, "swap_exact_amount_in"), args);
            let out = out_and_price.0;
            assert!(out >= min_out, "slippage_exceeded");
            return out;
        }

        let args = vec![
            &env,
            caller.into_val(&env),
            pool_id.into_val(&env),
            amount_in.into_val(&env),
            min_out.into_val(&env),
            receiver.into_val(&env),
        ];
        let out: i128 = env.invoke_contract(&router, &symbol_short!("swap"), args);
        assert!(out >= min_out, "slippage_exceeded");
        out
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env, contract, contractimpl};

    #[contract]
    struct DummyRouter;
    #[contractimpl]
    impl DummyRouter {
        pub fn swap(_env: Env, _caller: Address, _pool_id: u128, amount_in: i128, _min_out: i128, _receiver: Address) -> i128 {
            amount_in - (amount_in / 100)
        }
    }

    #[test]
    fn test_execute_with_router() {
        let env = Env::default();
        let id = env.register_contract(None, BalancedAdapter);
        let client = BalancedAdapterClient::new(&env, &id);
        let admin = Address::generate(&env);
        let router = env.register_contract(None, DummyRouter);
        client.init(&admin, &router);
        let caller = Address::generate(&env);
        env.mock_all_auths();
        let out = client.execute(&caller, &1u128, &1_000i128, &980i128, &Address::generate(&env));
        assert_eq!(out, 990);
    }
}
