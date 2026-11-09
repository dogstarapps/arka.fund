use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events as _},
    vec, Env, IntoVal,
};

#[test]
#[should_panic(expected = "only_writer")]
fn register_requires_authorized_caller() {
    let env = Env::default();
    let id = { env.mock_all_auths(); env.register(ArkaRegistry, (Address::generate(&env),)) };
    let client = ArkaRegistryClient::new(&env, &id);
    let caller = Address::generate(&env);
    let m = Address::generate(&env);
    let a = Address::generate(&env);
    env.mock_all_auths();
    client.register(&caller, &m, &a);
}

#[test]
fn registry_admin_controls_writers_and_listing() {
    let env = Env::default();
    
    
    let admin = Address::generate(&env);
    let registrar = Address::generate(&env);
    let manager = Address::generate(&env);
    let arka = Address::generate(&env);

    env.mock_all_auths();
    let id = env.register(ArkaRegistry, (&admin,));
    let client = ArkaRegistryClient::new(&env, &id);
    client.set_registrar(&admin, &registrar, &true);
    assert!(client.is_registrar(&registrar));

    client.register(&registrar, &manager, &arka);
    assert_eq!(client.count(), 1);
    assert_eq!(client.get_arkas(&0, &10).len(), 1);
    assert_eq!(client.get_arkas_by_manager(&manager, &0, &10).len(), 1);

    client.set_delisted(&admin, &arka, &true);
    assert!(client.is_delisted(&arka));
    assert_eq!(client.count(), 0);
    assert_eq!(client.get_arkas(&0, &10).len(), 0);
}

#[test]
fn admin_can_register_legacy_arkas_directly() {
    let env = Env::default();
    
    
    let admin = Address::generate(&env);
    let manager = Address::generate(&env);
    let arka = Address::generate(&env);

    env.mock_all_auths();
    let id = env.register(ArkaRegistry, (&admin,));
    let client = ArkaRegistryClient::new(&env, &id);
    client.register_admin(&admin, &manager, &arka);

    assert_eq!(client.count(), 1);
    assert_eq!(client.get_arkas_by_manager(&manager, &0, &10).len(), 1);
}

#[test]
fn registry_emits_indexer_ready_events() {
    let env = Env::default();
    
    
    let admin = Address::generate(&env);
    let registrar = Address::generate(&env);
    let manager = Address::generate(&env);
    let arka = Address::generate(&env);

    env.mock_all_auths();
    let id = env.register(ArkaRegistry, (&admin,));
    let client = ArkaRegistryClient::new(&env, &id);
    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                id.clone(),
                (EVENT_ADMIN,).into_val(&env),
                admin.clone().into_val(&env)
            )
        ]
    );

    client.set_registrar(&admin, &registrar, &true);
    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                id.clone(),
                (EVENT_WRITER,).into_val(&env),
                (admin.clone(), registrar.clone(), true).into_val(&env),
            )
        ]
    );

    client.register(&registrar, &manager, &arka);
    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                id.clone(),
                (EVENT_REGISTER,).into_val(&env),
                (registrar, manager.clone(), arka.clone()).into_val(&env),
            )
        ]
    );

    client.set_manager_curated(&admin, &manager, &true);
    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                id.clone(),
                (EVENT_CURATE,).into_val(&env),
                (admin.clone(), manager, true).into_val(&env),
            )
        ]
    );

    client.set_delisted(&admin, &arka, &true);
    assert_eq!(
        env.events().all(),
        vec![
            &env,
            (
                id,
                (EVENT_DELIST,).into_val(&env),
                (admin, arka, true).into_val(&env),
            )
        ]
    );
}


#[test]
fn optional_governor_clear_preserves_registrar_and_retired_admin_boundaries() {
    use soroban_sdk::testutils::Ledger as _;
    let env = Env::default();
    env.ledger().set_timestamp(1_000);
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let governor = Address::generate(&env);
    let registrar = Address::generate(&env);
    let stranger = Address::generate(&env);
    let manager = Address::generate(&env);
    let id = env.register(ArkaRegistry, (&admin,));
    let client = ArkaRegistryClient::new(&env, &id);
    client.set_registrar(&admin, &registrar, &true);
    client.set_governor(&admin, &None);
    client.register(&registrar, &manager, &Address::generate(&env));
    client.register(&admin, &manager, &Address::generate(&env));
    assert_eq!(client.count(), 2);
    assert!(client.try_register(&stranger, &manager, &Address::generate(&env)).is_err());
    client.set_governor(&admin, &Some(governor.clone()));
    client.clear_bootstrap_admin_expiry(&governor);
    client.set_governor(&governor, &None);
    assert!(client.try_set_governor(&admin, &Some(admin.clone())).is_err());
    assert!(client.try_register(&admin, &manager, &Address::generate(&env)).is_err());
    client.register(&registrar, &manager, &Address::generate(&env));
    assert_eq!(client.count(), 3);
}
