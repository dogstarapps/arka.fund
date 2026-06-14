#![no_std]

use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, vec,
    Address, BytesN, Env, Symbol, Val, Vec,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Governor,
    MinDelay,
    GracePeriod,
    BootstrapAdminExpiresAt,
    LastWasmHash,
    Operation(BytesN<32>),
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,
    Unauthorized = 2,
    InvalidDelay = 3,
    EmptyBatch = 4,
    OperationExists = 5,
    OperationMissing = 6,
    OperationNotReady = 7,
    OperationExpired = 8,
    OperationAlreadyExecuted = 9,
    OperationCancelled = 10,
    NotInitialized = 11,
    InvalidBootstrapAdmin = 12,
}

#[derive(Clone)]
#[contracttype]
pub enum OperationStatus {
    Pending,
    Executed,
    Cancelled,
}

#[derive(Clone)]
#[contracttype]
pub struct GovernanceAction {
    pub contract_id: Address,
    pub function: Symbol,
    pub args: Vec<Val>,
}

#[derive(Clone)]
#[contracttype]
pub struct QueuedOperation {
    pub operation_id: BytesN<32>,
    pub scheduled_by: Address,
    pub scheduled_at: u32,
    pub ready_at: u32,
    pub expires_at: u32,
    pub status: OperationStatus,
    pub actions: Vec<GovernanceAction>,
}

#[derive(Clone)]
#[contracttype]
pub struct ExecutorConfig {
    pub admin: Address,
    pub governor: Option<Address>,
    pub min_delay: u32,
    pub grace_period: u32,
}

#[derive(Clone)]
#[contracttype]
pub struct ExecutionReceipt {
    pub operation_id: BytesN<32>,
    pub executed_at: u32,
    pub action_count: u32,
}

const MAX_BOOTSTRAP_ADMIN_SECONDS: u64 = 365 * 24 * 60 * 60;

#[contract]
pub struct GovernanceExecutor;

#[contractimpl]
impl GovernanceExecutor {
    fn bootstrap_admin_expired(env: &Env) -> bool {
        let Some(expires_at) = env
            .storage()
            .persistent()
            .get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
        else {
            return false;
        };
        env.ledger().timestamp() > expires_at
    }

    fn require_admin_auth(env: &Env, caller: &Address) {
        let admin: Address = match env.storage().persistent().get(&DataKey::Admin) {
            Some(value) => value,
            None => panic_with_error!(env, Error::NotInitialized),
        };
        if *caller != admin {
            panic_with_error!(env, Error::Unauthorized);
        }
        if Self::bootstrap_admin_expired(env) {
            panic_with_error!(env, Error::Unauthorized);
        }
        caller.require_auth();
    }

    fn require_scheduler_auth(env: &Env, caller: &Address) {
        if let Some(governor) = env
            .storage()
            .persistent()
            .get::<DataKey, Address>(&DataKey::Governor)
        {
            if *caller != governor {
                panic_with_error!(env, Error::Unauthorized);
            }
            caller.require_auth();
            return;
        }
        Self::require_admin_auth(env, caller);
    }

