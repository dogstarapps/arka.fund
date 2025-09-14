## Arka.fund – UI Spec (v0.1)

> Product context
>
> Arka.fund is a non‑custodial protocol on Soroban that lets portfolio managers launch automated multi‑asset funds (Arkas) and retail users invest via a single participation token (SAC). The dApp covers: Arka creation, deposits/redemptions, atomic rebalancing via a multi‑AMM Router, dual coverage program, and DAO governance (Governor+Timelock).

### 1) Global UI/UX patterns

- Shared elements:
  - Logo/Brand (top‑left)
  - Currency selector (e.g., USDC) for denominating KPIs (TVL, AUM, share price)
  - CONNECT WALLET button (top‑right and side panel). Network selector (Testnet/Mainnet)
  - Right side panel: Discover, Arkas, Governance, Assets, Managers, Integrations, Dashboard
  - Global search “Search Arkas” with typeahead
  - Pagination component
  - States: loading, empty, error, wallet not connected, unsupported network
  - Units/format: thousands separators, currency, green/red percentages, relative timestamps
  - Charts: range (1D/1W/6M/1Y/ALL), tooltip, time axis
- Roles:
  - Visitor: read‑only
  - Investor: deposit/redeem, personal view
  - Manager: create/configure Arka, policies/fees modules
  - Governance: propose/vote
- Data sources (high level):
  - Soroban contracts: `ArkaFactory`, `Arka`, `Router`, `Adapters` (Aquarius, SoroSwap, Balanced, Blend), `Governor`, `Timelock`, `ArkaRegistry`
  - Indexer & NAV API: NAV/share, TVL, AUM, aggregated returns, counters, events

### 2) Discover (Home)

- Goal: overview and discovery of popular/curated/new Arkas
- KPI header: Arkas count, TVL, Withdrawals/Deposits count, Managers count, Managers fees earned, Total Arkas profits, Protocol fees
- Discovery tabs: Popular, Curated, New
- Arka cards (grid): name, depositors, AUM, sparkline, share price + 24h change, CTA

### 3) Arkas Leaderboard

- Controls: currency selector, CONNECT WALLET, search
- Table columns: Arka (name/manager), Managed (AUM), returns by period, Risk score, Points, Row action → detail
- Features: sorting, pagination, filtering

### 4) Arka Detail

- Top bar: currency selector, CONNECT WALLET, DEPOSIT button
- Tabs: Overview, Portfolio, Financials, Fees, Policies, Depositors, Activity, My Deposit
- Overview: AUM, Depositors, Avg Monthly Return, Denomination asset, main chart (NAV/share)
- Portfolio: composition by asset (code, issuer, weight, amount, valuation, sparkline)
- Financials: AUM, TVL, fees paid (manager/protocol), PnL total/by period (CSV export)
- Fees: management/performance/entry/exit fees, splits, accrual cadence
- Policies: asset whitelist, share transferability (free/permit‑list), deposit caps (per tx/wallet/window) and global cap, redemptions (notice/cooldown/exit‑fee), coverage lock
- Depositors: table (wallet, shares, value, since, last action)
- Activity: on‑chain feed (DEPOSIT, REDEEM, REBALANCE, FEE_CHARGED, POLICY_UPDATE, …)
- My Deposit: my_shares, avg_entry_price, current_value, pnl_%/abs, actions: Deposit, Redeem

### 5) Create Arka – Wizard (Manager)

- Steps: Before you start → Basics → Fees → Shares transferability → Deposits → Redemptions → Assets management → Review
- Basics: Name, Symbol (SAC), Denomination asset(s)
- Fees: Management %/y, Performance %, Entry/Exit %, splits, cadence
- Shares transferability: freely transferable vs permit‑listed
- Deposits: permit‑list of depositors, min/max per deposit, reject all, global cap
- Redemptions: notice/cooldown/exit‑fee window, max slippage on liquidation path
- Assets management: whitelist, rebalance cadence, router, slippage tolerances, coverage lock %, CCF params
- Review: summary + gas/tx estimate; actions: `ArkaFactory.create_arka`, post‑init setters

