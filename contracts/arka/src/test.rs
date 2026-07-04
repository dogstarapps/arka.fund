use super::*;
use adapter_blend::{BlendAdapter, BlendAdapterClient};
use blend_router_mock::{BlendRouterMock, BlendRouterMockClient};
use oracle_guard::{OracleGuard, OracleGuardClient};
use router::Router;
use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Ledger},
    Address, Env,
};

#[contract]
struct DummyToken;

#[contractimpl]
impl DummyToken {
    pub fn transfer_from(_env: Env, spender: Address, _from: Address, _to: Address, _amount: i128) {
        spender.require_auth();
    }
    pub fn transfer(_env: Env, from: Address, _to: Address, _amount: i128) {
        from.require_auth();
    }
    pub fn mint(env: Env, to: Address, amount: i128) {
        let key = (symbol_short!("bal"), to);
        let prev: i128 = env.storage().instance().get(&key).unwrap_or(0);
        env.storage().instance().set(&key, &(prev + amount));
    }
    pub fn burn(env: Env, from: Address, amount: i128) {
        let key = (symbol_short!("bal"), from);
        let prev: i128 = env.storage().instance().get(&key).unwrap_or(0);
        env.storage().instance().set(&key, &(prev - amount));
    }
    pub fn balance(env: Env, owner: Address) -> i128 {
        let key = (symbol_short!("bal"), owner);
        env.storage().instance().get(&key).unwrap_or(0)
    }
}

#[contract]
struct DummyOracle;

#[contractimpl]
impl DummyOracle {
    pub fn set_price(env: Env, asset: Address, price: i128, timestamp: u64) {
        env.storage()
            .instance()
            .set(&(symbol_short!("price"), asset.clone()), &price);
        env.storage()
            .instance()
            .set(&(symbol_short!("time"), asset), &timestamp);
    }

    pub fn lastprice(env: Env, asset: OracleAsset) -> OraclePriceData {
        let OracleAsset::Stellar(address) = asset else {
            panic!("unsupported_oracle_asset");
        };
        OraclePriceData {
            price: env
                .storage()
                .instance()
                .get(&(symbol_short!("price"), address.clone()))
                .unwrap_or(10_000_000),
            timestamp: env
                .storage()
                .instance()
                .get(&(symbol_short!("time"), address))
                .unwrap_or(0u64),
        }
    }
}

#[contract]
struct DummyVenueRegistry;

#[contractimpl]
impl DummyVenueRegistry {
    pub fn set_allowed(env: Env, venue: Address, allowed: bool) {
        env.storage()
            .instance()
            .set(&(symbol_short!("allow"), venue), &allowed);
    }

    pub fn is_allowed(env: Env, venue: Address) -> bool {
        env.storage()
            .instance()
            .get(&(symbol_short!("allow"), venue))
            .unwrap_or(false)
    }
}

#[contract]
struct DummyBlendAdapter;

#[contractimpl]
impl DummyBlendAdapter {
    pub fn set_market_asset(env: Env, market_id: u128, asset: Address) {
        env.storage()
            .instance()
            .set(&(symbol_short!("mkt"), market_id), &asset);
    }

    pub fn market_asset(env: Env, market_id: u128) -> Option<Address> {
        env.storage()
            .instance()
            .get(&(symbol_short!("mkt"), market_id))
    }

    pub fn router(_env: Env) -> Address {
        Address::generate(&_env)
    }

    pub fn execute(
        _env: Env,
        caller: Address,
        _action: BlendAction,
        _market_id: u128,
        amount: i128,
        _receiver: Address,
    ) -> i128 {
        caller.require_auth();
        amount
    }
}

mod profit_adapter_contract {
    use super::*;

    #[contract]
    pub struct ProfitAdapter;

    #[contractimpl]
    impl ProfitAdapter {
        pub fn execute(
            _env: Env,
            _caller: Address,
            _pool_id: u128,
            amount_in: i128,
            _min_out: i128,
            _receiver: Address,
        ) -> i128 {
            amount_in + 20
        }
    }
}

fn manager(env: &Env) -> Address {
    Address::generate(env)
}

fn setup_live_blend<'a>(
    env: &'a Env,
    mgr: &Address,
    asset: &Address,
) -> (Address, Address, BlendRouterMockClient<'a>) {
    let oracle_id = env.register_contract(None, DummyOracle);
    let oracle = DummyOracleClient::new(env, &oracle_id);
    oracle.set_price(asset, &10_000_000, &123u64);

    let router_id = env.register_contract(None, BlendRouterMock);
    let router = BlendRouterMockClient::new(env, &router_id);
    router.set_oracle(&oracle_id);
    router.set_reserve(
        asset,
        &0u32,
        &9_000_000u32,
        &1_000_000_000_000i128,
        &1_000_000_000_000i128,
        &10_000_000i128,
    );

    let adapter_id = env.register_contract(None, BlendAdapter);
    let adapter = BlendAdapterClient::new(env, &adapter_id);
    adapter.init(mgr, &router_id);
    (oracle_id, adapter_id, router)
}

