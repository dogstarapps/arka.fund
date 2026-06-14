#![no_std]
use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, vec,
    Address, Env, IntoVal, Map, Vec,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Collateral(Address, Address),
    Debt(Address, Address),
    Oracle,
    Reserve(Address),
    ReserveAssets,
}

#[derive(Clone)]
#[contracttype]
pub struct Request {
    pub address: Address,
    pub amount: i128,
    pub request_type: u32,
}

#[derive(Clone)]
#[contracttype]
pub struct PoolConfig {
    pub bstop_rate: u32,
    pub max_positions: u32,
    pub min_collateral: i128,
    pub oracle: Address,
    pub status: u32,
}

#[derive(Clone)]
#[contracttype]
pub struct ReserveConfig {
    pub c_factor: u32,
    pub decimals: u32,
    pub enabled: bool,
    pub index: u32,
    pub l_factor: u32,
    pub max_util: u32,
    pub r_base: u32,
    pub r_one: u32,
    pub r_three: u32,
    pub r_two: u32,
    pub reactivity: u32,
    pub supply_cap: i128,
    pub util: u32,
}

#[derive(Clone)]
#[contracttype]
pub struct ReserveData {
    pub b_rate: i128,
    pub b_supply: i128,
    pub backstop_credit: i128,
    pub d_rate: i128,
    pub d_supply: i128,
    pub ir_mod: i128,
    pub last_time: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct Reserve {
    pub asset: Address,
    pub config: ReserveConfig,
    pub data: ReserveData,
    pub scalar: i128,
}

#[derive(Clone)]
#[contracttype]
pub struct Positions {
    pub collateral: Map<u32, i128>,
    pub liabilities: Map<u32, i128>,
    pub supply: Map<u32, i128>,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    InvalidAction = 1,
    AmountZero = 2,
    UnsupportedRequest = 3,
    InsufficientCollateral = 4,
    InsufficientDebt = 5,
}

#[contract]
pub struct BlendRouterMock;

#[contractimpl]
impl BlendRouterMock {
    fn authorize_transfer(env: &Env, token: &Address, from: &Address, to: &Address, amount: i128) {
        let args = vec![
            env,
            from.clone().into_val(env),
            to.clone().into_val(env),
            amount.into_val(env),
        ];
        let auth = InvokerContractAuthEntry::Contract(SubContractInvocation {
            context: ContractContext {
                contract: token.clone(),
                fn_name: symbol_short!("transfer"),
                args: args.clone(),
            },
            sub_invocations: vec![env],
        });
        env.authorize_as_current_contract(vec![env, auth]);
    }

