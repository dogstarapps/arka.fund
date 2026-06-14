#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, Address,
    BytesN, Env, IntoVal, TryFromVal, Val, Vec,
};

pub const STATUS_DISABLED: u32 = 0;
pub const STATUS_MANUAL_ONLY: u32 = 1;
pub const STATUS_AUTO: u32 = 2;
pub const STATUS_DEPRECATED: u32 = 3;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    BootstrapAdmin,
    BootstrapAdminExpiresAt,
    Governor,
    Guardian,
    Venue(Address),
    Venues,
    LastWasmHash,
}

#[derive(Clone)]
#[contracttype]
pub struct VenueConfig {
    pub status: u32,
    pub updated_at: u64,
    pub updated_by: Address,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,
    Unauthorized = 2,
    InvalidBootstrapAdmin = 3,
    InvalidVenueStatus = 4,
    VenueNotConfigured = 5,
}

const MAX_BOOTSTRAP_ADMIN_SECONDS: u64 = 365 * 24 * 60 * 60;

#[contract]
pub struct VenueRegistry;

#[contractimpl]
impl VenueRegistry {
    fn bump_dynamic_key(env: &Env, key: &DataKey) {
        let max_ttl = env.storage().max_ttl();
        if max_ttl == 0 {
            return;
        }
        let store = env.storage().persistent();
        if store.has(key) {
            let threshold = core::cmp::max(max_ttl / 2, 1);
            store.extend_ttl(key, threshold, max_ttl);
        }
    }

    fn dynamic_get<T>(env: &Env, key: &DataKey) -> Option<T>
    where
        T: TryFromVal<Env, Val> + IntoVal<Env, Val>,
    {
        let persistent = env.storage().persistent();
        if let Some(value) = persistent.get::<DataKey, T>(key) {
            Self::bump_dynamic_key(env, key);
            return Some(value);
        }
        let legacy = env.storage().instance().get::<DataKey, T>(key);
        if let Some(value) = legacy {
            persistent.set(key, &value);
            env.storage().instance().remove(key);
            Self::bump_dynamic_key(env, key);
            return Some(value);
        }
        None
    }

    fn dynamic_set<T>(env: &Env, key: &DataKey, value: &T)
    where
        T: IntoVal<Env, Val>,
    {
        env.storage().persistent().set(key, value);
        env.storage().instance().remove(key);
        Self::bump_dynamic_key(env, key);
    }

    fn bootstrap_admin_active_internal(env: &Env) -> bool {
        let Some(expires_at) = env
            .storage()
            .instance()
            .get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
        else {
            return false;
        };
        env.ledger().timestamp() <= expires_at
    }

    fn require_future_bootstrap_expiry(env: &Env, expires_at: u64) {
        let now = env.ledger().timestamp();
        if expires_at <= now || expires_at.saturating_sub(now) > MAX_BOOTSTRAP_ADMIN_SECONDS {
            panic_with_error!(env, Error::InvalidBootstrapAdmin);
        }
    }

    fn require_bootstrap_or_governor_auth(env: &Env, caller: &Address) {
        let store = env.storage().instance();
        if Self::bootstrap_admin_active_internal(env) {
            if let Some(admin) = store.get::<DataKey, Address>(&DataKey::BootstrapAdmin) {
                if *caller == admin {
                    caller.require_auth();
                    return;
                }
            }
        }
        if let Some(governor) = store.get::<DataKey, Address>(&DataKey::Governor) {
            if *caller == governor {
                caller.require_auth();
                return;
            }
        }
        panic_with_error!(env, Error::Unauthorized);
    }

