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
    DeploymentOperation(BytesN<32>),
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

/// A reviewed creation in the executor's own deployment namespace. The exact
/// code, salt and constructor arguments are fixed when it is scheduled.
#[derive(Clone)]
#[contracttype]
pub struct ContractDeployment {
    pub wasm_hash: BytesN<32>,
    pub salt: BytesN<32>,
    pub constructor_args: Vec<Val>,
}

#[derive(Clone)]
#[contracttype]
pub struct QueuedDeployment {
    pub operation_id: BytesN<32>,
    pub scheduled_by: Address,
    pub scheduled_at: u32,
    pub ready_at: u32,
    pub expires_at: u32,
    pub status: OperationStatus,
    pub deployment: ContractDeployment,
}

// Keep existing call records and their ABI unchanged. Both typed records use
// the same ID namespace, authorization and execution lifecycle.
enum ScheduledOperation {
    Calls(QueuedOperation),
    Deployment(QueuedDeployment),
}

impl ScheduledOperation {
    fn status(&self) -> OperationStatus {
        match self {
            Self::Calls(op) => op.status.clone(),
            Self::Deployment(op) => op.status.clone(),
        }
    }

    fn window(&self) -> (u32, u32) {
        match self {
            Self::Calls(op) => (op.ready_at, op.expires_at),
            Self::Deployment(op) => (op.ready_at, op.expires_at),
        }
    }

