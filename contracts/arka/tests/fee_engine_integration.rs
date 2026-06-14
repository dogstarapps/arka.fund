use arka::{ArkaContract, ArkaContractClient, Asset};
use soroban_sdk::{
    contract, contractimpl, symbol_short,
    testutils::{Address as _, Ledger},
    vec, Address, Env,
};

const HALF_YEAR_SECONDS: u64 = 15_768_000;

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

#[test]
fn management_fee_preview_and_protocol_split_are_exposed_via_public_api() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);

    let arka_id = env.register_contract(None, ArkaContract);
    let client = ArkaContractClient::new(&env, &arka_id);
    let token_id = env.register_contract(None, DummyToken);
    let manager = Address::generate(&env);
    let treasury = Address::generate(&env);
    let user = Address::generate(&env);
    let whitelist = vec![&env, token_id.clone()];
    let denom = Asset {
        contract: token_id.clone(),
    };

    env.mock_all_auths_allowing_non_root_auth();
    client.init(&token_id, &1_000, &0, &0, &0, &whitelist, &manager);
    client.set_protocol_fee_policy(&manager, &treasury, &2_500, &0);
    client.deposit(&user, &denom, &1_000);

    env.ledger().set_timestamp(1_000 + HALF_YEAR_SECONDS);
    let preview = client.preview_fee_settlement();
    assert_eq!(preview.management_fee_value, 50);
    assert_eq!(preview.management_fee_shares, 52);
    assert_eq!(preview.protocol_fee_shares, 13);
    assert_eq!(preview.manager_fee_shares, 39);

    let settled = client.settle_fees();
    assert_eq!(settled.management_fee_shares, 52);
    assert_eq!(client.protocol_treasury(), Some(treasury.clone()));
    assert_eq!(client.shares_of(&treasury), 13);
    assert_eq!(client.shares_of(&manager), 39);

    let fee_state = client.fee_state();
    assert_eq!(fee_state.cumulative_management_shares, 52);
    assert_eq!(fee_state.cumulative_protocol_shares, 13);
    assert_eq!(fee_state.cumulative_manager_shares, 39);
}