    fn read_collateral(env: &Env, owner: &Address, asset: &Address) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::Collateral(owner.clone(), asset.clone()))
            .unwrap_or(0)
    }

    fn read_debt(env: &Env, owner: &Address, asset: &Address) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::Debt(owner.clone(), asset.clone()))
            .unwrap_or(0)
    }

    fn write_collateral(env: &Env, owner: &Address, asset: &Address, amount: i128) {
        env.storage()
            .instance()
            .set(&DataKey::Collateral(owner.clone(), asset.clone()), &amount);
    }

    fn write_debt(env: &Env, owner: &Address, asset: &Address, amount: i128) {
        env.storage()
            .instance()
            .set(&DataKey::Debt(owner.clone(), asset.clone()), &amount);
    }

    fn read_reserve(env: &Env, asset: &Address) -> Reserve {
        env.storage()
            .instance()
            .get(&DataKey::Reserve(asset.clone()))
            .unwrap_or(Reserve {
                asset: asset.clone(),
                config: ReserveConfig {
                    c_factor: 9_000_000,
                    decimals: 7,
                    enabled: true,
                    index: 0,
                    l_factor: 9_000_000,
                    max_util: 9_500_000,
                    r_base: 5_000,
                    r_one: 300_000,
                    r_three: 10_000_000,
                    r_two: 2_000_000,
                    reactivity: 50,
                    supply_cap: i128::MAX,
                    util: 5_000_000,
                },
                data: ReserveData {
                    b_rate: 1_000_000_000_000,
                    b_supply: 0,
                    backstop_credit: 0,
                    d_rate: 1_000_000_000_000,
                    d_supply: 0,
                    ir_mod: 0,
                    last_time: 0,
                },
                scalar: 10_000_000,
            })
    }

    pub fn set_oracle(env: Env, oracle: Address) {
        env.storage().instance().set(&DataKey::Oracle, &oracle);
    }

    pub fn set_reserve(
        env: Env,
        asset: Address,
        index: u32,
        c_factor: u32,
        b_rate: i128,
        d_rate: i128,
        scalar: i128,
    ) {
        let mut reserve_assets: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::ReserveAssets)
            .unwrap_or(Vec::new(&env));
        let mut found = false;
        for existing in reserve_assets.iter() {
            if existing == asset {
                found = true;
                break;
            }
        }
        if !found {
            reserve_assets.push_back(asset.clone());
            env.storage()
                .instance()
                .set(&DataKey::ReserveAssets, &reserve_assets);
        }
        env.storage().instance().set(
            &DataKey::Reserve(asset.clone()),
            &Reserve {
                asset,
                config: ReserveConfig {
                    c_factor,
                    decimals: 7,
                    enabled: true,
                    index,
                    l_factor: c_factor,
                    max_util: 9_500_000,
                    r_base: 5_000,
                    r_one: 300_000,
                    r_three: 10_000_000,
                    r_two: 2_000_000,
                    reactivity: 50,
                    supply_cap: i128::MAX,
                    util: 5_000_000,
                },
                data: ReserveData {
                    b_rate,
                    b_supply: 0,
                    backstop_credit: 0,
                    d_rate,
                    d_supply: 0,
                    ir_mod: 0,
                    last_time: 0,
                },
                scalar,
            },
        );
    }

    pub fn submit(
        env: Env,
        from: Address,
        spender: Address,
        to: Address,
        requests: Vec<Request>,
    ) -> i128 {
        spender.require_auth();
        if from != spender {
            from.require_auth();
        }
        let router = env.current_contract_address();
        let mut last_out = 0i128;
        for req in requests.iter() {
            if req.amount <= 0 {
                return 0;
            }
            match req.request_type {
                2 => {
                    let args = vec![
                        &env,
                        spender.clone().into_val(&env),
                        router.clone().into_val(&env),
                        req.amount.into_val(&env),
                    ];
                    let _ =
                        env.invoke_contract::<()>(&req.address, &symbol_short!("transfer"), args);
                    let next = Self::read_collateral(&env, &from, &req.address) + req.amount;
                    Self::write_collateral(&env, &from, &req.address, next);
                    last_out = req.amount;
                }
                3 => {
                    let collateral = Self::read_collateral(&env, &from, &req.address);
                    if collateral < req.amount {
                        panic_with_error!(&env, Error::InsufficientCollateral);
                    }
                    Self::write_collateral(&env, &from, &req.address, collateral - req.amount);
                    Self::authorize_transfer(&env, &req.address, &router, &to, req.amount);
                    let args = vec![
                        &env,
                        router.clone().into_val(&env),
                        to.clone().into_val(&env),
                        req.amount.into_val(&env),
                    ];
                    let _ =
                        env.invoke_contract::<()>(&req.address, &symbol_short!("transfer"), args);
                    last_out = req.amount;
                }
                4 => {
                    let next = Self::read_debt(&env, &from, &req.address) + req.amount;
                    Self::write_debt(&env, &from, &req.address, next);
                    Self::authorize_transfer(&env, &req.address, &router, &to, req.amount);
                    let args = vec![
                        &env,
                        router.clone().into_val(&env),
                        to.clone().into_val(&env),
                        req.amount.into_val(&env),
                    ];
                    let _ =
                        env.invoke_contract::<()>(&req.address, &symbol_short!("transfer"), args);
                    last_out = req.amount;
                }
                5 => {
                    let debt = Self::read_debt(&env, &from, &req.address);
                    if debt < req.amount {
                        panic_with_error!(&env, Error::InsufficientDebt);
                    }
                    let args = vec![
                        &env,
                        spender.clone().into_val(&env),
                        router.clone().into_val(&env),
                        req.amount.into_val(&env),
                    ];
                    let _ =
                        env.invoke_contract::<()>(&req.address, &symbol_short!("transfer"), args);
                    Self::write_debt(&env, &from, &req.address, debt - req.amount);
                    last_out = req.amount;
                }
                _ => panic_with_error!(&env, Error::UnsupportedRequest),
            }
        }
        env.events()
            .publish((symbol_short!("blend"),), (from, to, last_out));
        last_out
    }

    // action: 0=Lend, 1=Borrow, 2=Repay, 3=Liquidate, 4=Withdraw
    pub fn execute_action(
        env: Env,
        caller: Address,
        action: u32,
        market_id: u128,
        amount: i128,
        receiver: Address,
    ) -> i128 {
        caller.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, Error::AmountZero);
        }
        let out = match action {
            0 => amount,
            1 => amount,
            2 => amount,
            3 => amount,
            4 => amount,
            _ => panic_with_error!(&env, Error::InvalidAction),
        };
        env.events().publish(
            (symbol_short!("blend"),),
            (caller, action, market_id, amount, receiver, out),
        );
        out
    }

    pub fn get_config(env: Env) -> PoolConfig {
        PoolConfig {
            bstop_rate: 1_000_000,
            max_positions: 8,
            min_collateral: 0,
            oracle: env
                .storage()
                .instance()
                .get(&DataKey::Oracle)
                .unwrap_or(env.current_contract_address()),
            status: 0,
        }
    }

    pub fn get_reserve(env: Env, asset: Address) -> Reserve {
        Self::read_reserve(&env, &asset)
    }

    pub fn get_positions(env: Env, address: Address) -> Positions {
        let mut collateral = Map::new(&env);
        let mut liabilities = Map::new(&env);
        let supply = Map::new(&env);

        let reserve_assets: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::ReserveAssets)
            .unwrap_or(Vec::new(&env));
        for asset_id in reserve_assets.iter() {
            let reserve = Self::read_reserve(&env, &asset_id);
            let collateral_amount = Self::read_collateral(&env, &address, &asset_id);
            if collateral_amount > 0 {
                collateral.set(reserve.config.index, collateral_amount);
            }
            let debt_amount = Self::read_debt(&env, &address, &asset_id);
            if debt_amount > 0 {
                liabilities.set(reserve.config.index, debt_amount);
            }
        }

        Positions {
            collateral,
            liabilities,
            supply,
        }
    }

    pub fn collateral(env: Env, owner: Address, asset: Address) -> i128 {
        Self::read_collateral(&env, &owner, &asset)
    }

    pub fn debt(env: Env, owner: Address, asset: Address) -> i128 {
        Self::read_debt(&env, &owner, &asset)
    }
}

#[cfg(test)]
mod test {
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
}
