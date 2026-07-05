#![no_std]

use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contract, contracterror, contractimpl, contracttype, panic_with_error, vec, Address, Env,
    IntoVal, Symbol, Val,
};

#[derive(Clone)]
#[contracttype]
enum DataKey {
    Admin,
    Router,
    ProfitToken,
    DefaultBonus,
    PoolBonus(u128),
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    AmountZero = 4,
    SlippageExceeded = 5,
}

#[contract]
pub struct TestProfitAdapter;

#[contractimpl]
impl TestProfitAdapter {
    pub fn init(
        env: Env,
        admin: Address,
        router: Address,
        profit_token: Address,
        default_bonus: i128,
    ) {
        let store = env.storage().instance();
        if store.has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        admin.require_auth();
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::Router, &router);
        store.set(&DataKey::ProfitToken, &profit_token);
        store.set(&DataKey::DefaultBonus, &default_bonus);
    }

    pub fn set_router(env: Env, caller: Address, router: Address) {
        Self::require_admin(&env, &caller);
        env.storage().instance().set(&DataKey::Router, &router);
    }

    pub fn set_profit_token(env: Env, caller: Address, profit_token: Address) {
        Self::require_admin(&env, &caller);
        env.storage()
            .instance()
            .set(&DataKey::ProfitToken, &profit_token);
    }

    pub fn set_default_bonus(env: Env, caller: Address, default_bonus: i128) {
        Self::require_admin(&env, &caller);
        env.storage()
            .instance()
            .set(&DataKey::DefaultBonus, &default_bonus);
    }

    pub fn set_pool_bonus(env: Env, caller: Address, pool_id: u128, bonus: i128) {
        Self::require_admin(&env, &caller);
        env.storage()
            .instance()
            .set(&DataKey::PoolBonus(pool_id), &bonus);
    }

    pub fn clear_pool_bonus(env: Env, caller: Address, pool_id: u128) {
        Self::require_admin(&env, &caller);
        env.storage()
            .instance()
            .remove(&DataKey::PoolBonus(pool_id));
    }

    pub fn router(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Router)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized))
    }

    pub fn profit_token(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::ProfitToken)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized))
    }

    pub fn bonus_for(env: Env, pool_id: u128) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::PoolBonus(pool_id))
            .or_else(|| env.storage().instance().get(&DataKey::DefaultBonus))
            .unwrap_or(0)
    }

    pub fn execute(
        env: Env,
        caller: Address,
        pool_id: u128,
        amount_in: i128,
        min_out: i128,
        receiver: Address,
    ) -> i128 {
        caller.require_auth();
        if amount_in <= 0 {
            panic_with_error!(&env, Error::AmountZero);
        }

        let bonus = Self::bonus_for(env.clone(), pool_id);
        let out = amount_in + bonus;
        if out < min_out {
            panic_with_error!(&env, Error::SlippageExceeded);
        }
        let token = Self::profit_token(env.clone());
        let self_addr = env.current_contract_address();
        let args = vec![
            &env,
            self_addr.clone().into_val(&env),
            receiver.into_val(&env),
            out.into_val(&env),
        ];
        Self::invoke_with_contract_auth::<()>(&env, &token, "transfer", args);
        out
    }

    fn require_admin(env: &Env, caller: &Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized));
        if *caller != admin {
            panic_with_error!(env, Error::Unauthorized);
        }
        caller.require_auth();
    }

    fn authorize_current_contract_call(
        env: &Env,
        contract: &Address,
        fn_name: &str,
        args: &soroban_sdk::Vec<Val>,
    ) {
        let auth = InvokerContractAuthEntry::Contract(SubContractInvocation {
            context: ContractContext {
                contract: contract.clone(),
                fn_name: Symbol::new(env, fn_name),
                args: args.clone(),
            },
            sub_invocations: vec![env],
        });
        env.authorize_as_current_contract(vec![env, auth]);
    }

    fn invoke_with_contract_auth<T>(
        env: &Env,
        contract: &Address,
        fn_name: &str,
        args: soroban_sdk::Vec<Val>,
    ) -> T
    where
        T: soroban_sdk::TryFromVal<Env, Val>,
    {
        Self::authorize_current_contract_call(env, contract, fn_name, &args);
        env.invoke_contract::<T>(contract, &Symbol::new(env, fn_name), args)
    }
}

#[cfg(test)]
mod test;
