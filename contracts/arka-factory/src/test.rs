use super::*;
use soroban_sdk::{testutils::Ledger, Address, Bytes, Env};
use soroban_sdk::testutils::{MockAuth, MockAuthInvoke};
extern crate arka_registry as registry_mod;

struct FeeCreationFixture {
    env: Env, factory: Address, manager: Address,
    treasury: Address, token: Address, config: ManagedCreateConfig,
}

fn fee_creation_fixture(fee: i128, balance: i128) -> FeeCreationFixture {
    let env = Env::default();
    let (factory, governor) = register_factory(&env);
    let manager = Address::generate(&env);
    let treasury = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(Address::generate(&env)).address();
    soroban_sdk::token::StellarAssetClient::new(&env, &token).mint(&manager, &balance);
    let client = ArkaFactoryClient::new(&env, &factory);
    client.set_protocol_treasury(&treasury);
    client.set_creation_fee(&token, &fee);
    client.set_share_token_implementation(&BytesN::from_array(&env, &[7; 32]));
    client.set_managed_template(&governor, &ManagedTemplate {
        denomination: token.clone(), enabled: true,
        policy: ManagedPolicy { epoch_seconds: 60, manager_window: 60,
            min_request_shares: 1, buffer_bps: 0, blend_market_id: 0, blend_adapter: None },
    });
    client.set_portfolio_template(&governor, &Some(ManagedPortfolioPolicy {
        routes: Vec::new(&env), instant_cash: true, auto_payout: false,
        max_slippage_bps: 100, cancel_lock_seconds: 60,
    }));
    client.set_managed_routes_template(&governor, &Vec::new(&env));
    client.set_default_valuation_oracle(&Address::generate(&env), &300);
    let config = ManagedCreateConfig { template_hash: client.managed_routes_template_digest().unwrap(),
        denomination: token.clone(), mgmt_bps: 0, perf_bps: 0, deposit_bps: 0,
        router: Address::generate(&env) };
    FeeCreationFixture { env, factory, manager, treasury, token, config }
}

fn assert_creation_balances(f: &FeeCreationFixture, manager: i128, treasury: i128, count: u32) {
    let token = soroban_sdk::token::TokenClient::new(&f.env, &f.token);
    assert_eq!(token.balance(&f.manager), manager);
    assert_eq!(token.balance(&f.treasury), treasury);
    assert_eq!(token.allowance(&f.manager, &f.factory), 0);
    assert_eq!(ArkaFactoryClient::new(&f.env, &f.factory).get_arkas(&0, &10).len(), count);
}

#[test]
fn routed_creation_charges_without_allowance_under_the_exact_manager_auth_tree() {
    let f = fee_creation_fixture(5, 100);
    let salt = Bytes::from_array(&f.env, &[42; 32]);
    f.env.mock_auths(&[MockAuth { address: &f.manager, invoke: &MockAuthInvoke {
        contract: &f.factory, fn_name: "create_managed_routes",
        args: (salt.clone(), f.manager.clone(), f.config.clone()).into_val(&f.env),
        sub_invokes: &[MockAuthInvoke { contract: &f.token, fn_name: "transfer",
            args: (f.manager.clone(), f.treasury.clone(), 5i128).into_val(&f.env), sub_invokes: &[] }],
    }}]);
    ArkaFactoryClient::new(&f.env, &f.factory).create_managed_routes(&salt, &f.manager, &f.config);
    assert_creation_balances(&f, 95, 5, 1);
}

#[test]
fn routed_creation_cannot_charge_with_a_missing_fee_subauthorization() {
    let f = fee_creation_fixture(5, 100);
    let salt = Bytes::from_array(&f.env, &[42; 32]);
    f.env.mock_auths(&[MockAuth { address: &f.manager, invoke: &MockAuthInvoke {
        contract: &f.factory, fn_name: "create_managed_routes",
        args: (salt.clone(), f.manager.clone(), f.config.clone()).into_val(&f.env), sub_invokes: &[],
    }}]);
    assert!(ArkaFactoryClient::new(&f.env, &f.factory).try_create_managed_routes(&salt, &f.manager, &f.config).is_err());
    assert_creation_balances(&f, 100, 0, 0);
}

