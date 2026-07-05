use super::*;
use soroban_sdk::{contract, contractimpl, testutils::Address as _, Address, Env};

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

fn setup() -> (
    Env,
    Address,
    CoverageFundClient<'static>,
    MockTokenClient<'static>,
    MockTokenClient<'static>,
    Address,
    Address,
    Address,
) {
    let env = Env::default();
    let reserve_token_id = env.register_contract(None, MockToken);
    let bootstrap_token_id = env.register_contract(None, MockToken);
    let fund_id = env.register_contract(None, CoverageFund);
    let fund = CoverageFundClient::new(&env, &fund_id);
    let reserve_token = MockTokenClient::new(&env, &reserve_token_id);
    let bootstrap_token = MockTokenClient::new(&env, &bootstrap_token_id);
    let admin = Address::generate(&env);
    let staker = Address::generate(&env);
    let treasury = Address::generate(&env);
    env.mock_all_auths();
    fund.init(&admin, &reserve_token_id, &bootstrap_token_id);
    (
        env,
        fund_id,
        fund,
        reserve_token,
        bootstrap_token,
        admin,
        staker,
        treasury,
    )
}

#[test]
fn test_bootstrap_reward_flow_remains_compatible() {
    let (_env, fund_id, fund, reserve_token, bootstrap_token, admin, staker, _treasury) = setup();

    reserve_token.mint(&staker, &500);
    bootstrap_token.mint(&admin, &200);
    reserve_token.approve(&staker, &fund_id, &500);
    bootstrap_token.approve(&admin, &fund_id, &200);

    fund.stake(&staker, &500);
    fund.add_rewards(&admin, &200);

    assert_eq!(fund.pending_reward(&staker), 200);
    let claimed = fund.claim(&staker);
    assert_eq!(claimed, 200);
    assert_eq!(bootstrap_token.balance(&staker), 200);
}

#[test]
fn test_premium_routing_splits_between_reserve_rewards_and_treasury() {
    let (_env, fund_id, fund, reserve_token, _bootstrap_token, admin, staker, treasury) = setup();
    let vault = Address::generate(&fund.env);
    let payer = Address::generate(&fund.env);

    reserve_token.mint(&staker, &1_000);
    reserve_token.mint(&payer, &1_000);
    reserve_token.approve(&staker, &fund_id, &1_000);
    reserve_token.approve(&payer, &fund_id, &1_000);

    fund.stake(&staker, &1_000);
    fund.set_treasury(&admin, &Some(treasury.clone()));
    fund.set_economics_policy(&admin, &6_000, &1_000, &3_000);
    fund.set_covered_vault_policy(&admin, &vault, &1_200, &10_000);

    let receipt = fund.pay_premium(&payer, &vault, &2_000, &2_500);
    assert_eq!(
        receipt,
        PremiumReceipt {
            premium_amount: 60,
            retained_amount: 36,
            reserve_reward_amount: 18,
            treasury_amount: 6,
            reported_covered_nav: 2_000,
            reserve_ratio_before_bps: 5_000,
            reserve_ratio_after_bps: 5_180,
        }
    );

    assert_eq!(fund.pending_reserve_reward(&staker), 18);
    assert_eq!(reserve_token.balance(&treasury), 6);

    let metrics = fund.metrics();
    assert_eq!(metrics.retained_reserve, 36);
    assert_eq!(metrics.total_covered_nav, 2_000);
    assert_eq!(metrics.total_premiums, 60);
    assert_eq!(metrics.total_retained_prem, 36);
    assert_eq!(metrics.premiums_to_treas, 6);
    assert_eq!(metrics.reserve_capital, 1_036);
    assert_eq!(metrics.reserve_outstanding, 18);
}

