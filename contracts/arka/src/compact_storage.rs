//! Storage encoding only. Existing keys, public ABI, values, authorization,
//! policy checks and TTL operations remain unchanged. Legacy maps read as-is.
//! Known record maps store their ordered values without repeating field names.
use crate::*;
use soroban_sdk::{EnvBase, Env, IntoVal, Map, Symbol, TryFromVal, Val, Vec};

pub(crate) struct Store { env: Env, persistent: bool }
pub(crate) fn instance(env: &Env) -> Store { Store { env: env.clone(), persistent: false } }
pub(crate) fn persistent(env: &Env) -> Store { Store { env: env.clone(), persistent: true } }

fn schema(env: &Env, key: &Val) -> Option<(&'static [u8], bool)> {
    let v = Vec::<Val>::try_from_val(env, key).ok()?;
    let name = Symbol::try_from_val(env, &v.first()?).ok()?;
    // Keys here originate exclusively from the closed DataKey enum (the raw
    // dynamic helpers encode that same enum). Include EVERY variant: the host
    // symbol-index syscall traps on a missing name, it is not a search/None.
    let index=u32::from(env.symbol_index_in_strs(name.to_symbol_val(),DataKey::KEY_NAMES).ok()?);
    match index {
        4=>Some((FeeStructure::COMPACT_KEYS,false)),
        7=>Some((FeeState::COMPACT_KEYS,false)),
        6=>Some((ProtocolFeePolicy::COMPACT_KEYS,false)),
        26=>Some((SwapRiskPolicy::COMPACT_KEYS,false)),
        28=>Some((ValuationOracleConfig::COMPACT_KEYS,false)),
        36=>Some((ManagedPolicy::COMPACT_KEYS,false)),
        37=>Some((ManagedPortfolioPolicy::COMPACT_KEYS,false)),
        42=>Some((ManagedRouteBinding::COMPACT_KEYS,true)),
        24=>Some((CreditMarketConfig::COMPACT_KEYS,false)),
        38=>Some((ManagedQueue::COMPACT_KEYS,false)),
        39=>Some((ManagedRequest::COMPACT_KEYS,false)),
        0=>Some((Asset::COMPACT_KEYS,false)),
        8=>Some((Asset::COMPACT_KEYS,true)),
        _=>None,
    }
}

fn record(env: &Env, value: Val, fields: &[u8], encode: bool) -> Val {
    if encode {
        // Do not erase unknown/new fields: retain the full map if its schema
        // differs. This is an encoding optimization, never a whitelist/cap.
        if let Ok(m) = Map::<Symbol,Val>::try_from_val(env, &value) {
            if m.len() != fields.len() as u32 { return value; }
            let mut values = Vec::<Val>::new(env);
            for field in fields { let Some(v) = m.get(Symbol::new(env, crate::compact_codec::field_name(*field))) else { return value; }; values.push_back(v); }
            return (soroban_sdk::symbol_short!("c1"), values).into_val(env);
        }
    } else if let Ok((tag, values)) = <(Symbol, Vec<Val>)>::try_from_val(env, &value) {
        if tag == soroban_sdk::symbol_short!("c1") {
            assert!(values.len() == fields.len() as u32, "compact_schema_mismatch");
            let mut m = Map::<Symbol,Val>::new(env);
            for (i, field) in fields.iter().enumerate() { m.set(Symbol::new(env, crate::compact_codec::field_name(*field)), values.get(i as u32).unwrap()); }
            return m.into_val(env);
        }
    }
    value
}
fn transform(env: &Env, key: &Val, value: Val, encode: bool) -> Val {
    let Some((fields, list)) = schema(env, key) else { return value; };
    if list {
        if let Ok(values) = Vec::<Val>::try_from_val(env, &value) {
            let mut next = Vec::<Val>::new(env);
            for item in values { next.push_back(record(env, item, fields, encode)); }
            return next.into_val(env);
        }
        value
    } else { record(env, value, fields, encode) }
}
impl Store {
    #[inline(never)]
    fn read_raw(&self,key:Val)->Option<Val>{
        let raw:Option<Val>=if self.persistent {self.env.storage().persistent().get(&key)}else{self.env.storage().instance().get(&key)};
        raw.map(|v|transform(&self.env,&key,v,false))
    }
    #[inline(never)]
    fn write_raw(&self,key:Val,value:Val){
        let raw=transform(&self.env,&key,value,true);
        if self.persistent {self.env.storage().persistent().set(&key,&raw)}else{self.env.storage().instance().set(&key,&raw)}
    }
    pub(crate) fn has<K: IntoVal<Env,Val>>(&self, key: &K) -> bool {
        if self.persistent { self.env.storage().persistent().has(key) } else { self.env.storage().instance().has(key) }
    }
    pub(crate) fn get<K: IntoVal<Env,Val>, V: TryFromVal<Env,Val>>(&self, key: &K) -> Option<V> {
        self.read_raw(key.into_val(&self.env)).map(|v| V::try_from_val(&self.env,&v).unwrap_or_else(|_|panic!("compact_value_type")))
    }
    pub(crate) fn set<K: IntoVal<Env,Val>, V: IntoVal<Env,Val>>(&self, key: &K, value: &V) {
        self.write_raw(key.into_val(&self.env),value.into_val(&self.env));
    }
    pub(crate) fn remove<K: IntoVal<Env,Val>>(&self, key: &K) {
        if self.persistent { self.env.storage().persistent().remove(key); } else { self.env.storage().instance().remove(key); }
    }
    pub(crate) fn extend_ttl<K: IntoVal<Env,Val>>(&self, key: &K, threshold: u32, extend_to: u32) {
        assert!(self.persistent); self.env.storage().persistent().extend_ttl(key, threshold, extend_to);
    }
}
