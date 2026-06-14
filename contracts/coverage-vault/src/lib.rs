#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, vec,
    Address, BytesN, Env, IntoVal, Symbol,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Manager,
    Governor,
    BootstrapAdmin,
    BootstrapAdminExpiresAt,
    ClaimsMgr,
    Token,
    LockBps,
    Balance,
    LastWasmHash,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct ManagerClaimReceipt {
    pub amount_paid: i128,
    pub remaining_balance: i128,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidLockBps = 4,
    AmountZero = 5,
    InsufficientBalance = 6,
    LockViolation = 7,
    InvalidBootstrapAdmin = 8,
}

const MAX_BOOTSTRAP_ADMIN_SECONDS: u64 = 365 * 24 * 60 * 60;

#[contract]
pub struct CoverageVault;

#[contractimpl]
impl CoverageVault {
    fn assert_lock_bps(env: &Env, lock_bps: i32) {
        if !(0..=10_000).contains(&lock_bps) {
            panic_with_error!(env, Error::InvalidLockBps);
        }
    }

    fn require_policy_auth(env: &Env, caller: &Address) {
        let store = env.storage().instance();
        if let Some(governor) = store.get::<DataKey, Address>(&DataKey::Governor) {
            if *caller != governor {
                panic_with_error!(env, Error::Unauthorized);
            }
            caller.require_auth();
            return;
        }
        let manager: Address = match store.get(&DataKey::Manager) {
            Some(m) => m,
            None => panic_with_error!(env, Error::NotInitialized),
        };
        if *caller != manager {
            panic_with_error!(env, Error::Unauthorized);
        }
        caller.require_auth();
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

    fn require_claims_auth(env: &Env, caller: &Address) {
        let store = env.storage().instance();
        if let Some(claims_mgr) = store.get::<DataKey, Address>(&DataKey::ClaimsMgr) {
            if *caller == claims_mgr {
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
        let manager: Address = match store.get(&DataKey::Manager) {
            Some(m) => m,
            None => panic_with_error!(env, Error::NotInitialized),
        };
        if *caller != manager {
            panic_with_error!(env, Error::Unauthorized);
        }
        caller.require_auth();
    }

    fn minimum_locked(balance: i128, lock_bps: i32) -> i128 {
        (balance * lock_bps as i128) / 10_000
    }

    pub fn init(env: Env, manager: Address, token: Address, lock_bps: i32) {
        let store = env.storage().instance();
        if store.has(&DataKey::Manager) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        Self::assert_lock_bps(&env, lock_bps);
        store.set(&DataKey::Manager, &manager);
        store.set(&DataKey::Token, &token);
        store.set(&DataKey::LockBps, &lock_bps);
        store.set(&DataKey::Balance, &0i128);
    }

    pub fn set_governor(env: Env, caller: Address, governor: Address) {
        Self::require_policy_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Governor, &governor);
    }

    pub fn set_bootstrap_admin(env: Env, caller: Address, admin: Address, expires_at: u64) {
        let can_bootstrap_update = Self::bootstrap_admin_active_internal(&env)
            && env
                .storage()
                .instance()
                .get::<DataKey, Address>(&DataKey::BootstrapAdmin)
                .is_some();
        if can_bootstrap_update {
            Self::require_bootstrap_or_governor_auth(&env, &caller);
        } else {
            Self::require_policy_auth(&env, &caller);
        }
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

    pub fn set_claims_manager(env: Env, caller: Address, claims_manager: Option<Address>) {
        Self::require_policy_auth(&env, &caller);
        env.storage()
            .instance()
            .set(&DataKey::ClaimsMgr, &claims_manager);
    }

    pub fn set_lock_bps(env: Env, caller: Address, lock_bps: i32) {
        Self::assert_lock_bps(&env, lock_bps);
        Self::require_policy_auth(&env, &caller);
        env.storage().instance().set(&DataKey::LockBps, &lock_bps);
    }

    pub fn deposit(env: Env, from: Address, amount: i128) {
        if amount <= 0 {
            panic_with_error!(&env, Error::AmountZero);
        }
        from.require_auth();
        let store = env.storage().instance();
        let token: Address = match store.get(&DataKey::Token) {
            Some(t) => t,
            None => panic_with_error!(&env, Error::NotInitialized),
        };
        let vault = env.current_contract_address();
        let args = vec![
            &env,
            vault.clone().into_val(&env),
            from.clone().into_val(&env),
            vault.into_val(&env),
            amount.into_val(&env),
        ];
        let _ = env.invoke_contract::<()>(&token, &Symbol::new(&env, "transfer_from"), args);
        let bal: i128 = store.get(&DataKey::Balance).unwrap_or(0);
        store.set(&DataKey::Balance, &(bal + amount));
    }

    pub fn withdraw(env: Env, caller: Address, to: Address, amount: i128) {
        if amount <= 0 {
            panic_with_error!(&env, Error::AmountZero);
        }
        Self::require_policy_auth(&env, &caller);
        let store = env.storage().instance();
        let bal: i128 = store.get(&DataKey::Balance).unwrap_or(0);
        if amount > bal {
            panic_with_error!(&env, Error::InsufficientBalance);
        }
        let lock_bps: i32 = store.get(&DataKey::LockBps).unwrap_or(0);
        let remaining = bal - amount;
        let min_locked = Self::minimum_locked(bal, lock_bps);
        if remaining < min_locked {
            panic_with_error!(&env, Error::LockViolation);
        }
        let token: Address = match store.get(&DataKey::Token) {
            Some(t) => t,
            None => panic_with_error!(&env, Error::NotInitialized),
        };
        let vault = env.current_contract_address();
        let args = vec![
            &env,
            vault.into_val(&env),
            to.into_val(&env),
            amount.into_val(&env),
        ];
        let _ = env.invoke_contract::<()>(&token, &symbol_short!("transfer"), args);
        store.set(&DataKey::Balance, &remaining);
    }

    pub fn max_withdrawable(env: Env) -> i128 {
        let store = env.storage().instance();
        let bal: i128 = store.get(&DataKey::Balance).unwrap_or(0);
        let lock_bps: i32 = store.get(&DataKey::LockBps).unwrap_or(0);
        let min_locked = Self::minimum_locked(bal, lock_bps);
        bal - min_locked
    }

    pub fn claim_capacity(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Balance).unwrap_or(0)
    }

    pub fn claim_payout(
        env: Env,
        caller: Address,
        recipient: Address,
        amount: i128,
    ) -> ManagerClaimReceipt {
        if amount <= 0 {
            panic_with_error!(&env, Error::AmountZero);
        }
        Self::require_claims_auth(&env, &caller);
        let store = env.storage().instance();
        let bal: i128 = store.get(&DataKey::Balance).unwrap_or(0);
        if amount > bal {
            panic_with_error!(&env, Error::InsufficientBalance);
        }
        let remaining = bal - amount;
        let token: Address = match store.get(&DataKey::Token) {
            Some(t) => t,
            None => panic_with_error!(&env, Error::NotInitialized),
        };
        let vault = env.current_contract_address();
        let args = vec![
            &env,
            vault.into_val(&env),
            recipient.into_val(&env),
            amount.into_val(&env),
        ];
        let _ = env.invoke_contract::<()>(&token, &symbol_short!("transfer"), args);
        store.set(&DataKey::Balance, &remaining);
        ManagerClaimReceipt {
            amount_paid: amount,
            remaining_balance: remaining,
        }
    }

    pub fn manager(env: Env) -> Address {
        match env.storage().instance().get(&DataKey::Manager) {
            Some(m) => m,
            None => panic_with_error!(&env, Error::NotInitialized),
        }
    }

    pub fn governor(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Governor)
    }

    pub fn claims_manager(env: Env) -> Option<Address> {
        env.storage()
            .instance()
            .get(&DataKey::ClaimsMgr)
            .unwrap_or(None)
    }

    pub fn token(env: Env) -> Address {
        match env.storage().instance().get(&DataKey::Token) {
            Some(t) => t,
            None => panic_with_error!(&env, Error::NotInitialized),
        }
    }

    pub fn lock_bps(env: Env) -> i32 {
        env.storage().instance().get(&DataKey::LockBps).unwrap_or(0)
    }

    pub fn balance(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Balance).unwrap_or(0)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        contract, contractimpl, symbol_short, testutils::Address as _, testutils::Ledger, Address,
        Env,
    };