#[test]
fn test_treasury_split_is_blocked_until_reserve_target_is_met() {
    let (_env, fund_id, fund, reserve_token, _bootstrap_token, admin, staker, treasury) = setup();
    let vault = Address::generate(&fund.env);
    let payer = Address::generate(&fund.env);

    reserve_token.mint(&staker, &1_000);
    reserve_token.mint(&payer, &1_000);
    reserve_token.approve(&staker, &fund_id, &1_000);
    reserve_token.approve(&payer, &fund_id, &1_000);

    fund.stake(&staker, &1_000);
    fund.set_treasury(&admin, &Some(treasury.clone()));
    fund.set_economics_policy(&admin, &6_000, &1_000, &9_000);
    fund.set_covered_vault_policy(&admin, &vault, &1_200, &10_000);

    let receipt = fund.pay_premium(&payer, &vault, &2_000, &2_500);
    assert_eq!(receipt.treasury_amount, 0);
    assert_eq!(receipt.retained_amount, 42);
    assert_eq!(receipt.reserve_reward_amount, 18);
    assert_eq!(reserve_token.balance(&treasury), 0);

    let metrics = fund.metrics();
    assert_eq!(metrics.retained_reserve, 42);
    assert_eq!(metrics.premiums_to_treas, 0);
    assert_eq!(metrics.reserve_ratio_bps, 5_210);
}

#[test]
fn test_premium_distribution_waits_for_first_staker() {
    let (_env, fund_id, fund, reserve_token, _bootstrap_token, admin, staker, _treasury) = setup();
    let vault = Address::generate(&fund.env);
    let payer = Address::generate(&fund.env);

    reserve_token.mint(&payer, &1_000);
    reserve_token.mint(&staker, &1_000);
    reserve_token.approve(&payer, &fund_id, &1_000);
    reserve_token.approve(&staker, &fund_id, &1_000);

    fund.set_economics_policy(&admin, &5_000, &0, &0);
    fund.set_covered_vault_policy(&admin, &vault, &1_000, &10_000);
    let receipt = fund.pay_premium(&payer, &vault, &4_000, &2_500);
    assert_eq!(receipt.premium_amount, 100);
    assert_eq!(fund.metrics().reserve_outstanding, 50);
    assert_eq!(fund.pending_reserve_reward(&staker), 0);

    fund.stake(&staker, &1_000);
    assert_eq!(fund.pending_reserve_reward(&staker), 50);
}

#[test]
fn test_community_claim_consumes_retained_then_staked_principal() {
    let (_env, fund_id, fund, reserve_token, _bootstrap_token, admin, staker_a, _treasury) =
        setup();
    let staker_b = Address::generate(&fund.env);
    let payout = Address::generate(&fund.env);
    let vault = Address::generate(&fund.env);
    let payer = Address::generate(&fund.env);
    let claims_mgr = Address::generate(&fund.env);

    reserve_token.mint(&staker_a, &500);
    reserve_token.mint(&staker_b, &500);
    reserve_token.mint(&payer, &1_000);
    reserve_token.approve(&staker_a, &fund_id, &500);
    reserve_token.approve(&staker_b, &fund_id, &500);
    reserve_token.approve(&payer, &fund_id, &1_000);

    fund.stake(&staker_a, &500);
    fund.stake(&staker_b, &500);
    fund.set_claims_manager(&admin, &Some(claims_mgr.clone()));
    fund.set_economics_policy(&admin, &5_000, &0, &0);
    fund.set_covered_vault_policy(&admin, &vault, &1_000, &10_000);
    fund.pay_premium(&payer, &vault, &4_000, &2_500); // premium 100 => retained 50, reward 50

    let claim = fund.claim_from_community(&claims_mgr, &payout, &250);
    assert_eq!(
        claim,
        CommunityClaimReceipt {
            paid_from_retained: 50,
            paid_from_staked: 200,
            remaining_retained: 0,
            remaining_staked: 800,
        }
    );
    assert_eq!(reserve_token.balance(&payout), 250);
    assert_eq!(fund.total_staked(), 800);
    assert_eq!(fund.stake_of(&staker_a), 400);
    assert_eq!(fund.stake_of(&staker_b), 400);

    let metrics = fund.metrics();
    assert_eq!(metrics.claims_from_retained, 50);
    assert_eq!(metrics.claims_from_staked, 200);
    assert_eq!(metrics.reserve_capital, 800);
}
