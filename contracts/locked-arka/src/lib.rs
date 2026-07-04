#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, vec,
    Address, BytesN, Env, IntoVal, String, Symbol, TryFromVal, Val, Vec,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Governor,
    BootstrapAdminExpiresAt,
    Token,
    Name,
    Symbol,
    Decimals,
    MinLockLedgers,
    MaxLockLedgers,
    TotalLocked,
    Position(Address),
    Delegate(Address),
    Votes(Address),
    VoteCheckpoints(Address),
    SupplyCheckpoints,
    VoteLedgers,
    LastWasmHash,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidAmount = 4,
    InvalidLockWindow = 5,
    LockExists = 6,
    LockMissing = 7,
    LockNotMatured = 8,
    SequenceNotClosed = 9,
    InsufficientVotes = 10,
    InvalidBootstrapAdmin = 11,
}

const MAX_BOOTSTRAP_ADMIN_SECONDS: u64 = 365 * 24 * 60 * 60;

#[derive(Clone)]
#[contracttype]
pub struct LockPosition {
    pub amount: i128,
    pub unlock_ledger: u32,
}

#[derive(Clone)]
#[contracttype]
pub struct LockConfig {
    pub admin: Address,
    pub governor: Option<Address>,
    pub token: Address,
    pub min_lock_ledgers: u32,
    pub max_lock_ledgers: u32,
    pub decimals: u32,
    pub name: String,
    pub symbol: String,
}

#[contract]
pub struct LockedArka;

#[contractimpl]
impl LockedArka {
    fn pack_checkpoint(env: &Env, sequence: u32, amount: i128) -> u128 {
        #[allow(overflowing_literals)]
        let temp = amount & 0xFFFFFFFF_00000000_00000000_00000000;
        if temp != 0 || amount < 0 {
            panic_with_error!(env, Error::InvalidAmount);
        }
        (sequence as u128) << 96 | (amount as u128)
    }

    fn unpack_checkpoint(value: u128) -> (u32, i128) {
        let sequence = (value >> 96) as u32;
        let amount = (value & 0x00000000_FFFFFFFF_FFFFFFFF_FFFFFFFF) as i128;
        (sequence, amount)
    }

    fn upper_lookup(checkpoints: &Vec<u128>, sequence: u32) -> i128 {
        if checkpoints.is_empty() {
            return 0;
        }
        let needle = ((sequence as u128) << 96) | 0x00000000_FFFFFFFF_FFFFFFFF_FFFFFFFF;
        match checkpoints.binary_search(needle) {
            Ok(index) => Self::unpack_checkpoint(checkpoints.get_unchecked(index)).1,
            Err(index) => {
                if index == 0 {
                    0
                } else {
                    Self::unpack_checkpoint(checkpoints.get_unchecked(index - 1)).1
                }
            }
        }
    }

    fn bump_dynamic_key(env: &Env, key: &DataKey) {
        let max_ttl = env.storage().max_ttl();
        if max_ttl == 0 {
            return;
        }
        let store = env.storage().persistent();
        if store.has(key) {
            let threshold = core::cmp::max(max_ttl / 2, 1);
            store.extend_ttl(key, threshold, max_ttl);
        }
    }

    fn dynamic_get<T>(env: &Env, key: &DataKey) -> Option<T>
    where
        T: TryFromVal<Env, Val> + IntoVal<Env, Val>,
    {
        let persistent = env.storage().persistent();
        if let Some(value) = persistent.get::<DataKey, T>(key) {
            Self::bump_dynamic_key(env, key);
            return Some(value);
        }
        let legacy = env.storage().instance().get::<DataKey, T>(key);
        if let Some(value) = legacy {
            persistent.set(key, &value);
            env.storage().instance().remove(key);
            Self::bump_dynamic_key(env, key);
            return Some(value);
        }
        None
    }

    fn dynamic_set<T>(env: &Env, key: &DataKey, value: &T)
    where
        T: IntoVal<Env, Val>,
    {
        env.storage().persistent().set(key, value);
        env.storage().instance().remove(key);
        Self::bump_dynamic_key(env, key);
    }

    fn dynamic_remove(env: &Env, key: &DataKey) {
        env.storage().persistent().remove(key);
        env.storage().instance().remove(key);
    }

    fn admin_internal(env: &Env) -> Address {
        match env.storage().instance().get(&DataKey::Admin) {
            Some(value) => value,
            None => panic_with_error!(env, Error::NotInitialized),
        }
    }

    fn require_admin(env: &Env, caller: &Address) {
        let admin = Self::admin_internal(env);
        if *caller != admin || Self::bootstrap_admin_expired(env) {
            panic_with_error!(env, Error::Unauthorized);
        }
        caller.require_auth();
    }

