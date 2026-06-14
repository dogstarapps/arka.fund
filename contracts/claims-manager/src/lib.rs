#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, vec, Address, BytesN,
    Env, IntoVal, Symbol,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Governor,
    BootstrapAdminExpiresAt,
    ReserveToken,
    Treasury,
    RiskOp(Address),
    VaultCfg(Address),
    NextIncidentId,
    Incident(u64),
    ActiveByVault(Address),
    LastWasmHash,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct CoveredVaultConfig {
    pub manager_vault: Address,
    pub community_fund: Address,
    pub recipient: Address,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum IncidentClass {
    Oracle = 1,
    Integration = 2,
    Unauthorized = 3,
    PolicyBreach = 4,
    Exceptional = 5,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum IncidentStatus {
    Triggered = 1,
    Approved = 2,
    Executed = 3,
    Rejected = 4,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct IncidentRecord {
    pub id: u64,
    pub vault: Address,
    pub kind: IncidentClass,
    pub status: IncidentStatus,
    pub triggered_by: Address,
    pub reported_loss: i128,
    pub covered_nav: i128,
    pub mgr_vault_bal: i128,
    pub fund_reserve_cap: i128,
    pub meta_hash: BytesN<32>,
    pub created_at: u64,
    pub approved_at: u64,
    pub executed_at: u64,
    pub approved_payout: i128,
    pub mgr_payout: i128,
    pub fund_payout: i128,
    pub treasury_payout: i128,
    pub recipient: Address,
    pub reason_code: u32,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct ResolutionPlan {
    pub approved_payout: i128,
    pub mgr_payout: i128,
    pub fund_payout: i128,
    pub treasury_payout: i128,
    pub recipient: Address,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct ManagerClaimReceiptView {
    pub amount_paid: i128,
    pub remaining_balance: i128,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct CommunityClaimReceiptView {
    pub paid_from_retained: i128,
    pub paid_from_staked: i128,
    pub remaining_retained: i128,
    pub remaining_staked: i128,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct FundMetricsView {
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
    InvalidConfig = 4,
    VaultNotRegistered = 5,
    IncidentNotFound = 6,
    IncidentAlreadyOpen = 7,
    InvalidStatus = 8,
    InvalidAmount = 9,
    MissingTreasury = 10,
    InvalidBootstrapAdmin = 11,
}

const MAX_BOOTSTRAP_ADMIN_SECONDS: u64 = 365 * 24 * 60 * 60;

#[contract]
pub struct ClaimsManager;

#[contractimpl]
impl ClaimsManager {
    fn require_policy_auth(env: &Env, caller: &Address) {
        let store = env.storage().persistent();
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

    fn require_trigger_auth(env: &Env, caller: &Address) {
        let store = env.storage().persistent();
        if let Some(governor) = store.get::<DataKey, Address>(&DataKey::Governor) {
            if *caller == governor {
                caller.require_auth();
                return;
            }
        }
        let is_risk_op: bool = store.get(&DataKey::RiskOp(caller.clone())).unwrap_or(false);
        if is_risk_op {
            caller.require_auth();
            return;
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

    fn reserve_token_internal(env: &Env) -> Address {
        match env.storage().persistent().get(&DataKey::ReserveToken) {
            Some(token) => token,
            None => panic_with_error!(env, Error::NotInitialized),
        }
    }

    fn current_time(env: &Env) -> u64 {
        env.ledger().timestamp()
    }

    fn load_cfg(env: &Env, vault: &Address) -> CoveredVaultConfig {
        match env
            .storage()
            .persistent()
            .get::<DataKey, CoveredVaultConfig>(&DataKey::VaultCfg(vault.clone()))
        {
            Some(cfg) => cfg,
            None => panic_with_error!(env, Error::VaultNotRegistered),
        }
    }

    fn load_incident(env: &Env, incident_id: u64) -> IncidentRecord {
        match env
            .storage()
            .persistent()
            .get::<DataKey, IncidentRecord>(&DataKey::Incident(incident_id))
        {
            Some(incident) => incident,
            None => panic_with_error!(env, Error::IncidentNotFound),
        }
    }

    fn save_incident(env: &Env, incident: &IncidentRecord) {
        env.storage()
            .persistent()
            .set(&DataKey::Incident(incident.id), incident);
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

    fn manager_token(env: &Env, contract: &Address) -> Address {
        env.invoke_contract::<Address>(contract, &Symbol::new(env, "token"), vec![env])
    }

    fn manager_claims_manager(env: &Env, contract: &Address) -> Option<Address> {
        env.invoke_contract::<Option<Address>>(
            contract,
            &Symbol::new(env, "claims_manager"),
            vec![env],
        )
    }

    fn manager_claim_capacity(env: &Env, contract: &Address) -> i128 {
        env.invoke_contract::<i128>(contract, &Symbol::new(env, "claim_capacity"), vec![env])
    }

    fn manager_claim_payout(
        env: &Env,
        contract: &Address,
        caller: &Address,
        recipient: &Address,
        amount: i128,
    ) -> ManagerClaimReceiptView {
        env.invoke_contract::<ManagerClaimReceiptView>(
            contract,
            &Symbol::new(env, "claim_payout"),
            vec![
                env,
                caller.clone().into_val(env),
                recipient.clone().into_val(env),
                amount.into_val(env),
            ],
        )
    }

    fn fund_reserve_token(env: &Env, contract: &Address) -> Address {
        env.invoke_contract::<Address>(contract, &Symbol::new(env, "reserve_token"), vec![env])
    }

    fn fund_claims_manager(env: &Env, contract: &Address) -> Option<Address> {
        env.invoke_contract::<Option<Address>>(
            contract,
            &Symbol::new(env, "claims_manager"),
            vec![env],
        )
    }

    fn coverage_metrics(env: &Env, fund: &Address) -> FundMetricsView {
        env.invoke_contract::<FundMetricsView>(fund, &Symbol::new(env, "metrics"), vec![env])
    }

    fn fund_claim_from_community(
        env: &Env,
        contract: &Address,
        caller: &Address,
        recipient: &Address,
        amount: i128,
    ) -> CommunityClaimReceiptView {
        env.invoke_contract::<CommunityClaimReceiptView>(
            contract,
            &Symbol::new(env, "claim_from_community"),
            vec![
                env,
                caller.clone().into_val(env),
                recipient.clone().into_val(env),
                amount.into_val(env),
            ],
        )
    }

    pub fn init(env: Env, admin: Address, reserve_token: Address, treasury: Option<Address>) {
        let store = env.storage().persistent();
        if store.has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::ReserveToken, &reserve_token);
        store.set(&DataKey::Treasury, &treasury);
        store.set(&DataKey::NextIncidentId, &1u64);
    }

    pub fn set_governor(env: Env, caller: Address, governor: Address) {
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
            .publish((Symbol::new(&env, "upgrade"),), new_wasm_hash.clone());
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    pub fn last_wasm_hash(env: Env) -> Option<BytesN<32>> {
        env.storage()
            .persistent()
            .get::<DataKey, BytesN<32>>(&DataKey::LastWasmHash)
    }

    pub fn set_treasury(env: Env, caller: Address, treasury: Option<Address>) {
        Self::require_policy_auth(&env, &caller);
        env.storage()
            .persistent()
            .set(&DataKey::Treasury, &treasury);
    }

    pub fn set_risk_operator(env: Env, caller: Address, operator: Address, enabled: bool) {
        Self::require_policy_auth(&env, &caller);
        env.storage()
            .persistent()
            .set(&DataKey::RiskOp(operator), &enabled);
    }

    pub fn register_covered_vault(
        env: Env,
        caller: Address,
        vault: Address,
        manager_vault: Address,
        community_fund: Address,
        recipient: Address,
    ) {
        Self::require_policy_auth(&env, &caller);
        let reserve_token = Self::reserve_token_internal(&env);
        if Self::manager_token(&env, &manager_vault) != reserve_token
            || Self::fund_reserve_token(&env, &community_fund) != reserve_token
        {
            panic_with_error!(&env, Error::InvalidConfig);
        }

        let self_addr = env.current_contract_address();
        if Self::manager_claims_manager(&env, &manager_vault) != Some(self_addr.clone())
            || Self::fund_claims_manager(&env, &community_fund) != Some(self_addr)
        {
            panic_with_error!(&env, Error::InvalidConfig);
        }

        let cfg = CoveredVaultConfig {
            manager_vault,
            community_fund,
            recipient,
        };
        env.storage()
            .persistent()
            .set(&DataKey::VaultCfg(vault), &cfg);
    }

    pub fn trigger_incident(
        env: Env,
        caller: Address,
        vault: Address,
        kind: IncidentClass,
        reported_loss: i128,
        covered_nav: i128,
        meta_hash: BytesN<32>,
    ) -> u64 {
        if reported_loss <= 0 || covered_nav <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        Self::require_trigger_auth(&env, &caller);

        let store = env.storage().persistent();
        if store.has(&DataKey::ActiveByVault(vault.clone())) {
            panic_with_error!(&env, Error::IncidentAlreadyOpen);
        }
        let cfg = Self::load_cfg(&env, &vault);
        let fund_metrics = Self::coverage_metrics(&env, &cfg.community_fund);
        let next_id: u64 = store.get(&DataKey::NextIncidentId).unwrap_or(1);
        let incident = IncidentRecord {
            id: next_id,
            vault: vault.clone(),
            kind,
            status: IncidentStatus::Triggered,
            triggered_by: caller,
            reported_loss,
            covered_nav,
            mgr_vault_bal: Self::manager_claim_capacity(&env, &cfg.manager_vault),
            fund_reserve_cap: fund_metrics.reserve_capital,
            meta_hash,
            created_at: Self::current_time(&env),
            approved_at: 0,
            executed_at: 0,
            approved_payout: 0,
            mgr_payout: 0,
            fund_payout: 0,
            treasury_payout: 0,
            recipient: cfg.recipient,
            reason_code: 0,
        };
        Self::save_incident(&env, &incident);
        store.set(&DataKey::ActiveByVault(vault), &next_id);
        store.set(&DataKey::NextIncidentId, &(next_id + 1));
        next_id
    }

    pub fn approve_incident(
        env: Env,
        caller: Address,
        incident_id: u64,
        approved_payout: i128,
        recipient: Option<Address>,
        reason_code: u32,
    ) -> ResolutionPlan {
        if approved_payout <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        Self::require_policy_auth(&env, &caller);
        let mut incident = Self::load_incident(&env, incident_id);
        if incident.status != IncidentStatus::Triggered {
            panic_with_error!(&env, Error::InvalidStatus);
        }
        if approved_payout > incident.reported_loss {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        let cfg = Self::load_cfg(&env, &incident.vault);
        let manager_cap = Self::manager_claim_capacity(&env, &cfg.manager_vault);
        let fund_metrics = Self::coverage_metrics(&env, &cfg.community_fund);
        let fund_cap = fund_metrics.reserve_capital;

        let mgr_payout = core::cmp::min(approved_payout, manager_cap);
        let remaining = approved_payout - mgr_payout;
        let fund_payout = core::cmp::min(remaining, fund_cap);
        let treasury_payout = remaining - fund_payout;
        if treasury_payout > 0
            && env
                .storage()
                .persistent()
                .get::<DataKey, Option<Address>>(&DataKey::Treasury)
                .unwrap_or(None)
                .is_none()
        {
            panic_with_error!(&env, Error::MissingTreasury);
        }

        incident.status = IncidentStatus::Approved;
        incident.approved_at = Self::current_time(&env);
        incident.approved_payout = approved_payout;
        incident.mgr_payout = mgr_payout;
        incident.fund_payout = fund_payout;
        incident.treasury_payout = treasury_payout;
        incident.recipient = recipient.unwrap_or(cfg.recipient);
        incident.reason_code = reason_code;
        Self::save_incident(&env, &incident);

        ResolutionPlan {
            approved_payout,
            mgr_payout,
            fund_payout,
            treasury_payout,
            recipient: incident.recipient,
        }
    }

    pub fn reject_incident(env: Env, caller: Address, incident_id: u64, reason_code: u32) {
        Self::require_policy_auth(&env, &caller);
        let mut incident = Self::load_incident(&env, incident_id);
        if incident.status != IncidentStatus::Triggered {
            panic_with_error!(&env, Error::InvalidStatus);
        }
        incident.status = IncidentStatus::Rejected;
        incident.reason_code = reason_code;
        Self::save_incident(&env, &incident);
        env.storage()
            .persistent()
            .remove(&DataKey::ActiveByVault(incident.vault));
    }

    pub fn execute_incident(env: Env, incident_id: u64) -> IncidentRecord {
        let mut incident = Self::load_incident(&env, incident_id);
        if incident.status != IncidentStatus::Approved {
            panic_with_error!(&env, Error::InvalidStatus);
        }
        let cfg = Self::load_cfg(&env, &incident.vault);
        let self_addr = env.current_contract_address();

        if incident.mgr_payout > 0 {
            let _ = Self::manager_claim_payout(
                &env,
                &cfg.manager_vault,
                &self_addr,
                &incident.recipient,
                incident.mgr_payout,
            );
        }

        if incident.fund_payout > 0 {
            let _ = Self::fund_claim_from_community(
                &env,
                &cfg.community_fund,
                &self_addr,
                &incident.recipient,
                incident.fund_payout,
            );
        }

        if incident.treasury_payout > 0 {
            let token = Self::reserve_token_internal(&env);
            let treasury = match env
                .storage()
                .persistent()
                .get::<DataKey, Option<Address>>(&DataKey::Treasury)
                .unwrap_or(None)
            {
                Some(addr) => addr,
                None => panic_with_error!(&env, Error::MissingTreasury),
            };
            Self::transfer_from(
                &env,
                &token,
                &self_addr,
                &treasury,
                &incident.recipient,
                incident.treasury_payout,
            );
        }

        incident.status = IncidentStatus::Executed;
        incident.executed_at = Self::current_time(&env);
        Self::save_incident(&env, &incident);
        env.storage()
            .persistent()
            .remove(&DataKey::ActiveByVault(incident.vault.clone()));
        incident
    }

    pub fn incident(env: Env, incident_id: u64) -> Option<IncidentRecord> {
        env.storage()
            .persistent()
            .get(&DataKey::Incident(incident_id))
    }

    pub fn covered_vault(env: Env, vault: Address) -> Option<CoveredVaultConfig> {
        env.storage().persistent().get(&DataKey::VaultCfg(vault))
    }

    pub fn is_vault_frozen(env: Env, vault: Address) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::ActiveByVault(vault))
    }

    pub fn treasury(env: Env) -> Option<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::Treasury)
            .unwrap_or(None)
    }

    pub fn governor(env: Env) -> Option<Address> {
        env.storage().persistent().get(&DataKey::Governor)
    }

    pub fn next_incident_id(env: Env) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::NextIncidentId)
            .unwrap_or(1)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use coverage_fund::{CoverageFund, CoverageFundClient};
    use coverage_vault::{CoverageVault, CoverageVaultClient};
    use soroban_sdk::{
        contract, contractimpl, symbol_short, testutils::Address as _, Address, BytesN, Env,
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
            assert!(allow >= amount, "insufficient_allowance");
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
            assert!(fb >= amount, "insufficient_balance");
            env.storage().instance().set(&fk, &(fb - amount));
            let tb: i128 = env.storage().instance().get(&tk).unwrap_or(0);
            env.storage().instance().set(&tk, &(tb + amount));
        }
    }

    #[test]
    fn test_trigger_approve_and_execute_incident() {
        let env = Env::default();
        let token_id = env.register_contract(None, MockToken);
        let fund_id = env.register_contract(None, CoverageFund);
        let vault_id = env.register_contract(None, CoverageVault);
        let claims_id = env.register_contract(None, ClaimsManager);

        let token = MockTokenClient::new(&env, &token_id);
        let fund = CoverageFundClient::new(&env, &fund_id);
        let vault = CoverageVaultClient::new(&env, &vault_id);
        let claims = ClaimsManagerClient::new(&env, &claims_id);

        let admin = Address::generate(&env);
        let gov = Address::generate(&env);
        let staker = Address::generate(&env);
        let manager = Address::generate(&env);
        let treasury = Address::generate(&env);
        let payout = Address::generate(&env);
        let covered_vault = Address::generate(&env);

        env.mock_all_auths();

        claims.init(&admin, &token_id, &Some(treasury.clone()));
        claims.set_governor(&admin, &gov);
        fund.init(&admin, &token_id, &token_id);
        vault.init(&manager, &token_id, &3_000);

        token.mint(&staker, &1_000);
        token.mint(&manager, &500);
        token.mint(&treasury, &1_000);
        token.approve(&staker, &fund_id, &1_000);
        token.approve(&manager, &vault_id, &500);
        token.approve(&treasury, &claims_id, &1_000);

        fund.stake(&staker, &1_000);
        vault.deposit(&manager, &500);
        fund.set_claims_manager(&admin, &Some(claims_id.clone()));
        vault.set_claims_manager(&manager, &Some(claims_id.clone()));
        claims.register_covered_vault(&gov, &covered_vault, &vault_id, &fund_id, &payout);

        let incident_id = claims.trigger_incident(
            &gov,
            &covered_vault,
            &IncidentClass::Integration,
            &1_200,
            &1_200,
            &BytesN::from_array(&env, &[7; 32]),
        );
        assert!(claims.is_vault_frozen(&covered_vault));

        let plan = claims.approve_incident(&gov, &incident_id, &1_200, &None, &42);
        assert_eq!(
            plan,
            ResolutionPlan {
                approved_payout: 1_200,
                mgr_payout: 500,
                fund_payout: 700,
                treasury_payout: 0,
                recipient: payout.clone(),
            }
        );

        let executed = claims.execute_incident(&incident_id);
        assert_eq!(executed.status, IncidentStatus::Executed);
        assert_eq!(token.balance(&payout), 1_200);
        assert!(!claims.is_vault_frozen(&covered_vault));
    }
}
