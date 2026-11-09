use super::*;

#[test]
fn test_blend_on_ice_nav_preserves_accrued_position_value_and_fair_shares() {
    for pool_status in [2u32, 3u32] {
        let env = Env::default();
        let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
        let user = Address::generate(&env);
        env.mock_all_auths_allowing_non_root_auth();
        let (_oracle_id, adapter_id, router) = setup_live_blend(&env, &mgr, &denom_id);

        client.deposit(&user, &denom_asset, &1_000);
        configure_blend_credit_market(&client, &mgr, &adapter_id, 0u128);
        client.credit_supply(&mgr, &CreditProtocol::Blend, &0u128, &denom_id, &400);
        router.set_reserve(
            &denom_id,
            &0u32,
            &9_000_000u32,
            &1_100_000_000_000i128,
            &1_000_000_000_000i128,
            &10_000_000i128,
        );
        router.set_pool_status(&pool_status);

        let status = client.blend_market_status(&0u128).unwrap();
        assert!(!status.nav_blocked);
        assert!(status.risky_actions_blocked);
        assert_eq!(client.blend_market_value(&0u128).unwrap().net_value, 440);
        assert_eq!(client.nav(), 1_040);
        // Mint against liquid funds plus the interest-bearing Blend position,
        // not the 600 liquid units or a cached pre-interest NAV.
        assert_eq!(client.deposit(&user, &denom_asset, &104), 100);
        assert_eq!(client.nav(), 1_144);
        assert_eq!(client.redeem(&user, &100), 104);
        assert_eq!(client.nav(), 1_040);
        assert_eq!(client.shares_of(&user), 1_000);
    }
}

#[test]
fn test_blend_on_ice_nav_still_subtracts_outstanding_debt() {
    for pool_status in [2u32, 3u32] {
        let env = Env::default();
        let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
        let user = Address::generate(&env);
        env.mock_all_auths_allowing_non_root_auth();
        let (_oracle_id, adapter_id, router) = setup_live_blend(&env, &mgr, &denom_id);
        client.deposit(&user, &denom_asset, &1_000);
        configure_blend_credit_market(&client, &mgr, &adapter_id, 0u128);
        client.credit_supply(&mgr, &CreditProtocol::Blend, &0u128, &denom_id, &400);
        client.credit_borrow(&mgr, &CreditProtocol::Blend, &0u128, &denom_id, &75);
        router.set_pool_status(&pool_status);

        assert_eq!(client.liquid_balance(&denom_id), 675);
        assert_eq!(client.blend_market_value(&0u128).unwrap().net_value, 325);
        assert_eq!(client.nav(), 1_000);
        assert_eq!(client.deposit(&user, &denom_asset, &100), 100);
        assert_eq!(client.redeem(&user, &100), 100);
    }
}

#[test]
fn test_blend_on_ice_cross_asset_nav_requires_every_price_to_be_fresh() {
    let env = Env::default();
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let other_id = env.register_contract(None, DummyToken);
    let other_asset = Asset {
        contract: other_id.clone(),
    };
    let user = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();
    let (oracle_id, adapter_id, router) = setup_live_blend(&env, &mgr, &other_id);
    let oracle = DummyOracleClient::new(&env, &oracle_id);
    // Noah-like units: denomination priced at $0.20, supplied asset at $1.
    oracle.set_price(&denom_id, &2_000_000i128, &1_000u64);
    oracle.set_price(&other_id, &10_000_000i128, &1_000u64);
    client.set_whitelist(&mgr, &vec![&env, denom_id.clone(), other_id.clone()]);
    client.set_valuation_oracle(&mgr, &oracle_id, &300u64);
    client.deposit(&user, &denom_asset, &1_000);
    assert_eq!(client.deposit(&user, &other_asset, &100), 500);
    configure_blend_credit_market(&client, &mgr, &adapter_id, 0u128);
    client.credit_supply(&mgr, &CreditProtocol::Blend, &0u128, &other_id, &100);
    router.set_pool_status(&3u32);
    client.set_blend_risk_policy(
        &mgr,
        &0u128,
        &300u64,
        &DEFAULT_BLEND_MIN_HEALTH_FACTOR,
        &true,
        &true,
    );
    assert_eq!(client.blend_market_value(&0u128).unwrap().net_value, 500);
    assert_eq!(client.nav(), 1_500);
    assert_eq!(client.deposit(&user, &other_asset, &40), 200);
    assert_eq!(client.redeem(&user, &200), 200);
    // Leave no liquid non-denomination asset: the pool valuation itself must
    // detect the stale price, rather than the separate liquid-NAV guard.
    router.set_pool_status(&0u32);
    client.credit_supply(&mgr, &CreditProtocol::Blend, &0u128, &other_id, &40);
    router.set_pool_status(&3u32);
    assert_eq!(client.liquid_balance(&other_id), 0);

    env.ledger().set_timestamp(2_000);
    oracle.set_price(&denom_id, &2_000_000i128, &2_000u64);
    // A fresh denomination price must not hide a stale/missing asset price.
    for asset_timestamp in [1_000u64, 0u64] {
        oracle.set_price(&other_id, &10_000_000i128, &asset_timestamp);
        let status = client.blend_market_status(&0u128).unwrap();
        assert!(status.has_stale_oracle);
        assert!(status.nav_blocked);
        assert_eq!(
            client.try_nav(),
            Err(Ok(soroban_sdk::Error::from_contract_error(
                Error::BlendNavUnavailable as u32
            )))
        );
    }
    // The converse must also fail closed.
    oracle.set_price(&other_id, &10_000_000i128, &2_000u64);
    oracle.set_price(&denom_id, &2_000_000i128, &1_000u64);
    assert!(client.blend_market_status(&0u128).unwrap().has_stale_oracle);

    // Also require freshness across all positions: a fresh denomination
    // reserve must not hide a stale price in a second supplied reserve.
    oracle.set_price(&denom_id, &2_000_000i128, &2_000u64);
    router.set_pool_status(&0u32);
    router.set_reserve(
        &denom_id,
        &1u32,
        &9_000_000u32,
        &1_000_000_000_000i128,
        &1_000_000_000_000i128,
        &10_000_000i128,
    );
    client.credit_supply(&mgr, &CreditProtocol::Blend, &0u128, &denom_id, &100);
    router.set_pool_status(&3u32);
    assert_eq!(client.nav(), 1_500);
    oracle.set_price(&other_id, &10_000_000i128, &1_000u64);
    let status = client.blend_market_status(&0u128).unwrap();
    assert!(status.has_stale_oracle);
    assert!(status.nav_blocked);
    assert_eq!(
        client.blend_market_value(&0u128).unwrap().oracle_timestamp,
        1_000
    );
}

