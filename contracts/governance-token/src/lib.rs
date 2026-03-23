#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, symbol_short};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
}

#[contract]
pub struct GovToken;

#[contractimpl]
impl GovToken {
    pub fn init(env: Env, admin: Address) {
        let store = env.storage().instance();
        assert!(store.get::<_, Address>(&DataKey::Admin).is_none(), "already_init");
        store.set(&DataKey::Admin, &admin);
    }

    // Minimal surface for governor demos: mint balances tracked in events only is insufficient.
    // For now, we expose a balance map: Address -> i128 (not production token standard).
    pub fn mint(env: Env, to: Address, amount: i128) {
        let store = env.storage().instance();
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("no_admin");
        admin.require_auth();
        let key = (symbol_short!("bal"), to.clone());
        let prev: i128 = store.get(&key).unwrap_or(0);
        store.set(&key, &(prev + amount));
    }

    pub fn balance(env: Env, owner: Address) -> i128 {
        let store = env.storage().instance();
        let key = (symbol_short!("bal"), owner);
        store.get(&key).unwrap_or(0)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, Address};

    #[test]
    fn test_mint_balance() {
        let env = Env::default();
        let id = env.register_contract(None, GovToken);
        let client = GovTokenClient::new(&env, &id);
        let admin = Address::generate(&env);
        client.init(&admin);

        let user = Address::generate(&env);
        env.mock_all_auths();
        client.mint(&user, &100);
        let b = client.balance(&user);
        assert_eq!(b, 100);
    }
}