fn setup_live_blend_with_oracle_guard<'a>(
    env: &'a Env,
    mgr: &Address,
    denom: &Address,
    other: &Address,
    primary_other_price: i128,
    secondary_other_price: i128,
    divergence_mode: u32,
) -> (
    Address,
    Address,
    BlendRouterMockClient<'a>,
    DummyOracleClient<'a>,
    DummyOracleClient<'a>,
) {
    let primary_oracle_id = env.register_contract(None, DummyOracle);
    let primary_oracle = DummyOracleClient::new(env, &primary_oracle_id);
    primary_oracle.set_price(denom, &10_000_000i128, &1_000u64);
    primary_oracle.set_price(other, &primary_other_price, &1_000u64);

    let secondary_oracle_id = env.register_contract(None, DummyOracle);
    let secondary_oracle = DummyOracleClient::new(env, &secondary_oracle_id);
    secondary_oracle.set_price(denom, &10_000_000i128, &1_001u64);
    secondary_oracle.set_price(other, &secondary_other_price, &1_001u64);

    let guard_id = env.register_contract(None, OracleGuard);
    let guard = OracleGuardClient::new(env, &guard_id);
    let guard_admin = Address::generate(env);
    guard.init(&guard_admin);
    guard.set_stellar_asset_policy(
        &guard_admin,
        denom,
        &primary_oracle_id,
        &secondary_oracle_id,
        &true,
        &DEFAULT_BLEND_MAX_ORACLE_AGE,
        &500u32,
        &true,
        &0u32,
    );
    guard.set_stellar_asset_policy(
        &guard_admin,
        other,
        &primary_oracle_id,
        &secondary_oracle_id,
        &true,
        &DEFAULT_BLEND_MAX_ORACLE_AGE,
        &500u32,
        &false,
        &divergence_mode,
    );

    let router_id = env.register_contract(None, BlendRouterMock);
    let router = BlendRouterMockClient::new(env, &router_id);
    router.set_oracle(&guard_id);
    router.set_reserve(
        denom,
        &0u32,
        &9_000_000u32,
        &1_000_000_000_000i128,
        &1_000_000_000_000i128,
        &10_000_000i128,
    );
    router.set_reserve(
        other,
        &1u32,
        &8_000_000u32,
        &1_000_000_000_000i128,
        &1_000_000_000_000i128,
        &10_000_000i128,
    );

    let adapter_id = env.register_contract(None, BlendAdapter);
    let adapter = BlendAdapterClient::new(env, &adapter_id);
    adapter.init(mgr, &router_id);
    (
        guard_id,
        adapter_id,
        router,
        primary_oracle,
        secondary_oracle,
    )
}

fn setup_arka_with_fees(
    env: &Env,
    mgmt_bps: i32,
    perf_bps: i32,
    deposit_bps: i32,
    redeem_bps: i32,
) -> (ArkaContractClient<'_>, Address, Address, Asset) {
    if env.ledger().timestamp() == 0 {
        env.ledger().set_timestamp(1_000);
    }
    let contract_id = env.register_contract(None, ArkaContract);
    let client = ArkaContractClient::new(env, &contract_id);
    let token_id = env.register_contract(None, DummyToken);
    let denom_asset = Asset {
        contract: token_id.clone(),
    };
    let wl = vec![env, token_id.clone()];
    let mgr = manager(env);
    client.init(
        &token_id,
        &mgmt_bps,
        &perf_bps,
        &deposit_bps,
        &redeem_bps,
        &wl,
        &mgr,
    );
    (client, token_id, mgr, denom_asset)
}

fn setup_arka(env: &Env) -> (ArkaContractClient<'_>, Address, Address, Asset) {
    setup_arka_with_fees(env, 0, 0, 0, 0)
}

fn configure_blend_credit_market(
    client: &ArkaContractClient<'_>,
    mgr: &Address,
    adapter: &Address,
    market_id: u128,
) {
    client.configure_credit_market(
        mgr,
        &CreditProtocol::Blend,
        &market_id,
        adapter,
        &true,
        &true,
        &true,
        &true,
        &true,
    );
}

#[test]
fn test_init_and_deposit_redeem() {
    let env = Env::default();
    let (client, token_id, _mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();
    let minted = client.deposit(&user, &denom_asset, &100);
    assert_eq!(minted, 100);
    assert_eq!(client.nav(), 100);
    assert_eq!(client.liquid_balance(&token_id), 100);

    let out = client.redeem(&user, &40);
    assert_eq!(out, 40);
    assert_eq!(client.nav(), 60);
    assert_eq!(client.liquid_balance(&token_id), 60);
}

#[test]
fn test_governor_controls_policy_after_set() {
    let env = Env::default();
    let (client, token_id, mgr, _denom_asset) = setup_arka(&env);
    let gov = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();
    client.set_governor(&mgr, &gov);
    assert_eq!(client.governor(), Some(gov.clone()));

    let new_router = Address::generate(&env);
    client.set_router(&gov, &new_router);
    assert_eq!(client.router(), new_router);

    client.set_fees(&gov, &10, &20, &30, &40);
    let fees = client.fees();
    assert_eq!(fees.mgmt_bps, 10);
    assert_eq!(fees.perf_bps, 20);
    assert_eq!(fees.deposit_bps, 30);
    assert_eq!(fees.redeem_bps, 40);

    let new_mgr = Address::generate(&env);
    client.set_manager(&gov, &new_mgr);
    assert_eq!(client.manager(), new_mgr);
    assert_eq!(client.liquid_balance(&token_id), 0);
}

#[test]
fn test_share_token_mints_and_burns_with_deposit_and_redeem() {
    let env = Env::default();
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let share_token_id = env.register_contract(None, DummyToken);

    env.mock_all_auths_allowing_non_root_auth();
    client.set_share_token(&mgr, &share_token_id);

    let user = Address::generate(&env);
    let minted = client.deposit(&user, &denom_asset, &100);
    assert_eq!(minted, 100);
    assert_eq!(client.shares_of(&user), 100);

    let out = client.redeem(&user, &40);
    assert_eq!(out, 40);
    assert_eq!(client.shares_of(&user), 60);
    assert_eq!(client.liquid_balance(&denom_id), 60);
}

#[test]
fn test_management_fee_settlement_mints_shares_to_manager() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    let (client, _denom_id, mgr, denom_asset) = setup_arka_with_fees(&env, 1_000, 0, 0, 0);
    let user = Address::generate(&env);

    env.mock_all_auths_allowing_non_root_auth();
    client.deposit(&user, &denom_asset, &1_000);
    env.ledger()
        .set_timestamp(1_000 + (YEAR_SECONDS as u64 / 2));

    let preview = client.preview_fee_settlement();
    assert_eq!(preview.management_fee_value, 50);
    assert_eq!(preview.management_fee_shares, 52);
    assert_eq!(preview.manager_fee_shares, 52);
    assert_eq!(preview.protocol_fee_shares, 0);

    let settled = client.settle_fees();
    assert_eq!(settled.management_fee_shares, 52);
    assert_eq!(client.shares_of(&mgr), 52);
    let fee_state = client.fee_state();
    assert_eq!(fee_state.cumulative_management_shares, 52);
    assert_eq!(fee_state.cumulative_manager_shares, 52);
}

