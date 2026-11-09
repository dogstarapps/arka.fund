use super::*;
use soroban_sdk::testutils::{MockAuth, MockAuthInvoke};

struct Fixture<'a> {
    c: ArkaContractClient<'a>,
    token: Address,
    manager: Address,
    a: Address,
    b: Address,
    pool: BlendRouterMockClient<'a>,
    oracle: Address,
    adapter: Address,
}

fn fixture(env: &Env, buffer: u32, blend: bool) -> Fixture<'_> {
    env.mock_all_auths_allowing_non_root_auth();
    env.budget().reset_unlimited();
    let (c, t, m, asset) = setup_arka(env);
    let a = Address::generate(env);
    let b = Address::generate(env);
    let (oracle, adapter, pool) = setup_live_blend(env, &m, &t);
    DummyOracleClient::new(env, &oracle).set_price(&t, &10_000_000, &1000);
    c.configure_credit_market(
        &m,
        &CreditProtocol::Blend,
        &1,
        &adapter,
        &true,
        &false,
        &false,
        &true,
        &true,
    );
    let p = ManagedPolicy {
        epoch_seconds: 60,
        manager_window: 3600,
        min_request_shares: 1,
        buffer_bps: buffer,
        blend_market_id: 1,
        blend_adapter: if blend { Some(adapter.clone()) } else { None },
    };
    c.enable_managed_withdrawals(&m, &p);
    let token = DummyTokenClient::new(env, &t);
    token.mint(&a, &900);
    token.mint(&b, &100);
    c.deposit(&a, &asset, &900);
    c.deposit(&b, &asset, &100);
    if blend {
        c.credit_supply(&m, &CreditProtocol::Blend, &1, &t, &800);
    }
    Fixture {
        c,
        token: t,
        manager: m,
        a,
        b,
        pool,
        oracle,
        adapter,
    }
}

fn time(env: &Env, f: &Fixture, t: u64) {
    env.ledger().set_timestamp(t);
    DummyOracleClient::new(env, &f.oracle).set_price(&f.token, &10_000_000, &t);
}
fn auth(env: &Env, c: &ArkaContractClient, owner: &Address, name: &str, args: Vec<Val>) {
    env.mock_auths(&[MockAuth {
        address: owner,
        invoke: &MockAuthInvoke {
            contract: &c.address,
            fn_name: name,
            args,
            sub_invokes: &[],
        },
    }]);
}
fn invariant(env: &Env, f: &Fixture) {
    let q = f.c.managed_queue_state();
    let rows = f.c.withdrawal_requests(&1, &32);
    let mut pending = 0;
    let mut reserved = 0;
    for r in rows.iter() {
        assert_eq!(
            r.requested_shares,
            r.pending_shares + r.settled_shares + r.cancelled_shares
        );
        pending += r.pending_shares;
        reserved += r.claimable_assets;
    }
    assert_eq!(q.pending_shares, pending);
    assert_eq!(q.reserved_assets, reserved);
    assert_eq!(f.c.shares_of(&f.c.address), pending);
    assert!(
        DummyTokenClient::new(env, &f.token).balance(&f.c.address)
            >= f.c.liquid_balance(&f.token) + reserved
    );
}

