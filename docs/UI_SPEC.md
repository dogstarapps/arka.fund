## Arka.fund – UI Spec (extracto MVP alineado por tranches)

### Objetivo
Concretar qué pantallas/funciones se entregan por tranche y qué depende del Indexer & NAV API.

### Tranche 1 (MVP técnico)
- Conexión de wallet (Freighter/xBull/Albedo) y swaps de prueba (Router y Adapter SoroSwap/Aquarius).
- Sin Discover/Leaderboards/Arka Detail completos.

### Tranche 2 (Vaults & Manager)
- Wizard de creación/configuración (subset MVP): Basics, Fees, Transferability, Deposits, Redemptions, Assets mgmt, Review.
- Depósitos/reembolsos con tokenización de shares (SAC) y políticas clave (allowlists, caps, slippage guard).
- DAO wiring: setters gobernados y upgrades/migraciones.
- Smart routing “best‑of candidates” multi‑AMM (on‑chain verificado).

### Tranche 3 (UX completa + Indexer)
- Indexer & NAV API: NAV/share, TVL, retornos por periodo, contadores, feeds de eventos.
- UI: Discover, Arkas Leaderboard, Arka Detail (Overview/Portfolio/Financials/Fees/Policies/Depositors/Activity/My Deposit), Managers leaderboard, Integrations grid, Assets explorer.
- Quotes multi‑protocolo y fallback path en UI, cobertura (UI) y telemetría.

### Dependencias técnicas
- Indexer: requerido para KPIs, gráficas y listados con ordenación/paginación.
- Contratos: `ArkaFactory`, `Arka`, `Router`, `Adapters`, `Governor`, `Timelock`.

### Checklist (MVP)
- [ ] Wizard subset operativo (Tranche 2)
- [ ] SAC por Arka visible en wallet (Tranche 2)
- [ ] Indexer básico para NAV/TVL (Tranche 3)
- [ ] Discover/Leaderboards (Tranche 3)