#[test]
fn test_protocol_fee_policy_splits_management_fee_to_treasury() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    let (client, _denom_id, mgr, denom_asset) = setup_arka_with_fees(&env, 1_000, 0, 0, 0);
    let user = Address::generate(&env);
    let treasury = Address::generate(&env);

    env.mock_all_auths_allowing_non_root_auth();
    client.set_protocol_fee_policy(&mgr, &treasury, &2_500, &0);
    client.deposit(&user, &denom_asset, &1_000);
    env.ledger()
        .set_timestamp(1_000 + (YEAR_SECONDS as u64 / 2));

    let settled = client.settle_fees();
    assert_eq!(settled.management_fee_shares, 52);
    assert_eq!(settled.protocol_fee_shares, 13);
    assert_eq!(settled.manager_fee_shares, 39);
    assert_eq!(client.shares_of(&treasury), 13);
    assert_eq!(client.shares_of(&mgr), 39);
    let policy = client.protocol_fee_policy();
    assert_eq!(policy.mgmt_protocol_bps, 2_500);
}

#[test]
fn test_performance_fee_uses_high_water_mark_without_double_charging() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    let (client, denom_id, mgr, denom_asset) = setup_arka_with_fees(&env, 0, 2_000, 0, 0);
    let user = Address::generate(&env);
    let router_id = env.register_contract(None, Router);
    let adapter_id = env.register_contract(None, profit_adapter_contract::ProfitAdapter);

    env.mock_all_auths_allowing_non_root_auth();
    client.set_router(&mgr, &router_id);
    client.deposit(&user, &denom_asset, &1_000);

    let steps = vec![
        &env,
        SwapStep {
            adapter: adapter_id,
            pool_id: 7,
            asset_in: Asset {
                contract: denom_id.clone(),
            },
            amount_in: 100,
            min_out: 100,
            asset_out: Asset {
                contract: denom_id.clone(),
            },
            router_addr: router_id.clone(),
        },
    ];

    client.rebalance(&mgr, &steps);
    assert_eq!(client.nav(), 1_020);
    assert_eq!(client.shares_of(&mgr), 3);

    let fee_state_after_profit = client.fee_state();
    assert_eq!(fee_state_after_profit.cumulative_performance_shares, 3);
    let hwm = fee_state_after_profit.high_water_mark;

    let settled_again = client.settle_fees();
    assert_eq!(settled_again.performance_fee_shares, 0);
    assert_eq!(client.shares_of(&mgr), 3);
    assert_eq!(client.fee_state().high_water_mark, hwm);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_rebalance_blocks_non_whitelisted_assets() {
    let env = Env::default();
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    let router_id = env.register_contract(None, Router);
    let adapter_id = env.register_contract(None, profit_adapter_contract::ProfitAdapter);
    let out_asset = Address::generate(&env);

    env.mock_all_auths_allowing_non_root_auth();
    client.set_router(&mgr, &router_id);
    client.deposit(&user, &denom_asset, &1_000);
    client.set_swap_risk_policy(&mgr, &true, &false, &5_000, &5_000, &5_000, &60, &10_000);
    client.set_allowed_venues(&mgr, &vec![&env], &vec![&env, adapter_id.clone()]);

    let steps = vec![
        &env,
        SwapStep {
            adapter: adapter_id,
            pool_id: 1,
            asset_in: Asset {
                contract: denom_id.clone(),
            },
            amount_in: 100,
            min_out: 90,
            asset_out: Asset {
                contract: out_asset,
            },
            router_addr: router_id,
        },
    ];
    client.rebalance(&mgr, &steps);
}

#[test]
#[should_panic(expected = "Error(Contract, #24)")]
fn test_rebalance_blocks_disallowed_internal_adapter() {
    let env = Env::default();
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    let router_id = env.register_contract(None, Router);
    let adapter_id = env.register_contract(None, profit_adapter_contract::ProfitAdapter);

    env.mock_all_auths_allowing_non_root_auth();
    client.set_router(&mgr, &router_id);
    client.deposit(&user, &denom_asset, &1_000);
    client.set_swap_risk_policy(&mgr, &true, &false, &5_000, &5_000, &5_000, &60, &10_000);
    client.set_allowed_venues(&mgr, &vec![&env], &vec![&env, Address::generate(&env)]);

    let steps = vec![
        &env,
        SwapStep {
            adapter: adapter_id,
            pool_id: 7,
            asset_in: Asset {
                contract: denom_id.clone(),
            },
            amount_in: 100,
            min_out: 90,
            asset_out: Asset {
                contract: denom_id.clone(),
            },
            router_addr: router_id,
        },
    ];
    client.rebalance(&mgr, &steps);
}

#[test]
fn test_rebalance_allows_globally_enabled_internal_adapter() {
    let env = Env::default();
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    let router_id = env.register_contract(None, Router);
    let adapter_id = env.register_contract(None, profit_adapter_contract::ProfitAdapter);
    let venue_registry_id = env.register_contract(None, DummyVenueRegistry);
    let venue_registry = DummyVenueRegistryClient::new(&env, &venue_registry_id);

    env.mock_all_auths_allowing_non_root_auth();
    client.set_router(&mgr, &router_id);
    client.set_venue_registry(&mgr, &venue_registry_id);
    venue_registry.set_allowed(&adapter_id, &true);
    client.deposit(&user, &denom_asset, &1_000);

    let steps = vec![
        &env,
        SwapStep {
            adapter: adapter_id,
            pool_id: 7,
            asset_in: Asset {
                contract: denom_id.clone(),
            },
            amount_in: 100,
            min_out: 90,
            asset_out: Asset {
                contract: denom_id.clone(),
            },
            router_addr: router_id,
        },
    ];

    assert_eq!(client.rebalance(&mgr, &steps), 120);
}

