use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events as _},
    vec, Env, IntoVal,
};

#[test]
#[should_panic(expected = "only_writer")]
fn register_requires_authorized_caller() {
    let env = Env::default();
    let id = env.register_contract(None, ArkaRegistry);
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
    let id = env.register_contract(None, ArkaRegistry);
    let client = ArkaRegistryClient::new(&env, &id);
    let admin = Address::generate(&env);
    let registrar = Address::generate(&env);
    let manager = Address::generate(&env);
    let arka = Address::generate(&env);

    env.mock_all_auths();
    client.init_admin(&admin);
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
    let id = env.register_contract(None, ArkaRegistry);
    let client = ArkaRegistryClient::new(&env, &id);
    let admin = Address::generate(&env);
    let manager = Address::generate(&env);
    let arka = Address::generate(&env);

    env.mock_all_auths();
    client.init_admin(&admin);
    client.register_admin(&admin, &manager, &arka);

    assert_eq!(client.count(), 1);
    assert_eq!(client.get_arkas_by_manager(&manager, &0, &10).len(), 1);
}

#[test]
fn registry_emits_indexer_ready_events() {
    let env = Env::default();
    let id = env.register_contract(None, ArkaRegistry);
    let client = ArkaRegistryClient::new(&env, &id);
    let admin = Address::generate(&env);
    let registrar = Address::generate(&env);
    let manager = Address::generate(&env);
    let arka = Address::generate(&env);

    env.mock_all_auths();
    client.init_admin(&admin);
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
