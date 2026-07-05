#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, vec,
    Address, BytesN, Env, IntoVal, Symbol, Val,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Governor,
    BootstrapAdminExpiresAt,
    Router,
    AssetByMarket(u128),
    LastWasmHash,
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
    Unauthorized = 7,
    InvalidBootstrapAdmin = 8,
}

const MAX_BOOTSTRAP_ADMIN_SECONDS: u64 = 365 * 24 * 60 * 60;

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
    fn bootstrap_admin_expired(env: &Env) -> bool {
        let Some(expires_at) = env
            .storage()
            .instance()
            .get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
        else {
            return false;
        };
        env.ledger().timestamp() > expires_at
    }

    fn bootstrap_admin_active_internal(env: &Env) -> bool {
        let Some(expires_at) = env
            .storage()
            .instance()
            .get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
        else {
            return false;
        };
        env.ledger().timestamp() <= expires_at
    }

    fn require_future_bootstrap_expiry(env: &Env, expires_at: u64) {
        let now = env.ledger().timestamp();
        if expires_at <= now || expires_at.saturating_sub(now) > MAX_BOOTSTRAP_ADMIN_SECONDS {
            panic_with_error!(env, Error::InvalidBootstrapAdmin);
        }
    }

    fn require_admin_or_governor_auth(env: &Env, caller: &Address) {
        let store = env.storage().instance();
        if let Some(admin) = store.get::<DataKey, Address>(&DataKey::Admin) {
            if *caller == admin && !Self::bootstrap_admin_expired(env) {
                caller.require_auth();
                return;
            }
        }
        if let Some(governor) = store.get::<DataKey, Address>(&DataKey::Governor) {
            if *caller == governor {
                caller.require_auth();
                return;
            }
        }
        panic_with_error!(env, Error::Unauthorized);
    }

    fn require_governor_auth(env: &Env, caller: &Address) {
        let Some(governor) = env
            .storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::Governor)
        else {
            panic_with_error!(env, Error::Unauthorized);
        };
        if *caller != governor {
            panic_with_error!(env, Error::Unauthorized);
        }
        caller.require_auth();
    }

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

        if let Some(asset) = asset_override
            .or_else(|| store.get::<DataKey, Address>(&DataKey::AssetByMarket(market_id)))
        {
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

    pub fn set_admin(env: Env, caller: Address, admin: Address) {
        Self::require_admin_or_governor_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn set_governor(env: Env, caller: Address, governor: Option<Address>) {
        Self::require_admin_or_governor_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Governor, &governor);
    }

    pub fn set_bootstrap_admin_expiry(env: Env, caller: Address, expires_at: u64) {
        Self::require_admin_or_governor_auth(&env, &caller);
        Self::require_future_bootstrap_expiry(&env, expires_at);
        if let Some(current_expires_at) = env
            .storage()
            .instance()
            .get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
        {
            assert!(
                expires_at <= current_expires_at,
                "bootstrap_admin_expiry_locked"
            );
        }
        env.storage()
            .instance()
            .set(&DataKey::BootstrapAdminExpiresAt, &expires_at);
    }

    pub fn clear_bootstrap_admin_expiry(env: Env, caller: Address) {
        Self::require_governor_auth(&env, &caller);
        let expired_at: u64 = 0;
        env.storage()
            .instance()
            .set(&DataKey::BootstrapAdminExpiresAt, &expired_at);
    }

    pub fn bootstrap_admin_expires_at(env: Env) -> Option<u64> {
        env.storage()
            .instance()
            .get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
    }

    pub fn bootstrap_admin_active(env: Env) -> bool {
        Self::bootstrap_admin_active_internal(&env)
    }

    pub fn set_router(env: Env, caller: Address, router: Address) {
        Self::require_admin_or_governor_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Router, &router);
    }

    pub fn router(env: Env) -> Address {
        match env.storage().instance().get(&DataKey::Router) {
            Some(r) => r,
            None => panic_with_error!(&env, Error::NotInitialized),
        }
    }

    pub fn set_market_asset(env: Env, caller: Address, market_id: u128, asset: Address) {
        Self::require_admin_or_governor_auth(&env, &caller);
        env.storage()
            .instance()
            .set(&DataKey::AssetByMarket(market_id), &asset);
    }

    pub fn market_asset(env: Env, market_id: u128) -> Option<Address> {
        env.storage()
            .instance()
            .get(&DataKey::AssetByMarket(market_id))
    }

    pub fn upgrade(env: Env, caller: Address, new_wasm_hash: BytesN<32>) {
        Self::require_admin_or_governor_auth(&env, &caller);
        env.storage()
            .instance()
            .set(&DataKey::LastWasmHash, &new_wasm_hash);
        env.events()
            .publish((symbol_short!("upgrade"),), new_wasm_hash.clone());
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    pub fn last_wasm_hash(env: Env) -> Option<BytesN<32>> {
        env.storage()
            .instance()
            .get::<DataKey, BytesN<32>>(&DataKey::LastWasmHash)
    }

    pub fn execute(
        env: Env,
        caller: Address,
        action: Action,
        market_id: u128,
        amount: i128,
        receiver: Address,
    ) -> i128 {
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
        Self::execute_internal(
            env,
            caller,
            action,
            market_id,
            amount,
            Some(asset),
            receiver,
        )
    }
}

#[cfg(test)]
mod test;
