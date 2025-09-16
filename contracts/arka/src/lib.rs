#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, contracterror, panic_with_error, symbol_short, Address, Env, Symbol, Vec, IntoVal, vec};

#[derive(Clone)]
#[contracttype]
pub struct FeeStructure {
    pub mgmt_bps: i32,
    pub perf_bps: i32,
    pub deposit_bps: i32,
    pub redeem_bps: i32,
}

#[derive(Clone)]
#[contracttype]
pub struct Asset {
    // Minimal placeholder: in practice, use soroban token interface contract Address
    pub contract: Address,
}

#[derive(Clone)]
#[contracttype]
pub struct SwapStep {
    pub adapter: Address,
    pub pool_id: u128,
    pub amount_in: i128,
    pub min_out: i128,
    pub asset_out: Asset,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Denomination,
    TotalShares,
    Aum,
    Fees,
    Whitelist,
    Manager,
    Router,
    Balance(Address),
}

const EVENT_DEPOSIT: Symbol = symbol_short!("deposit");
const EVENT_REDEEM: Symbol = symbol_short!("redeem");
const EVENT_PROFIT: Symbol = symbol_short!("profit");

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    OnlyManager = 3,
    AmountZero = 4,
    AssetNotWhitelisted = 5,
    SharesZero = 6,
    InsufficientUserShares = 7,
    InsufficientShares = 8,
    RouterNotSet = 9,
}

#[contract]
pub struct ArkaContract;

#[contractimpl]
impl ArkaContract {
    // ----- Errors defined at module level -----
    fn apply_fee_bps(amount: i128, fee_bps: i32) -> i128 {
        // fee_bps in [0,10000]; returns net amount after fee
        let bps = 10000i128 - (fee_bps as i128);
        (amount * bps) / 10000i128
    }

    pub fn init(
        env: Env,
        denomination_contract: Address,
        mgmt_bps: i32,
        perf_bps: i32,
        deposit_bps: i32,
        redeem_bps: i32,
        whitelist_contracts: Vec<Address>,
        manager: Address,
    ) {
        let store = env.storage().instance();
        if store.has(&DataKey::Denomination) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        let denomination = Asset { contract: denomination_contract };
        let fees = FeeStructure { mgmt_bps, perf_bps, deposit_bps, redeem_bps };
        // Map whitelist addresses to Asset structs
        let mut wl_assets: Vec<Asset> = Vec::new(&env);
        for addr in whitelist_contracts.iter() {
            wl_assets.push_back(Asset { contract: addr });
        }
        store.set(&DataKey::Denomination, &denomination);
        store.set(&DataKey::Fees, &fees);
        store.set(&DataKey::Whitelist, &wl_assets);
        store.set(&DataKey::Manager, &manager);
        store.set(&DataKey::TotalShares, &0i128);
        store.set(&DataKey::Aum, &0i128);
    }

    pub fn set_router(env: Env, caller: Address, router: Address) {
        let store = env.storage().instance();
        let mgr: Address = match store.get(&DataKey::Manager) {
            Some(m) => m,
            None => panic_with_error!(&env, Error::NotInitialized),
        };
        if caller != mgr { panic_with_error!(&env, Error::OnlyManager); }
        caller.require_auth();
        store.set(&DataKey::Router, &router);
    }