#[test]
fn fee_transfer_alone_cannot_authorize_routed_creation() {
    let f = fee_creation_fixture(5, 100);
    f.env.mock_auths(&[MockAuth { address: &f.manager, invoke: &MockAuthInvoke {
        contract: &f.token, fn_name: "transfer",
        args: (f.manager.clone(), f.treasury.clone(), 5i128).into_val(&f.env), sub_invokes: &[],
    }}]);
    assert!(ArkaFactoryClient::new(&f.env, &f.factory).try_create_managed_routes(
        &Bytes::from_array(&f.env, &[42; 32]), &f.manager, &f.config).is_err());
    assert_creation_balances(&f, 100, 0, 0);
}

#[test]
fn routed_creation_rejects_a_fee_amount_changed_since_review_without_payment() {
    let f = fee_creation_fixture(5, 100);
    let client = ArkaFactoryClient::new(&f.env, &f.factory);
    client.set_creation_fee(&f.token, &6);
    assert_ne!(client.managed_routes_template_digest().unwrap(), f.config.template_hash);
    assert!(client.try_create_managed_routes(&Bytes::from_array(&f.env, &[42; 32]), &f.manager, &f.config).is_err());
    assert_creation_balances(&f, 100, 0, 0);
}

#[test]
fn routed_creation_rejects_a_fee_token_changed_since_review_without_payment() {
    let f = fee_creation_fixture(5, 100);
    let client = ArkaFactoryClient::new(&f.env, &f.factory);
    client.set_creation_fee(&Address::generate(&f.env), &5);
    assert_ne!(client.managed_routes_template_digest().unwrap(), f.config.template_hash);
    assert!(client.try_create_managed_routes(&Bytes::from_array(&f.env, &[42; 32]), &f.manager, &f.config).is_err());
    assert_creation_balances(&f, 100, 0, 0);
}

#[test]
fn routed_creation_rejects_a_treasury_changed_since_review_without_payment() {
    let f = fee_creation_fixture(5, 100);
    let client = ArkaFactoryClient::new(&f.env, &f.factory);
    client.set_protocol_treasury(&Address::generate(&f.env));
    assert_ne!(client.managed_routes_template_digest().unwrap(), f.config.template_hash);
    assert!(client.try_create_managed_routes(&Bytes::from_array(&f.env, &[42; 32]), &f.manager, &f.config).is_err());
    assert_creation_balances(&f, 100, 0, 0);
}

#[test]
fn routed_creation_with_no_fee_needs_no_token_authorization() {
    let f = fee_creation_fixture(0, 100);
    let salt = Bytes::from_array(&f.env, &[42; 32]);
    f.env.mock_auths(&[MockAuth { address: &f.manager, invoke: &MockAuthInvoke {
        contract: &f.factory, fn_name: "create_managed_routes",
        args: (salt.clone(), f.manager.clone(), f.config.clone()).into_val(&f.env), sub_invokes: &[],
    }}]);
    ArkaFactoryClient::new(&f.env, &f.factory).create_managed_routes(&salt, &f.manager, &f.config);
    assert_creation_balances(&f, 100, 0, 1);
}

#[test]
fn failed_routed_creation_rolls_back_fee_and_registration() {
    let mut f = fee_creation_fixture(5, 100);
    let client = ArkaFactoryClient::new(&f.env, &f.factory);
    client.set_registry(&Address::generate(&f.env));
    f.config.template_hash = client.managed_routes_template_digest().unwrap();
    assert!(client.try_create_managed_routes(&Bytes::from_array(&f.env, &[42; 32]), &f.manager, &f.config).is_err());
    assert_creation_balances(&f, 100, 0, 0);
}