#[test]
#[should_panic(expected = "Error(Contract, #24)")]
fn test_rebalance_blocks_globally_disabled_adapter_even_without_local_swap_policy() {
    let env = Env::default();
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    let router_id = env.register_contract(None, Router);
    let adapter_id = env.register_contract(None, profit_adapter_contract::ProfitAdapter);
    let venue_registry_id = env.register_contract(None, DummyVenueRegistry);
    let venue_registry = DummyVenueRegistryClient::new(&env, &venue_registry_id);

    env.mock_all_auths_allowing_non_root_auth();
    client.set_router(&mgr, &router_id);
    client.set_venue_registry(&mgr, &venue_registry_id);
    venue_registry.set_allowed(&adapter_id, &false);
    client.deposit(&user, &denom_asset, &1_000);

    let steps = vec![
        &env,
        SwapStep {
            adapter: adapter_id,
            pool_id: 7,
            asset_in: Asset {
                contract: denom_id.clone(),
            },
            amount_in: 100,
            min_out: 90,
            asset_out: Asset {
                contract: denom_id.clone(),
            },
            router_addr: router_id,
        },
    ];

    client.rebalance(&mgr, &steps);
}

#[test]
#[should_panic(expected = "Error(Contract, #25)")]
fn test_rebalance_blocks_trade_size_over_policy_cap() {
    let env = Env::default();
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    let router_id = env.register_contract(None, Router);
    let adapter_id = env.register_contract(None, profit_adapter_contract::ProfitAdapter);

    env.mock_all_auths_allowing_non_root_auth();
    client.set_router(&mgr, &router_id);
    client.deposit(&user, &denom_asset, &1_000);
    client.set_swap_risk_policy(&mgr, &true, &false, &5_000, &5_000, &5_000, &60, &500);
    client.set_allowed_venues(&mgr, &vec![&env], &vec![&env, adapter_id.clone()]);

    let steps = vec![
        &env,
        SwapStep {
            adapter: adapter_id,
            pool_id: 9,
            asset_in: Asset {
                contract: denom_id.clone(),
            },
            amount_in: 100,
            min_out: 95,
            asset_out: Asset {
                contract: denom_id.clone(),
            },
            router_addr: router_id,
        },
    ];
    client.rebalance(&mgr, &steps);
}

#[test]
#[should_panic(expected = "Error(Contract, #27)")]
fn test_rebalance_blocks_stale_swap_oracle_data() {
    let env = Env::default();
    env.ledger().set_timestamp(2_000);
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    let router_id = env.register_contract(None, Router);
    let adapter_id = env.register_contract(None, profit_adapter_contract::ProfitAdapter);
    let oracle_id = env.register_contract(None, DummyOracle);
    let oracle = DummyOracleClient::new(&env, &oracle_id);

    env.mock_all_auths_allowing_non_root_auth();
    oracle.set_price(&denom_id, &10_000_000i128, &1_000u64);
    client.set_router(&mgr, &router_id);
    client.set_swap_oracle(&mgr, &oracle_id);
    client.deposit(&user, &denom_asset, &1_000);
    client.set_swap_risk_policy(&mgr, &true, &true, &5_000, &5_000, &5_000, &30, &10_000);
    client.set_allowed_venues(&mgr, &vec![&env], &vec![&env, adapter_id.clone()]);

    let steps = vec![
        &env,
        SwapStep {
            adapter: adapter_id,
            pool_id: 3,
            asset_in: Asset {
                contract: denom_id.clone(),
            },
            amount_in: 100,
            min_out: 95,
            asset_out: Asset {
                contract: denom_id.clone(),
            },
            router_addr: router_id,
        },
    ];
    client.rebalance(&mgr, &steps);
}

#[test]
#[should_panic(expected = "Error(Contract, #29)")]
fn test_rebalance_blocks_price_impact_over_policy_cap() {
    let env = Env::default();
    env.ledger().set_timestamp(2_000);
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    let router_id = env.register_contract(None, Router);
    let adapter_id = env.register_contract(None, profit_adapter_contract::ProfitAdapter);
    let oracle_id = env.register_contract(None, DummyOracle);
    let oracle = DummyOracleClient::new(&env, &oracle_id);

    env.mock_all_auths_allowing_non_root_auth();
    oracle.set_price(&denom_id, &10_000_000i128, &1_995u64);
    client.set_router(&mgr, &router_id);
    client.set_swap_oracle(&mgr, &oracle_id);
    client.deposit(&user, &denom_asset, &1_000);
    client.set_swap_risk_policy(&mgr, &true, &true, &500, &10_000, &10_000, &60, &10_000);
    client.set_allowed_venues(&mgr, &vec![&env], &vec![&env, adapter_id.clone()]);

    let steps = vec![
        &env,
        SwapStep {
            adapter: adapter_id,
            pool_id: 4,
            asset_in: Asset {
                contract: denom_id.clone(),
            },
            amount_in: 100,
            min_out: 50,
            asset_out: Asset {
                contract: denom_id.clone(),
            },
            router_addr: router_id,
        },
    ];
    client.rebalance(&mgr, &steps);
}

#[test]
fn test_set_manager_settles_old_manager_before_rotation() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    let (client, _denom_id, mgr, denom_asset) = setup_arka_with_fees(&env, 1_000, 0, 0, 0);
    let user = Address::generate(&env);
    let new_mgr = Address::generate(&env);

    env.mock_all_auths_allowing_non_root_auth();
    client.deposit(&user, &denom_asset, &1_000);
    env.ledger()
        .set_timestamp(1_000 + (YEAR_SECONDS as u64 / 2));
    client.set_manager(&mgr, &new_mgr);

    assert_eq!(client.shares_of(&mgr), 52);
    assert_eq!(client.manager(), new_mgr.clone());

    env.ledger().set_timestamp(1_000 + YEAR_SECONDS as u64);
    client.settle_fees();
    assert!(client.shares_of(&new_mgr) > 0);
}

