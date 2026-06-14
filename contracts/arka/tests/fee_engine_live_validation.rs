use arka::{ArkaContract, ArkaContractClient, Asset, SwapStep};
use router::Router;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    vec, Address, Env,
};
use test_profit_adapter::TestProfitAdapter;
use test_token::TestToken;

const HALF_YEAR_SECONDS: u64 = 15_768_000;

#[test]
fn fee_engine_live_path_validates_management_and_performance_with_real_token_transfers() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);

    let arka_id = env.register_contract(None, ArkaContract);
    let arka = ArkaContractClient::new(&env, &arka_id);
    let token_id = env.register_contract(None, TestToken);
    let token = test_token::TestTokenClient::new(&env, &token_id);
    let router_id = env.register_contract(None, Router);
    let adapter_id = env.register_contract(None, TestProfitAdapter);
    let adapter = test_profit_adapter::TestProfitAdapterClient::new(&env, &adapter_id);

    let manager = Address::generate(&env);
    let treasury = Address::generate(&env);
    let user = Address::generate(&env);
    let whitelist = vec![&env, token_id.clone()];
    let denom = Asset {
        contract: token_id.clone(),
    };

    env.mock_all_auths_allowing_non_root_auth();
    token.init(&manager);
    token.mint(&user, &1_500i128);
    token.mint(&adapter_id, &200i128);

    adapter.init(&manager, &router_id, &token_id, &80i128);

    arka.init(
        &token_id, &1_000i32, &2_000i32, &0i32, &0i32, &whitelist, &manager,
    );
    arka.set_router(&manager, &router_id);
    arka.set_protocol_fee_policy(&manager, &treasury, &2_500i32, &5_000i32);

    token.approve(&user, &arka_id, &1_000i128, &100_000u32);
    arka.deposit(&user, &denom, &1_000i128);

    env.ledger().set_timestamp(1_000 + HALF_YEAR_SECONDS);
    let preview = arka.preview_fee_settlement();
    assert_eq!(preview.management_fee_shares, 52);
    assert_eq!(preview.protocol_fee_shares, 13);
    assert_eq!(preview.manager_fee_shares, 39);

    let settled = arka.settle_fees();
    assert_eq!(settled.management_fee_shares, 52);
    assert_eq!(arka.shares_of(&treasury), 13);
    assert_eq!(arka.shares_of(&manager), 39);

    let steps = vec![
        &env,
        SwapStep {
            adapter: adapter_id,
            pool_id: 7u128,
            asset_in: Asset {
                contract: token_id.clone(),
            },
            amount_in: 100i128,
            min_out: 100i128,
            asset_out: Asset {
                contract: token_id.clone(),
            },
            router_addr: router_id,
        },
    ];

    let out = arka.rebalance(&manager, &steps);
    assert_eq!(out, 180);
    assert_eq!(token.balance(&manager), 0);
    assert_eq!(token.balance(&arka_id), 1_080);

    let fee_state_after_profit = arka.fee_state();
    assert_eq!(fee_state_after_profit.cumulative_performance_shares, 4);
    assert_eq!(arka.shares_of(&manager), 41);
    assert_eq!(arka.shares_of(&treasury), 15);

    let user_shares = arka.shares_of(&user);
    let out_redeem = arka.redeem(&user, &user_shares);
    assert_eq!(out_redeem, 1_022);
    assert_eq!(arka.shares_of(&user), 0);
    assert_eq!(arka.shares_of(&manager), 41);
    assert_eq!(arka.shares_of(&treasury), 15);
    assert_eq!(arka.nav(), 58);
}
