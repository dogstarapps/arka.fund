use super::*;
use soroban_sdk::{
    contract, contractimpl, symbol_short, testutils::Address as _, testutils::Ledger, Address, Env,
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