#[test]
fn test_blend_position_updates_nav_and_liquidity() {
    let env = Env::default();
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();
    let (_oracle_id, adapter_id, _router) = setup_live_blend(&env, &mgr, &denom_id);
    client.deposit(&user, &denom_asset, &1_000);
    configure_blend_credit_market(&client, &mgr, &adapter_id, 0u128);
    assert_eq!(client.nav(), 1_000);
    assert_eq!(client.liquid_balance(&denom_id), 1_000);

    client.blend_lend(&mgr, &adapter_id, &0u128, &denom_id, &400);
    let position = client.blend_position(&0u128, &denom_id).unwrap();
    assert_eq!(position.collateral_amount, 400);
    assert_eq!(position.debt_amount, 0);
    assert_eq!(client.liquid_balance(&denom_id), 600);
    assert_eq!(client.nav(), 1_000);

    client.blend_borrow(&mgr, &adapter_id, &0u128, &denom_id, &150);
    let position = client.blend_position(&0u128, &denom_id).unwrap();
    assert_eq!(position.collateral_amount, 400);
    assert_eq!(position.debt_amount, 150);
    assert_eq!(client.liquid_balance(&denom_id), 750);
    assert_eq!(client.nav(), 1_000);

    client.blend_repay(&mgr, &adapter_id, &0u128, &denom_id, &50);
    let position = client.blend_position(&0u128, &denom_id).unwrap();
    assert_eq!(position.debt_amount, 100);
    assert_eq!(client.liquid_balance(&denom_id), 700);
    assert_eq!(client.nav(), 1_000);

    client.blend_withdraw(&mgr, &adapter_id, &0u128, &denom_id, &100);
    let position = client.blend_position(&0u128, &denom_id).unwrap();
    assert_eq!(position.collateral_amount, 300);
    assert_eq!(position.debt_amount, 100);
    assert_eq!(client.liquid_balance(&denom_id), 800);
    assert_eq!(client.nav(), 1_000);
}

#[test]
#[should_panic]
fn test_redeem_requires_liquidity_when_blend_collateral_locked() {
    let env = Env::default();
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();
    let (_oracle_id, adapter_id, _router) = setup_live_blend(&env, &mgr, &denom_id);
    client.deposit(&user, &denom_asset, &1_000);
    configure_blend_credit_market(&client, &mgr, &adapter_id, 0u128);
    client.blend_lend(&mgr, &adapter_id, &0u128, &denom_id, &900);
    client.redeem(&user, &500);
}

#[test]
fn test_blend_supports_multiple_assets_within_whitelist() {
    let env = Env::default();
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();

    let other_token_id = env.register_contract(None, DummyToken);
    client.set_whitelist(&mgr, &vec![&env, denom_id.clone(), other_token_id.clone()]);
    let oracle_id = env.register_contract(None, DummyOracle);
    let oracle = DummyOracleClient::new(&env, &oracle_id);
    oracle.set_price(&denom_id, &10_000_000i128, &123u64);
    oracle.set_price(&other_token_id, &15_000_000i128, &124u64);
    let router_id = env.register_contract(None, BlendRouterMock);
    let router = BlendRouterMockClient::new(&env, &router_id);
    router.set_oracle(&oracle_id);
    router.set_reserve(
        &denom_id,
        &0u32,
        &9_000_000u32,
        &1_000_000_000_000i128,
        &1_000_000_000_000i128,
        &10_000_000i128,
    );
    router.set_reserve(
        &other_token_id,
        &1u32,
        &8_000_000u32,
        &1_000_000_000_000i128,
        &1_000_000_000_000i128,
        &10_000_000i128,
    );
    let adapter_id = env.register_contract(None, BlendAdapter);
    let adapter = BlendAdapterClient::new(&env, &adapter_id);
    adapter.init(&mgr, &router_id);
    client.deposit(&user, &denom_asset, &1_000);
    configure_blend_credit_market(&client, &mgr, &adapter_id, 7u128);
    client.blend_lend(&mgr, &adapter_id, &7u128, &denom_id, &400);
    client.set_blend_risk_policy(
        &mgr,
        &7u128,
        &DEFAULT_BLEND_MAX_ORACLE_AGE,
        &10_000_000i128,
        &true,
        &true,
    );
    client.blend_borrow(&mgr, &adapter_id, &7u128, &other_token_id, &200);

    let collateral = client.blend_position(&7u128, &denom_id).unwrap();
    assert_eq!(collateral.collateral_amount, 400);
    assert_eq!(collateral.debt_amount, 0);

    let debt = client.blend_position(&7u128, &other_token_id).unwrap();
    assert_eq!(debt.collateral_amount, 0);
    assert_eq!(debt.debt_amount, 200);

    let market_assets = client.blend_market_assets(&7u128);
    assert_eq!(market_assets.len(), 2);

    let market_value = client.blend_market_value(&7u128).unwrap();
    assert!(market_value.net_value > 0);
    assert_eq!(client.nav(), 900);
}

#[test]
fn test_oracle_guard_uses_secondary_feed_for_divergent_borrow_asset() {
    let env = Env::default();
    env.ledger().set_timestamp(1_500);
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();

    let other_token_id = env.register_contract(None, DummyToken);
    client.set_whitelist(&mgr, &vec![&env, denom_id.clone(), other_token_id.clone()]);
    let (_guard_id, adapter_id, _router, _primary, _secondary) = setup_live_blend_with_oracle_guard(
        &env,
        &mgr,
        &denom_id,
        &other_token_id,
        100_000_000i128,
        15_000_000i128,
        1u32,
    );

    client.deposit(&user, &denom_asset, &1_000);
    configure_blend_credit_market(&client, &mgr, &adapter_id, 9u128);
    client.blend_lend(&mgr, &adapter_id, &9u128, &denom_id, &400);
    client.set_blend_risk_policy(
        &mgr,
        &9u128,
        &DEFAULT_BLEND_MAX_ORACLE_AGE,
        &10_000_000i128,
        &true,
        &true,
    );
    client.blend_borrow(&mgr, &adapter_id, &9u128, &other_token_id, &200);

    let debt = client
        .blend_position_value(&9u128, &other_token_id)
        .unwrap();
    assert_eq!(debt.price, 15_000_000);
    assert_eq!(debt.debt_value, 300);

    let status = client.blend_market_status(&9u128).unwrap();
    assert!(!status.has_invalid_oracle_data);
    assert!(!status.nav_blocked);
    assert!(!status.risky_actions_blocked);
}

