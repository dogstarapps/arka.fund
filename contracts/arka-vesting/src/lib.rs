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
    NextGrantId,
    Grant(u32),
    BeneficiaryGrants(Address),
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
    GrantMissing = 6,
    GrantNotRevocable = 7,
    GrantAlreadyCanceled = 8,
    InvalidBootstrapAdmin = 9,
}

const MAX_BOOTSTRAP_ADMIN_SECONDS: u64 = 365 * 24 * 60 * 60;

#[derive(Clone)]
#[contracttype]
pub struct VestingGrant {
    pub beneficiary: Address,
    pub total_amount: i128,
    pub released_amount: i128,
    pub start_time: u64,
    pub cliff_time: u64,
    pub end_time: u64,
    pub revocable: bool,
    pub canceled_at: Option<u64>,
    pub refund_recipient: Option<Address>,
}

#[derive(Clone)]
#[contracttype]
pub struct RevokeReceipt {
    pub grant_id: u32,
    pub vested_amount: i128,
    pub refunded_amount: i128,
    pub cutoff_time: u64,
    pub refund_recipient: Address,
}

#[contract]
pub struct ArkaVesting;

#[contractimpl]
impl ArkaVesting {
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

    fn validate_schedule(env: &Env, start_time: u64, cliff_time: u64, end_time: u64) {
        if start_time >= end_time || cliff_time < start_time || cliff_time > end_time {
            panic_with_error!(env, Error::InvalidSchedule);
        }
    }

    fn grant_internal(env: &Env, grant_id: u32) -> VestingGrant {
        match env
            .storage()
            .persistent()
            .get::<DataKey, VestingGrant>(&DataKey::Grant(grant_id))
        {
            Some(value) => value,
            None => panic_with_error!(env, Error::GrantMissing),
        }
    }

    fn set_grant(env: &Env, grant_id: u32, grant: &VestingGrant) {
        env.storage()
            .persistent()
            .set(&DataKey::Grant(grant_id), grant);
    }

