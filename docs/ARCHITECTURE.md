# Arka.fund – Detailed Technical Architecture

**Version:** 1.0 • **Updated:** 2025‑04‑30

---

## I. Introduction and Functional Scope

This document describes in detail the technical architecture of Arka.fund, covering:

1.  **Functional description** (use cases, roles, operational flows).
2.  **On-chain components** (Soroban contracts: Factory, Arkas, Router, Adapters, DAO).
3.  **DeFi integration** (AMMs: Aquarius, SoroSwap, Phoenix, Comet, Balanced; Lending/Borrowing: Blend).
4.  **DAO governance** (modules, proposals, timelock, fee distribution).
5.  **Manager tier system** (tiers based on AUM and net profit).
6.  **Off-chain services** (Route API, indexer, front-end, backtesting, monitoring).
7.  **Diagrams and schemas** (Mermaid + detailed explanations).

---

## II. Functional Description

### 1. Roles and Use Cases
| Role      | Privileges                                                | Example Flow                                       |
|-----------|-----------------------------------------------------------|----------------------------------------------------|
| Manager   | Create arkas, configure parameters, rebalance assets, propose DAO | José creates a USD-Stellar arka with 2% fees and USDC whitelist. |
| Depositor | Deposit, redeem shares, check performance, vote DAO       | Ana deposits 1,000 USDC, views her NAV, and receives tokens. |
| Voter     | Propose/vote on changes (assets, fees, integrations), claim DAO rewards | María proposes adding BTC to the whitelist and votes. |

### 2. Main Flows

#### a) Arka Creation
![](images/diagram-1.svg)
- The **manager**, when initializing the arka, specifies the **denomination_asset** (unit of account for NAV, fees, and reporting), along with fees, asset whitelist, deposit/withdrawal limits, and governance rules.

#### b) Deposit and Redemption
![](images/diagram-2.svg)
- **Deposit**: Receives allowed assets and issues proportional shares calculated based on the denomination_asset.
- **Redeem**: Burns shares and, before transferring funds, **executes internal swaps** to convert **the corresponding proportion of each underlying asset** to the `denomination_asset`. Finally, transfers the **original capital** plus the accumulated **net profit** to the user.

---

## III. On-chain Components

### 1. ArkaFactory
- **Functions:**
    - `createArka(params) -> Address`: Deploys a Proxy pointing to the ArkaLogic implementation.
    - `upgradeImplementation(newImpl)`: Internal, only via Timelock.
- **State:** Stores the current implementation and template proxy address.

### 2. ArkaProxy & ArkaLogic
- **Proxy:** Delegates all calls to ArkaLogic.
- **Logic (Rust/Soroban):**
    - **Storage**:
        - `denomination: Asset`
        - `totalShares: i128`
        - `aum: i128`
        - `fees: FeeStructure { mgmtRate, perfRate, depositRate, redeemRate }`
        - `whitelist: Vec<Asset>`
        - `manager: Address`
    - **Entries**:
        - `deposit(asset: Asset, amt: i128)`
        - `redeem(shares: i128)`
        - `rebalance(steps: Vec<SwapStep>)`
    - **Events**:
        - `Deposit(user, asset, amt, shares)`
        - `Redeem(user, shares, assetAmt)`
        - `ProfitLogged(delta, timestamp)`

### 3. ArkaToken (token contract)
- SPL-20 style with `mint`, `burn`, `transfer`.
- `approve`/`transferFrom` for integration with front-end/redeem.

### 4. Router and Adapters
- The `Router` orchestrates multi-hop swaps receiving a vector of *SwapStep*.
- Each *SwapStep* defines: `adapter` (Address), `pool_id` (u128), `amount_in` (i128), `min_out` (i128), `asset_out` (Asset).
- **Adapters**: Implement protocol-specific `execute(caller, pool_id, amount_in, min_out, receiver)`.
- Current Testnet integration uses a “quick path” to bypass SoroSwap nested-auth constraints; the definitive model signs non-root auth entries assembled by the dApp so the receiver is the Arka directly.