#[test]
#[should_panic]
fn test_oracle_guard_fail_closed_blocks_divergent_borrow_asset() {
    let env = Env::default();
    env.ledger().set_timestamp(1_500);
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();

    let other_token_id = env.register_contract(None, DummyToken);
    client.set_whitelist(&mgr, &vec![&env, denom_id.clone(), other_token_id.clone()]);
    let (_guard_id, adapter_id, _router, _primary, _secondary) = setup_live_blend_with_oracle_guard(
        &env,
        &mgr,
        &denom_id,
        &other_token_id,
        100_000_000i128,
        15_000_000i128,
        0u32,
    );

    client.deposit(&user, &denom_asset, &1_000);
    configure_blend_credit_market(&client, &mgr, &adapter_id, 10u128);
    client.blend_lend(&mgr, &adapter_id, &10u128, &denom_id, &400);
    client.set_blend_risk_policy(
        &mgr,
        &10u128,
        &DEFAULT_BLEND_MAX_ORACLE_AGE,
        &10_000_000i128,
        &true,
        &true,
    );
    client.blend_borrow(&mgr, &adapter_id, &10u128, &other_token_id, &200);
}

#[test]
fn test_credit_position_wrappers_delegate_to_blend() {
    let env = Env::default();
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();
    let (oracle_id, adapter_id, router) = setup_live_blend(&env, &mgr, &denom_id);
    let oracle = DummyOracleClient::new(&env, &oracle_id);
    oracle.set_price(&denom_id, &10_000_000i128, &1_000u64);
    router.set_reserve(
        &denom_id,
        &0u32,
        &9_000_000u32,
        &1_000_000_000_000i128,
        &1_000_000_000_000i128,
        &10_000_000i128,
    );

    client.deposit(&user, &denom_asset, &1_000);
    configure_blend_credit_market(&client, &mgr, &adapter_id, 0u128);
    client.credit_supply(&mgr, &CreditProtocol::Blend, &0u128, &denom_id, &400);
    client.credit_borrow(&mgr, &CreditProtocol::Blend, &0u128, &denom_id, &100);
    client.credit_repay(&mgr, &CreditProtocol::Blend, &0u128, &denom_id, &50);
    client.credit_withdraw(&mgr, &CreditProtocol::Blend, &0u128, &denom_id, &25);

    let position = client
        .credit_position(&CreditProtocol::Blend, &0u128, &denom_id)
        .unwrap();
    assert_eq!(position.collateral_amount, 375);
    assert_eq!(position.debt_amount, 50);

    let protocols = client.credit_protocols();
    assert_eq!(protocols.len(), 1);
    let configs = client.credit_market_configs(&CreditProtocol::Blend);
    assert_eq!(configs.len(), 1);
    assert_eq!(configs.get(0).unwrap().adapter, adapter_id);
    let values = client.credit_position_values(&CreditProtocol::Blend, &0u128);
    assert_eq!(values.len(), 1);
    let market_value = client
        .credit_market_value(&CreditProtocol::Blend, &0u128)
        .unwrap();
    assert_eq!(market_value.net_value, 325);
    assert_eq!(
        client.credit_health_factor(&CreditProtocol::Blend, &0u128),
        Some(67_400_000)
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #24)")]
fn test_credit_supply_blocks_globally_disabled_blend_adapter() {
    let env = Env::default();
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();
    let (_oracle_id, adapter_id, _router) = setup_live_blend(&env, &mgr, &denom_id);
    let venue_registry_id = env.register_contract(None, DummyVenueRegistry);
    let venue_registry = DummyVenueRegistryClient::new(&env, &venue_registry_id);

    client.deposit(&user, &denom_asset, &1_000);
    client.set_venue_registry(&mgr, &venue_registry_id);
    venue_registry.set_allowed(&adapter_id, &false);
    configure_blend_credit_market(&client, &mgr, &adapter_id, 0u128);

    client.credit_supply(&mgr, &CreditProtocol::Blend, &0u128, &denom_id, &400);
}

#[test]
#[should_panic(expected = "Error(Contract, #24)")]
fn test_legacy_blend_lend_blocks_globally_disabled_adapter() {
    let env = Env::default();
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();
    let (_oracle_id, adapter_id, _router) = setup_live_blend(&env, &mgr, &denom_id);
    let venue_registry_id = env.register_contract(None, DummyVenueRegistry);
    let venue_registry = DummyVenueRegistryClient::new(&env, &venue_registry_id);

    client.deposit(&user, &denom_asset, &1_000);
    client.set_venue_registry(&mgr, &venue_registry_id);
    venue_registry.set_allowed(&adapter_id, &false);
    configure_blend_credit_market(&client, &mgr, &adapter_id, 0u128);

    client.blend_lend(&mgr, &adapter_id, &0u128, &denom_id, &400);
}

#[test]
#[should_panic(expected = "Error(Contract, #20)")]
fn test_legacy_blend_lend_blocks_unconfigured_market() {
    let env = Env::default();
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();
    let (_oracle_id, adapter_id, _router) = setup_live_blend(&env, &mgr, &denom_id);

    client.deposit(&user, &denom_asset, &1_000);

    client.blend_lend(&mgr, &adapter_id, &0u128, &denom_id, &400);
}

#[test]
#[should_panic(expected = "Error(Contract, #24)")]
fn test_legacy_blend_lend_blocks_adapter_mismatch() {
    let env = Env::default();
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();
    let (_oracle_id, adapter_id, _router) = setup_live_blend(&env, &mgr, &denom_id);
    let other_adapter = Address::generate(&env);

    client.deposit(&user, &denom_asset, &1_000);
    configure_blend_credit_market(&client, &mgr, &adapter_id, 0u128);

    client.blend_lend(&mgr, &other_adapter, &0u128, &denom_id, &400);
}

#[test]
#[should_panic(expected = "Error(Contract, #21)")]
fn test_legacy_blend_borrow_blocks_disallowed_action() {
    let env = Env::default();
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();
    let (_oracle_id, adapter_id, _router) = setup_live_blend(&env, &mgr, &denom_id);

    client.deposit(&user, &denom_asset, &1_000);
    client.configure_credit_market(
        &mgr,
        &CreditProtocol::Blend,
        &0u128,
        &adapter_id,
        &true,
        &false,
        &true,
        &true,
        &true,
    );

    client.blend_borrow(&mgr, &adapter_id, &0u128, &denom_id, &100);
}

#[test]
fn test_credit_market_status_wrapper_matches_blend_status() {
    let env = Env::default();
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();
    let (oracle_id, adapter_id, _router) = setup_live_blend(&env, &mgr, &denom_id);
    let oracle = DummyOracleClient::new(&env, &oracle_id);
    oracle.set_price(&denom_id, &10_000_000i128, &1_000u64);

    client.deposit(&user, &denom_asset, &1_000);
    configure_blend_credit_market(&client, &mgr, &adapter_id, 0u128);
    client.credit_supply(&mgr, &CreditProtocol::Blend, &0u128, &denom_id, &400);
    let policy = client.credit_risk_policy(&CreditProtocol::Blend, &0u128);
    assert_eq!(policy.max_oracle_age, DEFAULT_BLEND_MAX_ORACLE_AGE);

    env.ledger()
        .with_mut(|li| li.timestamp = 1_000 + DEFAULT_BLEND_MAX_ORACLE_AGE + 1);
    let status = client
        .credit_market_status(&CreditProtocol::Blend, &0u128)
        .unwrap();
    assert!(status.has_stale_oracle);
    assert!(status.risky_actions_blocked);
    assert!(status.nav_blocked);
}

#[test]
#[should_panic(expected = "Error(Contract, #21)")]
fn test_credit_market_capabilities_block_disallowed_action() {
    let env = Env::default();
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();
    let (_oracle_id, adapter_id, _router) = setup_live_blend(&env, &mgr, &denom_id);

    client.deposit(&user, &denom_asset, &1_000);
    client.configure_credit_market(
        &mgr,
        &CreditProtocol::Blend,
        &0u128,
        &adapter_id,
        &true,
        &false,
        &true,
        &true,
        &true,
    );
    client.credit_borrow(&mgr, &CreditProtocol::Blend, &0u128, &denom_id, &100);
}

#[test]
fn test_blend_position_value_uses_live_pool_rates() {
    let env = Env::default();
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();
    let (oracle_id, adapter_id, router) = setup_live_blend(&env, &mgr, &denom_id);
    let oracle = DummyOracleClient::new(&env, &oracle_id);
    router.set_reserve(
        &denom_id,
        &0u32,
        &9_000_000u32,
        &1_100_000_000_000i128,
        &1_200_000_000_000i128,
        &10_000_000i128,
    );
    oracle.set_price(&denom_id, &10_000_000i128, &456u64);

    client.deposit(&user, &denom_asset, &1_000);
    configure_blend_credit_market(&client, &mgr, &adapter_id, 0u128);
    client.blend_lend(&mgr, &adapter_id, &0u128, &denom_id, &400);
    client.blend_borrow(&mgr, &adapter_id, &0u128, &denom_id, &100);

    let position_value = client.blend_position_value(&0u128, &denom_id).unwrap();
    assert_eq!(position_value.collateral_amount, 440);
    assert_eq!(position_value.debt_amount, 120);
    assert_eq!(position_value.net_value, 320);
    assert_eq!(position_value.health_factor, 33_000_000);
    assert_eq!(client.nav(), 1_020);
    assert_eq!(client.blend_health_factor(&0u128), Some(33_000_000));
}

#[test]
fn test_blend_market_status_blocks_stale_nav() {
    let env = Env::default();
    env.ledger().set_timestamp(150);
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();
    let (oracle_id, adapter_id, _router) = setup_live_blend(&env, &mgr, &denom_id);
    let oracle = DummyOracleClient::new(&env, &oracle_id);
    oracle.set_price(&denom_id, &10_000_000i128, &100u64);

    client.deposit(&user, &denom_asset, &1_000);
    configure_blend_credit_market(&client, &mgr, &adapter_id, 0u128);
    client.blend_lend(&mgr, &adapter_id, &0u128, &denom_id, &400);
    client.set_blend_risk_policy(&mgr, &0u128, &60u64, &12_500_000i128, &true, &true);
    env.ledger().set_timestamp(5_000);

    let status = client.blend_market_status(&0u128).unwrap();
    assert!(status.has_stale_oracle);
    assert!(status.nav_blocked);
}

#[test]
#[should_panic]
fn test_stale_oracle_panics_nav() {
    let env = Env::default();
    env.ledger().set_timestamp(150);
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();
    let (oracle_id, adapter_id, _router) = setup_live_blend(&env, &mgr, &denom_id);
    let oracle = DummyOracleClient::new(&env, &oracle_id);
    oracle.set_price(&denom_id, &10_000_000i128, &100u64);

    client.deposit(&user, &denom_asset, &1_000);
    configure_blend_credit_market(&client, &mgr, &adapter_id, 0u128);
    client.blend_lend(&mgr, &adapter_id, &0u128, &denom_id, &400);
    client.set_blend_risk_policy(&mgr, &0u128, &60u64, &12_500_000i128, &true, &true);
    env.ledger().set_timestamp(5_000);
    client.nav();
}

#[test]
fn test_invalid_oracle_data_blocks_market_status() {
    let env = Env::default();
    env.ledger().set_timestamp(150);
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();
    let (oracle_id, adapter_id, _router) = setup_live_blend(&env, &mgr, &denom_id);
    let oracle = DummyOracleClient::new(&env, &oracle_id);

    client.deposit(&user, &denom_asset, &1_000);
    configure_blend_credit_market(&client, &mgr, &adapter_id, 0u128);
    client.blend_lend(&mgr, &adapter_id, &0u128, &denom_id, &400);
    oracle.set_price(&denom_id, &0i128, &140u64);

    let status = client.blend_market_status(&0u128).unwrap();
    assert!(status.has_invalid_oracle_data);
    assert!(status.nav_blocked);
    assert!(status.risky_actions_blocked);
}

#[test]
#[should_panic]
fn test_invalid_oracle_data_panics_borrow() {
    let env = Env::default();
    env.ledger().set_timestamp(150);
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();
    let (oracle_id, adapter_id, _router) = setup_live_blend(&env, &mgr, &denom_id);
    let oracle = DummyOracleClient::new(&env, &oracle_id);

    client.deposit(&user, &denom_asset, &1_000);
    configure_blend_credit_market(&client, &mgr, &adapter_id, 0u128);
    client.blend_lend(&mgr, &adapter_id, &0u128, &denom_id, &400);
    oracle.set_price(&denom_id, &0i128, &140u64);
    client.blend_borrow(&mgr, &adapter_id, &0u128, &denom_id, &10);
}

#[test]
#[should_panic]
fn test_blend_borrow_panics_below_min_health_factor() {
    let env = Env::default();
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let user = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();
    let (_oracle_id, adapter_id, _router) = setup_live_blend(&env, &mgr, &denom_id);

    client.deposit(&user, &denom_asset, &1_000);
    configure_blend_credit_market(&client, &mgr, &adapter_id, 0u128);
    client.blend_lend(&mgr, &adapter_id, &0u128, &denom_id, &400);
    client.set_blend_risk_policy(
        &mgr,
        &0u128,
        &DEFAULT_BLEND_MAX_ORACLE_AGE,
        &15_000_000i128,
        &true,
        &true,
    );
    client.blend_borrow(&mgr, &adapter_id, &0u128, &denom_id, &300);
}

#[test]
#[should_panic]
fn test_manager_cannot_set_policy_after_governor_assigned() {
    let env = Env::default();
    let (client, _denom_id, mgr, _denom_asset) = setup_arka(&env);
    let gov = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();
    client.set_governor(&mgr, &gov);
    client.set_router(&mgr, &Address::generate(&env));
}

#[test]
#[should_panic]
fn test_invalid_fee_bps_rejected() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ArkaContract);
    let client = ArkaContractClient::new(&env, &contract_id);
    let token_id = env.register_contract(None, DummyToken);
    let wl = vec![&env, token_id.clone()];
    let mgr = manager(&env);
    client.init(&token_id, &20_000, &0, &0, &0, &wl, &mgr);
}