#[test]
fn test_blend_on_ice_legacy_market_can_value_and_redeem_without_v2_source() {
    let env = Env::default();
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();
    let (_oracle_id, adapter_id, router) = setup_live_blend(&env, &mgr, &denom_id);
    client.deposit(&user, &denom_asset, &1_000);
    client.configure_credit_market(
        &mgr,
        &CreditProtocol::Blend,
        &0u128,
        &adapter_id,
        &true,
        &true,
        &true,
        &true,
        &true,
    );
    assert!(client.blend_v2_risk_source(&0u128).is_none());
    client.credit_supply(&mgr, &CreditProtocol::Blend, &0u128, &denom_id, &400);
    router.set_pool_status(&3u32);

    let status = client.blend_market_status(&0u128).unwrap();
    assert!(!status.nav_blocked);
    assert!(status.risky_actions_blocked);
    assert_eq!(client.nav(), 1_000);
    assert_eq!(client.deposit(&user, &denom_asset, &100), 100);
    assert_eq!(client.redeem(&user, &100), 100);
}

#[test]
fn test_blend_on_ice_performance_fee_keeps_high_water_mark_accounting() {
    let env = Env::default();
    let (client, denom_id, mgr, denom_asset) = setup_arka_with_fees(&env, 0, 2_000, 0, 0);
    let user = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();
    let (_oracle_id, adapter_id, router) = setup_live_blend(&env, &mgr, &denom_id);
    client.deposit(&user, &denom_asset, &1_000);
    configure_blend_credit_market(&client, &mgr, &adapter_id, 0u128);
    client.credit_supply(&mgr, &CreditProtocol::Blend, &0u128, &denom_id, &400);
    router.set_reserve(
        &denom_id,
        &0u32,
        &9_000_000u32,
        &1_500_000_000_000i128,
        &1_000_000_000_000i128,
        &10_000_000i128,
    );
    router.set_pool_status(&3u32);

    let settled = client.settle_fees();
    assert_eq!(settled.nav, 1_200);
    assert_eq!(settled.performance_fee_value, 40);
    assert_eq!(settled.performance_fee_shares, 34);
    assert_eq!(client.shares_of(&mgr), 34);
    assert_eq!(client.settle_fees().performance_fee_shares, 0);
    assert_eq!(client.nav(), 1_200);
}