#[test]
fn insufficient_fee_balance_cannot_publish_a_routed_fund() {
    let f = fee_creation_fixture(5, 2);
    assert!(ArkaFactoryClient::new(&f.env, &f.factory).try_create_managed_routes(
        &Bytes::from_array(&f.env, &[42; 32]), &f.manager, &f.config).is_err());
    assert_creation_balances(&f, 2, 0, 0);
}

// These legacy behavior fixtures use the constructor, never the removed
// first-claim setter. Authorization security is exercised separately against
// compiled Wasm in P29 enforcing mode, without SDK registration shortcuts.
fn register_factory(env: &Env) -> (Address, Address) {
    let governor = Address::generate(env);
    env.mock_all_auths_allowing_non_root_auth();
    let id = env.register(ArkaFactory, (governor.clone(),));
    (id, governor)
}

#[test]
fn test_set_and_create() {
    let env = Env::default();
    // Deploy registry


    let (contract_id, _gov) = register_factory(&env);
    let client = ArkaFactoryClient::new(&env, &contract_id);
    let registry_admin = Address::generate(&env);
    env.mock_all_auths_allowing_non_root_auth();
    let reg_id = env.register(registry_mod::ArkaRegistry, (&registry_admin,));
    let reg = registry_mod::ArkaRegistryClient::new(&env, &reg_id);
    reg.set_registrar(&registry_admin, &contract_id, &true);
    client.set_registry(&reg_id);
    // Create and auto-register
    let manager = Address::generate(&env);
    let mut salt = Bytes::new(&env);
    for _ in 0..32 {
        salt.push_back(1u8);
    }
    let _arka = client.create_arka(&salt, &manager);
    assert_eq!(reg.count(), 1);
    assert_eq!(reg.get_arkas(&0, &10).len(), 1);
    assert_eq!(reg.get_arkas_by_manager(&manager, &0, &10).len(), 1);
}

#[test]
fn test_migrate_tracks_old_new_mapping() {
    let env = Env::default();
    let (contract_id, _governor) = register_factory(&env);
    let client = ArkaFactoryClient::new(&env, &contract_id);

    let old_arka = Address::generate(&env);
    let manager = Address::generate(&env);
    let mut salt = Bytes::new(&env);
    for _ in 0..32 {
        salt.push_back(9u8);
    }
    let denom = Address::generate(&env);
    let whitelist = Vec::from_array(&env, [denom.clone()]);
    let router = Address::generate(&env);

    env.mock_all_auths();
    let new_arka = client.migrate_arka(
        &old_arka, &salt, &manager, &denom, &0, &0, &0, &0, &whitelist, &router,
    );
    assert_eq!(client.migrated_to(&old_arka), Some(new_arka.clone()));
    assert_eq!(client.migrated_from(&new_arka), Some(old_arka));
}

#[test]
fn test_create_and_init_records_share_token_for_arka() {
    let env = Env::default();
    let (contract_id, _governor) = register_factory(&env);
    let client = ArkaFactoryClient::new(&env, &contract_id);

    env.mock_all_auths();
    let share_token_impl = BytesN::from_array(&env, &[7u8; 32]);
    client.set_share_token_implementation(&share_token_impl);

    let manager = Address::generate(&env);
    let mut salt = Bytes::new(&env);
    for _ in 0..32 {
        salt.push_back(2u8);
    }
    let denom = Address::generate(&env);
    let whitelist = Vec::from_array(&env, [denom.clone()]);
    let router = Address::generate(&env);

    let arka = client.create_and_init(&salt, &manager, &denom, &0, &0, &0, &0, &whitelist, &router);

    assert_eq!(
        client.get_share_token_implementation(),
        Some(share_token_impl)
    );
    assert!(client.share_token_of(&arka).is_some());
}