    pub fn deposit(env: Env, user: Address, asset: Asset, amount: i128) -> i128 {
        user.require_auth();
        if amount <= 0 { panic_with_error!(&env, Error::AmountZero); }
        // Validate asset whitelist (placeholder contains check)
        let store = env.storage().instance();
        let wl: Vec<Asset> = store.get(&DataKey::Whitelist).unwrap_or(Vec::new(&env));
        let mut allowed = false;
        for a in wl.iter() {
            if a.contract == asset.contract { allowed = true; break; }
        }
        if !allowed { panic_with_error!(&env, Error::AssetNotWhitelisted); }
        // Transfer tokens from user to this contract (expects token standard)
        let self_addr = env.current_contract_address();
        // SAC: transfer_from(spender, from, to, amount)
        let args = vec![
            &env,
            self_addr.clone().into_val(&env),
            user.clone().into_val(&env),
            self_addr.clone().into_val(&env),
            amount.into_val(&env),
        ];
        let _ = env.invoke_contract::<()>(&asset.contract, &Symbol::new(&env, "transfer_from"), args);
        // Compute shares based on NAV
        let fees: FeeStructure = store.get(&DataKey::Fees).unwrap_or(FeeStructure { mgmt_bps: 0, perf_bps: 0, deposit_bps: 0, redeem_bps: 0 });
        let net_amount = Self::apply_fee_bps(amount, fees.deposit_bps);
        let total: i128 = store.get(&DataKey::TotalShares).unwrap_or(0);
        let aum: i128 = store.get(&DataKey::Aum).unwrap_or(0);
        let shares_minted = if total == 0 || aum == 0 { net_amount } else { (net_amount * total) / aum };
        if shares_minted <= 0 { panic_with_error!(&env, Error::SharesZero); }
        store.set(&DataKey::TotalShares, &(total + shares_minted));
        store.set(&DataKey::Aum, &(aum + net_amount));
        // Track per-user shares
        let bal: i128 = store.get(&DataKey::Balance(user.clone())).unwrap_or(0);
        store.set(&DataKey::Balance(user.clone()), &(bal + shares_minted));

        env.events().publish((EVENT_DEPOSIT,), (user.clone(), amount, shares_minted));
        shares_minted
    }

    pub fn redeem(env: Env, user: Address, shares: i128) -> i128 {
        user.require_auth();
        if shares <= 0 { panic_with_error!(&env, Error::SharesZero); }
        let store = env.storage().instance();
        // Ensure user has shares
        let user_bal: i128 = store.get(&DataKey::Balance(user.clone())).unwrap_or(0);
        if shares > user_bal { panic_with_error!(&env, Error::InsufficientUserShares); }
        let total: i128 = store.get(&DataKey::TotalShares).unwrap_or(0);
        if shares > total { panic_with_error!(&env, Error::InsufficientShares); }
        let aum: i128 = store.get(&DataKey::Aum).unwrap_or(0);
        // proportional return in denomination asset (placeholder)
        let mut amount_out = if total == 0 { 0 } else { (shares * aum) / total };

        store.set(&DataKey::TotalShares, &(total - shares));
        store.set(&DataKey::Balance(user.clone()), &(user_bal - shares));
        // Apply redeem fee and update AUM with gross amount removed
        let fees: FeeStructure = store.get(&DataKey::Fees).unwrap_or(FeeStructure { mgmt_bps: 0, perf_bps: 0, deposit_bps: 0, redeem_bps: 0 });
        let net_out = Self::apply_fee_bps(amount_out, fees.redeem_bps);
        store.set(&DataKey::Aum, &(aum - amount_out));
        // Send denomination asset from vault to user
        let denom: Asset = match store.get(&DataKey::Denomination) { Some(d) => d, None => panic_with_error!(&env, Error::NotInitialized) };
        let self_addr = env.current_contract_address();
        let args = vec![
            &env,
            self_addr.into_val(&env),
            user.clone().into_val(&env),
            net_out.into_val(&env),
        ];
        let _ = env.invoke_contract::<()>(&denom.contract, &symbol_short!("transfer"), args);
        env.events().publish((EVENT_REDEEM,), (user.clone(), shares, net_out));
        net_out
    }

    pub fn rebalance(env: Env, manager: Address, steps: Vec<SwapStep>) -> i128 {
        let store = env.storage().instance();
        let stored_manager: Address = match store.get(&DataKey::Manager) { Some(m) => m, None => panic_with_error!(&env, Error::NotInitialized) };
        if manager != stored_manager { panic_with_error!(&env, Error::OnlyManager); }
        manager.require_auth();

        let router: Address = match store.get(&DataKey::Router) { Some(r) => r, None => panic_with_error!(&env, Error::RouterNotSet) };
        // Ensure the router is authorized at the root invocation to allow nested require_auth in downstream calls
        router.require_auth();
        // Call router.execute(manager, steps) and receive total output in denomination units (placeholder)
        let args = vec![
            &env,
            manager.clone().into_val(&env),
            steps.clone().into_val(&env),
        ];
        let out_total: i128 = env.invoke_contract(&router, &symbol_short!("execute"), args);

        // For now, treat out_total as profit delta (placeholder)
        let aum: i128 = store.get(&DataKey::Aum).unwrap_or(0);
        let profit = out_total;
        store.set(&DataKey::Aum, &(aum + profit));
        env.events().publish((EVENT_PROFIT,), (profit, steps.len() as u32));
        profit
    }

