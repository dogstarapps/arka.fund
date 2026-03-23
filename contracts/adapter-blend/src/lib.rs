#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, panic_with_error, Address, Env, IntoVal, Symbol, Val, vec};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Router,
    AssetByMarket(u128),
}

#[derive(Clone)]
#[contracttype]
pub enum Action {
    Lend,
    Borrow,
    Repay,
    Withdraw,
    Liquidate,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    OnlyAdmin = 3,
    AmountZero = 4,
    InvalidOut = 5,
    UnsupportedAction = 6,
}

#[derive(Clone)]
#[contracttype]
pub struct Request {
    pub address: Address,
    pub amount: i128,
    pub request_type: u32,
}

#[contract]
pub struct BlendAdapter;

#[contractimpl]
impl BlendAdapter {
    fn execute_internal(
        env: Env,
        caller: Address,
        action: Action,
        market_id: u128,
        amount: i128,
        asset_override: Option<Address>,
        receiver: Address,
    ) -> i128 {
        caller.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::AmountZero);
        }
        let store = env.storage().instance();
        let router: Address = match store.get(&DataKey::Router) {
            Some(r) => r,
            None => panic_with_error!(&env, Error::NotInitialized),
        };

        if let Some(asset) = asset_override.or_else(|| store.get::<DataKey, Address>(&DataKey::AssetByMarket(market_id))) {
            let request_type: u32 = match action {
                Action::Lend => 2,
                Action::Withdraw => 3,
                Action::Borrow => 4,
                Action::Repay => 5,
                Action::Liquidate => panic_with_error!(&env, Error::UnsupportedAction),
            };
            let req = Request {
                address: asset,
                amount,
                request_type,
            };
            let requests = vec![&env, req];
            let args = vec![
                &env,
                caller.into_val(&env),
                caller.into_val(&env),
                receiver.into_val(&env),
                requests.into_val(&env),
            ];
            let _: Val = env.invoke_contract(&router, &Symbol::new(&env, "submit"), args);
            return amount;
        }

        let action_code: u32 = match action {
            Action::Lend => 0,
            Action::Borrow => 1,
            Action::Repay => 2,
            Action::Liquidate => 3,
            Action::Withdraw => 4,
        };
        let args = vec![
            &env,
            caller.into_val(&env),
            action_code.into_val(&env),
            market_id.into_val(&env),
            amount.into_val(&env),
            receiver.into_val(&env),
        ];
        let out: i128 = env.invoke_contract(&router, &Symbol::new(&env, "execute_action"), args);
        if out <= 0 {
            panic_with_error!(&env, Error::InvalidOut);
        }
        out
    }

    pub fn init(env: Env, admin: Address, router: Address) {
        let store = env.storage().instance();
        if store.has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::Router, &router);
    }

    pub fn set_router(env: Env, caller: Address, router: Address) {
        let store = env.storage().instance();
        let admin: Address = match store.get(&DataKey::Admin) {
            Some(a) => a,
            None => panic_with_error!(&env, Error::NotInitialized),
        };
        if caller != admin {
            panic_with_error!(&env, Error::OnlyAdmin);
        }
        caller.require_auth();
        store.set(&DataKey::Router, &router);
    }

    pub fn router(env: Env) -> Address {
        match env.storage().instance().get(&DataKey::Router) {
            Some(r) => r,
            None => panic_with_error!(&env, Error::NotInitialized),
        }
    }

    pub fn set_market_asset(env: Env, caller: Address, market_id: u128, asset: Address) {
        let store = env.storage().instance();
        let admin: Address = match store.get(&DataKey::Admin) {
            Some(a) => a,
            None => panic_with_error!(&env, Error::NotInitialized),
        };
        if caller != admin {
            panic_with_error!(&env, Error::OnlyAdmin);
        }
        caller.require_auth();
        store.set(&DataKey::AssetByMarket(market_id), &asset);
    }

    pub fn market_asset(env: Env, market_id: u128) -> Option<Address> {
        env.storage().instance().get(&DataKey::AssetByMarket(market_id))
    }

    pub fn execute(env: Env, caller: Address, action: Action, market_id: u128, amount: i128, receiver: Address) -> i128 {
        Self::execute_internal(env, caller, action, market_id, amount, None, receiver)
    }

    pub fn execute_with_asset(
        env: Env,
        caller: Address,
        action: Action,
        market_id: u128,
        asset: Address,
        amount: i128,
        receiver: Address,
    ) -> i128 {
        Self::execute_internal(env, caller, action, market_id, amount, Some(asset), receiver)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env, contract, contractimpl};

    #[contract]
    struct DummyBlendRouter;
    #[contractimpl]
    impl DummyBlendRouter {
        pub fn execute_action(_env: Env, _caller: Address, action: u32, _market_id: u128, amount: i128, _receiver: Address) -> i128 {
            match action {
                0 => amount,
                1 => (amount * 95) / 100,
                2 => amount,
                3 => (amount * 90) / 100,
                _ => 0,
            }
        }
    }

    #[contract]
    struct DummySubmitRouter;
    #[contractimpl]
    impl DummySubmitRouter {
        pub fn submit(_env: Env, _from: Address, _spender: Address, _to: Address, _requests: soroban_sdk::Vec<Request>) {}
    }

    #[test]
    fn test_execute_lend_and_borrow() {
        let env = Env::default();
        let id = env.register_contract(None, BlendAdapter);
        let client = BlendAdapterClient::new(&env, &id);
        let admin = Address::generate(&env);
        let router = env.register_contract(None, DummyBlendRouter);
        client.init(&admin, &router);
        let caller = Address::generate(&env);
        let receiver = Address::generate(&env);
        env.mock_all_auths();

        let out_lend = client.execute(&caller, &Action::Lend, &7u128, &1_000i128, &receiver);
        assert_eq!(out_lend, 1_000);
        let out_borrow = client.execute(&caller, &Action::Borrow, &7u128, &1_000i128, &receiver);
        assert_eq!(out_borrow, 950);
    }

    #[test]
    fn test_execute_submit_path_with_market_asset() {
        let env = Env::default();
        let id = env.register_contract(None, BlendAdapter);
        let client = BlendAdapterClient::new(&env, &id);
        let admin = Address::generate(&env);
        let router = env.register_contract(None, DummySubmitRouter);
        let asset = Address::generate(&env);
        client.init(&admin, &router);
        env.mock_all_auths();
        client.set_market_asset(&admin, &7u128, &asset);

        let caller = Address::generate(&env);
        let receiver = Address::generate(&env);
        let out_lend = client.execute(&caller, &Action::Lend, &7u128, &500i128, &receiver);
        assert_eq!(out_lend, 500);

        let out_withdraw = client.execute(&caller, &Action::Withdraw, &7u128, &200i128, &receiver);
        assert_eq!(out_withdraw, 200);
    }
}