**Integrated Protocols:**
| Protocol           | Type      | Key Operations                       |
|---------------------|-----------|--------------------------------------|
| **Aquarius AMM**    | AMM       | `swap`, `add_liquidity`, `remove_liquidity` |
| **SoroSwap AMM**    | AMM       | `swap`, `add_liquidity`, `remove_liquidity` |
| **Phoenix AMM**     | AMM       | `swap`, `deposit`, `withdraw`       |
| **Comet AMM**       | AMM       | `swap`, `mint_liquidity`, `burn_liquidity` |
| **Balanced AMM**    | AMM       | `swap`, `pool_reserves`              |
| **Blend**           | Lending   | `lend`, `borrow`, `repay`, `liquidate` |

> All AMMs and Blend have the same relevance; there is no special emphasis on any specific protocol.

##### Generic Adapter Example
```rust
pub struct GenericAdapter;

impl Adapter for GenericAdapter {
    fn validate(env: &Env, step: &SwapStep) -> Result<(), AdapterError> {
        // Example: check reserves
        let (r0,r1) = protocol::reserves(env, step.pool_id);
        if r0 == 0 || r1 == 0 {
            return Err(AdapterError::NoLiquidity);
        }
        Ok(())
    }

    fn execute(env: &Env, step: &SwapStep, amount_in: i128) -> Result<i128, AdapterError> {
        // Example of generic swap call
        protocol::swap(env, step.pool_id, amount_in, step.min_out,
                       env.current_contract_address(),
                       env.current_contract_address());
        // Calculate output
        let balance = env.account_balance(env.current_contract_address(), step.asset_out)?;
        Ok(balance)
    }
}
```

---

## IV. DAO Governance

### 1. Modules
- **Governor:** Proposal creation and voting (thresholds, quorums).
- **Timelock:** Configurable delay (e.g., 48h) before executing changes.
- **Treasury:** Receives fees (management, performance) and distributes revenue share.

### 2. Proposal Flows
![](images/diagram-3.svg)

### 3. On-chain Updates
- Asset whitelist, fees, adapters list, AUM limits.
- Upgradeable contract implementation (ArkaLogic).

See also: `docs/FEES.md` for detailed fee model and DAO-controlled splits.

---

## V. Off-chain Services

### 1. Route-API (StellarBroker)
- Calculates multi-hop routes that can include AMMs (Aquarius, SoroSwap, Phoenix, Comet, Balanced) and Blend.
- Endpoint `GET /route?from=&to=&amt=` → JSON with steps (`SwapStep[]`).

### 2. Indexer & APIs
- Listens to on-chain events (`Deposit`, `Redeem`, `ProfitLogged`, `SwapExecuted`).
- Stores in **DynamoDB** for state queries and metrics.
- Exposes GraphQL API for front-end (transaction history, balances, performance).

### 3. Front-end (React + Tailwind)
- Pages: Discover, Arka Detail (Performance, Portfolio, My Positions, Activity, Deposits, Withdrawals, Stats), Governance.
- Uses GraphQL and invokes Soroban transactions with `soroban-client`.

### 4. Monitoring
- Alerts for critical events: large rebalances, execution failures, proposals near expiry.

---

## VI. Architecture Diagrams

### 1. Deployment Diagram
![](images/diagram-4.svg)

### 2. Swap Flow
![](images/diagram-5.svg)

---

## VII. Security and Best Practices
- **Slippage Checks**: `min_out` verified in adapter.
- **Timelock** ensures review of changes.
- **Exhaustive Testing**: unit, integration, property tests for swaps and proposals.
- **Audit Trails**: All events logged and auditable.

---

## VIII. Deployment and CI/CD
- **Pipelines**: `cargo fmt`, `cargo clippy`, `cargo test`, `soroban testnet deploy`, e2e tests, static audit.
- **Versioning**: SemVer for contracts and adapters.
- **Rollback**: Maintenance of previous implementations in ArkaFactory.
