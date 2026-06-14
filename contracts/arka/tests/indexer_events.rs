use arka::{ArkaContract, ArkaContractClient, CreditProtocol};
use soroban_sdk::{
    contract, contractimpl, symbol_short,
    testutils::{Address as _, Events as _},
    vec, Address, Env, IntoVal,
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
}

#[test]
fn configuration_changes_emit_provider_ready_events() {
    let env = Env::default();
    let arka_id = env.register_contract(None, ArkaContract);
    let client = ArkaContractClient::new(&env, &arka_id);
    let denom_token = env.register_contract(None, DummyToken);
    let secondary_token = env.register_contract(None, DummyToken);
    let manager = Address::generate(&env);
    let rotated_manager = Address::generate(&env);
    let whitelist_init = vec![&env, denom_token.clone()];
    let whitelist_updated = vec![&env, denom_token.clone(), secondary_token.clone()];

    env.mock_all_auths_allowing_non_root_auth();
    client.init(
        &denom_token,
        &100,
        &200,
        &25,
        &30,
        &whitelist_init,
        &manager,
    );
    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                arka_id.clone(),
                (symbol_short!("initcfg"),).into_val(&env),
                (
                    manager.clone(),
                    denom_token.clone(),
                    whitelist_init.clone(),
                    100i32,
                    200i32,
                    25i32,
                    30i32,
                )
                    .into_val(&env),
            )
        ]
    );

    client.set_governor(&manager, &manager);
    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                arka_id.clone(),
                (symbol_short!("govset"),).into_val(&env),
                (manager.clone(), manager.clone()).into_val(&env),
            )
        ]
    );

    client.set_fees(&manager, &125, &225, &35, &45);
    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                arka_id.clone(),
                (symbol_short!("feecfg"),).into_val(&env),
                (manager.clone(), 125i32, 225i32, 35i32, 45i32).into_val(&env),
            )
        ]
    );

    client.set_protocol_fee_policy(&manager, &secondary_token, &1_500, &2_500);
    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                arka_id.clone(),
                (symbol_short!("protfee"),).into_val(&env),
                (manager.clone(), secondary_token.clone(), 1_500i32, 2_500i32).into_val(&env),
            )
        ]
    );

    client.set_whitelist(&manager, &whitelist_updated);
    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                arka_id.clone(),
                (symbol_short!("whlist"),).into_val(&env),
                (manager.clone(), whitelist_updated.clone()).into_val(&env),
            )
        ]
    );

    client.set_manager(&manager, &rotated_manager);
    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                arka_id.clone(),
                (symbol_short!("mngrset"),).into_val(&env),
                (manager.clone(), rotated_manager.clone()).into_val(&env),
            )
        ]
    );

    client.set_router(&manager, &secondary_token);
    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                arka_id.clone(),
                (symbol_short!("router"),).into_val(&env),
                (manager.clone(), secondary_token.clone()).into_val(&env),
            )
        ]
    );

    client.set_share_token(&manager, &denom_token);
    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                arka_id.clone(),
                (symbol_short!("sharetk"),).into_val(&env),
                (manager.clone(), denom_token.clone()).into_val(&env),
            )
        ]
    );

    client.set_blend_risk_policy(&manager, &7, &600, &1_250_000, &true, &false);
    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                arka_id.clone(),
                (symbol_short!("blendcfg"),).into_val(&env),
                (manager.clone(), 7u128, 600u64, 1_250_000i128, true, false).into_val(&env),
            )
        ]
    );

    client.configure_credit_market(
        &manager,
        &CreditProtocol::Blend,
        &7,
        &secondary_token,
        &true,
        &false,
        &true,
        &false,
        &true,
    );
    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                arka_id,
                (symbol_short!("creditcf"),).into_val(&env),
                (
                    manager,
                    0u32,
                    7u128,
                    secondary_token,
                    true,
                    false,
                    true,
                    false,
                    true,
                )
                    .into_val(&env),
            )
        ]
    );
}
