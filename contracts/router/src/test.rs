use super::*;
use soroban_sdk::{testutils::Address as _, testutils::Ledger, Env};

use soroban_sdk::{contract, contractimpl};
#[contract]
struct DummyAdapter;
#[contractimpl]
impl DummyAdapter {
    pub fn execute(
        _env: Env,
        _caller: Address,
        _pool_id: u128,
        amount_in: i128,
        _min_out: i128,
        _receiver: Address,
    ) -> i128 {
        amount_in
    }
}

#[test]
fn test_execute_accumulates_step_outputs() {
    let env = Env::default();
    let router_id = env.register(Router, (None::<Address>, None::<Address>, 0u64));
    let client = RouterClient::new(&env, &router_id);
    // Register dummy adapter
    let adapter_id = env.register_contract(None, DummyAdapter);
    let caller = Address::generate(&env);
    let steps = Vec::from_array(
        &env,
        [
            SwapStep {
                adapter: adapter_id.clone(),
                pool_id: 1,
                amount_in: 10,
                min_out: 9,
                asset_out: Asset {
                    contract: Address::generate(&env),
                },
            },
            SwapStep {
                adapter: adapter_id.clone(),
                pool_id: 2,
                amount_in: 5,
                min_out: 4,
                asset_out: Asset {
                    contract: Address::generate(&env),
                },
            },
        ],
    );
    let out = client.execute(&caller, &steps);
    assert_eq!(out, 15);
}

#[test]
#[should_panic(expected = "bootstrap_admin_expiry_locked")]
fn test_bootstrap_admin_cannot_extend_expiry() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    
    
    let admin = Address::generate(&env);

    env.mock_all_auths();
    let router_id = env.register(Router, (&Some((admin).clone()), &None::<Address>, &2_000u64,));
    let client = RouterClient::new(&env, &router_id);
    client.set_bootstrap_admin(&admin, &admin, &2_001);
}


#[test]
fn optional_governor_clear_does_not_recreate_retired_bootstrap_authority() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let governor = Address::generate(&env);
    let id = env.register(Router, (&Some(admin.clone()), &None::<Address>, &2_000u64));
    let client = RouterClient::new(&env, &id);
    client.set_governor(&admin, &None);
    assert!(client.try_clear_bootstrap_admin(&admin).is_err());
    client.set_governor(&admin, &Some(governor.clone()));
    client.clear_bootstrap_admin(&governor);
    client.set_governor(&governor, &None);
    assert_eq!(client.bootstrap_admin(), None);
    assert!(client.try_set_governor(&admin, &Some(admin.clone())).is_err());
}
