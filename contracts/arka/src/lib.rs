#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol, Vec, IntoVal, vec};

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
    pub adapter_id: u32,
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
}

const EVENT_DEPOSIT: Symbol = symbol_short!("deposit");
const EVENT_REDEEM: Symbol = symbol_short!("redeem");
const EVENT_PROFIT: Symbol = symbol_short!("profit");

#[contract]
pub struct ArkaContract;

#[contractimpl]
impl ArkaContract {
    fn apply_fee_bps(amount: i128, fee_bps: i32) -> i128 {
        // fee_bps in [0,10000]; returns net amount after fee
        let bps = 10000i128 - (fee_bps as i128);
        (amount * bps) / 10000i128
    }

    pub fn init(env: Env, denomination: Asset, fees: FeeStructure, whitelist: Vec<Asset>, manager: Address) {
        let store = env.storage().instance();
        assert!(!store.has(&DataKey::Denomination), "already_initialized");
        store.set(&DataKey::Denomination, &denomination);
        store.set(&DataKey::Fees, &fees);
        store.set(&DataKey::Whitelist, &whitelist);
        store.set(&DataKey::Manager, &manager);
        store.set(&DataKey::TotalShares, &0i128);
        store.set(&DataKey::Aum, &0i128);
    }

    pub fn set_router(env: Env, caller: Address, router: Address) {
        let store = env.storage().instance();
        let mgr: Address = store.get(&DataKey::Manager).expect("not_initialized");
        assert!(caller == mgr, "only_manager");
        caller.require_auth();
        store.set(&DataKey::Router, &router);
    }

    pub fn deposit(env: Env, user: Address, asset: Asset, amount: i128) -> i128 {
        user.require_auth();
        assert!(amount > 0, "amount_zero");
        // Validate asset whitelist (placeholder contains check)
        let store = env.storage().instance();
        let wl: Vec<Asset> = store.get(&DataKey::Whitelist).unwrap_or(Vec::new(&env));
        let mut allowed = false;
        for a in wl.iter() {
            if a.contract == asset.contract { allowed = true; break; }
        }
        assert!(allowed, "asset_not_whitelisted");
        // Transfer tokens from user to this contract (expects token standard)
        let self_addr = env.current_contract_address();
        let args = vec![
            &env,
            user.clone().into_val(&env),
            self_addr.clone().into_val(&env),
            amount.into_val(&env),
        ];
        let _ = env.invoke_contract::<()>(&asset.contract, &symbol_short!("xfer_from"), args);
        // Compute shares based on NAV
        let fees: FeeStructure = store.get(&DataKey::Fees).unwrap_or(FeeStructure { mgmt_bps: 0, perf_bps: 0, deposit_bps: 0, redeem_bps: 0 });
        let net_amount = Self::apply_fee_bps(amount, fees.deposit_bps);
        let total: i128 = store.get(&DataKey::TotalShares).unwrap_or(0);
        let aum: i128 = store.get(&DataKey::Aum).unwrap_or(0);
        let shares_minted = if total == 0 || aum == 0 { net_amount } else { (net_amount * total) / aum };
        assert!(shares_minted > 0, "shares_zero");
        store.set(&DataKey::TotalShares, &(total + shares_minted));
        store.set(&DataKey::Aum, &(aum + net_amount));

        env.events().publish((EVENT_DEPOSIT,), (user.clone(), amount, shares_minted));
        shares_minted
    }

    pub fn redeem(env: Env, user: Address, shares: i128) -> i128 {
        user.require_auth();
        assert!(shares > 0, "shares_zero");
        let store = env.storage().instance();
        let total: i128 = store.get(&DataKey::TotalShares).unwrap_or(0);
        assert!(shares <= total, "insufficient_shares");
        let aum: i128 = store.get(&DataKey::Aum).unwrap_or(0);
        // proportional return in denomination asset (placeholder)
        let mut amount_out = if total == 0 { 0 } else { (shares * aum) / total };

        store.set(&DataKey::TotalShares, &(total - shares));
        // Apply redeem fee and update AUM with gross amount removed
        let fees: FeeStructure = store.get(&DataKey::Fees).unwrap_or(FeeStructure { mgmt_bps: 0, perf_bps: 0, deposit_bps: 0, redeem_bps: 0 });
        let net_out = Self::apply_fee_bps(amount_out, fees.redeem_bps);
        store.set(&DataKey::Aum, &(aum - amount_out));
        // Send denomination asset from vault to user
        let denom: Asset = store.get(&DataKey::Denomination).expect("not_initialized");
        let self_addr = env.current_contract_address();
        let args = vec![
            &env,
            self_addr.into_val(&env),
            user.clone().into_val(&env),
            net_out.into_val(&env),
        ];
        let _ = env.invoke_contract::<()>(&denom.contract, &symbol_short!("xfer"), args);
        env.events().publish((EVENT_REDEEM,), (user.clone(), shares, net_out));
        net_out
    }

    pub fn rebalance(env: Env, manager: Address, steps: Vec<SwapStep>) -> i128 {
        let store = env.storage().instance();
        let stored_manager: Address = store.get(&DataKey::Manager).expect("not_initialized");
        assert!(manager == stored_manager, "only_manager");
        manager.require_auth();

        let router: Address = store.get(&DataKey::Router).expect("router_not_set");
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
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{vec, testutils::Address as _, Address};

    fn asset(env: &Env) -> Asset { Asset { contract: Address::generate(env) } }
    fn manager(env: &Env) -> Address { Address::generate(env) }

    #[test]
    fn test_init_and_deposit_redeem() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ArkaContract);
        let client = ArkaContractClient::new(&env, &contract_id);

        let denom = asset(&env);
        let fees = FeeStructure { mgmt_bps: 0, perf_bps: 0, deposit_bps: 0, redeem_bps: 0 };
        let wl = vec![&env, denom.clone()];
        let mgr = manager(&env);
        client.init(&denom, &fees, &wl, &mgr);

        let user = Address::generate(&env);
        let amount: i128 = 100;
        let minted = client.deposit(&user, &denom, &amount);
        assert_eq!(minted, amount);

        let out = client.redeem(&user, &40);
        assert_eq!(out, 40);
    }
}


