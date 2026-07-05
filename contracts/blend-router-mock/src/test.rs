use super::*;
use soroban_sdk::{contract, contractimpl, testutils::Address as _, Address, Env};

#[contract]
struct MockToken;

#[contractimpl]
impl MockToken {
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        let from_key = (symbol_short!("bal"), from.clone());
        let to_key = (symbol_short!("bal"), to.clone());
        let from_bal: i128 = env.storage().instance().get(&from_key).unwrap_or(0);
        assert!(from_bal >= amount, "insufficient_balance");
        env.storage()
            .instance()
            .set(&from_key, &(from_bal - amount));
        let to_bal: i128 = env.storage().instance().get(&to_key).unwrap_or(0);
        env.storage().instance().set(&to_key, &(to_bal + amount));
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let to_key = (symbol_short!("bal"), to);
        let to_bal: i128 = env.storage().instance().get(&to_key).unwrap_or(0);
        env.storage().instance().set(&to_key, &(to_bal + amount));
    }

    pub fn balance(env: Env, owner: Address) -> i128 {
        let key = (symbol_short!("bal"), owner);
        env.storage().instance().get(&key).unwrap_or(0)
    }
}

#[test]
fn test_submit_tracks_collateral_debt_and_payouts() {
    let env = Env::default();
    let router_id = env.register_contract(None, BlendRouterMock);
    let router = BlendRouterMockClient::new(&env, &router_id);
    let token_id = env.register_contract(None, MockToken);
    let token = MockTokenClient::new(&env, &token_id);
    let owner = Address::generate(&env);
    let receiver = Address::generate(&env);

    env.mock_all_auths();
    token.mint(&router_id, &2_000);
    token.mint(&owner, &1_000);
    router.submit(
        &owner,
        &owner,
        &router_id,
        &vec![
            &env,
            Request {
                address: token_id.clone(),
                amount: 500,
                request_type: 2,
            },
        ],
    );
    assert_eq!(router.collateral(&owner, &token_id), 500);

    router.submit(
        &owner,
        &owner,
        &receiver,
        &vec![
            &env,
            Request {
                address: token_id.clone(),
                amount: 200,
                request_type: 4,
            },
        ],
    );
    assert_eq!(router.debt(&owner, &token_id), 200);
    assert_eq!(token.balance(&receiver), 200);

    router.submit(
        &owner,
        &owner,
        &router_id,
        &vec![
            &env,
            Request {
                address: token_id.clone(),
                amount: 50,
                request_type: 5,
            },
        ],
    );
    assert_eq!(router.debt(&owner, &token_id), 150);

    router.submit(
        &owner,
        &owner,
        &receiver,
        &vec![
            &env,
            Request {
                address: token_id.clone(),
                amount: 100,
                request_type: 3,
            },
        ],
    );
    assert_eq!(router.collateral(&owner, &token_id), 400);
    assert_eq!(token.balance(&receiver), 300);
}
