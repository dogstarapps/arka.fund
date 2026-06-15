use arka::{ArkaContract, ArkaContractClient, Asset, SwapStep};
use router::Router;
use soroban_sdk::{
    contract, contractimpl, symbol_short,
    testutils::{Address as _, Ledger},
    vec, Address, Env,
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
struct ProfitAdapter;

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

#[test]
fn fee_engine_end_to_end_settles_performance_and_preserves_fee_ownership_on_redeem() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);

    let arka_id = env.register_contract(None, ArkaContract);
    let client = ArkaContractClient::new(&env, &arka_id);
    let token_id = env.register_contract(None, DummyToken);
    let router_id = env.register_contract(None, Router);
    let adapter_id = env.register_contract(None, ProfitAdapter);
    let manager = Address::generate(&env);
    let treasury = Address::generate(&env);
    let user = Address::generate(&env);
    let whitelist = vec![&env, token_id.clone()];
    let denom = Asset {
        contract: token_id.clone(),
    };

    env.mock_all_auths_allowing_non_root_auth();
    client.init(&token_id, &0, &2_000, &0, &0, &whitelist, &manager);
    client.set_router(&manager, &router_id);
    client.set_protocol_fee_policy(&manager, &treasury, &0, &5_000);
    client.deposit(&user, &denom, &1_000);

    let steps = vec![
        &env,
        SwapStep {
            adapter: adapter_id,
            pool_id: 11,
            asset_in: Asset {
                contract: token_id.clone(),
            },
            amount_in: 100,
            min_out: 100,
            asset_out: Asset {
                contract: token_id.clone(),
            },
            router_addr: router_id,
        },
    ];

    client.rebalance(&manager, &steps);
    assert_eq!(client.nav(), 1_020);
    assert_eq!(client.shares_of(&manager), 2);
    assert_eq!(client.shares_of(&treasury), 1);

    let out = client.redeem(&user, &1_000);
    assert_eq!(out, 1_016);
    assert_eq!(client.shares_of(&user), 0);
    assert_eq!(client.shares_of(&manager), 2);
    assert_eq!(client.shares_of(&treasury), 1);
    assert_eq!(client.nav(), 4);
}