    fn set_status(&mut self, status: OperationStatus) {
        match self {
            Self::Calls(op) => op.status = status,
            Self::Deployment(op) => op.status = status,
        }
    }
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
            .get::<DataKey, Option<Address>>(&DataKey::Governor).flatten()
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
        if let Some(governor) = store.get::<DataKey, Option<Address>>(&DataKey::Governor).flatten() {
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
            .get::<DataKey, Option<Address>>(&DataKey::Governor).flatten()
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

    fn find_operation(env: &Env, operation_id: &BytesN<32>) -> Option<ScheduledOperation> {
        Self::operation(env.clone(), operation_id.clone())
            .map(ScheduledOperation::Calls)
            .or_else(|| {
                Self::deployment_operation(env.clone(), operation_id.clone())
                    .map(ScheduledOperation::Deployment)
            })
    }

    fn read_operation(env: &Env, operation_id: &BytesN<32>) -> ScheduledOperation {
        Self::find_operation(env, operation_id)
            .unwrap_or_else(|| panic_with_error!(env, Error::OperationMissing))
    }

    fn store_operation(env: &Env, operation_id: &BytesN<32>, operation: &ScheduledOperation) {
        match operation {
            ScheduledOperation::Calls(op) => env
                .storage()
                .persistent()
                .set(&Self::operation_key(operation_id), op),
            ScheduledOperation::Deployment(op) => env
                .storage()
                .persistent()
                .set(&DataKey::DeploymentOperation(operation_id.clone()), op),
        }
    }

    fn require_unused_id(env: &Env, operation_id: &BytesN<32>) {
        if Self::find_operation(env, operation_id).is_some() {
            panic_with_error!(env, Error::OperationExists);
        }
    }

    fn require_pending(env: &Env, status: OperationStatus) {
        match status {
            OperationStatus::Pending => {}
            OperationStatus::Executed => panic_with_error!(env, Error::OperationAlreadyExecuted),
            OperationStatus::Cancelled => panic_with_error!(env, Error::OperationCancelled),
        }
    }

    fn scheduling_window(env: &Env) -> (u32, u32, u32) {
        let now = env.ledger().sequence();
        let store = env.storage().persistent();
        let min_delay: u32 = store.get(&DataKey::MinDelay).unwrap_or(0);
        let grace_period: u32 = store.get(&DataKey::GracePeriod).unwrap_or(0);
        let ready_at = now.saturating_add(min_delay);
        (now, ready_at, ready_at.saturating_add(grace_period))
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

    // Construction and initialization are one atomic host operation.
    pub fn __constructor(env: Env, admin: Address, min_delay: u32, grace_period: u32) {
        Self::initialize(env, admin, min_delay, grace_period);
    }

    // Retain the legacy ABI, but never expose a second initialization path.
    #[allow(unused_variables)]
    pub fn init(env: Env, admin: Address, min_delay: u32, grace_period: u32) {
        panic!("initialization_requires_constructor");
    }

    fn initialize(env: Env, admin: Address, min_delay: u32, grace_period: u32) {
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
        Self::require_unused_id(&env, &operation_id);
        let (now, ready_at, expires_at) = Self::scheduling_window(&env);
        let operation = QueuedOperation {
            operation_id: operation_id.clone(),
            scheduled_by: caller,
            scheduled_at: now,
            ready_at,
            expires_at,
            status: OperationStatus::Pending,
            actions,
        };
        store.set(&key, &operation);
        env.events()
            .publish((symbol_short!("sched"), operation_id), operation.clone());
        operation
    }

    pub fn schedule_deployment(
        env: Env,
        caller: Address,
        operation_id: BytesN<32>,
        deployment: ContractDeployment,
    ) -> QueuedDeployment {
        Self::require_scheduler_auth(&env, &caller);
        Self::require_unused_id(&env, &operation_id);
        let (scheduled_at, ready_at, expires_at) = Self::scheduling_window(&env);
        let operation = QueuedDeployment {
            operation_id: operation_id.clone(),
            scheduled_by: caller,
            scheduled_at,
            ready_at,
            expires_at,
            status: OperationStatus::Pending,
            deployment,
        };
        Self::store_operation(
            &env,
            &operation_id,
            &ScheduledOperation::Deployment(operation.clone()),
        );
        env.events()
            .publish((symbol_short!("scheddep"), operation_id), operation.clone());
        operation
    }

    // Preserve the legacy return type. Deployment cancellation has its own
    // typed return, while both paths use the same transition implementation.
    pub fn cancel(env: Env, caller: Address, operation_id: BytesN<32>) -> QueuedOperation {
        Self::require_scheduler_auth(&env, &caller);
        let operation = Self::operation(env.clone(), operation_id.clone())
            .unwrap_or_else(|| panic_with_error!(&env, Error::OperationMissing));
        match Self::cancel_operation(&env, &operation_id, ScheduledOperation::Calls(operation)) {
            ScheduledOperation::Calls(op) => op,
            ScheduledOperation::Deployment(_) => unreachable!(),
        }
    }

    pub fn cancel_deployment(
        env: Env,
        caller: Address,
        operation_id: BytesN<32>,
    ) -> QueuedDeployment {
        Self::require_scheduler_auth(&env, &caller);
        let operation = Self::deployment_operation(env.clone(), operation_id.clone())
            .unwrap_or_else(|| panic_with_error!(&env, Error::OperationMissing));
        match Self::cancel_operation(
            &env,
            &operation_id,
            ScheduledOperation::Deployment(operation),
        ) {
            ScheduledOperation::Deployment(op) => op,
            ScheduledOperation::Calls(_) => unreachable!(),
        }
    }

    fn cancel_operation(
        env: &Env,
        operation_id: &BytesN<32>,
        mut operation: ScheduledOperation,
    ) -> ScheduledOperation {
        Self::require_pending(env, operation.status());
        operation.set_status(OperationStatus::Cancelled);
        Self::store_operation(env, operation_id, &operation);
        match &operation {
            ScheduledOperation::Calls(op) => env
                .events()
                .publish((symbol_short!("cancel"), operation_id.clone()), op.clone()),
            ScheduledOperation::Deployment(op) => env.events().publish(
                (symbol_short!("canceldep"), operation_id.clone()),
                op.clone(),
            ),
        }
        operation
    }

    pub fn execute(env: Env, operation_id: BytesN<32>) -> ExecutionReceipt {
        let mut operation = Self::read_operation(&env, &operation_id);
        Self::require_pending(&env, operation.status());

        let now = env.ledger().sequence();
        let (ready_at, expires_at) = operation.window();
        if now < ready_at {
            panic_with_error!(&env, Error::OperationNotReady);
        }
        if now > expires_at {
            panic_with_error!(&env, Error::OperationExpired);
        }

        operation.set_status(OperationStatus::Executed);
        Self::store_operation(&env, &operation_id, &operation);
        let action_count = match operation {
            ScheduledOperation::Calls(operation) => {
                for action in operation.actions.iter() {
                    Self::authorize_current_contract_call(
                        &env,
                        &action.contract_id,
                        &action.function,
                        &action.args,
                    );
                    let _ = env.invoke_contract::<Val>(
                        &action.contract_id,
                        &action.function,
                        action.args,
                    );
                }
                operation.actions.len()
            }
            ScheduledOperation::Deployment(operation) => {
                let deployment = operation.deployment;
                let deployer = env.deployer().with_current_contract(deployment.salt);
                Self::authorize_current_contract_call(
                    &env,
                    &deployer.deployed_address(),
                    &Symbol::new(&env, "__constructor"),
                    &deployment.constructor_args,
                );
                let address = deployer.deploy_v2(deployment.wasm_hash, deployment.constructor_args);
                env.events()
                    .publish((symbol_short!("deployed"), operation_id.clone()), address);
                1
            }
        };

        let receipt = ExecutionReceipt {
            operation_id: operation_id.clone(),
            executed_at: now,
            action_count,
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
        Self::find_operation(&env, &operation_id).map(|operation| operation.status())
    }

    pub fn deployment_operation(env: Env, operation_id: BytesN<32>) -> Option<QueuedDeployment> {
        env.storage()
            .persistent()
            .get(&DataKey::DeploymentOperation(operation_id))
    }

    pub fn deployment_address(env: Env, operation_id: BytesN<32>) -> Option<Address> {
        Self::deployment_operation(env.clone(), operation_id).map(|operation| {
            env.deployer()
                .with_current_contract(operation.deployment.salt)
                .deployed_address()
        })
    }

    pub fn is_ready(env: Env, operation_id: BytesN<32>) -> bool {
        match Self::find_operation(&env, &operation_id) {
            Some(operation) => {
                let (ready_at, expires_at) = operation.window();
                matches!(operation.status(), OperationStatus::Pending)
                    && env.ledger().sequence() >= ready_at
                    && env.ledger().sequence() <= expires_at
            }
            None => false,
        }
    }
}

#[cfg(test)]
mod test;