#[test]
#[should_panic(expected = "bootstrap_admin_expiry_locked")]
fn test_bootstrap_admin_cannot_extend_expiry() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    let (client, _denom_id, mgr, _denom_asset) = setup_arka(&env);
    let admin = Address::generate(&env);

    env.mock_all_auths_allowing_non_root_auth();
    client.set_bootstrap_admin(&mgr, &admin, &2_000);
    client.set_bootstrap_admin(&admin, &admin, &2_001);
}

#[test]
fn test_blend_lend_with_real_adapter_authorizes_pool_submit() {
    let env = Env::default();
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let oracle_id = env.register_contract(None, DummyOracle);
    let oracle = DummyOracleClient::new(&env, &oracle_id);
    oracle.set_price(&denom_id, &10_000_000i128, &123u64);
    let router_id = env.register_contract(None, BlendRouterMock);
    let router = BlendRouterMockClient::new(&env, &router_id);
    router.set_oracle(&oracle_id);
    router.set_reserve(
        &denom_id,
        &0u32,
        &9_000_000u32,
        &1_000_000_000_000i128,
        &1_000_000_000_000i128,
        &10_000_000i128,
    );
    let adapter_id = env.register_contract(None, BlendAdapter);
    let adapter = BlendAdapterClient::new(&env, &adapter_id);
    let user = Address::generate(&env);
    let arka_id = client.address.clone();
    env.mock_all_auths_allowing_non_root_auth();
    adapter.init(&mgr, &router_id);
    client.deposit(&user, &denom_asset, &1_000);
    configure_blend_credit_market(&client, &mgr, &adapter_id, 0u128);
    client.blend_lend(&mgr, &adapter_id, &0u128, &denom_id, &400);

    let position = client.blend_position(&0u128, &denom_id).unwrap();
    assert_eq!(position.collateral_amount, 400);
    assert_eq!(position.debt_amount, 0);
    assert_eq!(client.liquid_balance(&denom_id), 600);
    assert_eq!(router.collateral(&arka_id, &denom_id), 400);
}

