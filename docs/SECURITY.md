## Security

Stellar/Soroban exposes no public mempool, so outsiders can’t freely watch pending trades. A validator can see a private queue for ~5 s, but Stellar Core randomises ordering inside each ledger and fees don’t set priority, making deterministic front-running impractical.

We apply defence-in-depth safeguards (negligible cost <1%):
- Single atomic transaction with min_out: if any hop slips, the whole rebalance reverts.
- Short-window TWAP check: blocks swaps that drift beyond a safe threshold.
- Split-route planning in the dApp can recommend chunked execution before wallet handoff, but chunking is not yet enforced on-chain by `Arka`.

Additional hardening (roadmap):
- Per-hop slippage caps and max path length enforced by `Arka` policy.
- Allowlist of tokens/adapters; optional DAO-approved static paths for sensitive markets.
- On-chain or governance-backed chunk thresholds, max chunk size, max path length and route-cycle rejection.
- Randomised chunk sizing and subtle delays across chunks to decorrelate from price updates, if we decide to support that at the execution layer.
- Post-trade invariant checks (e.g., pool reserves sanity) to detect anomalies.

DAO swap guardrails implementation notes:
- See `docs/SWAP_GUARDRAILS_DAO_2026-04-10.md` for the 15-control policy set and current implementation phase.

Auth model notes (Testnet):
- SoroSwap requires root invoker auth for nested calls (`require_auth`). Two approaches:
  - Quick path (current): receive swap proceeds at the manager (root signer), then transfer to Arka within the same transaction.
  - Definitive: dApp simulates and assembles non-root auth entries for `rebalance→router→adapter→amm`; manager signs once; receiver is Arka.

These protections ensure robustness today and if future tooling ever exposes more mempool data.
