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
    pub asset_in: Asset,
    pub amount_in: i128,
    pub min_out: i128,
    pub asset_out: Asset,
    pub router_addr: Address,
}

// Shape expected by Router.execute
#[derive(Clone)]
#[contracttype]
pub struct RouterStep {
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

        let router_internal: Address = match store.get(&DataKey::Router) { Some(r) => r, None => panic_with_error!(&env, Error::RouterNotSet) };
        let self_addr = env.current_contract_address();
        let latest = env.ledger().sequence();
        let exp: u32 = latest + 100_000; // long-lived approve

        let mut total_out: i128 = 0;

        // Process each step. If the provided router_addr differs from our internal router,
        // call that external router directly (e.g., SoroSwap) as the vault (invoker=self).
        // Otherwise, use the internal Router with the adapter pipeline.
        let mut internal_steps: Vec<RouterStep> = Vec::new(&env);

        for s in steps.iter() {
            if s.router_addr != router_internal {
                // Direct router path (e.g., SoroSwap):
                // 1) Approve router to spend from this vault
                let args_approve = vec![
                    &env,
                    self_addr.clone().into_val(&env),
                    s.router_addr.clone().into_val(&env),
                    s.amount_in.into_val(&env),
                    exp.into_val(&env),
                ];
                let _ = env.invoke_contract::<()>(&s.asset_in.contract, &symbol_short!("approve"), args_approve);
                // 2) Build path [asset_in, asset_out]
                let mut path: Vec<Address> = Vec::new(&env);
                path.push_back(s.asset_in.contract.clone());
                path.push_back(s.asset_out.contract.clone());
                // 3) Call router.swap_exact_tokens_for_tokens(amount_in, min_out, path, to=self, deadline)
                let deadline: u64 = env.ledger().timestamp() + 1800u64;
                let args_swap = vec![
                    &env,
                    s.amount_in.into_val(&env),
                    s.min_out.into_val(&env),
                    path.into_val(&env),
                    self_addr.clone().into_val(&env),
                    deadline.into_val(&env),
                ];
                let func = Symbol::new(&env, "swap_exact_tokens_for_tokens");
                let amounts: Vec<i128> = env.invoke_contract(&s.router_addr, &func, args_swap);
                // last entry is out amount
                let mut out: i128 = 0;
                for v in amounts.iter() { out = v; }
                total_out += out;
            } else {
                // Internal router step (keeps adapter flow). Move input to manager as before.
                let args_transfer = vec![
                    &env,
                    self_addr.clone().into_val(&env),
                    manager.clone().into_val(&env),
                    s.amount_in.into_val(&env),
                ];
                let _ = env.invoke_contract::<()>(&s.asset_in.contract, &symbol_short!("transfer"), args_transfer);
                internal_steps.push_back(RouterStep {
                    adapter: s.adapter,
                    pool_id: s.pool_id,
                    amount_in: s.amount_in,
                    min_out: s.min_out,
                    asset_out: s.asset_out.clone(),
                });
            }
        }

        if internal_steps.len() > 0 {
            let args = vec![
                &env,
                manager.clone().into_val(&env),
                internal_steps.into_val(&env),
            ];
            let out_internal: i128 = env.invoke_contract(&router_internal, &symbol_short!("execute"), args);
            // Forward proceeds from manager back to vault
            let mut last_asset: Option<Asset> = None;
            for s in steps.iter() { last_asset = Some(s.asset_out.clone()); }
            if let Some(asset) = last_asset {
                let args = vec![
                    &env,
                    manager.clone().into_val(&env),
                    self_addr.clone().into_val(&env),
                    out_internal.into_val(&env),
                ];
                let _ = env.invoke_contract::<()>(&asset.contract, &symbol_short!("transfer"), args);
            }
            total_out += out_internal;
        }

        // Update AUM with total_out as placeholder profit
        let aum: i128 = store.get(&DataKey::Aum).unwrap_or(0);
        store.set(&DataKey::Aum, &(aum + total_out));
        env.events().publish((EVENT_PROFIT,), (total_out, steps.len() as u32));
        total_out
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