    fn require_admin_or_governor_auth(env: &Env, caller: &Address) {
        let store = env.storage().persistent();
        if let Some(admin) = store.get::<DataKey, Address>(&DataKey::Admin) {
            if *caller == admin && !Self::bootstrap_admin_expired(env) {
                caller.require_auth();
                return;
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

    fn require_positive_window(env: &Env, value: u32) {
        if value == 0 {
            panic_with_error!(env, Error::InvalidDelay);
        }
    }

    fn require_future_bootstrap_expiry(env: &Env, expires_at: u64) {
        let now = env.ledger().timestamp();
        if expires_at <= now || expires_at.saturating_sub(now) > MAX_BOOTSTRAP_ADMIN_SECONDS {
            panic_with_error!(env, Error::InvalidBootstrapAdmin);
        }
    }

    fn require_governor_auth(env: &Env, caller: &Address) {
        let Some(governor) = env
            .storage()
            .persistent()
            .get::<DataKey, Address>(&DataKey::Governor)
        else {
            panic_with_error!(env, Error::Unauthorized);
        };
        if *caller != governor {
            panic_with_error!(env, Error::Unauthorized);
        }
        caller.require_auth();
    }

    fn config_internal(env: &Env) -> ExecutorConfig {
        let store = env.storage().persistent();
        ExecutorConfig {
            admin: match store.get(&DataKey::Admin) {
                Some(value) => value,
                None => panic_with_error!(env, Error::NotInitialized),
            },
            governor: store.get(&DataKey::Governor).unwrap_or(None),
            min_delay: store.get(&DataKey::MinDelay).unwrap_or(0),
            grace_period: store.get(&DataKey::GracePeriod).unwrap_or(0),
        }
    }

    fn operation_key(operation_id: &BytesN<32>) -> DataKey {
        DataKey::Operation(operation_id.clone())
    }

    fn read_operation(env: &Env, operation_id: &BytesN<32>) -> QueuedOperation {
        match env
            .storage()
            .persistent()
            .get::<DataKey, QueuedOperation>(&Self::operation_key(operation_id))
        {
            Some(operation) => operation,
            None => panic_with_error!(env, Error::OperationMissing),
        }
    }

    fn authorize_current_contract_call(
        env: &Env,
        contract: &Address,
        fn_name: &Symbol,
        args: &Vec<Val>,
    ) {
        let auth = InvokerContractAuthEntry::Contract(SubContractInvocation {
            context: ContractContext {
                contract: contract.clone(),
                fn_name: fn_name.clone(),
                args: args.clone(),
            },
            sub_invocations: vec![env],
        });
        env.authorize_as_current_contract(vec![env, auth]);
    }

    pub fn init(env: Env, admin: Address, min_delay: u32, grace_period: u32) {
        Self::require_positive_window(&env, min_delay);
        Self::require_positive_window(&env, grace_period);
        let store = env.storage().persistent();
        if store.has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::MinDelay, &min_delay);
        store.set(&DataKey::GracePeriod, &grace_period);
    }

    pub fn set_admin(env: Env, caller: Address, admin: Address) {
        Self::require_admin_or_governor_auth(&env, &caller);
        env.storage().persistent().set(&DataKey::Admin, &admin);
    }

    pub fn set_governor(env: Env, caller: Address, governor: Option<Address>) {
        Self::require_admin_or_governor_auth(&env, &caller);
        env.storage()
            .persistent()
            .set(&DataKey::Governor, &governor);
    }

    pub fn set_bootstrap_admin_expiry(env: Env, caller: Address, expires_at: u64) {
        Self::require_admin_auth(&env, &caller);
        Self::require_future_bootstrap_expiry(&env, expires_at);
        if let Some(current_expires_at) = env
            .storage()
            .persistent()
            .get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
        {
            assert!(
                expires_at <= current_expires_at,
                "bootstrap_admin_expiry_locked"
            );
        }
        env.storage()
            .persistent()
            .set(&DataKey::BootstrapAdminExpiresAt, &expires_at);
    }

    pub fn clear_bootstrap_admin_expiry(env: Env, caller: Address) {
        Self::require_governor_auth(&env, &caller);
        let expired_at: u64 = 0;
        env.storage()
            .persistent()
            .set(&DataKey::BootstrapAdminExpiresAt, &expired_at);
    }

    pub fn bootstrap_admin_expires_at(env: Env) -> Option<u64> {
        env.storage()
            .persistent()
            .get::<DataKey, u64>(&DataKey::BootstrapAdminExpiresAt)
    }

    pub fn bootstrap_admin_active(env: Env) -> bool {
        let Some(expires_at) = Self::bootstrap_admin_expires_at(env.clone()) else {
            return false;
        };
        env.ledger().timestamp() <= expires_at
    }

    pub fn upgrade(env: Env, caller: Address, new_wasm_hash: BytesN<32>) {
        Self::require_admin_or_governor_auth(&env, &caller);
        env.storage()
            .persistent()
            .set(&DataKey::LastWasmHash, &new_wasm_hash);
        env.events()
            .publish((symbol_short!("upgrade"),), new_wasm_hash.clone());
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    pub fn last_wasm_hash(env: Env) -> Option<BytesN<32>> {
        env.storage()
            .persistent()
            .get::<DataKey, BytesN<32>>(&DataKey::LastWasmHash)
    }

    pub fn set_min_delay(env: Env, caller: Address, min_delay: u32) {
        Self::require_positive_window(&env, min_delay);
        Self::require_admin_or_governor_auth(&env, &caller);
        env.storage()
            .persistent()
            .set(&DataKey::MinDelay, &min_delay);
    }

    pub fn set_grace_period(env: Env, caller: Address, grace_period: u32) {
        Self::require_positive_window(&env, grace_period);
        Self::require_admin_or_governor_auth(&env, &caller);
        env.storage()
            .persistent()
            .set(&DataKey::GracePeriod, &grace_period);
    }

    pub fn schedule(
        env: Env,
        caller: Address,
        operation_id: BytesN<32>,
        actions: Vec<GovernanceAction>,
    ) -> QueuedOperation {
        Self::require_scheduler_auth(&env, &caller);
        if actions.is_empty() {
            panic_with_error!(&env, Error::EmptyBatch);
        }
        let key = Self::operation_key(&operation_id);
        let store = env.storage().persistent();
        if store.has(&key) {
            panic_with_error!(&env, Error::OperationExists);
        }
        let now = env.ledger().sequence();
        let min_delay: u32 = store.get(&DataKey::MinDelay).unwrap_or(0);
        let grace_period: u32 = store.get(&DataKey::GracePeriod).unwrap_or(0);
        let operation = QueuedOperation {
            operation_id: operation_id.clone(),
            scheduled_by: caller,
            scheduled_at: now,
            ready_at: now.saturating_add(min_delay),
            expires_at: now.saturating_add(min_delay).saturating_add(grace_period),
            status: OperationStatus::Pending,
            actions,
        };
        store.set(&key, &operation);
        env.events()
            .publish((symbol_short!("sched"), operation_id), operation.clone());
        operation
    }

    pub fn cancel(env: Env, caller: Address, operation_id: BytesN<32>) -> QueuedOperation {
        Self::require_scheduler_auth(&env, &caller);
        let mut operation = Self::read_operation(&env, &operation_id);
        match operation.status {
            OperationStatus::Pending => {}
            OperationStatus::Executed => panic_with_error!(&env, Error::OperationAlreadyExecuted),
            OperationStatus::Cancelled => panic_with_error!(&env, Error::OperationCancelled),
        }
        operation.status = OperationStatus::Cancelled;
        env.storage()
            .persistent()
            .set(&Self::operation_key(&operation_id), &operation);
        env.events()
            .publish((symbol_short!("cancel"), operation_id), operation.clone());
        operation
    }

    pub fn execute(env: Env, operation_id: BytesN<32>) -> ExecutionReceipt {
        let mut operation = Self::read_operation(&env, &operation_id);
        match operation.status {
            OperationStatus::Pending => {}
            OperationStatus::Executed => panic_with_error!(&env, Error::OperationAlreadyExecuted),
            OperationStatus::Cancelled => panic_with_error!(&env, Error::OperationCancelled),
        }

        let now = env.ledger().sequence();
        if now < operation.ready_at {
            panic_with_error!(&env, Error::OperationNotReady);
        }
        if now > operation.expires_at {
            panic_with_error!(&env, Error::OperationExpired);
        }

        operation.status = OperationStatus::Executed;
        env.storage()
            .persistent()
            .set(&Self::operation_key(&operation_id), &operation);

        for action in operation.actions.iter() {
            Self::authorize_current_contract_call(
                &env,
                &action.contract_id,
                &action.function,
                &action.args,
            );
            let _ = env.invoke_contract::<Val>(&action.contract_id, &action.function, action.args);
        }

        let receipt = ExecutionReceipt {
            operation_id: operation_id.clone(),
            executed_at: now,
            action_count: operation.actions.len(),
        };
        env.events()
            .publish((symbol_short!("exec"), operation_id), receipt.clone());
        receipt
    }

    pub fn config(env: Env) -> ExecutorConfig {
        Self::config_internal(&env)
    }

    pub fn operation(env: Env, operation_id: BytesN<32>) -> Option<QueuedOperation> {
        env.storage()
            .persistent()
            .get::<DataKey, QueuedOperation>(&Self::operation_key(&operation_id))
    }

    pub fn current_operation_status(env: Env, operation_id: BytesN<32>) -> Option<OperationStatus> {
        Self::operation(env, operation_id).map(|operation| operation.status)
    }

    pub fn is_ready(env: Env, operation_id: BytesN<32>) -> bool {
        match Self::operation(env.clone(), operation_id) {
            Some(operation) => {
                matches!(operation.status, OperationStatus::Pending)
                    && env.ledger().sequence() >= operation.ready_at
                    && env.ledger().sequence() <= operation.expires_at
            }
            None => false,
        }
    }
}

#[cfg(test)]
mod test {
    extern crate std;

    use super::*;
    use governance_token::{GovToken, GovTokenClient};
    use soroban_sdk::{
        testutils::{Address as _, Ledger, LedgerInfo},
        IntoVal,
    };

    const ONE_DAY_LEDGERS: u32 = 17_280;

    fn operation_id(env: &Env, seed: u8) -> BytesN<32> {
        BytesN::from_array(env, &[seed; 32])
    }

    fn jump(env: &Env, ledgers: u32) {
        env.ledger().set(LedgerInfo {
            timestamp: env.ledger().timestamp().saturating_add(ledgers as u64 * 5),
            protocol_version: 23,
            sequence_number: env.ledger().sequence().saturating_add(ledgers),
            network_id: Default::default(),
            base_reserve: 10,
            min_temp_entry_ttl: ONE_DAY_LEDGERS,
            min_persistent_entry_ttl: 10 * ONE_DAY_LEDGERS,
            max_entry_ttl: 365 * ONE_DAY_LEDGERS,
        });
    }

    fn set_default_ledger(env: &Env) {
        env.ledger().set(LedgerInfo {
            timestamp: 1_441_065_600,
            protocol_version: 23,
            sequence_number: 100,
            network_id: Default::default(),
            base_reserve: 10,
            min_temp_entry_ttl: ONE_DAY_LEDGERS,
            min_persistent_entry_ttl: 10 * ONE_DAY_LEDGERS,
            max_entry_ttl: 365 * ONE_DAY_LEDGERS,
        });
    }

    #[test]
    fn test_schedule_execute_against_real_governance_token() {
        let env = Env::default();
        env.mock_all_auths();
        set_default_ledger(&env);

        let executor_id = env.register_contract(None, GovernanceExecutor);
        let executor = GovernanceExecutorClient::new(&env, &executor_id);
        let admin = Address::generate(&env);
        executor.init(&admin, &5, &20);

        let token_id = env.register_contract(None, GovToken);
        let token = GovTokenClient::new(&env, &token_id);
        token.init(&executor_id);

        let user = Address::generate(&env);
        let actions = vec![
            &env,
            GovernanceAction {
                contract_id: token_id.clone(),
                function: Symbol::new(&env, "mint"),
                args: vec![&env, user.clone().into_val(&env), 250i128.into_val(&env)],
            },
        ];
        let op_id = operation_id(&env, 7);
        executor.schedule(&admin, &op_id, &actions);

        jump(&env, 5);
        let receipt = executor.execute(&op_id);
        assert_eq!(receipt.action_count, 1);
        assert_eq!(token.balance(&user), 250);
        assert!(matches!(
            executor.current_operation_status(&op_id),
            Some(OperationStatus::Executed)
        ));
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #7)")]
    fn test_execute_before_ready_panics() {
        let env = Env::default();
        env.mock_all_auths();
        set_default_ledger(&env);

        let executor_id = env.register_contract(None, GovernanceExecutor);
        let executor = GovernanceExecutorClient::new(&env, &executor_id);
        let admin = Address::generate(&env);
        executor.init(&admin, &3, &10);

        let token_id = env.register_contract(None, GovToken);
        let token = GovTokenClient::new(&env, &token_id);
        token.init(&executor_id);

        let user = Address::generate(&env);
        let actions = vec![
            &env,
            GovernanceAction {
                contract_id: token_id,
                function: Symbol::new(&env, "mint"),
                args: vec![&env, user.into_val(&env), 10i128.into_val(&env)],
            },
        ];
        let op_id = operation_id(&env, 8);
        executor.schedule(&admin, &op_id, &actions);
        executor.execute(&op_id);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #10)")]
    fn test_cancelled_operation_cannot_execute() {
        let env = Env::default();
        env.mock_all_auths();
        set_default_ledger(&env);

        let executor_id = env.register_contract(None, GovernanceExecutor);
        let executor = GovernanceExecutorClient::new(&env, &executor_id);
        let admin = Address::generate(&env);
        executor.init(&admin, &2, &10);

        let token_id = env.register_contract(None, GovToken);
        let token = GovTokenClient::new(&env, &token_id);
        token.init(&executor_id);

        let user = Address::generate(&env);
        let actions = vec![
            &env,
            GovernanceAction {
                contract_id: token_id,
                function: Symbol::new(&env, "mint"),
                args: vec![&env, user.into_val(&env), 5i128.into_val(&env)],
            },
        ];
        let op_id = operation_id(&env, 9);
        executor.schedule(&admin, &op_id, &actions);
        executor.cancel(&admin, &op_id);
        jump(&env, 2);
        executor.execute(&op_id);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #2)")]
    fn test_expired_bootstrap_admin_cannot_schedule() {
        let env = Env::default();
        env.mock_all_auths();
        set_default_ledger(&env);

        let executor_id = env.register_contract(None, GovernanceExecutor);
        let executor = GovernanceExecutorClient::new(&env, &executor_id);
        let admin = Address::generate(&env);
        executor.init(&admin, &2, &10);
        executor.set_bootstrap_admin_expiry(&admin, &(env.ledger().timestamp() + 10));

        let token_id = env.register_contract(None, GovToken);
        let user = Address::generate(&env);
        let actions = vec![
            &env,
            GovernanceAction {
                contract_id: token_id,
                function: Symbol::new(&env, "mint"),
                args: vec![&env, user.into_val(&env), 5i128.into_val(&env)],
            },
        ];
        let op_id = operation_id(&env, 10);
        jump(&env, 3);

        executor.schedule(&admin, &op_id, &actions);
    }

    #[test]
    fn test_governor_can_rotate_admin_after_bootstrap_expiry() {
        let env = Env::default();
        env.mock_all_auths();
        set_default_ledger(&env);

        let executor_id = env.register_contract(None, GovernanceExecutor);
        let executor = GovernanceExecutorClient::new(&env, &executor_id);
        let admin = Address::generate(&env);
        let governor = Address::generate(&env);
        let dao_admin = Address::generate(&env);
        executor.init(&admin, &2, &10);
        executor.set_governor(&admin, &Some(governor.clone()));
        executor.set_bootstrap_admin_expiry(&admin, &(env.ledger().timestamp() + 10));
        jump(&env, 3);

        assert!(!executor.bootstrap_admin_active());
        executor.set_admin(&governor, &dao_admin);

        assert_eq!(executor.config().admin, dao_admin);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #12)")]
    fn test_bootstrap_admin_expiry_rejects_windows_over_one_year() {
        let env = Env::default();
        env.mock_all_auths();
        set_default_ledger(&env);

        let executor_id = env.register_contract(None, GovernanceExecutor);
        let executor = GovernanceExecutorClient::new(&env, &executor_id);
        let admin = Address::generate(&env);
        executor.init(&admin, &2, &10);

        executor.set_bootstrap_admin_expiry(
            &admin,
            &(env.ledger().timestamp() + MAX_BOOTSTRAP_ADMIN_SECONDS + 1),
        );
    }

    #[test]
    #[should_panic(expected = "bootstrap_admin_expiry_locked")]
    fn test_bootstrap_admin_expiry_cannot_be_extended() {
        let env = Env::default();
        env.mock_all_auths();
        set_default_ledger(&env);

        let executor_id = env.register_contract(None, GovernanceExecutor);
        let executor = GovernanceExecutorClient::new(&env, &executor_id);
        let admin = Address::generate(&env);
        executor.init(&admin, &2, &10);

        let first_expiry = env.ledger().timestamp() + 10;
        executor.set_bootstrap_admin_expiry(&admin, &first_expiry);
        executor.set_bootstrap_admin_expiry(&admin, &(first_expiry + 1));
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #2)")]
    fn test_admin_cannot_clear_bootstrap_expiry_without_governor() {
        let env = Env::default();
        env.mock_all_auths();
        set_default_ledger(&env);

        let executor_id = env.register_contract(None, GovernanceExecutor);
        let executor = GovernanceExecutorClient::new(&env, &executor_id);
        let admin = Address::generate(&env);
        executor.init(&admin, &2, &10);
        executor.set_bootstrap_admin_expiry(&admin, &(env.ledger().timestamp() + 10));

        executor.clear_bootstrap_admin_expiry(&admin);
    }

    #[test]
    fn test_governor_clears_bootstrap_expiry_after_handoff() {
        let env = Env::default();
        env.mock_all_auths();
        set_default_ledger(&env);

        let executor_id = env.register_contract(None, GovernanceExecutor);
        let executor = GovernanceExecutorClient::new(&env, &executor_id);
        let admin = Address::generate(&env);
        let governor = Address::generate(&env);
        executor.init(&admin, &2, &10);
        executor.set_governor(&admin, &Some(governor.clone()));
        executor.set_bootstrap_admin_expiry(&admin, &(env.ledger().timestamp() + 10));

        executor.clear_bootstrap_admin_expiry(&governor);

        assert_eq!(executor.bootstrap_admin_expires_at(), Some(0));
        assert!(!executor.bootstrap_admin_active());
    }
}