    #[contract]
    struct MockToken;
    #[contractimpl]
    impl MockToken {
        pub fn mint(env: Env, to: Address, amount: i128) {
            let k = (symbol_short!("bal"), to);
            let b: i128 = env.storage().instance().get(&k).unwrap_or(0);
            env.storage().instance().set(&k, &(b + amount));
        }
        pub fn approve(env: Env, owner: Address, spender: Address, amount: i128) {
            owner.require_auth();
            let k = (symbol_short!("allow"), owner, spender);
            env.storage().instance().set(&k, &amount);
        }
        pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
            spender.require_auth();
            let ak = (symbol_short!("allow"), from.clone(), spender.clone());
            let allow: i128 = env.storage().instance().get(&ak).unwrap_or(0);
            if allow < amount {
                panic!("insufficient_allowance");
            }
            env.storage().instance().set(&ak, &(allow - amount));
            Self::xfer(env, from, to, amount);
        }
        pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
            from.require_auth();
            Self::xfer(env, from, to, amount);
        }
        pub fn balance(env: Env, owner: Address) -> i128 {
            env.storage()
                .instance()
                .get(&(symbol_short!("bal"), owner))
                .unwrap_or(0)
        }
        fn xfer(env: Env, from: Address, to: Address, amount: i128) {
            let fk = (symbol_short!("bal"), from);
            let tk = (symbol_short!("bal"), to);
            let fb: i128 = env.storage().instance().get(&fk).unwrap_or(0);
            if fb < amount {
                panic!("insufficient_balance");
            }
            env.storage().instance().set(&fk, &(fb - amount));
            let tb: i128 = env.storage().instance().get(&tk).unwrap_or(0);
            env.storage().instance().set(&tk, &(tb + amount));
        }
    }

    #[test]
    fn test_deposit_withdraw_with_lock() {
        let env = Env::default();
        let token_id = env.register_contract(None, MockToken);
        let token = MockTokenClient::new(&env, &token_id);
        let vault_id = env.register_contract(None, CoverageVault);
        let client = CoverageVaultClient::new(&env, &vault_id);
        let mgr = Address::generate(&env);
        client.init(&mgr, &token_id, &2000);
        let user = Address::generate(&env);
        let treasury = Address::generate(&env);

        env.mock_all_auths();
        token.mint(&user, &1_000);
        token.approve(&user, &vault_id, &1_000);
        client.deposit(&user, &1_000);
        assert_eq!(client.balance(), 1_000);
        assert_eq!(client.max_withdrawable(), 800);

        client.withdraw(&mgr, &treasury, &800);
        assert_eq!(client.balance(), 200);
        assert_eq!(token.balance(&treasury), 800);
    }

    #[test]
    #[should_panic]
    fn test_withdraw_above_max_lock_violates() {
        let env = Env::default();
        let token_id = env.register_contract(None, MockToken);
        let token = MockTokenClient::new(&env, &token_id);
        let vault_id = env.register_contract(None, CoverageVault);
        let client = CoverageVaultClient::new(&env, &vault_id);
        let mgr = Address::generate(&env);
        let user = Address::generate(&env);
        let treasury = Address::generate(&env);

        client.init(&mgr, &token_id, &2000);
        env.mock_all_auths();
        token.mint(&user, &500);
        token.approve(&user, &vault_id, &500);
        client.deposit(&user, &500);
        client.withdraw(&mgr, &treasury, &401);
    }

    #[test]
    fn test_governor_takes_policy_control() {
        let env = Env::default();
        let token_id = env.register_contract(None, MockToken);
        let vault_id = env.register_contract(None, CoverageVault);
        let client = CoverageVaultClient::new(&env, &vault_id);
        let mgr = Address::generate(&env);
        let gov = Address::generate(&env);
        env.mock_all_auths();
        client.init(&mgr, &token_id, &1000);
        client.set_governor(&mgr, &gov);
        assert_eq!(client.governor(), Some(gov.clone()));
        client.set_lock_bps(&gov, &3000);
        assert_eq!(client.lock_bps(), 3000);
    }

    #[test]
    fn test_claim_payout_bypasses_lock_for_authorized_claims_manager() {
        let env = Env::default();
        let token_id = env.register_contract(None, MockToken);
        let token = MockTokenClient::new(&env, &token_id);
        let vault_id = env.register_contract(None, CoverageVault);
        let client = CoverageVaultClient::new(&env, &vault_id);
        let mgr = Address::generate(&env);
        let claims_mgr = Address::generate(&env);
        let recipient = Address::generate(&env);
        env.mock_all_auths();

        client.init(&mgr, &token_id, &8000);
        client.set_claims_manager(&mgr, &Some(claims_mgr.clone()));
        token.mint(&mgr, &1_000);
        token.approve(&mgr, &vault_id, &1_000);
        client.deposit(&mgr, &1_000);

        let receipt = client.claim_payout(&claims_mgr, &recipient, &900);
        assert_eq!(
            receipt,
            ManagerClaimReceipt {
                amount_paid: 900,
                remaining_balance: 100,
            }
        );
        assert_eq!(token.balance(&recipient), 900);
        assert_eq!(client.balance(), 100);
    }

    #[test]
    #[should_panic(expected = "bootstrap_admin_expiry_locked")]
    fn test_bootstrap_admin_cannot_extend_expiry() {
        let env = Env::default();
        env.ledger().set_timestamp(1_000);
        let token_id = env.register_contract(None, MockToken);
        let vault_id = env.register_contract(None, CoverageVault);
        let client = CoverageVaultClient::new(&env, &vault_id);
        let mgr = Address::generate(&env);
        let admin = Address::generate(&env);

        env.mock_all_auths();
        client.init(&mgr, &token_id, &1000);
        client.set_bootstrap_admin(&mgr, &admin, &2_000);
        client.set_bootstrap_admin(&admin, &admin, &2_001);
    }
}
