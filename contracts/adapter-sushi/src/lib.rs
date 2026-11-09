#![no_std]
use soroban_sdk::{auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation}, contract, contractimpl, contracttype, symbol_short, token, vec, Address, Env, IntoVal, Symbol, U256};

#[derive(Clone)]
#[contracttype]
pub enum DataKey { Admin, Factory, Route(u128), Caller(Address) }

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct SushiPoolRoute {
    pub pool: Address,
    pub token_in: Address,
    pub token_out: Address,
    pub fee: u32,
}

// ABI pinned to Sushi's official Stellar pool bindings, not an EVM router.
#[derive(Clone)]
#[contracttype]
pub struct OracleHints { pub checkpoint: u32, pub checkpoint_min: u32, pub slot: u128 }
#[derive(Clone)]
#[contracttype]
pub struct SwapResult {
    pub amount0: i128, pub amount1: i128, pub liquidity: u128,
    pub sqrt_price_x96: U256, pub tick: i32,
}

#[contract]
pub struct SushiAdapter;

#[contractimpl]
impl SushiAdapter {
    /// Immutable code and factory. Admin may be a governance contract; there is
    /// no upgrade entrypoint, bootstrap bypass, allowance or implicit owner.
    pub fn __constructor(env: Env, admin: Address, factory: Address) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Factory, &factory);
    }

    fn authenticate(env: &Env, caller: &Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        assert!(*caller == admin, "only_admin");
        caller.require_auth();
    }

    fn validate_pool(env: &Env, route: &SushiPoolRoute) -> bool {
        assert!(route.token_in != route.token_out, "identical_tokens");
        let factory: Address = env.storage().instance().get(&DataKey::Factory).unwrap();
        let actual_factory: Address = env.invoke_contract(&route.pool, &symbol_short!("factory"), vec![env]);
        let token0: Address = env.invoke_contract(&route.pool, &symbol_short!("token0"), vec![env]);
        let token1: Address = env.invoke_contract(&route.pool, &symbol_short!("token1"), vec![env]);
        let fee: u32 = env.invoke_contract(&route.pool, &symbol_short!("fee"), vec![env]);
        assert!(factory == actual_factory && fee == route.fee, "pool_identity_changed");
        assert!((route.token_in == token0 && route.token_out == token1) || (route.token_in == token1 && route.token_out == token0), "pool_tokens_changed");
        let registered: Option<Address> = env.invoke_contract(&factory, &symbol_short!("get_pool"), vec![env, token0.into_val(env), token1.into_val(env), fee.into_val(env)]);
        assert!(registered == Some(route.pool.clone()), "pool_not_registered");
        let paused: bool = env.invoke_contract(&route.pool, &symbol_short!("is_paused"), vec![env]);
        assert!(!paused, "pool_paused");
        route.token_in == token0
    }

    pub fn set_pool_route(env: Env, caller: Address, pool_id: u128, route: SushiPoolRoute) {
        Self::authenticate(&env, &caller);
        Self::validate_pool(&env, &route);
        // A route ID has one immutable meaning. Use a new ID and a new reviewed
        // vault binding for a different pool/path, rather than retargeting it.
        assert!(!env.storage().persistent().has(&DataKey::Route(pool_id)), "route_already_configured");
        env.storage().persistent().set(&DataKey::Route(pool_id), &route);
        env.events().publish((symbol_short!("sushir"),), (pool_id, route));
    }

    pub fn set_caller(env: Env, admin: Address, caller: Address, allowed: bool) {
        Self::authenticate(&env, &admin);
        env.storage().persistent().set(&DataKey::Caller(caller.clone()), &allowed);
        env.events().publish((symbol_short!("sushic"),), (caller, allowed));
    }

    pub fn is_caller(env: Env, caller: Address) -> bool {
        let key = DataKey::Caller(caller);
        if !env.storage().persistent().has(&key) { return false; }
        let max = env.storage().max_ttl();
        if max > 0 { env.storage().persistent().extend_ttl(&key, core::cmp::max(max / 2, 1), max); }
        env.storage().persistent().get(&key).unwrap_or(false)
    }

    pub fn factory(env: Env) -> Address { env.storage().instance().get(&DataKey::Factory).unwrap() }

    pub fn pool_route(env: Env, pool_id: u128) -> SushiPoolRoute {
        let key = DataKey::Route(pool_id);
        let route = env.storage().persistent().get(&key).expect("route_not_configured");
        let max = env.storage().max_ttl();
        if max > 0 { env.storage().persistent().extend_ttl(&key, core::cmp::max(max / 2, 1), max); }
        route
    }

    /// Existing Arka internal-router ABI. Input is prefunded atomically by the
    /// vault; output is measured, then only that new output is returned.
    pub fn execute(env: Env, caller: Address, pool_id: u128, amount_in: i128, min_out: i128, receiver: Address) -> i128 {
        caller.require_auth();
        assert!(Self::is_caller(env.clone(), caller.clone()), "caller_not_allowed");
        assert!(amount_in > 0 && min_out > 0, "positive_amounts_required");
        assert!(caller == receiver, "receiver_must_be_caller");
        let route = Self::pool_route(env.clone(), pool_id);
        let zero_for_one = Self::validate_pool(&env, &route);
        let me = env.current_contract_address();
        let input = token::TokenClient::new(&env, &route.token_in);
        let output = token::TokenClient::new(&env, &route.token_out);
        let input_before = input.balance(&me);
        let output_before = output.balance(&me);
        assert!(input_before >= amount_in, "input_not_prefunded");
        let limit = if zero_for_one { U256::from_parts(&env, 0, 0, 0, 4_295_128_740) }
            else { U256::from_parts(&env, 0, 4_294_805_859, 17_280_870_778_742_802_505, 6_743_328_256_752_651_557) };
        let hints: OracleHints = env.invoke_contract(&route.pool, &Symbol::new(&env, "get_oracle_hints"), vec![&env]);
        let args = vec![&env, me.clone().into_val(&env), me.clone().into_val(&env), zero_for_one.into_val(&env), amount_in.into_val(&env), limit.into_val(&env), hints.into_val(&env)];
        let transfer = InvokerContractAuthEntry::Contract(SubContractInvocation {
            context: ContractContext { contract: route.token_in.clone(), fn_name: symbol_short!("transfer"), args: vec![&env, me.clone().into_val(&env), route.pool.clone().into_val(&env), amount_in.into_val(&env)] },
            sub_invocations: vec![&env],
        });
        // Hints/identity reads happen BEFORE this exact, bounded authorization.
        // The immediate pool call already has invoker-contract authorization.
        // Its nested token transfer needs a separate, exact authorization.
        env.authorize_as_current_contract(vec![&env, transfer]);
        let result: SwapResult = env.invoke_contract(&route.pool, &symbol_short!("swap"), args);
        let spent = input_before.checked_sub(input.balance(&me)).expect("input_delta_overflow");
        let received = output.balance(&me).checked_sub(output_before).expect("output_delta_overflow");
        let (reported_in, reported_out) = if zero_for_one { (result.amount0, result.amount1) } else { (result.amount1, result.amount0) };
        assert!(spent == amount_in && reported_in == amount_in, "partial_or_invalid_input");
        assert!(reported_out.checked_neg() == Some(received) && received >= min_out && received > 0, "invalid_received_output");
        output.transfer(&me, &receiver, &received);
        assert!(output.balance(&me) == output_before, "output_dust_changed");
        received
    }
}

#[cfg(test)]
mod test;