#[test]
fn test_blend_on_ice_fee_settlement_allows_debt_free_withdrawal() {
    for pool_status in [2u32, 3u32] {
        let env = Env::default();
        let (client, denom_id, mgr, denom_asset) = setup_arka_with_fees(&env, 1_000, 0, 0, 0);
        let user = Address::generate(&env);
        env.mock_all_auths_allowing_non_root_auth();
        let (oracle_id, adapter_id, router) = setup_live_blend(&env, &mgr, &denom_id);
        let oracle = DummyOracleClient::new(&env, &oracle_id);
        client.deposit(&user, &denom_asset, &1_000);
        configure_blend_credit_market(&client, &mgr, &adapter_id, 0u128);
        client.credit_supply(&mgr, &CreditProtocol::Blend, &0u128, &denom_id, &400);
        router.set_pool_status(&pool_status);
        let now = 1_000 + (YEAR_SECONDS as u64 / 2);
        env.ledger().set_timestamp(now);
        oracle.set_price(&denom_id, &10_000_000i128, &now);

        client.credit_withdraw(&mgr, &CreditProtocol::Blend, &0u128, &denom_id, &400);
        assert_eq!(client.fee_state().cumulative_management_shares, 52);
        assert_eq!(client.shares_of(&mgr), 52);
        assert_eq!(client.liquid_balance(&denom_id), 1_000);
        assert_eq!(client.nav(), 1_000);
    }
}

#[test]
fn test_blend_on_ice_still_rejects_new_borrow_even_without_fail_close_actions() {
    for pool_status in [2u32, 3u32] {
        let env = Env::default();
        let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
        let user = Address::generate(&env);
        env.mock_all_auths_allowing_non_root_auth();
        let (_oracle_id, adapter_id, router) = setup_live_blend(&env, &mgr, &denom_id);
        client.deposit(&user, &denom_asset, &1_000);
        configure_blend_credit_market(&client, &mgr, &adapter_id, 0u128);
        client.credit_supply(&mgr, &CreditProtocol::Blend, &0u128, &denom_id, &400);
        client.set_blend_risk_policy(
            &mgr,
            &0u128,
            &DEFAULT_BLEND_MAX_ORACLE_AGE,
            &DEFAULT_BLEND_MIN_HEALTH_FACTOR,
            &true,
            &false,
        );
        router.set_pool_status(&pool_status);

        assert!(!client.blend_market_status(&0u128).unwrap().nav_blocked);
        assert_eq!(
            client.try_credit_borrow(&mgr, &CreditProtocol::Blend, &0u128, &denom_id, &1),
            Err(Ok(soroban_sdk::Error::from_contract_error(
                Error::BlendOracleInvalid as u32
            ))),
        );
    }
}

#[test]
fn test_blend_on_ice_invalid_valuation_still_fails_closed() {
    for failure_mode in 0..4 {
        let env = Env::default();
        let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
        let user = Address::generate(&env);
        env.mock_all_auths_allowing_non_root_auth();
        let (oracle_id, adapter_id, router) = setup_live_blend(&env, &mgr, &denom_id);
        let oracle = DummyOracleClient::new(&env, &oracle_id);
        client.deposit(&user, &denom_asset, &1_000);
        configure_blend_credit_market(&client, &mgr, &adapter_id, 0u128);
        client.credit_supply(&mgr, &CreditProtocol::Blend, &0u128, &denom_id, &400);
        router.set_pool_status(&3u32);
        match failure_mode {
            0 => env.ledger().set_timestamp(10_000), // stale oracle
            1 => oracle.set_price(&denom_id, &0i128, &1_000u64),
            2 => oracle.set_price(&denom_id, &10_000_000i128, &1_001u64), // future
            _ => env.as_contract(&router.address, || {
                let key = blend_router_mock::DataKey::Reserve(denom_id.clone());
                let mut reserve: blend_router_mock::Reserve =
                    env.storage().instance().get(&key).unwrap();
                reserve.config.enabled = false;
                env.storage().instance().set(&key, &reserve);
            }),
        }

        let status = client.blend_market_status(&0u128).unwrap();
        assert!(status.nav_blocked);
        assert!(status.risky_actions_blocked);
        let expected = Err(Ok(soroban_sdk::Error::from_contract_error(
            Error::BlendNavUnavailable as u32,
        )));
        assert_eq!(client.try_nav(), expected);
        assert_eq!(client.try_deposit(&user, &denom_asset, &100), expected);
        assert_eq!(client.try_redeem(&user, &100), expected);
    }
}

#[test]
fn test_blend_frozen_setup_and_unknown_statuses_still_block_nav() {
    for pool_status in [4u32, 5u32, 6u32, 99u32] {
        let env = Env::default();
        let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
        let user = Address::generate(&env);
        env.mock_all_auths_allowing_non_root_auth();
        let (_oracle_id, adapter_id, router) = setup_live_blend(&env, &mgr, &denom_id);
        client.deposit(&user, &denom_asset, &1_000);
        configure_blend_credit_market(&client, &mgr, &adapter_id, 0u128);
        client.credit_supply(&mgr, &CreditProtocol::Blend, &0u128, &denom_id, &400);
        router.set_pool_status(&pool_status);

        assert!(client.blend_market_status(&0u128).unwrap().nav_blocked);
        assert_eq!(
            client.try_nav(),
            Err(Ok(soroban_sdk::Error::from_contract_error(
                Error::BlendNavUnavailable as u32
            )))
        );
    }
}
