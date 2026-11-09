//! Additive routed-V3 creation. Legacy factory entrypoints/digests are unchanged.
//! The existing V3 bytecode validates every adapter/hash/venue and every guard.
use super::*;

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum ManagedRouteFamily { Soroswap, Aquarius, AquariusVault, SoroswapVault, Sushi }

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct ManagedRouteBinding {
    pub family: ManagedRouteFamily,
    pub adapter: Address,
    pub executor: Address,
    pub venue: Address,
    pub pool_id: u128,
    pub path: Vec<Address>,
    pub config_hash: BytesN<32>,
}

#[contractimpl]
impl ArkaFactory {
    /// Same governance authority as the existing managed/portfolio templates.
    /// No external adapter, oracle, registry, policy or current fund is changed.
    pub fn set_managed_routes_template(env: Env, caller: Address, bindings: Vec<ManagedRouteBinding>) {
        Self::require_bootstrap_or_governor_auth(&env, &caller);
        env.storage().instance().set(&DataKey::ManagedRoutesTemplate, &bindings);
        env.events().publish((Symbol::new(&env, "managed_routes_template"),), bindings);
    }

    pub fn managed_routes_template(env: Env) -> Option<Vec<ManagedRouteBinding>> {
        env.storage().instance().get(&DataKey::ManagedRoutesTemplate)
    }

    /// Separate digest: a routed review pins both the old configuration and the
    /// complete directional bindings. Existing V2/legacy digests keep their ABI.
    pub fn managed_routes_template_digest(env: Env) -> Option<BytesN<32>> {
        let base = Self::managed_template_digest(env.clone())?;
        let bindings = Self::managed_routes_template(env.clone())?;
        Some(env.crypto().sha256(&(base, bindings).to_xdr(&env)).into())
    }

    pub fn create_managed_routes(env: Env, salt: Bytes, manager: Address, config: ManagedCreateConfig) -> Address {
        let store = env.storage().instance();
        let template: ManagedTemplate = store.get(&DataKey::ManagedTemplate)
            .unwrap_or_else(|| panic_with_error!(&env, Error::ManagedCreationDisabled));
        if !template.enabled || !store.has(&DataKey::ShareTokenImplementation) {
            panic_with_error!(&env, Error::ManagedCreationDisabled);
        }
        let portfolio = Self::portfolio_creation_template(env.clone())
            .unwrap_or_else(|| panic_with_error!(&env, Error::InvalidManagedTemplate));
        let bindings = Self::managed_routes_template(env.clone())
            .unwrap_or_else(|| panic_with_error!(&env, Error::InvalidManagedTemplate));
        let digest = Self::managed_routes_template_digest(env.clone()).unwrap();
        if config.template_hash != digest || config.denomination != template.denomination
            || salt.len() != 32 || !store.has(&DataKey::DefaultValuationOracle) {
            panic_with_error!(&env, Error::InvalidManagedTemplate);
        }
        // Structural completeness, not a new price/size/fee policy. Both sides
        // of every portfolio route must be pinned before the fund is published.
        for route in portfolio.routes.iter() {
            for reverse in [false, true] {
                let first = if reverse { template.denomination.clone() } else { route.asset.clone() };
                let last = if reverse { route.asset.clone() } else { template.denomination.clone() };
                if !bindings.iter().any(|b| b.executor == route.router
                    && b.path.first() == Some(first.clone()) && b.path.last() == Some(last.clone())) {
                    panic_with_error!(&env, Error::InvalidManagedTemplate);
                }
            }
        }
        for binding in bindings.iter() {
            if binding.path.len() < 2 || !portfolio.routes.iter().any(|r| r.router == binding.executor
                && ((binding.path.first() == Some(r.asset.clone()) && binding.path.last() == Some(template.denomination.clone()))
                    || (binding.path.last() == Some(r.asset.clone()) && binding.path.first() == Some(template.denomination.clone())))) {
                panic_with_error!(&env, Error::InvalidManagedTemplate);
            }
        }
        let hash: BytesN<32> = env.crypto().sha256(&(env.current_contract_address(), manager.clone(), salt).to_xdr(&env)).into();
        let mut whitelist = vec![&env, config.denomination.clone()];
        for route in portfolio.routes.iter() { whitelist.push_back(route.asset); }
        Self::create_and_init_internal(env.clone(), Bytes::from_array(&env, &hash.to_array()), manager,
            config.denomination, config.mgmt_bps, config.perf_bps, config.deposit_bps, 0, whitelist,
            config.router, true, Some(template.policy), Some(portfolio), Some(bindings))
    }
}