    // --- Getters for dApp/UI ---
    pub fn manager(env: Env) -> Address {
        let store = env.storage().instance();
        match store.get(&DataKey::Manager) { Some(m) => m, None => panic_with_error!(&env, Error::NotInitialized) }
    }

    pub fn router(env: Env) -> Address {
        let store = env.storage().instance();
        match store.get(&DataKey::Router) { Some(r) => r, None => panic_with_error!(&env, Error::RouterNotSet) }
    }

    pub fn denomination(env: Env) -> Asset {
        let store = env.storage().instance();
        match store.get(&DataKey::Denomination) { Some(d) => d, None => panic_with_error!(&env, Error::NotInitialized) }
    }

    pub fn shares_of(env: Env, user: Address) -> i128 {
        let store = env.storage().instance();
        store.get(&DataKey::Balance(user)).unwrap_or(0)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{vec, testutils::Address as _, Address, contract, contractimpl};

    #[contract]
    struct DummyToken;
    #[contractimpl]
    impl DummyToken {
        pub fn xfer_from(_env: Env, _from: Address, _to: Address, _amount: i128) {}
        pub fn xfer(_env: Env, _from: Address, _to: Address, _amount: i128) {}
    }

    fn asset(env: &Env) -> Asset { Asset { contract: Address::generate(env) } }
    fn manager(env: &Env) -> Address { Address::generate(env) }

    #[test]
    fn test_init_and_deposit_redeem() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ArkaContract);
        let client = ArkaContractClient::new(&env, &contract_id);
        // Register dummy token to satisfy invoke_contract calls
        let token_id = env.register_contract(None, DummyToken);
        let denom = Asset { contract: token_id.clone() };
        let fees = FeeStructure { mgmt_bps: 0, perf_bps: 0, deposit_bps: 0, redeem_bps: 0 };
        let wl = vec![&env, denom.clone()];
        let mgr = manager(&env);
        client.init(&denom, &fees, &wl, &mgr);

        let user = Address::generate(&env);
        let amount: i128 = 100;
        env.mock_all_auths();
        let minted = client.deposit(&user, &denom, &amount);
        assert_eq!(minted, amount);

        let out = client.redeem(&user, &40);
        assert_eq!(out, 40);
    }

    #[test]
    #[should_panic]
    fn test_error_already_initialized() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ArkaContract);
        let client = ArkaContractClient::new(&env, &contract_id);
        let token_id = env.register_contract(None, DummyToken);
        let denom = Asset { contract: token_id.clone() };
        let fees = FeeStructure { mgmt_bps: 0, perf_bps: 0, deposit_bps: 0, redeem_bps: 0 };
        let wl = vec![&env, denom.clone()];
        let mgr = Address::generate(&env);
        client.init(&denom, &fees, &wl, &mgr);
        // Second init should panic with AlreadyInitialized
        client.init(&denom, &fees, &wl, &mgr);
    }

    #[test]
    #[should_panic]
    fn test_error_only_manager() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ArkaContract);
        let client = ArkaContractClient::new(&env, &contract_id);
        let token_id = env.register_contract(None, DummyToken);
        let denom = Asset { contract: token_id.clone() };
        let fees = FeeStructure { mgmt_bps: 0, perf_bps: 0, deposit_bps: 0, redeem_bps: 0 };
        let wl = vec![&env, denom.clone()];
        let mgr = Address::generate(&env);
        client.init(&denom, &fees, &wl, &mgr);
        let not_mgr = Address::generate(&env);
        env.mock_all_auths();
        client.set_router(&not_mgr, &Address::generate(&env));
    }
}


