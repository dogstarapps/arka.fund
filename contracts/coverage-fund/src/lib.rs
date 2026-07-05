#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, vec,
    Address, BytesN, Env, IntoVal, Symbol, TryFromVal, Val,
};

const SCALE: i128 = 1_000_000_000_000;
const MAX_BPS: i32 = 10_000;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Governor,
    BootstrapAdminExpiresAt,
    ClaimsMgr,
    ReserveToken,
    BootToken,
    Treasury,
    StakeEpoch,
    TotalStaked,
    TotalShares,
    UserEpoch(Address),
    StakeShares(Address),
    ReserveDebt(Address),
    PendingReserve(Address),
    AccReservePerShare,
    PendingReserveDist,
    TotalReserveFunded,
    TotalReserveClaimed,
    BootDebt(Address),
    PendingBoot(Address),
    AccBootPerShare,
    PendingBootDist,
    TotalBootFunded,
    TotalBootClaimed,
    RetainedReserve,
    TotalPremiums,
    TotalRetainedPrem,
    TotalPremToTreas,
    TotalCoveredNav,
    ReserveRetainBps,
    TreasuryShareBps,
    ReserveTargetBps,
    CoveredVaultPolicy(Address),
    CoveredVaultNav(Address),
    VaultPremiumPaid(Address),
    ClaimsFromRetained,
    ClaimsFromStaked,
    LastWasmHash,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct CoveredVaultPolicy {
    pub enabled: bool,
    pub annual_premium_bps: i32,
    pub coverage_limit: i128,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct PremiumQuote {
    pub annual_premium_bps: i32,
    pub coverage_period_bps: i32,
    pub covered_nav: i128,
    pub coverage_limit: i128,
    pub premium_amount: i128,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct PremiumReceipt {
    pub premium_amount: i128,
    pub retained_amount: i128,
    pub reserve_reward_amount: i128,
    pub treasury_amount: i128,
    pub reported_covered_nav: i128,
    pub reserve_ratio_before_bps: i128,
    pub reserve_ratio_after_bps: i128,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct PendingRewards {
    pub reserve_reward: i128,
    pub bootstrap_reward: i128,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct RewardClaimReceipt {
    pub reserve_reward: i128,
    pub bootstrap_reward: i128,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct CommunityClaimReceipt {
    pub paid_from_retained: i128,
    pub paid_from_staked: i128,
    pub remaining_retained: i128,
    pub remaining_staked: i128,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct CoverageFundMetrics {
    pub reserve_token: Address,
    pub bootstrap_token: Address,
    pub treasury: Option<Address>,
    pub claims_manager: Option<Address>,
    pub stake_epoch: u32,
    pub total_staked: i128,
    pub total_shares: i128,
    pub retained_reserve: i128,
    pub total_premiums: i128,
    pub total_retained_prem: i128,
    pub premiums_to_treas: i128,
    pub total_covered_nav: i128,
    pub reserve_capital: i128,
    pub reserve_outstanding: i128,
    pub boot_outstanding: i128,
    pub reserve_ratio_bps: i128,
    pub utilization_bps: i128,
    pub solvency_gap: i128,
    pub reserve_retain_bps: i32,
    pub treasury_share_bps: i32,
    pub reserve_target_bps: i32,
    pub claims_from_retained: i128,
    pub claims_from_staked: i128,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    AmountZero = 4,
    InsufficientStake = 5,
    InvalidBps = 6,
    InvalidPolicy = 7,
    VaultNotCovered = 8,
    CoverageLimitExceeded = 9,
    MissingTreasury = 10,
    InsufficientReserve = 11,
    InvalidBootstrapAdmin = 12,
}

const MAX_BOOTSTRAP_ADMIN_SECONDS: u64 = 365 * 24 * 60 * 60;

#[contract]
pub struct CoverageFund;

#[contractimpl]
impl CoverageFund {
    fn require_policy_auth(env: &Env, caller: &Address) {
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

    fn require_claims_auth(env: &Env, caller: &Address) {
        let store = env.storage().instance();
        if let Some(manager) = store.get::<DataKey, Address>(&DataKey::ClaimsMgr) {
            if *caller == manager {
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
        if let Some(admin) = store.get::<DataKey, Address>(&DataKey::Admin) {
            if *caller == admin && !Self::bootstrap_admin_expired(env) {
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

    fn assert_non_zero(env: &Env, amount: i128) {
        if amount <= 0 {
            panic_with_error!(env, Error::AmountZero);
        }
    }

    fn assert_bps(env: &Env, value: i32) {
        if !(0..=MAX_BPS).contains(&value) {
            panic_with_error!(env, Error::InvalidBps);
        }
    }

    fn assert_policy(env: &Env, annual_premium_bps: i32, coverage_limit: i128) {
        Self::assert_bps(env, annual_premium_bps);
        if annual_premium_bps <= 0 || coverage_limit <= 0 {
            panic_with_error!(env, Error::InvalidPolicy);
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

    fn reserve_token_internal(env: &Env) -> Address {
        match env.storage().instance().get(&DataKey::ReserveToken) {
            Some(token) => token,
            None => panic_with_error!(env, Error::NotInitialized),
        }
    }

    fn boot_token_internal(env: &Env) -> Address {
        match env.storage().instance().get(&DataKey::BootToken) {
            Some(token) => token,
            None => panic_with_error!(env, Error::NotInitialized),
        }
    }

    fn stake_epoch_internal(env: &Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::StakeEpoch)
            .unwrap_or(0)
    }

    fn total_staked_internal(env: &Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalStaked)
            .unwrap_or(0)
    }

    fn total_shares_internal(env: &Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalShares)
            .unwrap_or(0)
    }

    fn retained_reserve_internal(env: &Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::RetainedReserve)
            .unwrap_or(0)
    }

    fn reserve_capital_internal(env: &Env) -> i128 {
        Self::total_staked_internal(env) + Self::retained_reserve_internal(env)
    }

    fn reserve_outstanding_internal(env: &Env) -> i128 {
        let store = env.storage().instance();
        let funded: i128 = store.get(&DataKey::TotalReserveFunded).unwrap_or(0);
        let claimed: i128 = store.get(&DataKey::TotalReserveClaimed).unwrap_or(0);
        funded - claimed
    }

    fn boot_outstanding_internal(env: &Env) -> i128 {
        let store = env.storage().instance();
        let funded: i128 = store.get(&DataKey::TotalBootFunded).unwrap_or(0);
        let claimed: i128 = store.get(&DataKey::TotalBootClaimed).unwrap_or(0);
        funded - claimed
    }

    fn reserve_ratio_bps(reserve_capital: i128, covered_nav: i128) -> i128 {
        if covered_nav <= 0 {
            return 0;
        }
        (reserve_capital * MAX_BPS as i128) / covered_nav
    }

    fn utilization_bps(reserve_capital: i128, covered_nav: i128) -> i128 {
        if covered_nav <= 0 {
            return 0;
        }
        (covered_nav * MAX_BPS as i128) / core::cmp::max(reserve_capital, 1)
    }

    fn value_from_shares(shares: i128, total_staked: i128, total_shares: i128) -> i128 {
        if shares <= 0 || total_staked <= 0 || total_shares <= 0 {
            return 0;
        }
        (shares * total_staked) / total_shares
    }

    fn ceil_div(num: i128, den: i128) -> i128 {
        if den <= 0 {
            return 0;
        }
        (num + den - 1) / den
    }

    fn mint_shares_for_deposit(amount: i128, total_staked: i128, total_shares: i128) -> i128 {
        if total_staked <= 0 || total_shares <= 0 {
            return amount;
        }
        core::cmp::max((amount * total_shares) / total_staked, 1)
    }

    fn burn_shares_for_amount(amount: i128, total_staked: i128, total_shares: i128) -> i128 {
        if total_staked <= 0 || total_shares <= 0 {
            return 0;
        }
        Self::ceil_div(amount * total_shares, total_staked)
    }

    fn user_shares_internal(env: &Env, user: &Address) -> i128 {
        let current_epoch = Self::stake_epoch_internal(env);
        let user_epoch: u32 =
            Self::dynamic_get(env, &DataKey::UserEpoch(user.clone())).unwrap_or(current_epoch);
        if user_epoch != current_epoch {
            return 0;
        }
        Self::dynamic_get(env, &DataKey::StakeShares(user.clone())).unwrap_or(0)
    }

    fn set_user_shares(env: &Env, user: &Address, shares: i128) {
        let current_epoch = Self::stake_epoch_internal(env);
        Self::dynamic_set(env, &DataKey::UserEpoch(user.clone()), &current_epoch);
        Self::dynamic_set(env, &DataKey::StakeShares(user.clone()), &shares);
    }

    fn reset_epoch_if_drained(env: &Env) {
        let store = env.storage().instance();
        let total_staked = Self::total_staked_internal(env);
        let total_shares = Self::total_shares_internal(env);
        if total_staked == 0 && total_shares > 0 {
            let current_epoch = Self::stake_epoch_internal(env);
            store.set(&DataKey::StakeEpoch, &(current_epoch + 1));
            store.set(&DataKey::TotalShares, &0i128);
        }
    }

    fn distribute_pending_ledger(env: &Env, pending_key: DataKey, acc_key: DataKey) {
        let total_shares = Self::total_shares_internal(env);
        if total_shares <= 0 {
            return;
        }
        let store = env.storage().instance();
        let pending: i128 = store.get(&pending_key).unwrap_or(0);
        if pending <= 0 {
            return;
        }
        let acc: i128 = store.get(&acc_key).unwrap_or(0);
        let delta = (pending * SCALE) / total_shares;
        store.set(&acc_key, &(acc + delta));
        store.set(&pending_key, &0i128);
    }

    fn sync_reward_indices(env: &Env) {
        Self::distribute_pending_ledger(
            env,
            DataKey::PendingReserveDist,
            DataKey::AccReservePerShare,
        );
        Self::distribute_pending_ledger(env, DataKey::PendingBootDist, DataKey::AccBootPerShare);
    }

    fn settle_ledger(
        env: &Env,
        user: &Address,
        acc_key: DataKey,
        debt_key: DataKey,
        pending_key: DataKey,
    ) {
        let shares = Self::user_shares_internal(env, user);
        let debt: i128 = Self::dynamic_get(env, &debt_key).unwrap_or(0);
        let acc: i128 = env.storage().instance().get(&acc_key).unwrap_or(0);
        let accrued = (shares * acc) / SCALE;
        if accrued > debt {
            let prev: i128 = Self::dynamic_get(env, &pending_key).unwrap_or(0);
            Self::dynamic_set(env, &pending_key, &(prev + (accrued - debt)));
        }
        Self::dynamic_set(env, &debt_key, &accrued);
    }

    fn settle_user(env: &Env, user: &Address) {
        Self::sync_reward_indices(env);
        Self::settle_ledger(
            env,
            user,
            DataKey::AccReservePerShare,
            DataKey::ReserveDebt(user.clone()),
            DataKey::PendingReserve(user.clone()),
        );
        Self::settle_ledger(
            env,
            user,
            DataKey::AccBootPerShare,
            DataKey::BootDebt(user.clone()),
            DataKey::PendingBoot(user.clone()),
        );
    }

    fn pending_from_ledger(
        env: &Env,
        user: &Address,
        acc_key: DataKey,
        debt_key: DataKey,
        pending_key: DataKey,
        pending_dist_key: DataKey,
    ) -> i128 {
        let shares = Self::user_shares_internal(env, user);
        let debt: i128 = Self::dynamic_get(env, &debt_key).unwrap_or(0);
        let pending: i128 = Self::dynamic_get(env, &pending_key).unwrap_or(0);
        let mut acc: i128 = env.storage().instance().get(&acc_key).unwrap_or(0);
        let pending_dist: i128 = env.storage().instance().get(&pending_dist_key).unwrap_or(0);
        let total_shares = Self::total_shares_internal(env);
        if total_shares > 0 && pending_dist > 0 {
            acc += (pending_dist * SCALE) / total_shares;
        }
        let accrued = (shares * acc) / SCALE;
        if accrued > debt {
            pending + (accrued - debt)
        } else {
            pending
        }
    }

    fn allocate_ledger_funding(
        env: &Env,
        amount: i128,
        acc_key: DataKey,
        pending_key: DataKey,
        total_funded_key: DataKey,
    ) {
        let store = env.storage().instance();
        let prev_funded: i128 = store.get(&total_funded_key).unwrap_or(0);
        store.set(&total_funded_key, &(prev_funded + amount));
        let total_shares = Self::total_shares_internal(env);
        if total_shares > 0 {
            let acc: i128 = store.get(&acc_key).unwrap_or(0);
            let delta = (amount * SCALE) / total_shares;
            store.set(&acc_key, &(acc + delta));
            return;
        }
        let prev_pending: i128 = store.get(&pending_key).unwrap_or(0);
        store.set(&pending_key, &(prev_pending + amount));
    }

    fn claim_ledger(
        env: &Env,
        user: &Address,
        token: &Address,
        pending_key: DataKey,
        total_claimed_key: DataKey,
    ) -> i128 {
        Self::settle_user(env, user);
        let pending: i128 = Self::dynamic_get(env, &pending_key).unwrap_or(0);
        if pending > 0 {
            let fund = env.current_contract_address();
            Self::dynamic_set(env, &pending_key, &0i128);
            let store = env.storage().instance();
            let claimed: i128 = store.get(&total_claimed_key).unwrap_or(0);
            store.set(&total_claimed_key, &(claimed + pending));
            Self::transfer(env, token, &fund, user, pending);
        }
        pending
    }

    fn transfer_from(
        env: &Env,
        token: &Address,
        spender: &Address,
        from: &Address,
        to: &Address,
        amount: i128,
    ) {
        let args = vec![
            env,
            spender.clone().into_val(env),
            from.clone().into_val(env),
            to.clone().into_val(env),
            amount.into_val(env),
        ];
        let _ = env.invoke_contract::<()>(token, &Symbol::new(env, "transfer_from"), args);
    }

    fn transfer(env: &Env, token: &Address, from: &Address, to: &Address, amount: i128) {
        let args = vec![
            env,
            from.clone().into_val(env),
            to.clone().into_val(env),
            amount.into_val(env),
        ];
        let _ = env.invoke_contract::<()>(token, &symbol_short!("transfer"), args);
    }

    fn load_vault_policy(env: &Env, vault: &Address) -> CoveredVaultPolicy {
        match Self::dynamic_get::<CoveredVaultPolicy>(
            env,
            &DataKey::CoveredVaultPolicy(vault.clone()),
        ) {
            Some(policy) if policy.enabled => policy,
            _ => panic_with_error!(env, Error::VaultNotCovered),
        }
    }

    fn quote_premium_internal(
        env: &Env,
        vault: &Address,
        covered_nav: i128,
        coverage_period_bps: i32,
    ) -> PremiumQuote {
        Self::assert_non_zero(env, covered_nav);
        Self::assert_bps(env, coverage_period_bps);
        if coverage_period_bps <= 0 {
            panic_with_error!(env, Error::InvalidBps);
        }
        let policy = Self::load_vault_policy(env, vault);
        if covered_nav > policy.coverage_limit {
            panic_with_error!(env, Error::CoverageLimitExceeded);
        }
        let premium_amount =
            (covered_nav * policy.annual_premium_bps as i128 * coverage_period_bps as i128)
                / MAX_BPS as i128
                / MAX_BPS as i128;
        if premium_amount <= 0 {
            panic_with_error!(env, Error::AmountZero);
        }
        PremiumQuote {
            annual_premium_bps: policy.annual_premium_bps,
            coverage_period_bps,
            covered_nav,
            coverage_limit: policy.coverage_limit,
            premium_amount,
        }
    }

    pub fn init(env: Env, admin: Address, reserve_token: Address, bootstrap_token: Address) {
        let store = env.storage().instance();
        if store.has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::ReserveToken, &reserve_token);
        store.set(&DataKey::BootToken, &bootstrap_token);
        store.set(&DataKey::StakeEpoch, &0u32);
        store.set(&DataKey::TotalStaked, &0i128);
        store.set(&DataKey::TotalShares, &0i128);
        store.set(&DataKey::AccReservePerShare, &0i128);
        store.set(&DataKey::AccBootPerShare, &0i128);
        store.set(&DataKey::PendingReserveDist, &0i128);
        store.set(&DataKey::PendingBootDist, &0i128);
        store.set(&DataKey::RetainedReserve, &0i128);
        store.set(&DataKey::TotalPremiums, &0i128);
        store.set(&DataKey::TotalRetainedPrem, &0i128);
        store.set(&DataKey::TotalPremToTreas, &0i128);
        store.set(&DataKey::TotalCoveredNav, &0i128);
        store.set(&DataKey::TotalReserveFunded, &0i128);
        store.set(&DataKey::TotalReserveClaimed, &0i128);
        store.set(&DataKey::TotalBootFunded, &0i128);
        store.set(&DataKey::TotalBootClaimed, &0i128);
        store.set(&DataKey::ClaimsFromRetained, &0i128);
        store.set(&DataKey::ClaimsFromStaked, &0i128);
        store.set(&DataKey::ReserveRetainBps, &MAX_BPS);
        store.set(&DataKey::TreasuryShareBps, &0i32);
        store.set(&DataKey::ReserveTargetBps, &0i32);
    }

    pub fn set_governor(env: Env, caller: Address, governor: Address) {
        Self::require_policy_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Governor, &governor);
    }

    pub fn set_admin(env: Env, caller: Address, admin: Address) {
        Self::require_policy_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn set_bootstrap_admin_expiry(env: Env, caller: Address, expires_at: u64) {
        Self::require_policy_auth(&env, &caller);
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
        Self::require_policy_auth(&env, &caller);
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

    pub fn set_treasury(env: Env, caller: Address, treasury: Option<Address>) {
        Self::require_policy_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Treasury, &treasury);
    }

    pub fn set_economics_policy(
        env: Env,
        caller: Address,
        reserve_retain_bps: i32,
        treasury_share_bps: i32,
        reserve_target_bps: i32,
    ) {
        Self::require_policy_auth(&env, &caller);
        Self::assert_bps(&env, reserve_retain_bps);
        Self::assert_bps(&env, treasury_share_bps);
        Self::assert_bps(&env, reserve_target_bps);
        if reserve_retain_bps + treasury_share_bps > MAX_BPS {
            panic_with_error!(&env, Error::InvalidPolicy);
        }
        let store = env.storage().instance();
        store.set(&DataKey::ReserveRetainBps, &reserve_retain_bps);
        store.set(&DataKey::TreasuryShareBps, &treasury_share_bps);
        store.set(&DataKey::ReserveTargetBps, &reserve_target_bps);
    }

    pub fn set_covered_vault_policy(
        env: Env,
        caller: Address,
        vault: Address,
        annual_premium_bps: i32,
        coverage_limit: i128,
    ) {
        Self::require_policy_auth(&env, &caller);
        Self::assert_policy(&env, annual_premium_bps, coverage_limit);
        let policy = CoveredVaultPolicy {
            enabled: true,
            annual_premium_bps,
            coverage_limit,
        };
        Self::dynamic_set(&env, &DataKey::CoveredVaultPolicy(vault), &policy);
    }

    pub fn remove_covered_vault(env: Env, caller: Address, vault: Address) {
        Self::require_policy_auth(&env, &caller);
        let store = env.storage().instance();
        let previous_nav: i128 =
            Self::dynamic_get(&env, &DataKey::CoveredVaultNav(vault.clone())).unwrap_or(0);
        let total_covered_nav: i128 = store.get(&DataKey::TotalCoveredNav).unwrap_or(0);
        if previous_nav > 0 {
            store.set(
                &DataKey::TotalCoveredNav,
                &(total_covered_nav - previous_nav),
            );
        }
        Self::dynamic_remove(&env, &DataKey::CoveredVaultNav(vault.clone()));
        Self::dynamic_remove(&env, &DataKey::CoveredVaultPolicy(vault.clone()));
        Self::dynamic_remove(&env, &DataKey::VaultPremiumPaid(vault));
    }

    pub fn add_rewards(env: Env, caller: Address, amount: i128) {
        Self::fund_bootstrap_rewards(env, caller, amount);
    }

    pub fn fund_bootstrap_rewards(env: Env, caller: Address, amount: i128) {
        Self::assert_non_zero(&env, amount);
        Self::require_policy_auth(&env, &caller);
        let token = Self::boot_token_internal(&env);
        let fund = env.current_contract_address();
        Self::transfer_from(&env, &token, &fund, &caller, &fund, amount);
        Self::allocate_ledger_funding(
            &env,
            amount,
            DataKey::AccBootPerShare,
            DataKey::PendingBootDist,
            DataKey::TotalBootFunded,
        );
    }

    pub fn quote_premium(
        env: Env,
        vault: Address,
        covered_nav: i128,
        coverage_period_bps: i32,
    ) -> PremiumQuote {
        Self::quote_premium_internal(&env, &vault, covered_nav, coverage_period_bps)
    }

    pub fn pay_premium(
        env: Env,
        payer: Address,
        vault: Address,
        covered_nav: i128,
        coverage_period_bps: i32,
    ) -> PremiumReceipt {
        payer.require_auth();
        let quote = Self::quote_premium_internal(&env, &vault, covered_nav, coverage_period_bps);
        let reserve_token = Self::reserve_token_internal(&env);
        let fund = env.current_contract_address();
        Self::transfer_from(
            &env,
            &reserve_token,
            &fund,
            &payer,
            &fund,
            quote.premium_amount,
        );

        let store = env.storage().instance();
        let previous_nav: i128 =
            Self::dynamic_get(&env, &DataKey::CoveredVaultNav(vault.clone())).unwrap_or(0);
        let total_covered_nav_before: i128 = store.get(&DataKey::TotalCoveredNav).unwrap_or(0);
        let total_covered_nav_after = total_covered_nav_before - previous_nav + covered_nav;
        Self::dynamic_set(&env, &DataKey::CoveredVaultNav(vault.clone()), &covered_nav);
        store.set(&DataKey::TotalCoveredNav, &total_covered_nav_after);

        let reserve_ratio_before_bps = Self::reserve_ratio_bps(
            Self::reserve_capital_internal(&env),
            total_covered_nav_after,
        );

        let reserve_retain_bps: i32 = store.get(&DataKey::ReserveRetainBps).unwrap_or(MAX_BPS);
        let treasury_share_bps: i32 = store.get(&DataKey::TreasuryShareBps).unwrap_or(0);
        let reserve_target_bps: i32 = store.get(&DataKey::ReserveTargetBps).unwrap_or(0);
        let treasury: Option<Address> = store.get(&DataKey::Treasury).unwrap_or(None);

        let mut retained_amount =
            (quote.premium_amount * reserve_retain_bps as i128) / MAX_BPS as i128;
        let treasury_candidate =
            (quote.premium_amount * treasury_share_bps as i128) / MAX_BPS as i128;
        let mut treasury_amount = 0i128;

        if treasury_candidate > 0 {
            if reserve_ratio_before_bps >= reserve_target_bps as i128 {
                let treasury_address = match treasury {
                    Some(addr) => addr,
                    None => panic_with_error!(&env, Error::MissingTreasury),
                };
                Self::transfer(
                    &env,
                    &reserve_token,
                    &fund,
                    &treasury_address,
                    treasury_candidate,
                );
                treasury_amount = treasury_candidate;
                let sent: i128 = store.get(&DataKey::TotalPremToTreas).unwrap_or(0);
                store.set(&DataKey::TotalPremToTreas, &(sent + treasury_amount));
            } else {
                retained_amount += treasury_candidate;
            }
        }

        let reserve_reward_amount = quote.premium_amount - retained_amount - treasury_amount;
        let retained_before: i128 = store.get(&DataKey::RetainedReserve).unwrap_or(0);
        store.set(
            &DataKey::RetainedReserve,
            &(retained_before + retained_amount),
        );

        let total_paid: i128 = store.get(&DataKey::TotalPremiums).unwrap_or(0);
        store.set(
            &DataKey::TotalPremiums,
            &(total_paid + quote.premium_amount),
        );

        let total_retained: i128 = store.get(&DataKey::TotalRetainedPrem).unwrap_or(0);
        store.set(
            &DataKey::TotalRetainedPrem,
            &(total_retained + retained_amount),
        );

        let vault_paid: i128 =
            Self::dynamic_get(&env, &DataKey::VaultPremiumPaid(vault.clone())).unwrap_or(0);
        Self::dynamic_set(
            &env,
            &DataKey::VaultPremiumPaid(vault),
            &(vault_paid + quote.premium_amount),
        );

        if reserve_reward_amount > 0 {
            Self::allocate_ledger_funding(
                &env,
                reserve_reward_amount,
                DataKey::AccReservePerShare,
                DataKey::PendingReserveDist,
                DataKey::TotalReserveFunded,
            );
        }

        let reserve_ratio_after_bps = Self::reserve_ratio_bps(
            Self::reserve_capital_internal(&env),
            total_covered_nav_after,
        );

        PremiumReceipt {
            premium_amount: quote.premium_amount,
            retained_amount,
            reserve_reward_amount,
            treasury_amount,
            reported_covered_nav: covered_nav,
            reserve_ratio_before_bps,
            reserve_ratio_after_bps,
        }
    }

    pub fn stake(env: Env, user: Address, amount: i128) {
        Self::assert_non_zero(&env, amount);
        user.require_auth();

        Self::settle_user(&env, &user);

        let reserve_token = Self::reserve_token_internal(&env);
        let fund = env.current_contract_address();
        Self::transfer_from(&env, &reserve_token, &fund, &user, &fund, amount);

        let store = env.storage().instance();
        let total_staked_before = Self::total_staked_internal(&env);
        let total_shares_before = Self::total_shares_internal(&env);
        let user_shares_before = Self::user_shares_internal(&env, &user);
        let minted_shares =
            Self::mint_shares_for_deposit(amount, total_staked_before, total_shares_before);
        let next_user_shares = user_shares_before + minted_shares;
        Self::set_user_shares(&env, &user, next_user_shares);
        store.set(
            &DataKey::TotalShares,
            &(total_shares_before + minted_shares),
        );
        store.set(&DataKey::TotalStaked, &(total_staked_before + amount));

        if total_shares_before == 0 {
            Self::sync_reward_indices(&env);
            Self::dynamic_set(&env, &DataKey::ReserveDebt(user.clone()), &0i128);
            Self::dynamic_set(&env, &DataKey::BootDebt(user), &0i128);
        } else {
            let reserve_acc: i128 = store.get(&DataKey::AccReservePerShare).unwrap_or(0);
            let boot_acc: i128 = store.get(&DataKey::AccBootPerShare).unwrap_or(0);
            Self::dynamic_set(
                &env,
                &DataKey::ReserveDebt(user.clone()),
                &((next_user_shares * reserve_acc) / SCALE),
            );
            Self::dynamic_set(
                &env,
                &DataKey::BootDebt(user),
                &((next_user_shares * boot_acc) / SCALE),
            );
        }
    }

    pub fn unstake(env: Env, user: Address, amount: i128) {
        Self::assert_non_zero(&env, amount);
        user.require_auth();

        Self::settle_user(&env, &user);

        let store = env.storage().instance();
        let total_staked = Self::total_staked_internal(&env);
        let total_shares = Self::total_shares_internal(&env);
        let user_shares = Self::user_shares_internal(&env, &user);
        let user_value = Self::value_from_shares(user_shares, total_staked, total_shares);
        if amount > user_value {
            panic_with_error!(&env, Error::InsufficientStake);
        }

        let reserve_token = Self::reserve_token_internal(&env);
        let fund = env.current_contract_address();
        let mut burn_shares = Self::burn_shares_for_amount(amount, total_staked, total_shares);
        if amount == user_value {
            burn_shares = user_shares;
        }
        if burn_shares > user_shares {
            panic_with_error!(&env, Error::InsufficientStake);
        }
        let next_user_shares = user_shares - burn_shares;
        let next_total_shares = total_shares - burn_shares;
        let next_total_staked = total_staked - amount;

        Self::set_user_shares(&env, &user, next_user_shares);
        store.set(&DataKey::TotalShares, &next_total_shares);
        store.set(&DataKey::TotalStaked, &next_total_staked);
        Self::transfer(&env, &reserve_token, &fund, &user, amount);

        let reserve_acc: i128 = store.get(&DataKey::AccReservePerShare).unwrap_or(0);
        let boot_acc: i128 = store.get(&DataKey::AccBootPerShare).unwrap_or(0);
        Self::dynamic_set(
            &env,
            &DataKey::ReserveDebt(user.clone()),
            &((next_user_shares * reserve_acc) / SCALE),
        );
        Self::dynamic_set(
            &env,
            &DataKey::BootDebt(user),
            &((next_user_shares * boot_acc) / SCALE),
        );
        Self::reset_epoch_if_drained(&env);
    }

    pub fn claim_bootstrap_reward(env: Env, user: Address) -> i128 {
        user.require_auth();
        let token = Self::boot_token_internal(&env);
        Self::claim_ledger(
            &env,
            &user,
            &token,
            DataKey::PendingBoot(user.clone()),
            DataKey::TotalBootClaimed,
        )
    }

    pub fn claim_reserve_reward(env: Env, user: Address) -> i128 {
        user.require_auth();
        let token = Self::reserve_token_internal(&env);
        Self::claim_ledger(
            &env,
            &user,
            &token,
            DataKey::PendingReserve(user.clone()),
            DataKey::TotalReserveClaimed,
        )
    }

    pub fn claim_all(env: Env, user: Address) -> RewardClaimReceipt {
        user.require_auth();
        let reserve_token = Self::reserve_token_internal(&env);
        let boot_token = Self::boot_token_internal(&env);
        let reserve_reward = Self::claim_ledger(
            &env,
            &user,
            &reserve_token,
            DataKey::PendingReserve(user.clone()),
            DataKey::TotalReserveClaimed,
        );
        let bootstrap_reward = Self::claim_ledger(
            &env,
            &user,
            &boot_token,
            DataKey::PendingBoot(user.clone()),
            DataKey::TotalBootClaimed,
        );
        RewardClaimReceipt {
            reserve_reward,
            bootstrap_reward,
        }
    }

    pub fn claim(env: Env, user: Address) -> i128 {
        Self::claim_bootstrap_reward(env, user)
    }

    pub fn pending_bootstrap_reward(env: Env, user: Address) -> i128 {
        Self::pending_from_ledger(
            &env,
            &user,
            DataKey::AccBootPerShare,
            DataKey::BootDebt(user.clone()),
            DataKey::PendingBoot(user.clone()),
            DataKey::PendingBootDist,
        )
    }

    pub fn pending_reserve_reward(env: Env, user: Address) -> i128 {
        Self::pending_from_ledger(
            &env,
            &user,
            DataKey::AccReservePerShare,
            DataKey::ReserveDebt(user.clone()),
            DataKey::PendingReserve(user.clone()),
            DataKey::PendingReserveDist,
        )
    }

    pub fn pending_rewards(env: Env, user: Address) -> PendingRewards {
        PendingRewards {
            reserve_reward: Self::pending_reserve_reward(env.clone(), user.clone()),
            bootstrap_reward: Self::pending_bootstrap_reward(env, user),
        }
    }

    pub fn pending_reward(env: Env, user: Address) -> i128 {
        Self::pending_bootstrap_reward(env, user)
    }

    pub fn claim_capacity(env: Env) -> i128 {
        Self::reserve_capital_internal(&env)
    }

    pub fn claim_from_community(
        env: Env,
        caller: Address,
        recipient: Address,
        amount: i128,
    ) -> CommunityClaimReceipt {
        Self::assert_non_zero(&env, amount);
        Self::require_claims_auth(&env, &caller);

        let reserve_capital = Self::reserve_capital_internal(&env);
        if amount > reserve_capital {
            panic_with_error!(&env, Error::InsufficientReserve);
        }

        let store = env.storage().instance();
        let reserve_token = Self::reserve_token_internal(&env);
        let fund = env.current_contract_address();
        let retained_before: i128 = store.get(&DataKey::RetainedReserve).unwrap_or(0);
        let staked_before = Self::total_staked_internal(&env);
        let paid_from_retained = core::cmp::min(amount, retained_before);
        let paid_from_staked = amount - paid_from_retained;
        let remaining_retained = retained_before - paid_from_retained;
        let remaining_staked = staked_before - paid_from_staked;

        store.set(&DataKey::RetainedReserve, &remaining_retained);
        store.set(&DataKey::TotalStaked, &remaining_staked);

        let claims_retained: i128 = store.get(&DataKey::ClaimsFromRetained).unwrap_or(0);
        store.set(
            &DataKey::ClaimsFromRetained,
            &(claims_retained + paid_from_retained),
        );
        let claims_staked: i128 = store.get(&DataKey::ClaimsFromStaked).unwrap_or(0);
        store.set(
            &DataKey::ClaimsFromStaked,
            &(claims_staked + paid_from_staked),
        );

        Self::transfer(&env, &reserve_token, &fund, &recipient, amount);
        Self::reset_epoch_if_drained(&env);

        CommunityClaimReceipt {
            paid_from_retained,
            paid_from_staked,
            remaining_retained,
            remaining_staked,
        }
    }

    pub fn stake_of(env: Env, user: Address) -> i128 {
        let total_staked = Self::total_staked_internal(&env);
        let total_shares = Self::total_shares_internal(&env);
        let user_shares = Self::user_shares_internal(&env, &user);
        Self::value_from_shares(user_shares, total_staked, total_shares)
    }

    pub fn stake_shares_of(env: Env, user: Address) -> i128 {
        Self::user_shares_internal(&env, &user)
    }

    pub fn total_staked(env: Env) -> i128 {
        Self::total_staked_internal(&env)
    }

    pub fn total_stake_shares(env: Env) -> i128 {
        Self::total_shares_internal(&env)
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

    pub fn treasury(env: Env) -> Option<Address> {
        env.storage()
            .instance()
            .get(&DataKey::Treasury)
            .unwrap_or(None)
    }

    pub fn reserve_token(env: Env) -> Address {
        Self::reserve_token_internal(&env)
    }

    pub fn bootstrap_reward_token(env: Env) -> Address {
        Self::boot_token_internal(&env)
    }

    pub fn covered_vault_policy(env: Env, vault: Address) -> Option<CoveredVaultPolicy> {
        Self::dynamic_get(&env, &DataKey::CoveredVaultPolicy(vault))
    }

    pub fn covered_nav(env: Env, vault: Address) -> i128 {
        Self::dynamic_get(&env, &DataKey::CoveredVaultNav(vault)).unwrap_or(0)
    }

    pub fn premiums_paid_by_vault(env: Env, vault: Address) -> i128 {
        Self::dynamic_get(&env, &DataKey::VaultPremiumPaid(vault)).unwrap_or(0)
    }

    pub fn metrics(env: Env) -> CoverageFundMetrics {
        let store = env.storage().instance();
        let total_staked = Self::total_staked_internal(&env);
        let retained_reserve = Self::retained_reserve_internal(&env);
        let total_covered_nav: i128 = store.get(&DataKey::TotalCoveredNav).unwrap_or(0);
        let reserve_capital = total_staked + retained_reserve;
        let reserve_ratio_bps = Self::reserve_ratio_bps(reserve_capital, total_covered_nav);
        let utilization_bps = Self::utilization_bps(reserve_capital, total_covered_nav);
        let solvency_gap = core::cmp::max(total_covered_nav - reserve_capital, 0);
        CoverageFundMetrics {
            reserve_token: Self::reserve_token_internal(&env),
            bootstrap_token: Self::boot_token_internal(&env),
            treasury: store.get(&DataKey::Treasury).unwrap_or(None),
            claims_manager: store.get(&DataKey::ClaimsMgr).unwrap_or(None),
            stake_epoch: Self::stake_epoch_internal(&env),
            total_staked,
            total_shares: Self::total_shares_internal(&env),
            retained_reserve,
            total_premiums: store.get(&DataKey::TotalPremiums).unwrap_or(0),
            total_retained_prem: store.get(&DataKey::TotalRetainedPrem).unwrap_or(0),
            premiums_to_treas: store.get(&DataKey::TotalPremToTreas).unwrap_or(0),
            total_covered_nav,
            reserve_capital,
            reserve_outstanding: Self::reserve_outstanding_internal(&env),
            boot_outstanding: Self::boot_outstanding_internal(&env),
            reserve_ratio_bps,
            utilization_bps,
            solvency_gap,
            reserve_retain_bps: store.get(&DataKey::ReserveRetainBps).unwrap_or(MAX_BPS),
            treasury_share_bps: store.get(&DataKey::TreasuryShareBps).unwrap_or(0),
            reserve_target_bps: store.get(&DataKey::ReserveTargetBps).unwrap_or(0),
            claims_from_retained: store.get(&DataKey::ClaimsFromRetained).unwrap_or(0),
            claims_from_staked: store.get(&DataKey::ClaimsFromStaked).unwrap_or(0),
        }
    }
}

#[cfg(test)]
mod test;