    fn require_governor_auth(env: &Env, caller: &Address) {
        let Some(governor) = env
            .storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::Governor)
        else {
            panic_with_error!(env, Error::Unauthorized);
        };
        if *caller != governor {
            panic_with_error!(env, Error::Unauthorized);
        }
        caller.require_auth();
    }

    fn require_disable_auth(env: &Env, caller: &Address) {
        let store = env.storage().instance();
        if let Some(guardian) = store.get::<DataKey, Address>(&DataKey::Guardian) {
            if *caller == guardian {
                caller.require_auth();
                return;
            }
        }
        Self::require_bootstrap_or_governor_auth(env, caller);
    }

    fn assert_valid_status(env: &Env, status: u32) {
        if status > STATUS_DEPRECATED {
            panic_with_error!(env, Error::InvalidVenueStatus);
        }
    }

    fn upsert_venue(env: &Env, caller: &Address, venue: &Address, status: u32) {
        Self::assert_valid_status(env, status);
        let mut venues = Self::dynamic_get::<Vec<Address>>(env, &DataKey::Venues)
            .unwrap_or_else(|| Vec::new(env));
        let mut exists = false;
        for stored in venues.iter() {
            if stored == *venue {
                exists = true;
                break;
            }
        }
        if !exists {
            venues.push_back(venue.clone());
            Self::dynamic_set(env, &DataKey::Venues, &venues);
        }
        let config = VenueConfig {
            status,
            updated_at: env.ledger().timestamp(),
            updated_by: caller.clone(),
        };
        Self::dynamic_set(env, &DataKey::Venue(venue.clone()), &config);
    }

    pub fn init(env: Env, admin: Address, governor: Option<Address>, expires_at: u64) {
        admin.require_auth();
        let store = env.storage().instance();
        if store.has(&DataKey::BootstrapAdmin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        Self::require_future_bootstrap_expiry(&env, expires_at);
        store.set(&DataKey::BootstrapAdmin, &admin);
        store.set(&DataKey::Governor, &governor);
        store.set(&DataKey::BootstrapAdminExpiresAt, &expires_at);
        Self::dynamic_set(&env, &DataKey::Venues, &Vec::<Address>::new(&env));
    }

    pub fn set_bootstrap_admin(env: Env, caller: Address, admin: Address, expires_at: u64) {
        Self::require_bootstrap_or_governor_auth(&env, &caller);
        Self::require_future_bootstrap_expiry(&env, expires_at);
        let store = env.storage().instance();
        if let Some(current_expires_at) =
            store.get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
        {
            assert!(
                expires_at <= current_expires_at,
                "bootstrap_admin_expiry_locked"
            );
        }
        store.set(&DataKey::BootstrapAdmin, &admin);
        store.set(&DataKey::BootstrapAdminExpiresAt, &expires_at);
    }

    pub fn clear_bootstrap_admin(env: Env, caller: Address) {
        Self::require_governor_auth(&env, &caller);
        let store = env.storage().instance();
        store.remove(&DataKey::BootstrapAdmin);
        store.remove(&DataKey::BootstrapAdminExpiresAt);
    }

    pub fn set_governor(env: Env, caller: Address, governor: Option<Address>) {
        Self::require_bootstrap_or_governor_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Governor, &governor);
    }

    pub fn set_guardian(env: Env, caller: Address, guardian: Option<Address>) {
        Self::require_bootstrap_or_governor_auth(&env, &caller);
        env.storage().instance().set(&DataKey::Guardian, &guardian);
    }

    pub fn set_venue_status(env: Env, caller: Address, venue: Address, status: u32) {
        Self::require_bootstrap_or_governor_auth(&env, &caller);
        Self::upsert_venue(&env, &caller, &venue, status);
        env.events()
            .publish((symbol_short!("venue"),), (caller, venue, status));
    }

    pub fn disable_venue(env: Env, caller: Address, venue: Address) {
        Self::require_disable_auth(&env, &caller);
        Self::upsert_venue(&env, &caller, &venue, STATUS_DISABLED);
        env.events()
            .publish((symbol_short!("vdisable"),), (caller, venue));
    }

    pub fn venue_config(env: Env, venue: Address) -> Option<VenueConfig> {
        Self::dynamic_get(&env, &DataKey::Venue(venue))
    }

    pub fn is_configured(env: Env, venue: Address) -> bool {
        Self::dynamic_get::<VenueConfig>(&env, &DataKey::Venue(venue)).is_some()
    }

    pub fn is_allowed(env: Env, venue: Address) -> bool {
        match Self::dynamic_get::<VenueConfig>(&env, &DataKey::Venue(venue)) {
            Some(config) => config.status == STATUS_MANUAL_ONLY || config.status == STATUS_AUTO,
            None => false,
        }
    }

    pub fn is_auto_allowed(env: Env, venue: Address) -> bool {
        match Self::dynamic_get::<VenueConfig>(&env, &DataKey::Venue(venue)) {
            Some(config) => config.status == STATUS_AUTO,
            None => false,
        }
    }

    pub fn venues(env: Env, offset: u32, limit: u32) -> Vec<Address> {
        let venues = Self::dynamic_get::<Vec<Address>>(&env, &DataKey::Venues)
            .unwrap_or_else(|| Vec::new(&env));
        let mut out = Vec::new(&env);
        let len = venues.len();
        let mut i = offset;
        let max = if limit == 0 { 50 } else { limit };
        while i < len && out.len() < max {
            out.push_back(venues.get_unchecked(i));
            i += 1;
        }
        out
    }

    pub fn bootstrap_admin(env: Env) -> Option<Address> {
        env.storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::BootstrapAdmin)
    }

    pub fn bootstrap_admin_expires_at(env: Env) -> Option<u64> {
        env.storage()
            .instance()
            .get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
    }

    pub fn bootstrap_admin_active(env: Env) -> bool {
        Self::bootstrap_admin_active_internal(&env)
    }

    pub fn governor(env: Env) -> Option<Address> {
        env.storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::Governor)
    }

    pub fn guardian(env: Env) -> Option<Address> {
        env.storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::Guardian)
    }

    pub fn upgrade(env: Env, caller: Address, new_wasm_hash: BytesN<32>) {
        Self::require_bootstrap_or_governor_auth(&env, &caller);
        env.storage()
            .instance()
            .set(&DataKey::LastWasmHash, &new_wasm_hash);
        env.events()
            .publish((symbol_short!("upgrade"),), new_wasm_hash.clone());
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    pub fn last_wasm_hash(env: Env) -> Option<BytesN<32>> {
        env.storage()
            .instance()
            .get::<DataKey, BytesN<32>>(&DataKey::LastWasmHash)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, testutils::Ledger, Env};

    #[test]
    fn governor_can_enable_disable_and_query_venues() {
        let env = Env::default();
        env.ledger().set_timestamp(1_000);
        let id = env.register_contract(None, VenueRegistry);
        let client = VenueRegistryClient::new(&env, &id);
        let admin = Address::generate(&env);
        let venue = Address::generate(&env);

        env.mock_all_auths();
        client.init(&admin, &Some(admin.clone()), &2_000);
        client.set_venue_status(&admin, &venue, &STATUS_AUTO);
        assert!(client.is_allowed(&venue));
        assert!(client.is_auto_allowed(&venue));
        assert_eq!(client.venues(&0, &10).len(), 1);

        client.disable_venue(&admin, &venue);
        assert!(!client.is_allowed(&venue));
        assert!(!client.is_auto_allowed(&venue));
    }

    #[test]
    fn guardian_can_only_disable() {
        let env = Env::default();
        env.ledger().set_timestamp(1_000);
        let id = env.register_contract(None, VenueRegistry);
        let client = VenueRegistryClient::new(&env, &id);
        let admin = Address::generate(&env);
        let guardian = Address::generate(&env);
        let venue = Address::generate(&env);

        env.mock_all_auths();
        client.init(&admin, &Some(admin.clone()), &2_000);
        client.set_guardian(&admin, &Some(guardian.clone()));
        client.set_venue_status(&admin, &venue, &STATUS_AUTO);
        client.disable_venue(&guardian, &venue);
        assert!(!client.is_allowed(&venue));
    }

    #[test]
    #[should_panic(expected = "bootstrap_admin_expiry_locked")]
    fn bootstrap_admin_cannot_extend_expiry() {
        let env = Env::default();
        env.ledger().set_timestamp(1_000);
        let id = env.register_contract(None, VenueRegistry);
        let client = VenueRegistryClient::new(&env, &id);
        let admin = Address::generate(&env);

        env.mock_all_auths();
        client.init(&admin, &Some(admin.clone()), &2_000);
        client.set_bootstrap_admin(&admin, &admin, &2_001);
    }
}
