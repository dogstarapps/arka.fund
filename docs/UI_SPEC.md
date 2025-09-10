## Arka.fund – UI Spec (MVP aligned by tranches)

### Goal
Define which screens/functions are delivered per tranche and which depend on the Indexer & NAV API.

### Tranche 1 (Technical MVP)
- Wallet connection (Freighter/xBull/Albedo) and test swaps (Router and SoroSwap/Aquarius Adapters).
- No full Discover/Leaderboards/Arka Detail yet.

### Tranche 2 (Vaults & Manager)
- Creation/configuration wizard (MVP subset): Basics, Fees, Transferability, Deposits, Redemptions, Assets mgmt, Review.
- Deposits/redemptions with share tokenization (SAC) and key policies (allowlists, caps, slippage guard).
- DAO wiring: governed setters and upgrades/migrations.
- Smart routing “best‑of candidates” multi‑AMM (on‑chain verified).

### Tranche 3 (Full UX + Indexer)
- Indexer & NAV API: NAV/share, TVL, period returns, counters, event feeds.
- UI: Discover, Arkas Leaderboard, Arka Detail (Overview/Portfolio/Financials/Fees/Policies/Depositors/Activity/My Deposit), Managers leaderboard, Integrations grid, Assets explorer.
- Multi‑protocol quotes and fallback paths in UI, coverage UI, telemetry.

### Technical dependencies
- Indexer: required for KPIs, charts, and sortable/paginated lists.
- Contracts: `ArkaFactory`, `Arka`, `Router`, `Adapters`, `Governor`, `Timelock`.

### Checklist (MVP)
- [ ] Wizard subset operational (Tranche 2)
- [ ] Per‑Arka SAC visible in wallets (Tranche 2)
- [ ] Basic Indexer for NAV/TVL (Tranche 3)
- [ ] Discover/Leaderboards (Tranche 3)