#[test]
fn test_implementation_hash_is_readable_after_governed_configuration() {
    let env = Env::default();
    let (contract_id, _governor) = register_factory(&env);
    let client = ArkaFactoryClient::new(&env, &contract_id);

    env.mock_all_auths();
    let implementation = BytesN::from_array(&env, &[9u8; 32]);
    client.set_implementation(&implementation);

    assert_eq!(client.get_implementation(), Some(implementation));
}

#[test]
fn test_protocol_fee_defaults_round_trip() {
    let env = Env::default();
    let (contract_id, _governor) = register_factory(&env);
    let client = ArkaFactoryClient::new(&env, &contract_id);
    let treasury = Address::generate(&env);

    env.mock_all_auths();
    client.set_protocol_treasury(&treasury);
    client.set_protocol_fee_splits(&1_500, &2_500);

    assert_eq!(client.get_protocol_treasury(), Some(treasury));
    assert_eq!(client.get_protocol_mgmt_fee_bps(), 1_500);
    assert_eq!(client.get_protocol_perf_fee_bps(), 2_500);
}

#[test]
fn test_default_execution_policy_round_trip() {
    let env = Env::default();
    let (contract_id, _governor) = register_factory(&env);
    let client = ArkaFactoryClient::new(&env, &contract_id);
    let registry = Address::generate(&env);
    let oracle = Address::generate(&env);
    let router = Address::generate(&env);
    let adapter = Address::generate(&env);

    env.mock_all_auths();
    client.set_default_venue_registry(&registry);
    client.set_default_swap_oracle(&oracle);
    client.set_default_valuation_oracle(&oracle, &300u64);
    client.set_default_allowed_venues(
        &Vec::from_array(&env, [router.clone()]),
        &Vec::from_array(&env, [adapter.clone()]),
    );
    client.set_default_swap_risk_policy(&true, &true, &300, &300, &350, &60, &2_500);

    assert_eq!(client.get_default_venue_registry(), Some(registry));
    assert_eq!(client.get_default_swap_oracle(), Some(oracle.clone()));
    let valuation = client.get_default_valuation_oracle().unwrap();
    assert_eq!(valuation.oracle, oracle);
    assert_eq!(valuation.max_price_age, 300);
    assert_eq!(client.get_default_allowed_routers().get(0).unwrap(), router);
    assert_eq!(
        client.get_default_allowed_adapters().get(0).unwrap(),
        adapter
    );

    let policy = client.get_default_swap_risk_policy().unwrap();
    assert!(policy.enabled);
    assert!(policy.oracle_checks_enabled);
    assert_eq!(policy.max_price_impact_bps, 300);
    assert_eq!(policy.max_slippage_bps, 300);
    assert_eq!(policy.max_twap_deviation_bps, 350);
    assert_eq!(policy.max_oracle_age_seconds, 60);
    assert_eq!(policy.max_trade_size_bps, 2_500);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_default_valuation_oracle_rejects_zero_max_age() {
    let env = Env::default();
    let (contract_id, _governor) = register_factory(&env);
    let client = ArkaFactoryClient::new(&env, &contract_id);
    let oracle = Address::generate(&env);

    env.mock_all_auths();
    client.set_default_valuation_oracle(&oracle, &0u64);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_default_swap_policy_rejects_invalid_limits() {
    let env = Env::default();
    let (contract_id, _governor) = register_factory(&env);
    let client = ArkaFactoryClient::new(&env, &contract_id);
    env.mock_all_auths();
    client.set_default_swap_risk_policy(&true, &true, &10_001, &300, &350, &60, &2_500);
}

#[test]
#[should_panic(expected = "bootstrap_admin_expiry_locked")]
fn test_bootstrap_admin_cannot_extend_expiry() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    let (contract_id, governor) = register_factory(&env);
    let client = ArkaFactoryClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    env.mock_all_auths();
    client.set_bootstrap_admin(&governor, &admin, &2_000);
    client.set_bootstrap_admin(&admin, &admin, &2_001);
}
