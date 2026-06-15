#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, vec,
    Address, BytesN, Env, IntoVal, Vec,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    BootstrapAdmin,
    BootstrapAdminExpiresAt,
    Governor,
    LastWasmHash,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,
    Unauthorized = 2,
    InvalidBootstrapAdmin = 3,
}

const MAX_BOOTSTRAP_ADMIN_SECONDS: u64 = 365 * 24 * 60 * 60;

#[derive(Clone)]
#[contracttype]
pub struct Asset {
    pub contract: Address,
}

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

    fn require_bootstrap_or_governor_auth(env: &Env, caller: &Address) {
        let store = env.storage().instance();
        if Self::bootstrap_admin_active_internal(env) {
            if let Some(admin) = store.get::<DataKey, Address>(&DataKey::BootstrapAdmin) {
                if *caller == admin {
                    caller.require_auth();
                    return;
                }
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

    fn execute_internal(
        env: Env,
        caller: Address,
        receiver: Address,
        steps: Vec<SwapStep>,
    ) -> i128 {
        // Multi-hop: forward previous output as next input unless explicit amount_in provided (>0)
        let mut last_out: i128 = 0;
        let mut out_total: i128 = 0;
        for s in steps.iter() {
            let amount_in = if s.amount_in > 0 {
                s.amount_in
            } else {
                last_out
            };
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

    pub fn init_upgrade_authority(
        env: Env,
        admin: Address,
        governor: Option<Address>,
        expires_at: u64,
    ) {
        admin.require_auth();
        let store = env.storage().instance();
        if store.has(&DataKey::BootstrapAdmin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        Self::require_future_bootstrap_expiry(&env, expires_at);
        store.set(&DataKey::BootstrapAdmin, &admin);
        store.set(&DataKey::Governor, &governor);
        store.set(&DataKey::BootstrapAdminExpiresAt, &expires_at);
    }

    pub fn set_bootstrap_admin(env: Env, caller: Address, admin: Address, expires_at: u64) {
        Self::require_bootstrap_or_governor_auth(&env, &caller);
        Self::require_future_bootstrap_expiry(&env, expires_at);
        let store = env.storage().instance();
        if let Some(current_expires_at) =
            store.get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
        {
            assert!(
                expires_at <= current_expires_at,
                "bootstrap_admin_expiry_locked"
            );
        }
        store.set(&DataKey::BootstrapAdmin, &admin);
        store.set(&DataKey::BootstrapAdminExpiresAt, &expires_at);
    }

    pub fn clear_bootstrap_admin(env: Env, caller: Address) {
        Self::require_governor_auth(&env, &caller);
        let store = env.storage().instance();
        store.remove(&DataKey::BootstrapAdmin);
        store.remove(&DataKey::BootstrapAdminExpiresAt);
    }

    pub fn set_governor(env: Env, caller: Address, governor: Option<Address>) {
        Self::require_bootstrap_or_governor_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Governor, &governor);
    }

    pub fn bootstrap_admin(env: Env) -> Option<Address> {
        env.storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::BootstrapAdmin)
    }

    pub fn bootstrap_admin_expires_at(env: Env) -> Option<u64> {
        env.storage()
            .instance()
            .get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
    }

    pub fn bootstrap_admin_active(env: Env) -> bool {
        Self::bootstrap_admin_active_internal(&env)
    }

    pub fn upgrade(env: Env, caller: Address, new_wasm_hash: BytesN<32>) {
        Self::require_bootstrap_or_governor_auth(&env, &caller);
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

    pub fn execute(env: Env, caller: Address, steps: Vec<SwapStep>) -> i128 {
        Self::execute_internal(env, caller.clone(), caller, steps)
    }

    pub fn execute_for(env: Env, caller: Address, receiver: Address, steps: Vec<SwapStep>) -> i128 {
        Self::execute_internal(env, caller, receiver, steps)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, testutils::Ledger, Env};

    use soroban_sdk::{contract, contractimpl};
    #[contract]
    struct DummyAdapter;
    #[contractimpl]
    impl DummyAdapter {
        pub fn execute(
            _env: Env,
            _caller: Address,
            _pool_id: u128,
            amount_in: i128,
            _min_out: i128,
            _receiver: Address,
        ) -> i128 {
            amount_in
        }
    }

    #[test]
    fn test_execute_accumulates_step_outputs() {
        let env = Env::default();
        let router_id = env.register_contract(None, Router);
        let client = RouterClient::new(&env, &router_id);
        // Register dummy adapter
        let adapter_id = env.register_contract(None, DummyAdapter);
        let caller = Address::generate(&env);
        let steps = Vec::from_array(
            &env,
            [
                SwapStep {
                    adapter: adapter_id.clone(),
                    pool_id: 1,
                    amount_in: 10,
                    min_out: 9,
                    asset_out: Asset {
                        contract: Address::generate(&env),
                    },
                },
                SwapStep {
                    adapter: adapter_id.clone(),
                    pool_id: 2,
                    amount_in: 5,
                    min_out: 4,
                    asset_out: Asset {
                        contract: Address::generate(&env),
                    },
                },
            ],
        );
        let out = client.execute(&caller, &steps);
        assert_eq!(out, 15);
    }

    #[test]
    #[should_panic(expected = "bootstrap_admin_expiry_locked")]
    fn test_bootstrap_admin_cannot_extend_expiry() {
        let env = Env::default();
        env.ledger().set_timestamp(1_000);
        let router_id = env.register_contract(None, Router);
        let client = RouterClient::new(&env, &router_id);
        let admin = Address::generate(&env);

        env.mock_all_auths();
        client.init_upgrade_authority(&admin, &None, &2_000);
        client.set_bootstrap_admin(&admin, &admin, &2_001);
    }
}
