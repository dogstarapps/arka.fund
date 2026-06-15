use arka::{ArkaContract, ArkaContractClient, Asset, SwapStep};
use router::Router;
use soroban_sdk::{
    contract, contractimpl, symbol_short,
    testutils::{Address as _, Ledger},
    vec, Address, Env,
};
use venue_registry::{VenueRegistry, VenueRegistryClient, STATUS_AUTO, STATUS_DISABLED};

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

fn setup<'a>(
    env: &'a Env,
) -> (
    ArkaContractClient<'a>,
    VenueRegistryClient<'a>,
    Address,
    Address,
    Address,
    Address,
    Asset,
) {
    env.ledger().set_timestamp(1_000);
    let arka_id = env.register_contract(None, ArkaContract);
    let arka = ArkaContractClient::new(env, &arka_id);
    let venue_registry_id = env.register_contract(None, VenueRegistry);
    let venue_registry = VenueRegistryClient::new(env, &venue_registry_id);
    let token_id = env.register_contract(None, DummyToken);
    let router_id = env.register_contract(None, Router);
    let adapter_id = env.register_contract(None, ProfitAdapter);
    let manager = Address::generate(env);
    let admin = Address::generate(env);
    let whitelist = vec![env, token_id.clone()];
    let denom = Asset {
        contract: token_id.clone(),
    };

    env.mock_all_auths_allowing_non_root_auth();
    venue_registry.init(&admin, &Some(manager.clone()), &2_000);
    arka.init(&token_id, &0, &0, &0, &0, &whitelist, &manager);
    arka.set_router(&manager, &router_id);
    arka.set_venue_registry(&manager, &venue_registry_id);

    (
        arka,
        venue_registry,
        token_id,
        router_id,
        adapter_id,
        manager,
        denom,
    )
}

#[test]
fn global_registry_auto_venue_allows_rebalance() {
    let env = Env::default();
    let (arka, venue_registry, token_id, router_id, adapter_id, manager, denom) = setup(&env);
    let user = Address::generate(&env);

    venue_registry.set_venue_status(&manager, &adapter_id, &STATUS_AUTO);
    arka.deposit(&user, &denom, &1_000);
    let steps = vec![
        &env,
        SwapStep {
            adapter: adapter_id,
            pool_id: 1,
            asset_in: Asset {
                contract: token_id.clone(),
            },
            amount_in: 100,
            min_out: 90,
            asset_out: Asset { contract: token_id },
            router_addr: router_id,
        },
    ];

    assert_eq!(arka.rebalance(&manager, &steps), 120);
}

#[test]
#[should_panic(expected = "Error(Contract, #24)")]
fn global_registry_disabled_venue_blocks_rebalance() {
    let env = Env::default();
    let (arka, venue_registry, token_id, router_id, adapter_id, manager, denom) = setup(&env);
    let user = Address::generate(&env);

    venue_registry.set_venue_status(&manager, &adapter_id, &STATUS_DISABLED);
    arka.deposit(&user, &denom, &1_000);
    let steps = vec![
        &env,
        SwapStep {
            adapter: adapter_id,
            pool_id: 1,
            asset_in: Asset {
                contract: token_id.clone(),
            },
            amount_in: 100,
            min_out: 90,
            asset_out: Asset { contract: token_id },
            router_addr: router_id,
        },
    ];

    arka.rebalance(&manager, &steps);
}
