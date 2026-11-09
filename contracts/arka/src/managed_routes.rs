//! Experimental additive V3 route bindings. Never alters the legacy dispatcher.
//! Stored routes pin the actual adapter configuration, not a guessed pool id.
use super::*;
use soroban_sdk::xdr::ToXdr;

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum ManagedRouteFamily { Soroswap, Aquarius, AquariusVault, SoroswapVault, Sushi }

#[derive(Clone, Debug, Eq, PartialEq)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct ManagedRouteBinding {
    pub family: ManagedRouteFamily,
    pub adapter: Address,
    pub executor: Address,
    pub venue: Address,
    pub pool_id: u128,
    pub path: Vec<Address>,
    pub config_hash: BytesN<32>,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_ManagedRouteBinding {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct ManagedRouteBinding {
    pub family: ManagedRouteFamily,
    pub adapter: Address,
    pub executor: Address,
    pub venue: Address,
    pub pool_id: u128,
    pub path: Vec<Address>,
    pub config_hash: BytesN<32>,
}
}
crate::compact_codec::record!(ManagedRouteBinding, __wire_spec_ManagedRouteBinding::ManagedRouteBinding; (0, adapter, Address), (1, config_hash, BytesN<32>), (2, executor, Address), (3, family, ManagedRouteFamily), (4, path, Vec<Address>), (5, pool_id, u128), (6, venue, Address));

// Exact public adapter ABI mirrors. External configuration is re-read on EACH
// invocation; a governance route change cannot silently change our pinned path.
#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct ManagedAquariusRoute {
    pub token_in: Address, pub token_out: Address,
    pub tokens: Vec<Address>, pub pool_index: BytesN<32>,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_ManagedAquariusRoute {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct ManagedAquariusRoute {
    pub token_in: Address, pub token_out: Address,
    pub tokens: Vec<Address>, pub pool_index: BytesN<32>,
}
}
crate::compact_codec::record!(ManagedAquariusRoute, __wire_spec_ManagedAquariusRoute::ManagedAquariusRoute; (0, pool_index, BytesN<32>), (1, token_in, Address), (2, token_out, Address), (3, tokens, Vec<Address>));
#[derive(Clone)]
#[cfg_attr(not(target_family = "wasm"), soroban_sdk::contracttype)]
pub struct ManagedSushiRoute {
    pub pool: Address, pub token_in: Address, pub token_out: Address,
    pub fee: u32,
}
#[allow(non_snake_case, dead_code)]
#[cfg(target_family = "wasm")]
mod __wire_spec_ManagedSushiRoute {
 use super::*;
 #[soroban_sdk::contracttype]
 pub struct ManagedSushiRoute {
    pub pool: Address, pub token_in: Address, pub token_out: Address,
    pub fee: u32,
}
}
crate::compact_codec::record!(ManagedSushiRoute, __wire_spec_ManagedSushiRoute::ManagedSushiRoute; (0, fee, u32), (1, pool, Address), (2, token_in, Address), (3, token_out, Address));