    fn next_grant_id(env: &Env) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::NextGrantId)
            .unwrap_or(0)
    }

    fn push_grant_id(env: &Env, beneficiary: &Address, grant_id: u32) {
        let key = DataKey::BeneficiaryGrants(beneficiary.clone());
        let mut grants = env
            .storage()
            .persistent()
            .get::<DataKey, Vec<u32>>(&key)
            .unwrap_or(Vec::new(env));
        grants.push_back(grant_id);
        env.storage().persistent().set(&key, &grants);
    }

    fn vested_amount_at(grant: &VestingGrant, timestamp: u64) -> i128 {
        let effective_time = match grant.canceled_at {
            Some(canceled_at) if canceled_at < timestamp => canceled_at,
            Some(canceled_at) => canceled_at,
            None => timestamp,
        };
        if effective_time < grant.cliff_time {
            return 0;
        }
        if effective_time >= grant.end_time {
            return grant.total_amount;
        }
        let elapsed = effective_time.saturating_sub(grant.start_time) as i128;
        let duration = grant.end_time.saturating_sub(grant.start_time) as i128;
        (grant.total_amount * elapsed) / duration
    }

    fn claimable_internal(env: &Env, grant: &VestingGrant) -> i128 {
        let vested = Self::vested_amount_at(grant, env.ledger().timestamp());
        if vested <= grant.released_amount {
            0
        } else {
            vested - grant.released_amount
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
        env.storage().persistent().set(&DataKey::NextGrantId, &0u32);
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

    pub fn create_grant(
        env: Env,
        caller: Address,
        funding_source: Address,
        beneficiary: Address,
        start_time: u64,
        cliff_time: u64,
        end_time: u64,
        total_amount: i128,
        revocable: bool,
    ) -> u32 {
        Self::require_policy_auth(&env, &caller);
        Self::assert_positive(&env, total_amount);
        Self::validate_schedule(&env, start_time, cliff_time, end_time);

        let token = Self::token_internal(&env);
        Self::pull_token_from(&env, &token, &funding_source, total_amount);

        let grant_id = Self::next_grant_id(&env).saturating_add(1);
        let grant = VestingGrant {
            beneficiary: beneficiary.clone(),
            total_amount,
            released_amount: 0,
            start_time,
            cliff_time,
            end_time,
            revocable,
            canceled_at: None,
            refund_recipient: None,
        };
        Self::set_grant(&env, grant_id, &grant);
        env.storage()
            .persistent()
            .set(&DataKey::NextGrantId, &grant_id);
        Self::push_grant_id(&env, &beneficiary, grant_id);
        grant_id
    }

    pub fn claim(env: Env, grant_id: u32) -> i128 {
        let mut grant = Self::grant_internal(&env, grant_id);
        let claimable = Self::claimable_internal(&env, &grant);
        if claimable == 0 {
            return 0;
        }
        let token = Self::token_internal(&env);
        Self::push_token_to(&env, &token, &grant.beneficiary, claimable);
        grant.released_amount += claimable;
        Self::set_grant(&env, grant_id, &grant);
        claimable
    }

    pub fn claim_all(env: Env, beneficiary: Address) -> i128 {
        let grants = env
            .storage()
            .persistent()
            .get::<DataKey, Vec<u32>>(&DataKey::BeneficiaryGrants(beneficiary))
            .unwrap_or(Vec::new(&env));
        let mut total_claimed = 0i128;
        for grant_id in grants.iter() {
            total_claimed += Self::claim(env.clone(), grant_id);
        }
        total_claimed
    }

    pub fn revoke(
        env: Env,
        caller: Address,
        grant_id: u32,
        refund_recipient: Address,
    ) -> RevokeReceipt {
        Self::require_policy_auth(&env, &caller);
        let mut grant = Self::grant_internal(&env, grant_id);
        if !grant.revocable {
            panic_with_error!(&env, Error::GrantNotRevocable);
        }
        if grant.canceled_at.is_some() {
            panic_with_error!(&env, Error::GrantAlreadyCanceled);
        }
        let cutoff_time = env.ledger().timestamp();
        let vested_amount = Self::vested_amount_at(&grant, cutoff_time).max(grant.released_amount);
        let refunded_amount = grant.total_amount - vested_amount;
        if refunded_amount > 0 {
            let token = Self::token_internal(&env);
            Self::push_token_to(&env, &token, &refund_recipient, refunded_amount);
        }
        grant.canceled_at = Some(cutoff_time);
        grant.refund_recipient = Some(refund_recipient.clone());
        Self::set_grant(&env, grant_id, &grant);
        RevokeReceipt {
            grant_id,
            vested_amount,
            refunded_amount,
            cutoff_time,
            refund_recipient,
        }
    }

    pub fn grant(env: Env, grant_id: u32) -> VestingGrant {
        Self::grant_internal(&env, grant_id)
    }

    pub fn grant_ids(env: Env, beneficiary: Address) -> Vec<u32> {
        env.storage()
            .persistent()
            .get(&DataKey::BeneficiaryGrants(beneficiary))
            .unwrap_or(Vec::new(&env))
    }

    pub fn claimable(env: Env, grant_id: u32) -> i128 {
        let grant = Self::grant_internal(&env, grant_id);
        Self::claimable_internal(&env, &grant)
    }

    pub fn vested_amount(env: Env, grant_id: u32) -> i128 {
        let grant = Self::grant_internal(&env, grant_id);
        Self::vested_amount_at(&grant, env.ledger().timestamp())
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
mod test {
    extern crate std;

    use super::*;
    use arka_token::{ArkaToken, ArkaTokenClient};
    use soroban_sdk::{
        testutils::{Address as _, Ledger, LedgerInfo},
        Address,
    };

    fn set_ledger(env: &Env, timestamp: u64, sequence: u32) {
        env.ledger().set(LedgerInfo {
            timestamp,
            protocol_version: 23,
            sequence_number: sequence,
            network_id: Default::default(),
            base_reserve: 10,
            min_temp_entry_ttl: 17_280,
            min_persistent_entry_ttl: 172_800,
            max_entry_ttl: 31_536_000,
        });
    }

    #[test]
    fn test_linear_vesting_claim_and_revoke() {
        let env = Env::default();
        env.mock_all_auths();
        set_ledger(&env, 1_000, 10);

        let token_id = env.register_contract(None, ArkaToken);
        let token = ArkaTokenClient::new(&env, &token_id);
        let admin = Address::generate(&env);
        token.init(
            &admin,
            &soroban_sdk::String::from_str(&env, "ARKA"),
            &soroban_sdk::String::from_str(&env, "ARKA"),
            &7u32,
            &Some(1_000_000i128),
        );

        let treasury = Address::generate(&env);
        let team = Address::generate(&env);
        token.mint(&treasury, &1_000);

        let vesting_id = env.register_contract(None, ArkaVesting);
        let vesting = ArkaVestingClient::new(&env, &vesting_id);
        vesting.init(&admin, &token_id);
        token.approve(&treasury, &vesting_id, &600);

        let grant_id = vesting.create_grant(
            &admin, &treasury, &team, &1_000, &1_100, &1_400, &600, &true,
        );
        assert_eq!(grant_id, 1);
        assert_eq!(token.balance(&treasury), 400);

        set_ledger(&env, 1_050, 11);
        assert_eq!(vesting.claimable(&grant_id), 0);

        set_ledger(&env, 1_200, 12);
        assert_eq!(vesting.claimable(&grant_id), 300);
        assert_eq!(vesting.claim(&grant_id), 300);
        assert_eq!(token.balance(&team), 300);

        set_ledger(&env, 1_250, 13);
        let receipt = vesting.revoke(&admin, &grant_id, &treasury);
        assert_eq!(receipt.vested_amount, 375);
        assert_eq!(receipt.refunded_amount, 225);
        assert_eq!(token.balance(&treasury), 625);

        assert_eq!(vesting.claimable(&grant_id), 75);
        assert_eq!(vesting.claim(&grant_id), 75);
        assert_eq!(token.balance(&team), 375);
        assert_eq!(vesting.claimable(&grant_id), 0);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #5)")]
    fn test_invalid_schedule_is_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        set_ledger(&env, 1_000, 10);

        let token_id = env.register_contract(None, ArkaToken);
        let token = ArkaTokenClient::new(&env, &token_id);
        let admin = Address::generate(&env);
        token.init(
            &admin,
            &soroban_sdk::String::from_str(&env, "ARKA"),
            &soroban_sdk::String::from_str(&env, "ARKA"),
            &7u32,
            &Some(1_000_000i128),
        );
        let treasury = Address::generate(&env);
        let beneficiary = Address::generate(&env);
        token.mint(&treasury, &100);

        let vesting_id = env.register_contract(None, ArkaVesting);
        let vesting = ArkaVestingClient::new(&env, &vesting_id);
        vesting.init(&admin, &token_id);
        token.approve(&treasury, &vesting_id, &100);
        vesting.create_grant(
            &admin,
            &treasury,
            &beneficiary,
            &1_000,
            &900,
            &1_200,
            &100,
            &true,
        );
    }
}