#[test]
fn managed_request_escrows_shares_without_reducing_supply_or_nav() {
    let env = Env::default();
    let f = fixture(&env, 1000, true);
    let r = f.c.request_withdrawal(&f.a, &500);
    assert_eq!(r.eligible_at, 1020);
    assert_eq!(f.c.shares_of(&f.a), 400);
    assert_eq!(f.c.total_shares(), 1000);
    assert_eq!(f.c.nav(), 1000);
    invariant(&env, &f);
}
#[test]
fn managed_cancellation_returns_pending_shares() {
    let env = Env::default();
    let f = fixture(&env, 1000, true);
    let r = f.c.request_withdrawal(&f.a, &500);
    let r = f.c.cancel_withdrawal(&f.a, &r.id);
    assert_eq!(r.cancelled_shares, 500);
    assert_eq!(f.c.shares_of(&f.a), 900);
    invariant(&env, &f);
}
#[test]
fn managed_no_settlement_before_cutoff() {
    let env = Env::default();
    let f = fixture(&env, 0, false);
    f.c.request_withdrawal(&f.a, &100);
    assert_eq!(f.c.settle_withdrawals(&16).reserved_assets, 0);
    assert_eq!(f.c.total_shares(), 1000);
    invariant(&env, &f);
}
#[test]
fn managed_full_cash_request_settle_claim_cycle() {
    let env = Env::default();
    let f = fixture(&env, 0, false);
    let r = f.c.request_withdrawal(&f.a, &900);
    time(&env, &f, 1020);
    assert_eq!(f.c.settle_withdrawals(&16).reserved_assets, 900);
    assert!(env.auths().is_empty());
    assert_eq!(f.c.nav(), 100);
    assert_eq!(f.c.liquid_balance(&f.token), 100);
    assert_eq!(f.c.total_shares(), 100);
    assert_eq!(f.c.claim_withdrawal(&f.a, &r.id), 900);
    assert_eq!(f.c.managed_queue_state().reserved_assets, 0);
    invariant(&env, &f);
}
#[test]
fn managed_buffer_preserves_remaining_risk_and_partial_fifo() {
    let env = Env::default();
    let f = fixture(&env, 1000, true);
    let a = f.c.request_withdrawal(&f.a, &900);
    let b = f.c.request_withdrawal(&f.b, &100);
    time(&env, &f, 1020);
    let batch = f.c.settle_withdrawals(&16);
    assert_eq!(batch.reserved_assets, 111);
    assert_eq!(f.c.withdrawal_request(&a.id).unwrap().pending_shares, 789);
    assert_eq!(f.c.withdrawal_request(&b.id).unwrap().claimable_assets, 0);
    assert!(f.c.liquid_balance(&f.token) * 10 >= f.c.nav());
    invariant(&env, &f);
}
#[test]
fn managed_manager_recovers_then_settles_without_touching_reserved_claims() {
    let env = Env::default();
    let f = fixture(&env, 1000, true);
    let a = f.c.request_withdrawal(&f.a, &900);
    time(&env, &f, 1020);
    f.c.settle_withdrawals(&16);
    let s = f.c.withdrawal_status();
    assert_eq!(s.recovery_needed, 710);
    assert_eq!(f.c.prepare_withdrawal_liquidity(&f.manager, &710), 710);
    f.c.settle_withdrawals(&16);
    assert_eq!(f.c.withdrawal_request(&a.id).unwrap().claimable_assets, 900);
    assert_eq!(f.c.nav(), 100);
    assert_eq!(f.c.liquid_balance(&f.token), 10);
    assert_eq!(f.pool.collateral(&f.c.address, &f.token), 90);
    invariant(&env, &f);
}
#[test]
fn managed_public_recovery_after_window_requires_only_caller() {
    let env = Env::default();
    let f = fixture(&env, 1000, true);
    f.c.request_withdrawal(&f.a, &900);
    time(&env, &f, 4620);
    auth(
        &env,
        &f.c,
        &f.b,
        "prepare_withdrawal_liquidity",
        (f.b.clone(), 710i128).into_val(&env),
    );
    assert_eq!(f.c.prepare_withdrawal_liquidity(&f.b, &710), 710);
    let a = env.auths();
    assert_eq!(a.len(), 1);
    assert_eq!(a[0].0, f.b);
}
#[test]
fn managed_public_recovery_cannot_preempt_manager_window() {
    let env = Env::default();
    let f = fixture(&env, 1000, true);
    f.c.request_withdrawal(&f.a, &900);
    time(&env, &f, 1020);
    assert!(f.c.try_prepare_withdrawal_liquidity(&f.b, &710).is_err());
    assert_eq!(f.pool.collateral(&f.c.address, &f.token), 800);
    invariant(&env, &f);
}
#[test]
fn managed_recovery_cannot_exceed_head_obligation() {
    let env = Env::default();
    let f = fixture(&env, 1000, true);
    f.c.request_withdrawal(&f.a, &100);
    time(&env, &f, 1020);
    assert_eq!(f.c.withdrawal_status().recovery_needed, 0);
    assert!(f
        .c
        .try_prepare_withdrawal_liquidity(&f.manager, &1)
        .is_err());
    invariant(&env, &f);
}
#[test]
fn managed_partial_cancellation_keeps_claimable_assets() {
    let env = Env::default();
    let f = fixture(&env, 1000, true);
    let a = f.c.request_withdrawal(&f.a, &900);
    time(&env, &f, 1020);
    f.c.settle_withdrawals(&16);
    let r = f.c.cancel_withdrawal(&f.a, &a.id);
    assert_eq!(r.cancelled_shares, 789);
    assert_eq!(r.claimable_assets, 111);
    assert_eq!(f.c.claim_withdrawal(&f.a, &a.id), 111);
    assert_eq!(f.c.shares_of(&f.a), 789);
    invariant(&env, &f);
}
#[test]
fn managed_reserves_excluded_from_new_deposit_price() {
    let env = Env::default();
    let f = fixture(&env, 0, false);
    f.c.request_withdrawal(&f.a, &900);
    time(&env, &f, 1020);
    f.c.settle_withdrawals(&16);
    let u = Address::generate(&env);
    DummyTokenClient::new(&env, &f.token).mint(&u, &100);
    assert_eq!(
        f.c.deposit(
            &u,
            &Asset {
                contract: f.token.clone()
            },
            &100
        ),
        100
    );
    assert_eq!(f.c.nav(), 200);
    invariant(&env, &f);
}
#[test]
fn managed_claim_does_not_require_prices_or_pool_availability() {
    let env = Env::default();
    let f = fixture(&env, 1000, true);
    let a = f.c.request_withdrawal(&f.a, &100);
    time(&env, &f, 1020);
    f.c.settle_withdrawals(&16);
    f.pool.set_oracle(&Address::generate(&env));
    auth(
        &env,
        &f.c,
        &f.a,
        "claim_withdrawal",
        (f.a.clone(), a.id).into_val(&env),
    );
    assert_eq!(f.c.claim_withdrawal(&f.a, &a.id), 100);
    let auths = env.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, f.a);
}
#[test]
fn managed_duplicate_claim_and_cancel_are_rejected() {
    let env = Env::default();
    let f = fixture(&env, 0, false);
    let a = f.c.request_withdrawal(&f.a, &100);
    time(&env, &f, 1020);
    f.c.settle_withdrawals(&16);
    f.c.claim_withdrawal(&f.a, &a.id);
    assert!(f.c.try_claim_withdrawal(&f.a, &a.id).is_err());
    assert!(f.c.try_cancel_withdrawal(&f.a, &a.id).is_err());
    invariant(&env, &f);
}
#[test]
fn managed_owner_authorization_is_enforced() {
    let env = Env::default();
    let f = fixture(&env, 0, false);
    env.mock_auths(&[]);
    assert!(f.c.try_request_withdrawal(&f.a, &100).is_err());
    assert_eq!(f.c.shares_of(&f.a), 900);
    auth(
        &env,
        &f.c,
        &f.a,
        "request_withdrawal",
        (f.a.clone(), 100i128).into_val(&env),
    );
    let a = f.c.request_withdrawal(&f.a, &100);
    assert_eq!(env.auths().len(), 1);
    env.mock_all_auths();
    assert!(f.c.try_cancel_withdrawal(&f.b, &a.id).is_err());
    time(&env, &f, 1020);
    f.c.settle_withdrawals(&16);
    assert!(f.c.try_claim_withdrawal(&f.b, &a.id).is_err());
    invariant(&env, &f);
}
#[test]
fn managed_requests_validate_balance_and_pending_uniqueness() {
    let env = Env::default();
    let f = fixture(&env, 0, false);
    for n in [0, -1, 901] {
        assert!(f.c.try_request_withdrawal(&f.a, &n).is_err());
    }
    f.c.request_withdrawal(&f.a, &100);
    assert!(f.c.try_request_withdrawal(&f.a, &100).is_err());
    invariant(&env, &f);
}
#[test]
fn managed_existing_redeem_and_unsafe_management_routes_cannot_bypass_queue() {
    let env = Env::default();
    let f = fixture(&env, 1000, true);
    f.c.request_withdrawal(&f.a, &900);
    assert!(f.c.try_redeem(&f.a, &1).is_err());
    assert!(f.c.try_redeem(&f.b, &100).is_err());
    assert!(f.c.try_rebalance(&f.manager, &Vec::new(&env)).is_err());
    assert!(f
        .c
        .try_blend_borrow(&f.manager, &f.adapter, &1, &f.token, &1)
        .is_err());
    assert!(f
        .c
        .try_credit_supply(&f.manager, &CreditProtocol::Blend, &1, &f.token, &1)
        .is_err());
    invariant(&env, &f);
}
#[test]
fn managed_terms_share_token_and_market_are_frozen() {
    let env = Env::default();
    let f = fixture(&env, 0, false);
    assert!(f.c.try_set_fees(&f.manager, &0, &0, &0, &1).is_err());
    assert!(f.c.try_set_whitelist(&f.manager, &Vec::new(&env)).is_err());
    assert!(f.c.try_set_share_token(&f.manager, &f.token).is_err());
    assert!(f
        .c
        .try_configure_credit_market(
            &f.manager,
            &CreditProtocol::Blend,
            &1,
            &f.adapter,
            &true,
            &true,
            &false,
            &false,
            &true
        )
        .is_err());
}
#[test]
fn managed_buffer_cannot_be_invested_or_reserved_cash_reused() {
    let env = Env::default();
    let f = fixture(&env, 1000, true);
    assert!(f
        .c
        .try_credit_supply(&f.manager, &CreditProtocol::Blend, &1, &f.token, &101)
        .is_err());
    let a = f.c.request_withdrawal(&f.a, &100);
    time(&env, &f, 1020);
    f.c.settle_withdrawals(&16);
    assert!(f
        .c
        .try_credit_supply(&f.manager, &CreditProtocol::Blend, &1, &f.token, &101)
        .is_err());
    assert_eq!(f.c.claim_withdrawal(&f.a, &a.id), 100);
    invariant(&env, &f);
}
#[test]
fn managed_all_holders_exit_and_final_nav_is_zero() {
    let env = Env::default();
    let f = fixture(&env, 1000, true);
    let a = f.c.request_withdrawal(&f.a, &900);
    let b = f.c.request_withdrawal(&f.b, &100);
    time(&env, &f, 1020);
    f.c.prepare_withdrawal_liquidity(&f.manager, &710);
    f.c.settle_withdrawals(&16);
    f.c.prepare_withdrawal_liquidity(&f.manager, &90);
    f.c.settle_withdrawals(&16);
    assert_eq!(f.c.total_shares(), 0);
    assert_eq!(f.c.nav(), 0);
    assert_eq!(f.c.managed_queue_state().reserved_assets, 1000);
    f.c.claim_withdrawal(&f.a, &a.id);
    f.c.claim_withdrawal(&f.b, &b.id);
    assert_eq!(
        DummyTokenClient::new(&env, &f.token).balance(&f.c.address),
        0
    );
    invariant(&env, &f);
}
#[test]
fn managed_donations_are_not_double_counted_as_cash() {
    let env = Env::default();
    let f = fixture(&env, 0, false);
    DummyTokenClient::new(&env, &f.token).mint(&f.c.address, &10000);
    f.c.request_withdrawal(&f.a, &900);
    time(&env, &f, 1020);
    f.c.settle_withdrawals(&16);
    assert_eq!(f.c.nav(), 100);
    assert_eq!(f.c.managed_queue_state().reserved_assets, 900);
    invariant(&env, &f);
}
#[test]
fn managed_short_recovery_rolls_back_pool_and_accounting() {
    let env = Env::default();
    let f = fixture(&env, 1000, true);
    f.c.request_withdrawal(&f.a, &900);
    time(&env, &f, 1020);
    f.pool.set_withdraw_haircut(&f.token, &2);
    assert!(f
        .c
        .try_prepare_withdrawal_liquidity(&f.manager, &710)
        .is_err());
    assert_eq!(f.pool.collateral(&f.c.address, &f.token), 800);
    assert_eq!(f.c.liquid_balance(&f.token), 200);
    invariant(&env, &f);
}
#[test]
fn managed_debt_unknown_collateral_and_wrong_adapter_are_rejected() {
    let env = Env::default();
    let f = fixture(&env, 1000, true);
    let other = env.register_contract(None, DummyToken);
    f.pool.set_reserve(
        &other,
        &1,
        &9_000_000,
        &1_000_000_000_000,
        &1_000_000_000_000,
        &10_000_000,
    );
    f.pool.set_debt(&f.c.address, &other, &1);
    f.c.request_withdrawal(&f.a, &100);
    time(&env, &f, 1020);
    assert!(f.c.try_settle_withdrawals(&16).is_err());
    f.pool.set_debt(&f.c.address, &other, &0);
    f.pool.set_collateral(&f.c.address, &other, &1);
    assert!(f.c.try_settle_withdrawals(&16).is_err());
    assert!(f
        .c
        .try_blend_withdraw(&f.manager, &Address::generate(&env), &1, &f.token, &1)
        .is_err());
    invariant(&env, &f);
}
#[test]
fn managed_shared_batch_price_accounts_for_loss_before_payout() {
    let env = Env::default();
    let f = fixture(&env, 0, false);
    let a = f.c.request_withdrawal(&f.a, &50);
    let b = f.c.request_withdrawal(&f.b, &50);
    DummyTokenClient::new(&env, &f.token).burn(&f.c.address, &100);
    env.as_contract(&f.c.address, || {
        ArkaContract::add_liquid_balance(&env, &f.token, -100)
    });
    time(&env, &f, 1020);
    let batch = f.c.settle_withdrawals(&16);
    assert_eq!(batch.nav_before, 900);
    assert_eq!(f.c.withdrawal_request(&a.id).unwrap().claimable_assets, 45);
    assert_eq!(f.c.withdrawal_request(&b.id).unwrap().claimable_assets, 45);
    assert_eq!(f.c.nav(), 810);
    invariant(&env, &f);
}
#[test]
fn managed_views_and_processing_have_hard_batch_limits() {
    let env = Env::default();
    let f = fixture(&env, 0, false);
    assert!(f.c.try_settle_withdrawals(&0).is_err());
    assert!(f.c.try_settle_withdrawals(&17).is_err());
    assert!(f.c.try_withdrawal_requests(&0, &1).is_err());
    assert!(f.c.try_withdrawal_requests(&1, &33).is_err());
}
#[test]
fn managed_enable_rejects_existing_funded_vault() {
    let env = Env::default();
    env.mock_all_auths();
    let (c, t, m, a) = setup_arka(&env);
    c.deposit(&m, &a, &1);
    let p = ManagedPolicy {
        epoch_seconds: 60,
        manager_window: 60,
        min_request_shares: 1,
        buffer_bps: 0,
        blend_market_id: 0,
        blend_adapter: None,
    };
    assert!(c.try_enable_managed_withdrawals(&m, &p).is_err());
    assert!(c.managed_withdrawal_policy().is_none());
    assert_eq!(c.nav(), 1);
    assert_eq!(c.liquid_balance(&t), 1);
}
#[test]
fn managed_illiquidity_leaves_entitlement_pending() {
    let env = Env::default();
    let f = fixture(&env, 1000, true);
    f.c.request_withdrawal(&f.a, &900);
    time(&env, &f, 1020);
    f.c.settle_withdrawals(&16);
    DummyTokenClient::new(&env, &f.token).burn(&f.pool.address, &800);
    let s = f.c.withdrawal_status();
    assert_eq!(s.recovery_available, 0);
    assert_eq!(s.queue.pending_shares, 789);
    assert!(f
        .c
        .try_prepare_withdrawal_liquidity(&f.manager, &1)
        .is_err());
    invariant(&env, &f);
}