impl ArkaContract {
    pub(super) fn managed_route_bindings(env: &Env) -> Vec<ManagedRouteBinding> {
        crate::compact_storage::instance(&env).get(&DataKey::ManagedRouteBindings).unwrap_or(Vec::new(env))
    }
    pub(super) fn managed_bindings_init(env: &Env, _caller: &Address, bindings: &Vec<ManagedRouteBinding>) {
        // Only called immediately before managed_enable_portfolio, which
        // authenticates the same root invocation. Requiring twice in one host
        // frame is invalid; failure there atomically rolls back this storage.
        Self::managed_assert_legacy_mode(env);
        if crate::compact_storage::instance(&env).has(&DataKey::ManagedRouteBindings) {
            panic_with_error!(env, Error::ManagedPolicyLocked);
        }
        for b in bindings.iter() { Self::managed_validate_binding(env, &b, false); }
        crate::compact_storage::instance(&env).set(&DataKey::ManagedRouteBindings, bindings);
    }
    pub(super) fn managed_validate_binding(env: &Env, b: &ManagedRouteBinding, auto: bool) {
        let internal: Address = crate::compact_storage::instance(&env).get(&DataKey::Router)
            .unwrap_or_else(|| panic_with_error!(env, Error::RouterNotSet));
        let executor_valid = if b.family == ManagedRouteFamily::AquariusVault || b.family == ManagedRouteFamily::SoroswapVault {
            b.executor == b.adapter
        } else { b.executor == internal };
        if !executor_valid || b.adapter == internal || b.path.len() < 2 {
            panic_with_error!(env, Error::ManagedUnsupported);
        }
        Self::assert_address_allowed_or_fail(env, Self::read_allowed_adapters_internal(env), &b.adapter);
        if auto { Self::assert_global_venue_auto_allowed(env, &b.adapter); }
        else { Self::assert_global_venue_allowed(env, &b.adapter); }
        for asset in b.path.iter() { Self::assert_asset_allowed(env, &asset); }
        match b.family {
            ManagedRouteFamily::Soroswap | ManagedRouteFamily::SoroswapVault => {
                if b.family == ManagedRouteFamily::SoroswapVault && b.path.len() != 2 {
                    panic_with_error!(env, Error::ManagedUnsupported);
                }
                let path: Vec<Address> = env.invoke_contract(&b.adapter, &Symbol::new(env, "path_for_pool"), vec![env, b.pool_id.into_val(env)]);
                let router: Address = env.invoke_contract(&b.adapter, &symbol_short!("router"), vec![env]);
                if path != b.path || router != b.venue || env.crypto().sha256(&path.to_xdr(env)).to_bytes() != b.config_hash { panic_with_error!(env, Error::ManagedUnsupported); }
            },
            ManagedRouteFamily::Aquarius | ManagedRouteFamily::AquariusVault => {
                let route: ManagedAquariusRoute = env.invoke_contract(&b.adapter, &Symbol::new(env, "pool_route"), vec![env, b.pool_id.into_val(env)]);
                let router: Address = env.invoke_contract(&b.adapter, &symbol_short!("router"), vec![env]);
                if router != b.venue || env.crypto().sha256(&route.clone().to_xdr(env)).to_bytes() != b.config_hash { panic_with_error!(env, Error::ManagedUnsupported); }
                if b.path.len() != 2 || route.token_in != b.path.first().unwrap() || route.token_out != b.path.last().unwrap()
                    || !route.tokens.contains(&route.token_in) || !route.tokens.contains(&route.token_out) {
                    panic_with_error!(env, Error::ManagedUnsupported);
                }
            },
            ManagedRouteFamily::Sushi => {
                let route: ManagedSushiRoute = env.invoke_contract(&b.adapter, &Symbol::new(env, "pool_route"), vec![env, b.pool_id.into_val(env)]);
                if route.pool != b.venue || env.crypto().sha256(&route.clone().to_xdr(env)).to_bytes() != b.config_hash { panic_with_error!(env, Error::ManagedUnsupported); }
                if b.path.len() != 2 || route.token_in != b.path.first().unwrap() || route.token_out != b.path.last().unwrap() {
                    panic_with_error!(env, Error::ManagedUnsupported);
                }
            },
        }
    }
    pub(super) fn managed_binding_for(env: &Env, s: &SwapStep) -> Option<ManagedRouteBinding> {
        Self::managed_route_bindings(env).iter().find(|b| b.executor == s.router_addr && b.adapter == s.adapter && b.pool_id == s.pool_id
            && b.path.first() == Some(s.asset_in.contract.clone()) && b.path.last() == Some(s.asset_out.contract.clone()))
    }
    pub(super) fn managed_route_admitted(env: &Env, route: &ManagedSpotRoute) {
        let denom = Self::denomination(env.clone()).contract;
        let bindings = Self::managed_route_bindings(env);
        if bindings.iter().any(|b| b.executor == route.router &&
            ((b.path.first() == Some(route.asset.clone()) && b.path.last() == Some(denom.clone())) ||
             (b.path.last() == Some(route.asset.clone()) && b.path.first() == Some(denom.clone())))) {
            for b in bindings.iter().filter(|b| b.executor == route.router && (b.path.first() == Some(route.asset.clone()) || b.path.last() == Some(route.asset.clone()))) {
                Self::managed_validate_binding(env, &b, false);
            }
        } else { Self::assert_global_venue_allowed(env, &route.router); }
    }
    pub(super) fn managed_bound_step(env: &Env, mut s: SwapStep) -> SwapStep {
        let bindings = Self::managed_route_bindings(env);
        if let Some(b) = bindings.iter().find(|b| b.path.first() == Some(s.asset_in.contract.clone()) && b.path.last() == Some(s.asset_out.contract.clone())) {
            s.adapter = b.adapter; s.pool_id = b.pool_id; s.router_addr = b.executor;
        } else if bindings.iter().any(|b| b.executor == s.router_addr) {
            panic_with_error!(env, Error::ManagedUnsupported);
        }
        s
    }
    pub(super) fn managed_execute_bound(env: &Env, b: &ManagedRouteBinding, s: &SwapStep) {
        Self::managed_validate_binding(env, b, false);
        let vault = env.current_contract_address();
        let input = &s.asset_in.contract;
        let before_adapter_in = Self::token_balance(env, input, &b.adapter);
        let before_adapter_out = Self::token_balance(env, &s.asset_out.contract, &b.adapter);
        let before_executor_in = Self::token_balance(env, input, &b.executor);
        let before_executor_out = Self::token_balance(env, &s.asset_out.contract, &b.executor);
        // Public adapters that retain a spending approval are NOT silently
        // accepted: the vault cannot revoke an allowance owned by an adapter.
        let allowance = soroban_sdk::token::Client::new(env, input).allowance(&b.adapter, &b.venue);
        if allowance != 0 { panic_with_error!(env, Error::ManagedUnsupported); }
        if b.family == ManagedRouteFamily::SoroswapVault {
            // The admitted adapter supplies the pinned path; debit the vault
            // directly through the real router, without an adapter approval.
            let pool: Address = env.invoke_contract(&b.venue,
                &Symbol::new(env, "router_pair_for"),
                vec![env, input.clone().into_val(env), s.asset_out.contract.clone().into_val(env)]);
            let args = vec![env, s.amount_in.into_val(env), s.min_out.into_val(env),
                b.path.clone().into_val(env), vault.clone().into_val(env),
                env.ledger().timestamp().checked_add(1800).unwrap().into_val(env)];
            let auth = |contract: Address, name: &str, args: Vec<Val>| InvokerContractAuthEntry::Contract(SubContractInvocation {
                context: ContractContext { contract, fn_name: Symbol::new(env, name), args }, sub_invocations: vec![env] });
            env.authorize_as_current_contract(vec![env,
                auth(b.venue.clone(), "swap_exact_tokens_for_tokens", args.clone()),
                auth(input.clone(), "transfer", vec![env, vault.clone().into_val(env), pool.into_val(env), s.amount_in.into_val(env)])]);
            let _: Vec<i128> = env.invoke_contract(&b.venue,
                &Symbol::new(env, "swap_exact_tokens_for_tokens"), args);
        } else if b.family == ManagedRouteFamily::AquariusVault {
            // Existing admitted adapter API: router/pool debit the vault under
            // exact contract authorizations. No prefund and no approval owned
            // by the adapter needs to be revoked by a different contract.
            let route: ManagedAquariusRoute = env.invoke_contract(&b.adapter, &Symbol::new(env, "pool_route"), vec![env, b.pool_id.into_val(env)]);
            let pool: Address = env.invoke_contract(&b.venue, &symbol_short!("get_pool"), vec![env, route.tokens.clone().into_val(env), route.pool_index.clone().into_val(env)]);
            let in_index = route.tokens.first_index_of(route.token_in.clone()).unwrap_or_else(|| panic_with_error!(env, Error::ManagedUnsupported));
            let out_index = route.tokens.first_index_of(route.token_out.clone()).unwrap_or_else(|| panic_with_error!(env, Error::ManagedUnsupported));
            let router_args = vec![env, vault.clone().into_val(env), route.tokens.clone().into_val(env), route.token_in.clone().into_val(env), route.token_out.clone().into_val(env), route.pool_index.clone().into_val(env), (s.amount_in as u128).into_val(env), (s.min_out as u128).into_val(env)];
            let pool_args = vec![env, vault.clone().into_val(env), in_index.into_val(env), out_index.into_val(env), (s.amount_in as u128).into_val(env), (s.min_out as u128).into_val(env)];
            let transfer_args = vec![env, vault.clone().into_val(env), pool.into_val(env), s.amount_in.into_val(env)];
            let auth = |contract: Address, name: &str, args: Vec<Val>| InvokerContractAuthEntry::Contract(SubContractInvocation { context:ContractContext {contract,fn_name:Symbol::new(env,name),args},sub_invocations:vec![env] });
            env.authorize_as_current_contract(vec![env, auth(b.venue.clone(),"swap",router_args),auth(pool.clone(),"swap",pool_args),auth(input.clone(),"transfer",transfer_args)]);
            let _: i128 = env.invoke_contract(&b.adapter, &Symbol::new(env,"swap_with_tokens"),vec![env,vault.clone().into_val(env),route.token_in.into_val(env),route.token_out.into_val(env),route.tokens.into_val(env),route.pool_index.into_val(env),s.amount_in.into_val(env),s.min_out.into_val(env),vault.into_val(env)]);
        } else {
        Self::invoke_with_contract_auth::<()>(env, input, "transfer", vec![env, vault.clone().into_val(env), b.adapter.clone().into_val(env), s.amount_in.into_val(env)]);
        // The adapter requires the VAULT, not the manager, in the nested auth.
        let auth = InvokerContractAuthEntry::Contract(SubContractInvocation {
            context: ContractContext {contract: b.adapter.clone(), fn_name: symbol_short!("execute"), args: vec![env, vault.clone().into_val(env), b.pool_id.into_val(env), s.amount_in.into_val(env), s.min_out.into_val(env), vault.clone().into_val(env)]},
            sub_invocations: vec![env],
        });
        env.authorize_as_current_contract(vec![env, auth]);
        // One measured leg at a time: router's sum-of-outputs is NOT cash.
        let _: i128 = env.invoke_contract(&b.executor, &Symbol::new(env, "execute_for"), vec![env, vault.clone().into_val(env), vault.clone().into_val(env), vec![env, RouterStep {adapter:b.adapter.clone(), pool_id:b.pool_id, amount_in:s.amount_in, min_out:s.min_out, asset_out:s.asset_out.clone()}].into_val(env)]);
        }
        if Self::token_balance(env, input, &b.adapter) != before_adapter_in || Self::token_balance(env, &s.asset_out.contract, &b.adapter) != before_adapter_out
            || Self::token_balance(env, input, &b.executor) != before_executor_in || Self::token_balance(env, &s.asset_out.contract, &b.executor) != before_executor_out
            || soroban_sdk::token::Client::new(env, input).allowance(&b.adapter, &b.venue) != 0 {
            panic_with_error!(env, Error::ManagedUnsupported);
        }
    }
}
