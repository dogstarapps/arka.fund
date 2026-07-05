    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_swap() {
        let env = Env::default();
        let id = env.register_contract(None, BalancedRouterMock);
        let client = BalancedRouterMockClient::new(&env, &id);
        let caller = soroban_sdk::Address::generate(&env);
        env.mock_all_auths();
        let out = client.swap(
            &caller,
            &1u128,
            &1_000i128,
            &900i128,
            &soroban_sdk::Address::generate(&env),
        );
        assert_eq!(out, 990);
    }
