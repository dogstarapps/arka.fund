#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, vec,
    Address, BytesN, Env, IntoVal, Symbol, Vec,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Governor,
    BootstrapAdminExpiresAt,
    Token,
    NextStreamId,
    Stream(u32),
    RecipientStreams(Address),
    LastWasmHash,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidAmount = 4,
    InvalidSchedule = 5,
    StreamMissing = 6,
    StreamAlreadyCanceled = 7,
    InvalidBootstrapAdmin = 8,
}

const MAX_BOOTSTRAP_ADMIN_SECONDS: u64 = 365 * 24 * 60 * 60;

#[derive(Clone)]
#[contracttype]
pub struct EmissionStream {
    pub recipient: Address,
    pub total_amount: i128,
    pub released_amount: i128,
    pub start_time: u64,
    pub end_time: u64,
    pub canceled_at: Option<u64>,
    pub refund_recipient: Option<Address>,
}

#[derive(Clone)]
#[contracttype]
pub struct CancelReceipt {
    pub stream_id: u32,
    pub vested_amount: i128,
    pub refunded_amount: i128,
    pub cutoff_time: u64,
    pub refund_recipient: Address,
}

#[contract]
pub struct EmissionsController;

#[contractimpl]
impl EmissionsController {
    fn admin_internal(env: &Env) -> Address {
        match env.storage().persistent().get(&DataKey::Admin) {
            Some(value) => value,
            None => panic_with_error!(env, Error::NotInitialized),
        }
    }

    fn token_internal(env: &Env) -> Address {
        match env.storage().persistent().get(&DataKey::Token) {
            Some(value) => value,
            None => panic_with_error!(env, Error::NotInitialized),
        }
    }

    fn require_policy_auth(env: &Env, caller: &Address) {
        let admin = Self::admin_internal(env);
        if *caller == admin && !Self::bootstrap_admin_expired(env) {
            caller.require_auth();
            return;
        }
        if let Some(governor) = env
            .storage()
            .persistent()
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
            .persistent()
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
            .persistent()
            .get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
        else {
            return false;
        };
        env.ledger().timestamp() > expires_at
    }

