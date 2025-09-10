## Security

Stellar/Soroban exposes no public mempool, so outsiders can’t freely watch pending trades. A validator can see a private queue for ~5 s, but Stellar Core randomises ordering inside each ledger and fees don’t set priority, making deterministic front-running impractical.

We apply defence-in-depth safeguards (negligible cost <1%):
- Single atomic transaction with min_out: if any hop slips, the whole rebalance reverts.
- Short-window TWAP check: blocks swaps that drift beyond a safe threshold.
- Auto-split of large orders: keeps each chunk small, lowering potential MEV payoff.

Additional hardening (roadmap):
- Per-hop slippage caps and max path length enforced by `Arka` policy.
- Allowlist of tokens/adapters; optional DAO-approved static paths for sensitive markets.
- Randomised chunk sizing and subtle delays across chunks to decorrelate from price updates.
- Post-trade invariant checks (e.g., pool reserves sanity) to detect anomalies.

These protections ensure robustness today and if future tooling ever exposes more mempool data.
