#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address, Env, IntoVal, Symbol,
    vec,
};

const SCALE: i128 = 1_000_000_000_000;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Governor,
    StakeToken,
    RewardToken,
    TotalStaked,
    StakeBy(Address),
    RewardDebt(Address),
    PendingBy(Address),
    AccRewardPerShare,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    AmountZero = 4,
    InsufficientStake = 5,
}

#[contract]
pub struct CoverageFund;

#[contractimpl]
impl CoverageFund {
    fn require_policy_auth(env: &Env, caller: &Address) {
        let store = env.storage().instance();
        if let Some(governor) = store.get::<DataKey, Address>(&DataKey::Governor) {
            if *caller != governor {
                panic_with_error!(env, Error::Unauthorized);
            }
            caller.require_auth();
            return;
        }
        let admin: Address = match store.get(&DataKey::Admin) {
            Some(a) => a,
            None => panic_with_error!(env, Error::NotInitialized),
        };
        if *caller != admin {
            panic_with_error!(env, Error::Unauthorized);
        }
        caller.require_auth();
    }

    fn settle_user(env: &Env, user: &Address) {
        let store = env.storage().instance();
        let staked: i128 = store.get(&DataKey::StakeBy(user.clone())).unwrap_or(0);
        let debt: i128 = store.get(&DataKey::RewardDebt(user.clone())).unwrap_or(0);
        let acc: i128 = store.get(&DataKey::AccRewardPerShare).unwrap_or(0);
        let accrued = (staked * acc) / SCALE;
        if accrued > debt {
            let pending = accrued - debt;
            let prev: i128 = store.get(&DataKey::PendingBy(user.clone())).unwrap_or(0);
            store.set(&DataKey::PendingBy(user.clone()), &(prev + pending));
        }
        store.set(&DataKey::RewardDebt(user.clone()), &accrued);
    }

    fn transfer_from(env: &Env, token: &Address, spender: &Address, from: &Address, to: &Address, amount: i128) {
        let args = vec![
            env,
            spender.clone().into_val(env),
            from.clone().into_val(env),
            to.clone().into_val(env),
            amount.into_val(env),
        ];
        let _ = env.invoke_contract::<()>(token, &Symbol::new(env, "transfer_from"), args);
    }

    fn transfer(env: &Env, token: &Address, from: &Address, to: &Address, amount: i128) {
        let args = vec![env, from.clone().into_val(env), to.clone().into_val(env), amount.into_val(env)];
        let _ = env.invoke_contract::<()>(token, &symbol_short!("transfer"), args);
    }