#[test]
fn test_blend_supply_only_fallback_when_external_diagnostics_disabled() {
    let env = Env::default();
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let (_oracle_id, adapter_id, _router) = setup_live_blend(&env, &mgr, &denom_id);
    let user = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();

    client.deposit(&user, &denom_asset, &1_000);
    configure_blend_credit_market(&client, &mgr, &adapter_id, 0u128);
    client.set_blend_external_diagnostics(&mgr, &0u128, &false);

    assert!(!client.blend_external_diagnostics(&0u128));
    client.credit_supply(&mgr, &CreditProtocol::Blend, &0u128, &denom_id, &400);

    assert_eq!(client.liquid_balance(&denom_id), 600);
    assert_eq!(client.nav(), 1_000);

    let value = client.blend_position_value(&0u128, &denom_id).unwrap();
    assert_eq!(value.collateral_value, 400);
    assert_eq!(value.debt_value, 0);
    assert_eq!(value.price, 0);

    let status = client.blend_market_status(&0u128).unwrap();
    assert!(!status.has_live_pricing);
    assert!(!status.has_stale_oracle);
    assert!(!status.nav_blocked);
    assert!(!status.risky_actions_blocked);

    client.credit_withdraw(&mgr, &CreditProtocol::Blend, &0u128, &denom_id, &400);
    assert_eq!(client.liquid_balance(&denom_id), 1_000);
    assert_eq!(client.nav(), 1_000);
    assert!(client.blend_position(&0u128, &denom_id).is_none());
}

#[test]
#[should_panic]
fn test_blend_borrow_blocks_when_external_diagnostics_disabled() {
    let env = Env::default();
    let (client, denom_id, mgr, denom_asset) = setup_arka(&env);
    let (_oracle_id, adapter_id, _router) = setup_live_blend(&env, &mgr, &denom_id);
    let user = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();

    client.deposit(&user, &denom_asset, &1_000);
    configure_blend_credit_market(&client, &mgr, &adapter_id, 0u128);
    client.set_blend_external_diagnostics(&mgr, &0u128, &false);
    client.credit_supply(&mgr, &CreditProtocol::Blend, &0u128, &denom_id, &400);

    client.credit_borrow(&mgr, &CreditProtocol::Blend, &0u128, &denom_id, &10);
}