    fn bootstrap_admin_active_internal(env: &Env) -> bool {
        let Some(expires_at) = env
            .storage()
            .persistent()
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

    fn assert_positive(env: &Env, amount: i128) {
        if amount <= 0 {
            panic_with_error!(env, Error::InvalidAmount);
        }
    }

    fn validate_schedule(env: &Env, start_time: u64, end_time: u64) {
        if start_time >= end_time {
            panic_with_error!(env, Error::InvalidSchedule);
        }
    }

    fn stream_internal(env: &Env, stream_id: u32) -> EmissionStream {
        match env
            .storage()
            .persistent()
            .get::<DataKey, EmissionStream>(&DataKey::Stream(stream_id))
        {
            Some(value) => value,
            None => panic_with_error!(env, Error::StreamMissing),
        }
    }

    fn set_stream(env: &Env, stream_id: u32, stream: &EmissionStream) {
        env.storage()
            .persistent()
            .set(&DataKey::Stream(stream_id), stream);
    }

    fn push_stream_id(env: &Env, recipient: &Address, stream_id: u32) {
        let key = DataKey::RecipientStreams(recipient.clone());
        let mut streams = env
            .storage()
            .persistent()
            .get::<DataKey, Vec<u32>>(&key)
            .unwrap_or(Vec::new(env));
        streams.push_back(stream_id);
        env.storage().persistent().set(&key, &streams);
    }

    fn next_stream_id(env: &Env) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::NextStreamId)
            .unwrap_or(0)
    }

    fn vested_amount_at(stream: &EmissionStream, timestamp: u64) -> i128 {
        let effective_time = match stream.canceled_at {
            Some(canceled_at) if canceled_at < timestamp => canceled_at,
            Some(canceled_at) => canceled_at,
            None => timestamp,
        };
        if effective_time <= stream.start_time {
            return 0;
        }
        if effective_time >= stream.end_time {
            return stream.total_amount;
        }
        let elapsed = effective_time.saturating_sub(stream.start_time) as i128;
        let duration = stream.end_time.saturating_sub(stream.start_time) as i128;
        (stream.total_amount * elapsed) / duration
    }

    fn releasable_internal(env: &Env, stream: &EmissionStream) -> i128 {
        let vested = Self::vested_amount_at(stream, env.ledger().timestamp());
        if vested <= stream.released_amount {
            0
        } else {
            vested - stream.released_amount
        }
    }

    fn pull_token_from(env: &Env, token: &Address, from: &Address, amount: i128) {
        let contract = env.current_contract_address();
        let args = vec![
            env,
            contract.clone().into_val(env),
            from.clone().into_val(env),
            contract.into_val(env),
            amount.into_val(env),
        ];
        let _ = env.invoke_contract::<()>(token, &Symbol::new(env, "transfer_from"), args);
    }

    fn push_token_to(env: &Env, token: &Address, to: &Address, amount: i128) {
        let contract = env.current_contract_address();
        let args = vec![
            env,
            contract.into_val(env),
            to.clone().into_val(env),
            amount.into_val(env),
        ];
        let _ = env.invoke_contract::<()>(token, &symbol_short!("transfer"), args);
    }

    pub fn init(env: Env, admin: Address, token: Address) {
        if env.storage().persistent().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::Token, &token);
        env.storage()
            .persistent()
            .set(&DataKey::NextStreamId, &0u32);
    }

    pub fn set_governor(env: Env, caller: Address, governor: Option<Address>) {
        Self::require_policy_auth(&env, &caller);
        env.storage()
            .persistent()
            .set(&DataKey::Governor, &governor);
    }

    pub fn set_admin(env: Env, caller: Address, admin: Address) {
        Self::require_policy_auth(&env, &caller);
        env.storage().persistent().set(&DataKey::Admin, &admin);
    }

    pub fn set_bootstrap_admin_expiry(env: Env, caller: Address, expires_at: u64) {
        Self::require_policy_auth(&env, &caller);
        Self::require_future_bootstrap_expiry(&env, expires_at);
        if let Some(current_expires_at) = env
            .storage()
            .persistent()
            .get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
        {
            assert!(
                expires_at <= current_expires_at,
                "bootstrap_admin_expiry_locked"
            );
        }
        env.storage()
            .persistent()
            .set(&DataKey::BootstrapAdminExpiresAt, &expires_at);
    }

    pub fn clear_bootstrap_admin_expiry(env: Env, caller: Address) {
        Self::require_governor_auth(&env, &caller);
        let expired_at: u64 = 0;
        env.storage()
            .persistent()
            .set(&DataKey::BootstrapAdminExpiresAt, &expired_at);
    }

    pub fn bootstrap_admin_expires_at(env: Env) -> Option<u64> {
        env.storage()
            .persistent()
            .get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
    }

    pub fn bootstrap_admin_active(env: Env) -> bool {
        Self::bootstrap_admin_active_internal(&env)
    }

    pub fn upgrade(env: Env, caller: Address, new_wasm_hash: BytesN<32>) {
        Self::require_policy_auth(&env, &caller);
        env.storage()
            .persistent()
            .set(&DataKey::LastWasmHash, &new_wasm_hash);
        env.events()
            .publish((symbol_short!("upgrade"),), new_wasm_hash.clone());
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    pub fn last_wasm_hash(env: Env) -> Option<BytesN<32>> {
        env.storage()
            .persistent()
            .get::<DataKey, BytesN<32>>(&DataKey::LastWasmHash)
    }

    pub fn create_stream(
        env: Env,
        caller: Address,
        funding_source: Address,
        recipient: Address,
        start_time: u64,
        end_time: u64,
        total_amount: i128,
    ) -> u32 {
        Self::require_policy_auth(&env, &caller);
        Self::assert_positive(&env, total_amount);
        Self::validate_schedule(&env, start_time, end_time);

        let token = Self::token_internal(&env);
        Self::pull_token_from(&env, &token, &funding_source, total_amount);

        let stream_id = Self::next_stream_id(&env).saturating_add(1);
        let stream = EmissionStream {
            recipient: recipient.clone(),
            total_amount,
            released_amount: 0,
            start_time,
            end_time,
            canceled_at: None,
            refund_recipient: None,
        };
        Self::set_stream(&env, stream_id, &stream);
        env.storage()
            .persistent()
            .set(&DataKey::NextStreamId, &stream_id);
        Self::push_stream_id(&env, &recipient, stream_id);
        stream_id
    }

    pub fn release(env: Env, stream_id: u32) -> i128 {
        let mut stream = Self::stream_internal(&env, stream_id);
        let releasable = Self::releasable_internal(&env, &stream);
        if releasable == 0 {
            return 0;
        }
        let token = Self::token_internal(&env);
        Self::push_token_to(&env, &token, &stream.recipient, releasable);
        stream.released_amount += releasable;
        Self::set_stream(&env, stream_id, &stream);
        releasable
    }

    pub fn release_all(env: Env, recipient: Address) -> i128 {
        let streams = env
            .storage()
            .persistent()
            .get::<DataKey, Vec<u32>>(&DataKey::RecipientStreams(recipient))
            .unwrap_or(Vec::new(&env));
        let mut total = 0i128;
        for stream_id in streams.iter() {
            total += Self::release(env.clone(), stream_id);
        }
        total
    }

    pub fn cancel_stream(
        env: Env,
        caller: Address,
        stream_id: u32,
        refund_recipient: Address,
    ) -> CancelReceipt {
        Self::require_policy_auth(&env, &caller);
        let mut stream = Self::stream_internal(&env, stream_id);
        if stream.canceled_at.is_some() {
            panic_with_error!(&env, Error::StreamAlreadyCanceled);
        }
        let cutoff_time = env.ledger().timestamp();
        let vested_amount =
            Self::vested_amount_at(&stream, cutoff_time).max(stream.released_amount);
        let refunded_amount = stream.total_amount - vested_amount;
        if refunded_amount > 0 {
            let token = Self::token_internal(&env);
            Self::push_token_to(&env, &token, &refund_recipient, refunded_amount);
        }
        stream.canceled_at = Some(cutoff_time);
        stream.refund_recipient = Some(refund_recipient.clone());
        Self::set_stream(&env, stream_id, &stream);
        CancelReceipt {
            stream_id,
            vested_amount,
            refunded_amount,
            cutoff_time,
            refund_recipient,
        }
    }

    pub fn stream(env: Env, stream_id: u32) -> EmissionStream {
        Self::stream_internal(&env, stream_id)
    }

    pub fn stream_ids(env: Env, recipient: Address) -> Vec<u32> {
        env.storage()
            .persistent()
            .get(&DataKey::RecipientStreams(recipient))
            .unwrap_or(Vec::new(&env))
    }

    pub fn releasable(env: Env, stream_id: u32) -> i128 {
        let stream = Self::stream_internal(&env, stream_id);
        Self::releasable_internal(&env, &stream)
    }

    pub fn token(env: Env) -> Address {
        Self::token_internal(&env)
    }

    pub fn governor(env: Env) -> Option<Address> {
        env.storage().persistent().get(&DataKey::Governor)
    }

    pub fn admin(env: Env) -> Address {
        Self::admin_internal(&env)
    }
}

#[cfg(test)]
mod test;