#[test]
fn managed_upgrade_cannot_discard_pending_or_reserved_claims() {
    let env = Env::default();
    let f = fixture(&env, 0, false);
    f.c.set_governor(&f.manager, &f.manager);
    let r = f.c.request_withdrawal(&f.a, &100);
    let hash = BytesN::from_array(&env, &[7; 32]);
    assert_eq!(
        f.c.try_upgrade(&f.manager, &hash),
        Err(Ok(soroban_sdk::Error::from_contract_error(
            Error::ManagedOutstanding as u32
        )))
    );
    time(&env, &f, 1020);
    f.c.settle_withdrawals(&16);
    assert_eq!(
        f.c.try_upgrade(&f.manager, &hash),
        Err(Ok(soroban_sdk::Error::from_contract_error(
            Error::ManagedOutstanding as u32
        )))
    );
    f.c.claim_withdrawal(&f.a, &r.id);
    assert_eq!(f.c.managed_queue_state().reserved_assets, 0);
}

#[test]
fn managed_cancelled_prefix_is_processed_in_bounded_batches() {
    let env = Env::default();
    let f = fixture(&env, 0, false);
    for _ in 0..34 {
        let r = f.c.request_withdrawal(&f.a, &1);
        f.c.cancel_withdrawal(&f.a, &r.id);
    }
    let r = f.c.request_withdrawal(&f.a, &100);
    time(&env, &f, 1020);
    assert_eq!(f.c.settle_withdrawals(&16).visited, 16);
    assert_eq!(f.c.managed_queue_state().head, 17);
    assert_eq!(f.c.withdrawal_status().recovery_needed, 0);
    assert!(f
        .c
        .try_prepare_withdrawal_liquidity(&f.manager, &1)
        .is_err());
    assert_eq!(f.c.settle_withdrawals(&16).visited, 16);
    assert_eq!(f.c.settle_withdrawals(&16).reserved_assets, 100);
    assert_eq!(f.c.withdrawal_request(&r.id).unwrap().pending_shares, 0);
}

