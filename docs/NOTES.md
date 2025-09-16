## Arka.fund – Notes & Improvements (Testnet)

### 1) UX: Adapter vs Router swaps
- Problem: Adapter→Router nested call requires Soroban auth entries. Wallets typically prompt twice (auth entry + tx). With direct Router it’s a single prompt.
- Implemented: dApp now gathers and signs auth entries for adapter swaps.
- Improvements to consider:
  - Cache auth entries with longer expiration to reduce prompts within a session.
  - Keep a unified UI flow in the dApp even if the wallet shows multiple prompts.
  - Default to Router path for simple swaps; use Adapter only when multi-protocol routing is needed.

#### 1.1) Interim vs definitive routing
- Interim (quick path): funds from SoroSwap swaps are received by the manager (root signer), then forwarded to the Arka within the same transaction to bypass nested `require_auth` constraints.
- Definitive: the dApp simulates/assembles nested auth entries so the Arka remains the receiver; requires minor client updates and possibly Arka-initiated token approvals to protocol routers.

### 2) Governance coverage (DAO)
Goal: DAO governs protocol upgrades, configuration setters, adapter onboarding, and routing policies.

What should be governed (non-exhaustive):
- Upgrades:
  - `arka-factory`: `set_implementation(wasm_hash)` (via Timelock). Governs Arka logic upgrades and new deployments.
  - Core Router and Adapters: deploy/replace WASM; register/whitelist in Router.
- Configuration Setters:
  - `Arka`: fees, whitelist, manager address, router/adapter approvals.
  - Router: protocol allowlist/denylist, fee parameters (if any), default slippage guardrails.
  - Adapters: path presets (admin-gated), router binding, protocol-specific params.
- Adapter Lifecycle:
  - Add/remove adapters to the allowed set; require DAO approval before use in Router.
- Safety/Treasury:
  - Pause/resume switches where applicable; treasury movements under Timelock.

Runbook linkage and gaps:
- `GOVERNANCE_RUNBOOK.md` and `GOVERNANCE_WIRING.md` cover Governor/Votes deploy and wiring. Remaining items:
  - Ensure `arka-factory` admin is the Timelock (or Governor per design) and verify `set_governor()` executed.
  - Add proposal templates for:
    - `set_implementation` (upgrade Arka logic)
    - Register/approve new Adapters in Router
    - Update `Arka` parameters (fees/whitelist/router approvals)
  - Document how to queue/execute via Timelock (delay, grace, execution).

### 3) Best price routing – Manager-specified paths
Objective: Allow Managers to propose “best path” across tokens and protocols; DAO approves; Router enforces.

Design options:
- Manager proposals → DAO vote → Timelock sets:
  - Token path vector(s) for a given market (e.g., ARKA1→ARKA2 via intermediate tokens).
  - Protocol sequence (e.g., Aquarius hop then SoroSwap hop).
  - Slippage limits per hop and overall.
- Storage and enforcement:
  - Store approved paths in Router (mapping market→list of hops), per-protocol adapter chosen for each hop.
  - Router enforces only-approved paths; managers call `execute_multihop` referencing an approved path id.
- Flexibility:
  - Permit fallback to auto-router (off-chain computation) but require on-chain allowlist of tokens and adapters; transaction proves compliance with allowlist and max slippage.

Contract changes suggested:
- Router:
  - Add `approve_path(path_id, hops, slippage_bps)` (Timelock-only), `revoke_path(path_id)`.
  - `execute_path(path_id, amount_in, min_out, receiver)` consuming stored hops.
- Adapters:
  - Keep admin-gated path setters for protocol-level specifics if needed, or let Router pass full path to protocol adapters.

### 4) Action items
- Governance:
  - Add proposal scripts for: set_implementation, adapter register/approve, Arka setters.
  - Verify Timelock wiring for `arka-factory` admin; record tx hashes.
- Routing:
  - Draft Router path-approval interface and tests.
  - Decide: static approved paths vs. allowlist + on-the-fly off-chain routing proofs.
- dApp UX:
  - Cache auth-entry signatures where safe; graceful fallback to single-sign Router mode.
  - Show path details in UI (tokens/protocols/slippage) when using Adapter.

### 5) References
- `docs/Tranche1.md`: Testnet IDs and E2E.
- `GOVERNANCE_RUNBOOK.md`: Deploy and initialize Governor/Votes.
- `GOVERNANCE_WIRING.md`: High-level wiring and admin model.



