use claims_manager::{ClaimsManager, ClaimsManagerClient, IncidentClass, IncidentStatus};
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
fn e2e_freeze_reject_retrigger_and_execute_path() {
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
    let risk = Address::generate(&env);
    let staker = Address::generate(&env);
    let manager = Address::generate(&env);
    let payout = Address::generate(&env);
    let covered_vault = Address::generate(&env);

    env.mock_all_auths();

    claims.init(&admin, &token_id, &None);
    claims.set_governor(&admin, &gov);
    claims.set_risk_operator(&gov, &risk, &true);
    fund.init(&admin, &token_id, &token_id);
    vault.init(&manager, &token_id, &1_000);

    token.mint(&staker, &600);
    token.mint(&manager, &200);
    token.approve(&staker, &fund_id, &600);
    token.approve(&manager, &vault_id, &200);

    fund.stake(&staker, &600);
    vault.deposit(&manager, &200);
    fund.set_claims_manager(&admin, &Some(claims_id.clone()));
    vault.set_claims_manager(&manager, &Some(claims_id.clone()));
    claims.register_covered_vault(&gov, &covered_vault, &vault_id, &fund_id, &payout);

    let rejected_id = claims.trigger_incident(
        &risk,
        &covered_vault,
        &IncidentClass::PolicyBreach,
        &300,
        &300,
        &BytesN::from_array(&env, &[1; 32]),
    );
    assert!(claims.is_vault_frozen(&covered_vault));
    claims.reject_incident(&gov, &rejected_id, &11);
    assert!(!claims.is_vault_frozen(&covered_vault));
    assert_eq!(
        claims.incident(&rejected_id).unwrap().status,
        IncidentStatus::Rejected
    );

    let live_id = claims.trigger_incident(
        &risk,
        &covered_vault,
        &IncidentClass::Unauthorized,
        &500,
        &500,
        &BytesN::from_array(&env, &[2; 32]),
    );
    claims.approve_incident(&gov, &live_id, &500, &Some(payout.clone()), &12);
    let executed = claims.execute_incident(&live_id);
    assert_eq!(executed.status, IncidentStatus::Executed);
    assert_eq!(token.balance(&payout), 500);
    assert!(!claims.is_vault_frozen(&covered_vault));
}
