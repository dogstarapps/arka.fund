#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    BytesN, Env, IntoVal, String, Val,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Governor,
    BootstrapAdminExpiresAt,
    Name,
    Symbol,
    Decimals,
    MaxSupply,
    TotalSupply,
    LastWasmHash,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidAmount = 4,
    InsufficientBalance = 5,
    InsufficientAllowance = 6,
    MaxSupplyExceeded = 7,
    InvalidBootstrapAdmin = 8,
}

const MAX_BOOTSTRAP_ADMIN_SECONDS: u64 = 365 * 24 * 60 * 60;

#[contract]
pub struct ArkaToken;

#[contractimpl]
impl ArkaToken {
    fn bump_persistent_key<K>(env: &Env, key: &K)
    where
        K: IntoVal<Env, Val>,
    {
        let max_ttl = env.storage().max_ttl();
        if max_ttl == 0 {
            return;
        }
        if env.storage().persistent().has(key) {
            let threshold = core::cmp::max(max_ttl / 2, 1);
            env.storage()
                .persistent()
                .extend_ttl(key, threshold, max_ttl);
        }
    }

    fn admin_internal(env: &Env) -> Address {
        match env.storage().instance().get(&DataKey::Admin) {
            Some(value) => value,
            None => panic_with_error!(env, Error::NotInitialized),
        }
    }

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
        let admin = Self::admin_internal(env);
        if *caller == admin && !Self::bootstrap_admin_expired(env) {
            caller.require_auth();
            return;
        }
        if let Some(governor) = env
            .storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::Governor)
        {
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

    fn assert_positive(env: &Env, amount: i128) {
        if amount <= 0 {
            panic_with_error!(env, Error::InvalidAmount);
        }
    }

    fn balance_key(owner: &Address) -> (soroban_sdk::Symbol, Address) {
        (symbol_short!("bal"), owner.clone())
    }

    fn allowance_key(
        owner: &Address,
        spender: &Address,
    ) -> (soroban_sdk::Symbol, Address, Address) {
        (symbol_short!("allow"), owner.clone(), spender.clone())
    }

    fn balance_internal(env: &Env, owner: &Address) -> i128 {
        let key = Self::balance_key(owner);
        if let Some(balance) = env.storage().persistent().get::<_, i128>(&key) {
            Self::bump_persistent_key(env, &key);
            return balance;
        }
        let legacy_balance: i128 = env.storage().instance().get(&key).unwrap_or(0);
        if legacy_balance > 0 {
            env.storage().persistent().set(&key, &legacy_balance);
            env.storage().instance().remove(&key);
            Self::bump_persistent_key(env, &key);
        }
        legacy_balance
    }

    fn set_balance(env: &Env, owner: &Address, amount: i128) {
        let key = Self::balance_key(owner);
        if amount == 0 {
            env.storage().persistent().remove(&key);
            env.storage().instance().remove(&key);
            return;
        }
        env.storage().persistent().set(&key, &amount);
        env.storage().instance().remove(&key);
        Self::bump_persistent_key(env, &key);
    }

    fn allowance_internal(env: &Env, owner: &Address, spender: &Address) -> i128 {
        let key = Self::allowance_key(owner, spender);
        if let Some(allowance) = env.storage().persistent().get::<_, i128>(&key) {
            Self::bump_persistent_key(env, &key);
            return allowance;
        }
        let legacy_allowance: i128 = env.storage().instance().get(&key).unwrap_or(0);
        if legacy_allowance > 0 {
            env.storage().persistent().set(&key, &legacy_allowance);
            env.storage().instance().remove(&key);
            Self::bump_persistent_key(env, &key);
        }
        legacy_allowance
    }

    fn set_allowance(env: &Env, owner: &Address, spender: &Address, amount: i128) {
        let key = Self::allowance_key(owner, spender);
        if amount == 0 {
            env.storage().persistent().remove(&key);
            env.storage().instance().remove(&key);
            return;
        }
        env.storage().persistent().set(&key, &amount);
        env.storage().instance().remove(&key);
        Self::bump_persistent_key(env, &key);
    }

    fn total_supply_internal(env: &Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }

    fn set_total_supply(env: &Env, amount: i128) {
        env.storage().instance().set(&DataKey::TotalSupply, &amount);
    }

    fn enforce_supply_cap(env: &Env, next_total_supply: i128) {
        if let Some(max_supply) = env
            .storage()
            .instance()
            .get::<DataKey, i128>(&DataKey::MaxSupply)
        {
            if next_total_supply > max_supply {
                panic_with_error!(env, Error::MaxSupplyExceeded);
            }
        }
    }

    fn xfer(env: &Env, from: &Address, to: &Address, amount: i128) {
        Self::assert_positive(env, amount);
        let from_balance = Self::balance_internal(env, from);
        if from_balance < amount {
            panic_with_error!(env, Error::InsufficientBalance);
        }
        Self::set_balance(env, from, from_balance - amount);
        let to_balance = Self::balance_internal(env, to);
        Self::set_balance(env, to, to_balance + amount);
    }

    fn mint_internal(env: &Env, to: &Address, amount: i128) {
        Self::assert_positive(env, amount);
        let current_total = Self::total_supply_internal(env);
        let next_total = current_total + amount;
        Self::enforce_supply_cap(env, next_total);
        Self::set_total_supply(env, next_total);
        let balance = Self::balance_internal(env, to);
        Self::set_balance(env, to, balance + amount);
    }

    pub fn init(
        env: Env,
        admin: Address,
        name: String,
        symbol: String,
        decimals: u32,
        max_supply: Option<i128>,
    ) {
        let store = env.storage().instance();
        if store.has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        if let Some(cap) = max_supply {
            if cap <= 0 {
                panic_with_error!(&env, Error::InvalidAmount);
            }
        }
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::Name, &name);
        store.set(&DataKey::Symbol, &symbol);
        store.set(&DataKey::Decimals, &decimals);
        store.set(&DataKey::MaxSupply, &max_supply);
        store.set(&DataKey::TotalSupply, &0i128);
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

    pub fn admin(env: Env) -> Address {
        Self::admin_internal(&env)
    }

    pub fn max_supply(env: Env) -> Option<i128> {
        env.storage()
            .instance()
            .get(&DataKey::MaxSupply)
            .unwrap_or(None)
    }

    pub fn total_supply(env: Env) -> i128 {
        Self::total_supply_internal(&env)
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin = Self::admin_internal(&env);
        if Self::bootstrap_admin_expired(&env) {
            panic_with_error!(&env, Error::Unauthorized);
        }
        admin.require_auth();
        Self::mint_internal(&env, &to, amount);
    }

    pub fn mint_governed(env: Env, caller: Address, to: Address, amount: i128) {
        Self::require_admin_or_governor_auth(&env, &caller);
        Self::mint_internal(&env, &to, amount);
    }

    pub fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        Self::assert_positive(&env, amount);
        let balance = Self::balance_internal(&env, &from);
        if balance < amount {
            panic_with_error!(&env, Error::InsufficientBalance);
        }
        Self::set_balance(&env, &from, balance - amount);
        Self::set_total_supply(&env, Self::total_supply_internal(&env) - amount);
    }

    pub fn admin_burn(env: Env, from: Address, amount: i128) {
        let admin = Self::admin_internal(&env);
        if Self::bootstrap_admin_expired(&env) {
            panic_with_error!(&env, Error::Unauthorized);
        }
        admin.require_auth();
        Self::assert_positive(&env, amount);
        let balance = Self::balance_internal(&env, &from);
        if balance < amount {
            panic_with_error!(&env, Error::InsufficientBalance);
        }
        Self::set_balance(&env, &from, balance - amount);
        Self::set_total_supply(&env, Self::total_supply_internal(&env) - amount);
    }

    pub fn admin_burn_governed(env: Env, caller: Address, from: Address, amount: i128) {
        Self::require_admin_or_governor_auth(&env, &caller);
        Self::assert_positive(&env, amount);
        let balance = Self::balance_internal(&env, &from);
        if balance < amount {
            panic_with_error!(&env, Error::InsufficientBalance);
        }
        Self::set_balance(&env, &from, balance - amount);
        Self::set_total_supply(&env, Self::total_supply_internal(&env) - amount);
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

    pub fn approve(env: Env, owner: Address, spender: Address, amount: i128) {
        owner.require_auth();
        if amount < 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        Self::set_allowance(&env, &owner, &spender, amount);
    }

    pub fn allowance(env: Env, owner: Address, spender: Address) -> i128 {
        Self::allowance_internal(&env, &owner, &spender)
    }

    pub fn balance(env: Env, owner: Address) -> i128 {
        Self::balance_internal(&env, &owner)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        Self::xfer(&env, &from, &to, amount);
    }

    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        Self::assert_positive(&env, amount);
        let allowance = Self::allowance_internal(&env, &from, &spender);
        if allowance < amount {
            panic_with_error!(&env, Error::InsufficientAllowance);
        }
        Self::set_allowance(&env, &from, &spender, allowance - amount);
        Self::xfer(&env, &from, &to, amount);
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Decimals)
            .unwrap_or(7)
    }

    pub fn name(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Name)
            .unwrap_or(String::from_str(&env, "ARKA"))
    }

    pub fn symbol(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Symbol)
            .unwrap_or(String::from_str(&env, "ARKA"))
    }
}

#[cfg(test)]
mod test;