    pub fn init(env: Env, admin: Address, stake_token: Address, reward_token: Address) {
        let store = env.storage().instance();
        if store.has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::StakeToken, &stake_token);
        store.set(&DataKey::RewardToken, &reward_token);
        store.set(&DataKey::TotalStaked, &0i128);
        store.set(&DataKey::AccRewardPerShare, &0i128);
    }

    pub fn set_governor(env: Env, caller: Address, governor: Address) {
        Self::require_policy_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Governor, &governor);
    }

    pub fn add_rewards(env: Env, caller: Address, amount: i128) {
        if amount <= 0 {
            panic_with_error!(&env, Error::AmountZero);
        }
        Self::require_policy_auth(&env, &caller);
        let store = env.storage().instance();
        let total_staked: i128 = store.get(&DataKey::TotalStaked).unwrap_or(0);
        if total_staked <= 0 {
            panic_with_error!(&env, Error::InsufficientStake);
        }
        let reward_token: Address = match store.get(&DataKey::RewardToken) {
            Some(t) => t,
            None => panic_with_error!(&env, Error::NotInitialized),
        };
        let fund = env.current_contract_address();
        Self::transfer_from(&env, &reward_token, &fund, &caller, &fund, amount);
        let acc: i128 = store.get(&DataKey::AccRewardPerShare).unwrap_or(0);
        let delta = (amount * SCALE) / total_staked;
        store.set(&DataKey::AccRewardPerShare, &(acc + delta));
    }

    pub fn stake(env: Env, user: Address, amount: i128) {
        if amount <= 0 {
            panic_with_error!(&env, Error::AmountZero);
        }
        user.require_auth();
        let store = env.storage().instance();
        let stake_token: Address = match store.get(&DataKey::StakeToken) {
            Some(t) => t,
            None => panic_with_error!(&env, Error::NotInitialized),
        };
        let fund = env.current_contract_address();
        Self::settle_user(&env, &user);
        Self::transfer_from(&env, &stake_token, &fund, &user, &fund, amount);
        let prev: i128 = store.get(&DataKey::StakeBy(user.clone())).unwrap_or(0);
        let next = prev + amount;
        store.set(&DataKey::StakeBy(user.clone()), &next);
        let total: i128 = store.get(&DataKey::TotalStaked).unwrap_or(0);
        store.set(&DataKey::TotalStaked, &(total + amount));
        let acc: i128 = store.get(&DataKey::AccRewardPerShare).unwrap_or(0);
        store.set(&DataKey::RewardDebt(user), &((next * acc) / SCALE));
    }

    pub fn unstake(env: Env, user: Address, amount: i128) {
        if amount <= 0 {
            panic_with_error!(&env, Error::AmountZero);
        }
        user.require_auth();
        let store = env.storage().instance();
        let stake_token: Address = match store.get(&DataKey::StakeToken) {
            Some(t) => t,
            None => panic_with_error!(&env, Error::NotInitialized),
        };
        let fund = env.current_contract_address();
        Self::settle_user(&env, &user);
        let prev: i128 = store.get(&DataKey::StakeBy(user.clone())).unwrap_or(0);
        if amount > prev {
            panic_with_error!(&env, Error::InsufficientStake);
        }
        let next = prev - amount;
        store.set(&DataKey::StakeBy(user.clone()), &next);
        let total: i128 = store.get(&DataKey::TotalStaked).unwrap_or(0);
        store.set(&DataKey::TotalStaked, &(total - amount));
        Self::transfer(&env, &stake_token, &fund, &user, amount);
        let acc: i128 = store.get(&DataKey::AccRewardPerShare).unwrap_or(0);
        store.set(&DataKey::RewardDebt(user), &((next * acc) / SCALE));
    }

    pub fn claim(env: Env, user: Address) -> i128 {
        user.require_auth();
        let store = env.storage().instance();
        let reward_token: Address = match store.get(&DataKey::RewardToken) {
            Some(t) => t,
            None => panic_with_error!(&env, Error::NotInitialized),
        };
        let fund = env.current_contract_address();
        Self::settle_user(&env, &user);
        let pending: i128 = store.get(&DataKey::PendingBy(user.clone())).unwrap_or(0);
        if pending > 0 {
            store.set(&DataKey::PendingBy(user.clone()), &0i128);
            Self::transfer(&env, &reward_token, &fund, &user, pending);
        }
        pending
    }

    pub fn pending_reward(env: Env, user: Address) -> i128 {
        let store = env.storage().instance();
        let staked: i128 = store.get(&DataKey::StakeBy(user.clone())).unwrap_or(0);
        let debt: i128 = store.get(&DataKey::RewardDebt(user.clone())).unwrap_or(0);
        let pending: i128 = store.get(&DataKey::PendingBy(user)).unwrap_or(0);
        let acc: i128 = store.get(&DataKey::AccRewardPerShare).unwrap_or(0);
        let accrued = (staked * acc) / SCALE;
        if accrued > debt {
            pending + (accrued - debt)
        } else {
            pending
        }
    }

    pub fn stake_of(env: Env, user: Address) -> i128 {
        env.storage().instance().get(&DataKey::StakeBy(user)).unwrap_or(0)
    }

    pub fn total_staked(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalStaked).unwrap_or(0)
    }

    pub fn governor(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Governor)
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
        pub fn mint(env: Env, to: Address, amount: i128) {
            let k = (symbol_short!("bal"), to);
            let b: i128 = env.storage().instance().get(&k).unwrap_or(0);
            env.storage().instance().set(&k, &(b + amount));
        }
        pub fn approve(env: Env, owner: Address, spender: Address, amount: i128) {
            owner.require_auth();
            let k = (symbol_short!("allow"), owner, spender);
            env.storage().instance().set(&k, &amount);
        }
        pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
            spender.require_auth();
            let ak = (symbol_short!("allow"), from.clone(), spender.clone());
            let allow: i128 = env.storage().instance().get(&ak).unwrap_or(0);
            if allow < amount {
                panic!("insufficient_allowance");
            }
            env.storage().instance().set(&ak, &(allow - amount));
            Self::xfer(env, from, to, amount);
        }
        pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
            from.require_auth();
            Self::xfer(env, from, to, amount);
        }
        pub fn balance(env: Env, owner: Address) -> i128 {
            env.storage().instance().get(&(symbol_short!("bal"), owner)).unwrap_or(0)
        }
        fn xfer(env: Env, from: Address, to: Address, amount: i128) {
            let fk = (symbol_short!("bal"), from);
            let tk = (symbol_short!("bal"), to);
            let fb: i128 = env.storage().instance().get(&fk).unwrap_or(0);
            if fb < amount {
                panic!("insufficient_balance");
            }
            env.storage().instance().set(&fk, &(fb - amount));
            let tb: i128 = env.storage().instance().get(&tk).unwrap_or(0);
            env.storage().instance().set(&tk, &(tb + amount));
        }
    }

    #[test]
    fn test_single_staker_reward_flow() {
        let env = Env::default();
        let token_id = env.register_contract(None, MockToken);
        let token = MockTokenClient::new(&env, &token_id);
        let fund_id = env.register_contract(None, CoverageFund);
        let fund = CoverageFundClient::new(&env, &fund_id);
        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        env.mock_all_auths();
        fund.init(&admin, &token_id, &token_id);
        token.mint(&user, &500);
        token.mint(&admin, &200);
        token.approve(&user, &fund_id, &500);
        token.approve(&admin, &fund_id, &200);
        fund.stake(&user, &500);
        fund.add_rewards(&admin, &200);
        assert_eq!(fund.pending_reward(&user), 200);
        let claimed = fund.claim(&user);
        assert_eq!(claimed, 200);
        assert_eq!(token.balance(&user), 200);
    }

    #[test]
    fn test_multi_staker_proportional_rewards() {
        let env = Env::default();
        let token_id = env.register_contract(None, MockToken);
        let token = MockTokenClient::new(&env, &token_id);
        let fund_id = env.register_contract(None, CoverageFund);
        let fund = CoverageFundClient::new(&env, &fund_id);
        let admin = Address::generate(&env);
        let u1 = Address::generate(&env);
        let u2 = Address::generate(&env);
        env.mock_all_auths();
        fund.init(&admin, &token_id, &token_id);
        token.mint(&u1, &100);
        token.mint(&u2, &300);
        token.mint(&admin, &400);
        token.approve(&u1, &fund_id, &100);
        token.approve(&u2, &fund_id, &300);
        token.approve(&admin, &fund_id, &400);
        fund.stake(&u1, &100);
        fund.stake(&u2, &300);
        fund.add_rewards(&admin, &400);
        assert_eq!(fund.pending_reward(&u1), 100);
        assert_eq!(fund.pending_reward(&u2), 300);
    }

    #[test]
    fn test_governor_policy_control() {
        let env = Env::default();
        let token_id = env.register_contract(None, MockToken);
        let fund_id = env.register_contract(None, CoverageFund);
        let fund = CoverageFundClient::new(&env, &fund_id);
        let admin = Address::generate(&env);
        let gov = Address::generate(&env);
        env.mock_all_auths();
        fund.init(&admin, &token_id, &token_id);
        fund.set_governor(&admin, &gov);
        assert_eq!(fund.governor(), Some(gov));
    }
}


