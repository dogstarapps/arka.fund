use coverage_fund::{CoverageFund, CoverageFundClient, PendingRewards, RewardClaimReceipt};
use soroban_sdk::{contract, contractimpl, symbol_short, testutils::Address as _, Address, Env};

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
fn integration_claims_both_reward_streams_with_live_premium_routing() {
    let env = Env::default();
    let reserve_token_id = env.register_contract(None, MockToken);
    let bootstrap_token_id = env.register_contract(None, MockToken);
    let fund_id = env.register_contract(None, CoverageFund);

    let reserve_token = MockTokenClient::new(&env, &reserve_token_id);
    let bootstrap_token = MockTokenClient::new(&env, &bootstrap_token_id);
    let fund = CoverageFundClient::new(&env, &fund_id);

    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let staker = Address::generate(&env);
    let payer = Address::generate(&env);
    let vault = Address::generate(&env);

    env.mock_all_auths();

    fund.init(&admin, &reserve_token_id, &bootstrap_token_id);
    fund.set_treasury(&admin, &Some(treasury.clone()));
    fund.set_economics_policy(&admin, &7_000, &500, &1_000);
    fund.set_covered_vault_policy(&admin, &vault, &800, &20_000);

    reserve_token.mint(&staker, &2_000);
    reserve_token.mint(&payer, &2_000);
    bootstrap_token.mint(&admin, &120);
    reserve_token.approve(&staker, &fund_id, &2_000);
    reserve_token.approve(&payer, &fund_id, &2_000);
    bootstrap_token.approve(&admin, &fund_id, &120);

    fund.stake(&staker, &2_000);
    let receipt = fund.pay_premium(&payer, &vault, &5_000, &2_500);
    assert_eq!(receipt.premium_amount, 100);
    assert_eq!(receipt.retained_amount, 70);
    assert_eq!(receipt.reserve_reward_amount, 25);
    assert_eq!(receipt.treasury_amount, 5);

    fund.fund_bootstrap_rewards(&admin, &120);

    let pending = fund.pending_rewards(&staker);
    assert_eq!(
        pending,
        PendingRewards {
            reserve_reward: 25,
            bootstrap_reward: 120,
        }
    );

    let claimed = fund.claim_all(&staker);
    assert_eq!(
        claimed,
        RewardClaimReceipt {
            reserve_reward: 25,
            bootstrap_reward: 120,
        }
    );
    assert_eq!(reserve_token.balance(&staker), 25);
    assert_eq!(bootstrap_token.balance(&staker), 120);

    let metrics = fund.metrics();
    assert_eq!(metrics.reserve_capital, 2_070);
    assert_eq!(metrics.total_covered_nav, 5_000);
    assert_eq!(metrics.reserve_outstanding, 0);
    assert_eq!(metrics.boot_outstanding, 0);
    assert_eq!(metrics.premiums_to_treas, 5);
}