#[test]
fn managed_configuration_cannot_introduce_a_new_manager_veto() {
    let env = Env::default();
    let f = fixture(&env, 1000, true);
    assert!(f
        .c
        .try_set_valuation_oracle(&f.manager, &Address::generate(&env), &1)
        .is_err());
    assert!(f
        .c
        .try_set_allowed_venues(&f.manager, &Vec::new(&env), &Vec::new(&env))
        .is_err());
    assert!(f
        .c
        .try_set_venue_registry(&f.manager, &Address::generate(&env))
        .is_err());
    assert!(f.c.try_clear_venue_registry(&f.manager).is_err());
    assert!(f
        .c
        .try_set_blend_risk_policy(&f.manager, &1, &1, &100_000_000, &true, &true)
        .is_err());
    assert!(f
        .c
        .try_set_blend_external_diagnostics(&f.manager, &1, &true)
        .is_err());
    f.c.request_withdrawal(&f.a, &900);
    time(&env, &f, 4620);
    f.c.prepare_withdrawal_liquidity(&f.b, &710);
    f.c.settle_withdrawals(&16);
    invariant(&env, &f);
}

#[test]
fn managed_zero_nav_does_not_allow_a_deposit_to_reprice_existing_shares() {
    let env = Env::default();
    let f = fixture(&env, 0, false);
    DummyTokenClient::new(&env, &f.token).burn(&f.c.address, &1000);
    env.as_contract(&f.c.address, || {
        ArkaContract::add_liquid_balance(&env, &f.token, -1000)
    });
    assert!(f
        .c
        .try_deposit(
            &f.a,
            &Asset {
                contract: f.token.clone()
            },
            &1
        )
        .is_err());
    assert_eq!(f.c.total_shares(), 1000);
    assert_eq!(f.c.nav(), 0);
}