    fn require_governor_or_admin(env: &Env) {
        if let Some(governor) = env
            .storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::Governor)
        {
            governor.require_auth();
            return;
        }
        if Self::bootstrap_admin_expired(env) {
            panic_with_error!(env, Error::Unauthorized);
        }
        let admin = Self::admin_internal(env);
        admin.require_auth();
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

    fn token_internal(env: &Env) -> Address {
        match env.storage().instance().get(&DataKey::Token) {
            Some(value) => value,
            None => panic_with_error!(env, Error::NotInitialized),
        }
    }

    fn current_delegate(env: &Env, account: &Address) -> Address {
        Self::dynamic_get::<Address>(env, &DataKey::Delegate(account.clone()))
            .unwrap_or(account.clone())
    }

    fn current_votes(env: &Env, account: &Address) -> i128 {
        Self::dynamic_get::<i128>(env, &DataKey::Votes(account.clone())).unwrap_or(0)
    }

    fn total_locked_internal(env: &Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalLocked)
            .unwrap_or(0)
    }

    fn position_internal(env: &Env, account: &Address) -> Option<LockPosition> {
        Self::dynamic_get::<LockPosition>(env, &DataKey::Position(account.clone()))
    }

    fn current_sequence(env: &Env) -> u32 {
        env.ledger().sequence()
    }

    fn sorted_vote_ledgers(env: &Env) -> Vec<u32> {
        Self::dynamic_get::<Vec<u32>>(env, &DataKey::VoteLedgers).unwrap_or(Vec::new(env))
    }

    fn vote_checkpoints(env: &Env, account: &Address) -> Vec<u128> {
        Self::dynamic_get::<Vec<u128>>(env, &DataKey::VoteCheckpoints(account.clone()))
            .unwrap_or(Vec::new(env))
    }

    fn set_vote_checkpoints(env: &Env, account: &Address, checkpoints: &Vec<u128>) {
        Self::dynamic_set(env, &DataKey::VoteCheckpoints(account.clone()), checkpoints);
    }

    fn supply_checkpoints(env: &Env) -> Vec<u128> {
        Self::dynamic_get::<Vec<u128>>(env, &DataKey::SupplyCheckpoints).unwrap_or(Vec::new(env))
    }

    fn set_supply_checkpoints(env: &Env, checkpoints: &Vec<u128>) {
        Self::dynamic_set(env, &DataKey::SupplyCheckpoints, checkpoints);
    }

    fn insert_or_update_checkpoint(
        env: &Env,
        checkpoints: &mut Vec<u128>,
        sequence: u32,
        amount: i128,
    ) {
        let packed = Self::pack_checkpoint(env, sequence, amount);
        match checkpoints.binary_search(packed) {
            Ok(index) => {
                checkpoints.remove(index);
                checkpoints.insert(index, packed);
            }
            Err(index) => {
                if index > 0 {
                    let (prev_seq, _prev_amount) =
                        Self::unpack_checkpoint(checkpoints.get_unchecked(index - 1));
                    if prev_seq == sequence {
                        checkpoints.remove(index - 1);
                        checkpoints.insert(index - 1, packed);
                        return;
                    }
                }
                checkpoints.insert(index, packed);
            }
        }
    }

    fn maybe_insert_vote_fence(env: &Env, checkpoints: &mut Vec<u128>, prior_amount: i128) {
        let current_seq = Self::current_sequence(env);
        let last_seq = if checkpoints.is_empty() {
            0
        } else {
            Self::unpack_checkpoint(checkpoints.last_unchecked()).0
        };
        let mut candidate: Option<u32> = None;
        for sequence in Self::sorted_vote_ledgers(env).iter() {
            if sequence > last_seq && sequence < current_seq {
                candidate = Some(sequence);
            }
        }
        if let Some(sequence) = candidate {
            Self::insert_or_update_checkpoint(env, checkpoints, sequence, prior_amount);
        }
    }

    fn update_vote_checkpoint(env: &Env, account: &Address, next_votes: i128) {
        let prior_votes = Self::current_votes(env, account);
        let mut checkpoints = Self::vote_checkpoints(env, account);
        Self::maybe_insert_vote_fence(env, &mut checkpoints, prior_votes);
        Self::insert_or_update_checkpoint(
            env,
            &mut checkpoints,
            Self::current_sequence(env),
            next_votes,
        );
        Self::set_vote_checkpoints(env, account, &checkpoints);
        Self::dynamic_set(env, &DataKey::Votes(account.clone()), &next_votes);
    }

    fn update_supply_checkpoint(env: &Env, next_total_locked: i128) {
        let prior_total = Self::total_locked_internal(env);
        let mut checkpoints = Self::supply_checkpoints(env);
        Self::maybe_insert_vote_fence(env, &mut checkpoints, prior_total);
        Self::insert_or_update_checkpoint(
            env,
            &mut checkpoints,
            Self::current_sequence(env),
            next_total_locked,
        );
        Self::set_supply_checkpoints(env, &checkpoints);
        env.storage()
            .instance()
            .set(&DataKey::TotalLocked, &next_total_locked);
    }

    fn apply_vote_delta(env: &Env, account: &Address, delta: i128) {
        let current = Self::current_votes(env, account);
        let next = current + delta;
        if next < 0 {
            panic_with_error!(env, Error::InsufficientVotes);
        }
        Self::update_vote_checkpoint(env, account, next);
    }

    fn apply_supply_delta(env: &Env, delta: i128) {
        let current = Self::total_locked_internal(env);
        let next = current + delta;
        if next < 0 {
            panic_with_error!(env, Error::InvalidAmount);
        }
        Self::update_supply_checkpoint(env, next);
    }

    fn transfer_underlying(env: &Env, from: &Address, to: &Address, amount: i128) {
        let token = Self::token_internal(env);
        let args = vec![
            env,
            from.clone().into_val(env),
            to.clone().into_val(env),
            amount.into_val(env),
        ];
        let _ = env.invoke_contract::<()>(&token, &Symbol::new(env, "transfer"), args);
    }

    fn validate_lock_window(env: &Env, unlock_ledger: u32) {
        let current = Self::current_sequence(env);
        if unlock_ledger <= current {
            panic_with_error!(env, Error::InvalidLockWindow);
        }
        let duration = unlock_ledger - current;
        let min_lock: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MinLockLedgers)
            .unwrap_or(0);
        let max_lock: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MaxLockLedgers)
            .unwrap_or(0);
        if duration < min_lock || duration > max_lock {
            panic_with_error!(env, Error::InvalidLockWindow);
        }
    }

    pub fn init(
        env: Env,
        admin: Address,
        token: Address,
        min_lock_ledgers: u32,
        max_lock_ledgers: u32,
        name: String,
        symbol: String,
    ) {
        if min_lock_ledgers == 0 || max_lock_ledgers == 0 || min_lock_ledgers > max_lock_ledgers {
            panic_with_error!(&env, Error::InvalidLockWindow);
        }
        let store = env.storage().instance();
        if store.has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        let decimals =
            env.invoke_contract::<u32>(&token, &Symbol::new(&env, "decimals"), vec![&env]);
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::Token, &token);
        store.set(&DataKey::MinLockLedgers, &min_lock_ledgers);
        store.set(&DataKey::MaxLockLedgers, &max_lock_ledgers);
        store.set(&DataKey::Name, &name);
        store.set(&DataKey::Symbol, &symbol);
        store.set(&DataKey::Decimals, &decimals);
        store.set(&DataKey::TotalLocked, &0i128);
        Self::dynamic_set(&env, &DataKey::VoteLedgers, &Vec::<u32>::new(&env));
    }

    pub fn set_admin(env: Env, caller: Address, admin: Address) {
        Self::require_admin_or_governor_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn set_governor(env: Env, caller: Address, governor: Address) {
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

    pub fn create_lock(env: Env, account: Address, amount: i128, unlock_ledger: u32) {
        account.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        if Self::position_internal(&env, &account).is_some() {
            panic_with_error!(&env, Error::LockExists);
        }
        Self::validate_lock_window(&env, unlock_ledger);
        let contract = env.current_contract_address();
        Self::transfer_underlying(&env, &account, &contract, amount);
        let position = LockPosition {
            amount,
            unlock_ledger,
        };
        Self::dynamic_set(&env, &DataKey::Position(account.clone()), &position);
        let delegate = Self::current_delegate(&env, &account);
        Self::dynamic_set(&env, &DataKey::Delegate(account.clone()), &delegate);
        Self::apply_supply_delta(&env, amount);
        Self::apply_vote_delta(&env, &delegate, amount);
    }

    pub fn increase_amount(env: Env, account: Address, amount: i128) {
        account.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        let mut position = match Self::position_internal(&env, &account) {
            Some(value) => value,
            None => panic_with_error!(&env, Error::LockMissing),
        };
        if Self::current_sequence(&env) >= position.unlock_ledger {
            panic_with_error!(&env, Error::LockNotMatured);
        }
        let contract = env.current_contract_address();
        Self::transfer_underlying(&env, &account, &contract, amount);
        position.amount += amount;
        Self::dynamic_set(&env, &DataKey::Position(account.clone()), &position);
        let delegate = Self::current_delegate(&env, &account);
        Self::apply_supply_delta(&env, amount);
        Self::apply_vote_delta(&env, &delegate, amount);
    }

    pub fn extend_lock(env: Env, account: Address, unlock_ledger: u32) {
        account.require_auth();
        let mut position = match Self::position_internal(&env, &account) {
            Some(value) => value,
            None => panic_with_error!(&env, Error::LockMissing),
        };
        if Self::current_sequence(&env) >= position.unlock_ledger
            || unlock_ledger <= position.unlock_ledger
        {
            panic_with_error!(&env, Error::InvalidLockWindow);
        }
        Self::validate_lock_window(&env, unlock_ledger);
        position.unlock_ledger = unlock_ledger;
        Self::dynamic_set(&env, &DataKey::Position(account.clone()), &position);
    }

    pub fn withdraw(env: Env, account: Address) {
        account.require_auth();
        let position = match Self::position_internal(&env, &account) {
            Some(value) => value,
            None => panic_with_error!(&env, Error::LockMissing),
        };
        if Self::current_sequence(&env) < position.unlock_ledger {
            panic_with_error!(&env, Error::LockNotMatured);
        }
        Self::dynamic_remove(&env, &DataKey::Position(account.clone()));
        let delegate = Self::current_delegate(&env, &account);
        Self::apply_supply_delta(&env, -position.amount);
        Self::apply_vote_delta(&env, &delegate, -position.amount);
        let contract = env.current_contract_address();
        Self::transfer_underlying(&env, &contract, &account, position.amount);
    }

    pub fn delegate(env: Env, account: Address, delegatee: Address) {
        account.require_auth();
        let current_delegate = Self::current_delegate(&env, &account);
        if current_delegate == delegatee {
            return;
        }
        let locked_amount = Self::locked_balance(env.clone(), account.clone());
        Self::dynamic_set(&env, &DataKey::Delegate(account.clone()), &delegatee);
        if locked_amount > 0 {
            Self::apply_vote_delta(&env, &current_delegate, -locked_amount);
            Self::apply_vote_delta(&env, &delegatee, locked_amount);
        }
    }

    pub fn total_supply(env: Env) -> i128 {
        Self::total_locked_internal(&env)
    }

    pub fn balance(env: Env, account: Address) -> i128 {
        Self::locked_balance(env, account)
    }

    pub fn locked_balance(env: Env, account: Address) -> i128 {
        Self::position_internal(&env, &account)
            .map(|position| position.amount)
            .unwrap_or(0)
    }

    pub fn lock_position(env: Env, account: Address) -> Option<LockPosition> {
        Self::position_internal(&env, &account)
    }

    pub fn set_vote_sequence(env: Env, sequence: u32) {
        Self::require_governor_or_admin(&env);
        let mut sequences = Self::sorted_vote_ledgers(&env);
        match sequences.binary_search(sequence) {
            Ok(_) => {}
            Err(index) => sequences.insert(index, sequence),
        }
        Self::dynamic_set(&env, &DataKey::VoteLedgers, &sequences);
    }

    pub fn get_past_total_supply(env: Env, sequence: u32) -> i128 {
        if sequence >= Self::current_sequence(&env) {
            panic_with_error!(&env, Error::SequenceNotClosed);
        }
        Self::upper_lookup(&Self::supply_checkpoints(&env), sequence)
    }

    pub fn get_votes(env: Env, account: Address) -> i128 {
        Self::current_votes(&env, &account)
    }

    pub fn get_past_votes(env: Env, account: Address, sequence: u32) -> i128 {
        if sequence >= Self::current_sequence(&env) {
            panic_with_error!(&env, Error::SequenceNotClosed);
        }
        Self::upper_lookup(&Self::vote_checkpoints(&env, &account), sequence)
    }

    pub fn get_delegate(env: Env, account: Address) -> Address {
        Self::current_delegate(&env, &account)
    }

    pub fn admin(env: Env) -> Address {
        Self::admin_internal(&env)
    }

    pub fn governor(env: Env) -> Option<Address> {
        env.storage()
            .instance()
            .get(&DataKey::Governor)
            .unwrap_or(None)
    }

    pub fn config(env: Env) -> LockConfig {
        LockConfig {
            admin: Self::admin_internal(&env),
            governor: env
                .storage()
                .instance()
                .get(&DataKey::Governor)
                .unwrap_or(None),
            token: Self::token_internal(&env),
            min_lock_ledgers: env
                .storage()
                .instance()
                .get(&DataKey::MinLockLedgers)
                .unwrap_or(0),
            max_lock_ledgers: env
                .storage()
                .instance()
                .get(&DataKey::MaxLockLedgers)
                .unwrap_or(0),
            decimals: env
                .storage()
                .instance()
                .get(&DataKey::Decimals)
                .unwrap_or(7),
            name: env
                .storage()
                .instance()
                .get(&DataKey::Name)
                .unwrap_or(String::from_str(&env, "Locked ARKA")),
            symbol: env
                .storage()
                .instance()
                .get(&DataKey::Symbol)
                .unwrap_or(String::from_str(&env, "lARKA")),
        }
    }
}

#[cfg(test)]
mod test;