### 6) Assets (explorer)

- Table: asset_code+issuer, supply/held, 24h change, price, price 24h change, AUM exposure; controls: currency selector, search, pagination

### 7) Integrations

- Partners grid (logo + details): Blend, SoroSwap, Aquarius, Balanced, Phoenix, Comet, etc.
- Tile shows if adapter is active; links to external details

### 8) Governance (DAO)

- Tabs: Overview, Members, Proposals (primary)
- Left panel (proposals list): id, title, submitted ago, status; actions: Approve/Reject
- Right panel: counters, user voting power (delegate), stats
- Contracts: Script3 `Governor` + `Timelock`. Current tranche: Governor controls `ArkaFactory` admin via Timelock. Next: governed setters in `Arka`.

### 9) Dashboard (user)

- Tabs: My deposits, My Arkas, Activity
- Header: Total Portfolio Value + change; chart with ranges
- Table: name, all‑time/this‑month/7d sparkline, share price, shares, value; summary totals

### 10) Deposits – Policies (wizard)

- Modules: Limit wallets permitted to deposit (permit‑list), Deposit limits (min/max, reject all). Banner: restrictive nature of policies

### 11) Managers Leaderboard

- Table: Rank, Manager (handle/avatar/level), Level int, Arkas count, AUM total, Joined, Total Return %, Fees earned total; sorting, pagination, search

### 12) Router & Rebalance (functional logic reflected in UI)

- Atomic Rebalancing Router: UI shows best‑path across Aquarius/SoroSwap/Balanced/Blend with slippage guard; Activity logs
- Slippage limit editable per Arka/policy
- Pre‑trade checks: per‑hop quotes with fallback path

### 13) Coverage (Dual Coverage System)

- Managers: coverage lock % (vault insurance)
- Users: Community Coverage Fund (staking with yield)
- UI: indicators in Overview/Policies and deposit/withdraw module for the fund

### 14) Security, states, validations

- Wallet connection & network checks
- Limits: min/max, caps, allowlists
- Temporal locks: cooldowns, notice periods
- Errors: actionable messages (retry, slippage, insufficient funds, missing approval)

### 15) Telemetry & metrics

- Indexer & NAV API latency < 200 ms (Tranche 3); monitoring & alerting

### 16) Screen → contracts/events mapping

- Discover/Leaderboards: `ArkaFactory`, `Arka` → `ArkaCreated`, `Deposit`, `Redeem`, `FeeCharged`
- Arka Detail: `Arka` → `Rebalance`, `PolicyUpdated`, `CoverageLocked`
- Wizard: `ArkaFactory`, `Arka` → `ArkaCreated`, `ParamSet`
- Integrations: `Router`, `Adapters` → `SwapExecuted`, `RouteQuoted`
- Governance: `Governor`, `Timelock` → `ProposalCreated`, `VoteCast`, `ProposalExecuted`
- Dashboard: `Arka`, `SAC` → `Deposit`, `Redeem`

### 17) Acceptance checklist (MVP)

- Discover: KPIs from indexer; Popular/Curated/New lists with pagination
- Arkas Leaderboard: sortable columns; risk/points badges
- Arka Detail: Overview + chart; tabs Portfolio/Financials/Fees/Policies/Depositors/Activity/My Deposit
- Wizard: Basics, Fees, Transferability, Deposits, Redemptions, Assets mgmt, Review
- Assets: price + AUM table
- Integrations: grid with adapter status
- Governance: proposals list + actions; Delegation
- Dashboard: portfolio chart + positions + KPIs
- Managers: ranking with Level/Tier and metrics

### 18) Glossary

- Arka: tokenized automated multi‑asset fund (SAC)
- SAC: Share Asset Class – the Arka participation token
- AUM/TVL: assets under management / total value locked
- NAV/share: net asset value per participation
- Router/Adapter: multi‑hop routing engine and protocol connectors
- Governor/Timelock: governance contracts with execution delay
- Coverage lock: % of assets locked as insurance