#[test]
fn managed_pending_shares_pay_fees_but_claims_are_fixed_and_not_charged_again() {
    let env = Env::default();
    env.mock_all_auths();
    env.budget().reset_unlimited();
    let (c, t, m, a) = setup_arka_with_fees(&env, 500, 0, 0, 0);
    c.enable_managed_withdrawals(
        &m,
        &ManagedPolicy {
            epoch_seconds: 60,
            manager_window: 60,
            min_request_shares: 1,
            buffer_bps: 0,
            blend_market_id: 0,
            blend_adapter: None,
        },
    );
    let u = Address::generate(&env);
    DummyTokenClient::new(&env, &t).mint(&u, &1_000_000_000);
    c.deposit(&u, &a, &1_000_000_000);
    let r = c.request_withdrawal(&u, &500_000_000);
    env.ledger().set_timestamp(1000 + 31_536_000);
    c.settle_withdrawals(&16);
    let settled = c.withdrawal_request(&r.id).unwrap().claimable_assets;
    assert!(settled < 500_000_000);
    assert!(c.shares_of(&m) > 0);
    let remaining_nav = c.nav();
    assert_eq!(remaining_nav + settled, 1_000_000_000);
    env.ledger().set_timestamp(1000 + 2 * 31_536_000);
    c.settle_fees();
    assert_eq!(
        c.withdrawal_request(&r.id).unwrap().claimable_assets,
        settled
    );
    let fee_ts = c.fee_state().last_settlement_ts;
    assert_eq!(c.claim_withdrawal(&u, &r.id), settled);
    assert_eq!(c.fee_state().last_settlement_ts, fee_ts);
    assert_eq!(c.nav(), remaining_nav);
}

