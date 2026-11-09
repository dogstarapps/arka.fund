use super::*;
use soroban_sdk::token::{Client as TokenClient, StellarAssetClient};

#[contract]
struct SpotRouter;
#[contractimpl]
impl SpotRouter {
    pub fn set_rate(env: Env, numerator: i128, denominator: i128, short: bool) {
        env.storage()
            .instance()
            .set(&symbol_short!("num"), &numerator);
        env.storage()
            .instance()
            .set(&symbol_short!("den"), &denominator);
        env.storage()
            .instance()
            .set(&symbol_short!("short"), &short);
    }
    pub fn swap_exact_tokens_for_tokens(
        env: Env,
        amount: i128,
        _minimum: i128,
        path: Vec<Address>,
        to: Address,
        _deadline: u64,
    ) -> Vec<i128> {
        let n: i128 = env.storage().instance().get(&symbol_short!("num")).unwrap();
        let d: i128 = env.storage().instance().get(&symbol_short!("den")).unwrap();
        let output = amount * n / d;
        let short: bool = env
            .storage()
            .instance()
            .get(&symbol_short!("short"))
            .unwrap();
        let me = env.current_contract_address();
        TokenClient::new(&env, &path.get(0).unwrap()).transfer_from(&me, &to, &me, &amount);
        TokenClient::new(&env, &path.get(1).unwrap()).transfer(
            &me,
            &to,
            &(if short { output - 1 } else { output }),
        );
        vec![&env, amount, output] // Deliberately lies when `short`: balance-delta guard must catch it.
    }
}
struct Portfolio<'a> {
    c: ArkaContractClient<'a>,
    denom: Address,
    asset: Address,
    oracle: Address,
    router: Address,
    manager: Address,
    owner: Address,
}
fn portfolio(env: &Env, auto: bool) -> Portfolio<'_> {
    portfolio_with_fees(env, auto, 0, 0, 0)
}
fn portfolio_with_fees(env: &Env, auto: bool, management: i32, performance: i32, deposit: i32) -> Portfolio<'_> {
    env.mock_all_auths_allowing_non_root_auth();
    env.budget().reset_unlimited();
    env.ledger().set_timestamp(1000);
    let manager = Address::generate(env);
    let owner = Address::generate(env);
    let denom = env
        .register_stellar_asset_contract_v2(manager.clone())
        .address();
    let asset = env
        .register_stellar_asset_contract_v2(manager.clone())
        .address();
    let fund = env.register_contract(None, ArkaContract);
    let c = ArkaContractClient::new(env, &fund);
    c.set_manager(&manager, &manager);
    c.init(
        &denom,
        &management,
        &performance,
        &deposit,
        &0,
        &vec![env, denom.clone(), asset.clone()],
        &manager,
    );
    let oracle = env.register_contract(None, DummyOracle);
    let prices = DummyOracleClient::new(env, &oracle);
    prices.set_price(&denom, &10_000_000, &1000);
    prices.set_price(&asset, &20_000_000, &1000);
    c.set_valuation_oracle(&manager, &oracle, &300);
    let router = env.register_contract(None, SpotRouter);
    SpotRouterClient::new(env, &router).set_rate(&2, &1, &false);
    let p = ManagedPortfolioPolicy {
        routes: vec![
            env,
            ManagedSpotRoute {
                asset: asset.clone(),
                router: router.clone(),
            },
        ],
        instant_cash: true,
        auto_payout: auto,
        max_slippage_bps: 100,
        cancel_lock_seconds: 3600,
    };
    c.enable_managed_portfolio(
        &manager,
        &ManagedPolicy {
            epoch_seconds: 60,
            manager_window: 60,
            min_request_shares: 1,
            buffer_bps: 1000,
            blend_market_id: 0,
            blend_adapter: None,
        },
        &p,
    );
    for token in [&denom, &asset] {
        StellarAssetClient::new(env, token).mint(&owner, &10_000);
        StellarAssetClient::new(env, token).mint(&router, &10_000);
        TokenClient::new(env, token).approve(&owner, &fund, &10_000, &1000);
    }
    c.deposit_protected(
        &owner,
        &Asset {
            contract: denom.clone(),
        },
        &400,
        &c.quote_deposit(&Asset { contract: denom.clone() }, &400),
    );
    c.deposit_protected(
        &owner,
        &Asset {
            contract: asset.clone(),
        },
        &100,
        &c.quote_deposit(&Asset { contract: asset.clone() }, &100),
    );
    Portfolio {
        c,
        denom,
        asset,
        oracle,
        router,
        manager,
        owner,
    }
}
fn step(f: &Portfolio, amount: i128, min: i128, sell: bool) -> SwapStep {
    SwapStep {
        adapter: f.router.clone(),
        pool_id: 0,
        asset_in: Asset {
            contract: if sell {
                f.asset.clone()
            } else {
                f.denom.clone()
            },
        },
        amount_in: amount,
        min_out: min,
        asset_out: Asset {
            contract: if sell {
                f.denom.clone()
            } else {
                f.asset.clone()
            },
        },
        router_addr: f.router.clone(),
    }
}
fn now(env: &Env, f: &Portfolio, at: u64) {
    env.ledger().set_timestamp(at);
    DummyOracleClient::new(env, &f.oracle).set_price(&f.denom, &10_000_000, &at);
    DummyOracleClient::new(env, &f.oracle).set_price(&f.asset, &20_000_000, &at);
}
#[test]
fn portfolio_denomination_does_not_restrict_holdings_and_nav_uses_prices() {
    let env = Env::default();
    let f = portfolio(&env, true);
    assert_eq!(f.c.nav(), 600);
    assert_eq!(f.c.total_shares(), 600);
    assert_eq!(f.c.denomination().contract, f.denom);
    assert_eq!(f.c.liquid_balance(&f.asset), 100);
}
#[test]
fn protected_deposit_quote_matches_execution_in_both_assets() {
    let env = Env::default();
    let f = portfolio(&env, true);
    assert_eq!(f.c.deposit_protection_version(), 1);
    for (token, expected) in [(&f.denom, 10), (&f.asset, 20)] {
        let asset = Asset { contract: token.clone() };
        let shares = f.c.total_shares();
        let balance = TokenClient::new(&env, token).balance(&f.owner);
        let allowance = TokenClient::new(&env, token).allowance(&f.owner, &f.c.address);
        let quote = f.c.quote_deposit(&asset, &10);
        assert_eq!(quote, expected);
        assert_eq!(f.c.total_shares(), shares);
        assert_eq!(TokenClient::new(&env, token).balance(&f.owner), balance);
        assert_eq!(TokenClient::new(&env, token).allowance(&f.owner, &f.c.address), allowance);
        assert_eq!(f.c.deposit_protected(&f.owner, &asset, &10, &quote), quote);
    }
}
#[test]
fn protected_deposit_cannot_bypass_minimum_or_use_zero_negative_values() {
    let env = Env::default();
    let f = portfolio(&env, true);
    let asset = Asset { contract: f.denom.clone() };
    assert!(f.c.try_deposit(&f.owner, &asset, &10).is_err());
    for minimum in [0, -1, 11, i128::MAX] {
        assert!(f.c.try_deposit_protected(&f.owner, &asset, &10, &minimum).is_err());
    }
    for amount in [0, -1] {
        assert!(f.c.try_deposit_protected(&f.owner, &asset, &amount, &1).is_err());
    }
    assert_eq!(f.c.nav(), 600);
    assert_eq!(f.c.total_shares(), 600);
    assert_eq!(TokenClient::new(&env, &f.denom).allowance(&f.owner, &f.c.address), 9600);
}
#[test]
fn protected_deposit_adverse_nav_change_reverts_cash_shares_and_allowance() {
    let env = Env::default();
    let f = portfolio(&env, true);
    let asset = Asset { contract: f.denom.clone() };
    let quote = f.c.quote_deposit(&asset, &60);
    assert_eq!(quote, 60);
    DummyOracleClient::new(&env, &f.oracle).set_price(&f.asset, &40_000_000, &1000);
    assert_eq!(f.c.nav(), 800);
    assert_eq!(f.c.quote_deposit(&asset, &60), 45);
    let balance = TokenClient::new(&env, &f.denom).balance(&f.owner);
    let allowance = TokenClient::new(&env, &f.denom).allowance(&f.owner, &f.c.address);
    assert!(f.c.try_deposit_protected(&f.owner, &asset, &60, &quote).is_err());
    assert_eq!(TokenClient::new(&env, &f.denom).balance(&f.owner), balance);
    assert_eq!(TokenClient::new(&env, &f.denom).allowance(&f.owner, &f.c.address), allowance);
    assert_eq!(f.c.liquid_balance(&f.denom), 400);
    assert_eq!(f.c.total_shares(), 600);
    assert_eq!(f.c.deposit_protected(&f.owner, &asset, &60, &45), 45);
}
#[test]
fn protected_deposit_non_denomination_price_drop_is_also_guarded() {
    let env = Env::default();
    let f = portfolio(&env, true);
    let asset = Asset { contract: f.asset.clone() };
    let quote = f.c.quote_deposit(&asset, &100);
    DummyOracleClient::new(&env, &f.oracle).set_price(&f.asset, &10_000_000, &1000);
    assert_eq!(f.c.quote_deposit(&asset, &100), 120);
    assert!(f.c.try_deposit_protected(&f.owner, &asset, &100, &quote).is_err());
    assert_eq!(f.c.liquid_balance(&f.asset), 100);
    assert_eq!(f.c.total_shares(), 600);
}
#[test]
fn protected_deposit_allows_better_execution_and_rejects_zero_share_dust() {
    let env = Env::default();
    let f = portfolio(&env, true);
    let asset = Asset { contract: f.denom.clone() };
    DummyOracleClient::new(&env, &f.oracle).set_price(&f.asset, &10_000_000, &1000);
    assert_eq!(f.c.deposit_protected(&f.owner, &asset, &60, &60), 72);
    DummyOracleClient::new(&env, &f.oracle).set_price(&f.asset, &100_000_000, &1000);
    assert!(f.c.try_quote_deposit(&asset, &1).is_err());
    assert!(f.c.try_deposit_protected(&f.owner, &asset, &1, &1).is_err());
}
#[test]
fn protected_deposit_fee_quote_has_no_side_effects_and_failed_minimum_rolls_back_fees() {
    fn signature(s: FeeState) -> (u64, i128, i128, i128, i128, i128) {
        (s.last_settlement_ts, s.high_water_mark, s.cumulative_management_shares,
         s.cumulative_performance_shares, s.cumulative_manager_shares, s.cumulative_protocol_shares)
    }
    let env = Env::default();
    let f = portfolio_with_fees(&env, true, 200, 2000, 100);
    now(&env, &f, 1000 + YEAR_SECONDS as u64);
    let asset = Asset { contract: f.denom.clone() };
    let manager_before = f.c.shares_of(&f.manager);
    let state_before = f.c.fee_state();
    let total_before = f.c.total_shares();
    let quote = f.c.quote_deposit(&asset, &100);
    assert!(quote > 0);
    assert_eq!(f.c.shares_of(&f.manager), manager_before);
    assert_eq!(f.c.total_shares(), total_before);
    assert_eq!(signature(f.c.fee_state()), signature(state_before.clone()));
    assert!(f.c.try_deposit_protected(&f.owner, &asset, &100, &(quote + 1)).is_err());
    assert_eq!(f.c.shares_of(&f.manager), manager_before);
    assert_eq!(signature(f.c.fee_state()), signature(state_before));
    assert_eq!(f.c.total_shares(), total_before);
    assert_eq!(f.c.deposit_protected(&f.owner, &asset, &100, &quote), quote);
    assert!(f.c.shares_of(&f.manager) > manager_before);
}
#[test]
fn protected_deposit_rejects_stale_oracle_without_spending_allowance() {
    let env = Env::default();
    let f = portfolio(&env, true);
    env.ledger().set_timestamp(1301);
    let asset = Asset { contract: f.denom.clone() };
    assert!(f.c.try_quote_deposit(&asset, &10).is_err());
    assert!(f.c.try_deposit_protected(&f.owner, &asset, &10, &1).is_err());
    assert_eq!(TokenClient::new(&env, &f.denom).allowance(&f.owner, &f.c.address), 9600);
    assert_eq!(f.c.total_shares(), 600);
}
#[test]
fn portfolio_manager_rebalances_and_clears_allowance() {
    let env = Env::default();
    let f = portfolio(&env, true);
    SpotRouterClient::new(&env, &f.router).set_rate(&1, &2, &false);
    assert_eq!(
        f.c.rebalance(&f.manager, &vec![&env, step(&f, 100, 50, false)]),
        50
    );
    assert_eq!(f.c.nav(), 600);
    assert_eq!(f.c.liquid_balance(&f.asset), 150);
    assert_eq!(
        TokenClient::new(&env, &f.denom).allowance(&f.c.address, &f.router),
        0
    );
}
#[test]
fn portfolio_instant_cash_is_atomic_and_does_not_require_manager() {
    let env = Env::default();
    let f = portfolio(&env, true);
    assert_eq!(f.c.redeem_liquid(&f.owner, &100), 100);
    assert_eq!(f.c.shares_of(&f.owner), 500);
    assert_eq!(f.c.nav(), 500);
    assert_eq!(f.c.managed_queue_state().pending_shares, 0);
    assert_eq!(f.c.managed_queue_state().reserved_assets, 0);
}
#[test]
fn portfolio_insufficient_instant_cash_rolls_back_everything() {
    let env = Env::default();
    let f = portfolio(&env, true);
    assert!(f.c.try_redeem_liquid(&f.owner, &500).is_err());
    assert_eq!(f.c.shares_of(&f.owner), 600);
    assert_eq!(f.c.nav(), 600);
    assert_eq!(f.c.managed_queue_state().next_id, 1);
}
#[test]
fn portfolio_instant_cannot_jump_a_queued_investor() {
    let env = Env::default();
    let f = portfolio(&env, true);
    f.c.request_withdrawal(&f.owner, &10);
    assert!(f.c.try_redeem_liquid(&f.owner, &100).is_err());
}
#[test]
fn portfolio_cancellation_has_processing_window_and_finite_escape() {
    let env = Env::default();
    let f = portfolio(&env, true);
    let r = f.c.request_withdrawal(&f.owner, &500);
    now(&env, &f, 1020);
    assert!(f.c.try_cancel_withdrawal(&f.owner, &r.id).is_err());
    now(&env, &f, 4620);
    assert_eq!(f.c.cancel_withdrawal(&f.owner, &r.id).cancelled_shares, 500);
}
#[test]
fn portfolio_public_liquidation_is_bounded_timed_and_pays_only_vault() {
    let env = Env::default();
    let f = portfolio(&env, true);
    let r = f.c.request_withdrawal(&f.owner, &500);
    now(&env, &f, 1020);
    assert!(f
        .c
        .try_liquidate_withdrawal(&f.owner, &step(&f, 72, 144, true))
        .is_err());
    now(&env, &f, 1080);
    assert_eq!(
        f.c.liquidate_withdrawal(&f.owner, &step(&f, 55, 110, true)),
        110
    );
    f.c.settle_withdrawals(&16);
    assert_eq!(f.c.withdrawal_request(&r.id).unwrap().claimable_assets, 500);
    assert_eq!(f.c.pay_withdrawal(&r.id), 500);
    assert_eq!(f.c.nav(), 100);
}
#[test]
fn portfolio_public_liquidation_cannot_oversell_or_choose_other_route() {
    let env = Env::default();
    let f = portfolio(&env, true);
    f.c.request_withdrawal(&f.owner, &500);
    now(&env, &f, 1080);
    assert!(f
        .c
        .try_liquidate_withdrawal(&f.owner, &step(&f, 56, 112, true))
        .is_err());
    let mut s = step(&f, 55, 110, true);
    s.router_addr = Address::generate(&env);
    assert!(f.c.try_liquidate_withdrawal(&f.owner, &s).is_err());
}
#[test]
fn portfolio_rejects_bad_minimum_and_dishonest_router_balance() {
    let env = Env::default();
    let f = portfolio(&env, true);
    assert!(f
        .c
        .try_rebalance(&f.manager, &vec![&env, step(&f, 100, 1, true)])
        .is_err());
    SpotRouterClient::new(&env, &f.router).set_rate(&2, &1, &true);
    assert!(f
        .c
        .try_rebalance(&f.manager, &vec![&env, step(&f, 100, 200, true)])
        .is_err());
    assert_eq!(f.c.nav(), 600);
    assert_eq!(f.c.liquid_balance(&f.asset), 100);
    assert_eq!(
        TokenClient::new(&env, &f.asset).allowance(&f.c.address, &f.router),
        0
    );
}
#[test]
fn portfolio_rejects_stale_prices_and_pending_reinvestment() {
    let env = Env::default();
    let f = portfolio(&env, true);
    env.ledger().set_timestamp(2000);
    assert!(f
        .c
        .try_rebalance(&f.manager, &vec![&env, step(&f, 100, 200, true)])
        .is_err());
    now(&env, &f, 2000);
    f.c.request_withdrawal(&f.owner, &100);
    assert!(f
        .c
        .try_rebalance(&f.manager, &vec![&env, step(&f, 100, 50, false)])
        .is_err());
}
#[test]
fn portfolio_payment_needs_no_price_or_owner_signature_and_cannot_redirect() {
    let env = Env::default();
    let f = portfolio(&env, true);
    let r = f.c.request_withdrawal(&f.owner, &100);
    now(&env, &f, 1020);
    f.c.settle_withdrawals(&16);
    let before = TokenClient::new(&env, &f.denom).balance(&f.owner);
    env.mock_auths(&[]);
    env.ledger().set_timestamp(9999);
    assert_eq!(f.c.pay_withdrawal(&r.id), 100);
    assert!(env.auths().is_empty());
    assert_eq!(
        TokenClient::new(&env, &f.denom).balance(&f.owner),
        before + 100
    );
    assert!(f.c.try_pay_withdrawal(&r.id).is_err());
}
#[test]
fn portfolio_optional_payment_disabled_preserves_owner_claim() {
    let env = Env::default();
    let f = portfolio(&env, false);
    let r = f.c.request_withdrawal(&f.owner, &100);
    now(&env, &f, 1020);
    f.c.settle_withdrawals(&16);
    assert!(f.c.try_pay_withdrawal(&r.id).is_err());
    assert_eq!(f.c.claim_withdrawal(&f.owner, &r.id), 100);
}