#[test]
fn managed_policy_validation_is_explicit_and_activation_is_one_way() {
    let env = Env::default();
    env.mock_all_auths();
    let (c, _, m, _) = setup_arka(&env);
    let p = ManagedPolicy {
        epoch_seconds: 60,
        manager_window: 60,
        min_request_shares: 1,
        buffer_bps: 1000,
        blend_market_id: 0,
        blend_adapter: None,
    };
    for invalid in [
        ManagedPolicy {
            epoch_seconds: 59,
            ..p.clone()
        },
        ManagedPolicy {
            manager_window: 59,
            ..p.clone()
        },
        ManagedPolicy {
            buffer_bps: 5001,
            ..p.clone()
        },
        ManagedPolicy {
            min_request_shares: 0,
            ..p.clone()
        },
    ] {
        assert!(c.try_enable_managed_withdrawals(&m, &invalid).is_err());
    }
    c.enable_managed_withdrawals(&m, &p);
    assert!(c.try_enable_managed_withdrawals(&m, &p).is_err());
}

#[test]
fn managed_share_token_cannot_be_minted_by_an_external_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let (c, _, m, _) = setup_arka(&env);
    let token = env.register(share_token::ShareToken, (&m, &None::<Address>, &None::<Address>, &0u64));
    c.set_share_token(&m, &token);
    let p = ManagedPolicy {
        epoch_seconds: 60,
        manager_window: 60,
        min_request_shares: 1,
        buffer_bps: 0,
        blend_market_id: 0,
        blend_adapter: None,
    };
    assert!(c.try_enable_managed_withdrawals(&m, &p).is_err());
    assert!(c.managed_withdrawal_policy().is_none());
}