#[test]
fn portfolio_quotes_respect_integer_rounding_and_policy_floor() {
    let env = Env::default();
    let f = portfolio(&env, true);
    let buy = f.c.portfolio_trade_quote(&f.asset, &100, &false);
    assert_eq!(buy.min_out, 50);
    let sell = f.c.portfolio_trade_quote(&f.asset, &100, &true);
    assert_eq!(sell.min_out, 198);
    assert!(f
        .c
        .try_portfolio_trade_quote(&Address::generate(&env), &100, &true)
        .is_err());
}

#[test]
fn portfolio_manager_cannot_spend_reserved_cash_or_the_remaining_buffer() {
    let env = Env::default();
    let f = portfolio(&env, true);
    f.c.request_withdrawal(&f.owner, &100);
    now(&env, &f, 1020);
    f.c.settle_withdrawals(&16);
    SpotRouterClient::new(&env, &f.router).set_rate(&1, &2, &false);
    assert!(f
        .c
        .try_rebalance(&f.manager, &vec![&env, step(&f, 350, 175, false)])
        .is_err());
    assert!(f
        .c
        .try_rebalance(&f.manager, &vec![&env, step(&f, 280, 140, false)])
        .is_err());
    assert_eq!(f.c.nav(), 500);
    assert_eq!(f.c.liquid_balance(&f.denom), 300);
    assert_eq!(f.c.managed_queue_state().reserved_assets, 100);
}
