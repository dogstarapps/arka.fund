# Arka economics and security specification

Date: 2026-06-10

This document records the current on-chain economics and the security controls that protect depositor capital. It separates what is already implemented from the policy choices that still need to be fixed before mainnet.

Current status note, 2026-07-03: mainnet deployment facts are now anchored in `deployments.mainnet.json` and verified in `docs/MAINNET_REALITY_CHECK_2026-07-03.md`. The active mainnet manifest sets a `10.00 USDC` Arka creation fee, uses bootstrap admin `GBHIT7TXZSRWT4QZXKINECMQWKC7NC7GBJAGK6XFOURI3T6ZHJDTHCMD`, expires that bootstrap window on `2027-06-10T12:05:32Z`, records successful Phoenix/SoroSwap/Aquarius USDC-XLM canaries with `autoEnabled=false`, records Blend supply/withdraw canaries with borrow/repay disabled, and admits Balanced/SODAX as a server-side intent venue with `autoEnabled=true`.

## 1. Executive answer

### How much does it cost to open an Arka?

The contract supports an optional one-time creation fee in `ArkaFactory`.

Current behavior:

- If `ProtocolTreasury`, `CreationFeeToken` and `CreationFeeAmount` are configured and `CreationFeeAmount > 0`, the factory charges the manager at creation time.
- If any of those fields is missing, or the amount is zero, opening an Arka costs no protocol creation fee.
- The user still pays normal Stellar/Soroban network fees and storage/rent costs.

Current mainnet manifest:

- `CreationFeeToken` is USDC.
- `CreationFeeAmount` is `10.00 USDC`.
- Public product copy must show the human token amount before signing; it must not show raw base units.

Recommendation for launch:

- Do not launch public mainnet creation with a zero protocol creation fee unless creation is permissioned or rate-limited elsewhere.
- Use a small fixed anti-spam opening fee in `USDC` on mainnet, paid to the protocol treasury.
- Do not require payment in `ARKA` at launch. It adds friction before the token has mature liquidity and may confuse manager onboarding.
- Do not use arbitrary test/demo assets in production copy.

### Does opening an Arka have to cost something?

No. The protocol can monetize through ongoing fee splits instead of charging a creation fee, but a public permissionless factory still needs anti-spam friction.

Recommended product posture:

- Opening fee: fixed `USDC` amount at launch.
- Deposit/redeem fees: default `0%`, optional and capped.
- Management/performance fees: configured per Arka, with protocol-level caps and transparent manager/protocol split.
- Protocol revenue: primarily through a governed share of management/performance fees and optionally later a small platform overlay.

Rationale:

- Stellar network costs are low enough that a permissionless free factory can produce low-quality public Arkas.
- The opening fee is not the main revenue engine; it is an anti-spam and seriousness filter.
- The fee must stay low enough not to block real managers.
- Waivers can be handled off-chain or by DAO policy for curated/strategic launches.
- Creation and public discovery should be separate gates: an Arka may exist on-chain without being promoted in Discover, rankings or featured surfaces.
- Public listing should require additional quality signals such as paid creation fee, indexed NAV, minimum TVL, manager verification, DAO/curator approval or a non-spam activity threshold.

## 2. On-chain fee surfaces

### 2.1 One-time creation fee

Contract:

- `contracts/arka-factory/src/lib.rs`

Implemented functions:

- `set_creation_fee(token, amount)`
- `get_creation_fee_token()`
- `get_creation_fee_amount()`

Runtime behavior:

- `create_arka(...)` is permissionless but requires the manager signature.
- Before deploying the vault, `ArkaFactory` calls `charge_creation_fee(...)`.
- The fee is paid by `transfer_from(manager, treasury, fee_amount)` using the configured `CreationFeeToken`.
- This is a fixed token amount. It is not represented in basis points.

Governance:

- `set_creation_fee` is governor-controlled.
- The creation fee can be changed only through the factory governor/admin authority path.

Product rule:

- The Create Arka UI must always display the actual configured token and amount.
- If the factory returns no token or zero amount, the UI must say "No opening fee".
- On mainnet, "No opening fee" should be allowed only for a permissioned/beta factory, a DAO-approved waiver, or a temporary maintenance mode.
- The Discover/leaderboard indexer must not treat creation alone as a listing right.

Open decision:

- Mainnet creation fee token and amount are not final in the deployment manifest.
- Recommended policy range for v1: `10-100 USDC`, with `25 USDC` as a pragmatic default unless the DAO chooses a different value.

### 2.2 Vault fee structure

Contract:

- `contracts/arka/src/lib.rs`

Implemented structure:

```rust
FeeStructure {
    mgmt_bps,
    perf_bps,
    deposit_bps,
    redeem_bps,
}
```

All values are stored in basis points.

Basis points are ratios, not asset denominations:

- `1 bps = 0.01%`.
- `100 bps = 1.00%`.
- `10_000 bps = 100.00%`.
- The asset used for settlement depends on the operation: deposit amount, denomination output, NAV value or minted shares.
- The one-time creation fee is different: it is a fixed amount of the configured fee token, normally USDC.

| User-facing fee | On-chain field | Current mechanism |
| --- | --- | --- |
| Management fee | `mgmt_bps` | Annualized fee on vault NAV/AUM, accrued pro-rata over time. |
| Performance fee | `perf_bps` | Fee on profit above high-water mark. |
| Deposit fee | `deposit_bps` | Reduces the amount used to mint shares. It is not a separate transfer. |
| Withdrawal/redeem fee | `redeem_bps` | Reduces the denomination asset returned on redeem. |

Important product wording:

- The contract method is `redeem`, but the UI can call this "withdraw" if the user-facing meaning is capital exit.
- For precision, documentation should say "withdrawal/redemption fee".

### 2.3 Deposit fee

Implemented behavior:

- User signs `deposit(user, asset, amount)`.
- Asset must be whitelisted.
- Contract transfers the full `amount` from user to vault.
- Contract computes `net_amount = amount * (10_000 - deposit_bps) / 10_000`.
- Shares are minted from `net_amount`, not from gross amount.

Economic effect:

- Deposit fee dilutes the depositor by minting fewer shares.
- The withheld value remains inside the vault, benefiting existing shareholders.
- No separate transfer to manager or treasury occurs for deposit fee in the current implementation.
- `deposit_bps` is a ratio applied to the deposited amount. It is not a separate asset or a denomination choice.

Recommended launch policy:

- Default `deposit_bps = 0`.
- If enabled, cap at a very low value such as 0-50 bps.

### 2.4 Redeem / withdrawal fee

Implemented behavior:

- User signs `redeem(user, shares)`.
- Contract calculates gross denomination output from `shares / total_shares * NAV`.
- Contract computes `net_out = gross_out * (10_000 - redeem_bps) / 10_000`.
- User receives `net_out` in the Arka denomination asset.
- The difference remains inside the vault, benefiting remaining shareholders.
- `redeem_bps` is a ratio applied to the gross redemption value. The payout asset is the Arka denomination asset.

Security behavior:

- Redeem fails if the vault does not have enough liquid denomination balance.
- This protects vault solvency when capital is locked in Blend or other positions.

Recommended launch policy:

- Default `redeem_bps = 0`.
- Optional small anti-run fee can be enabled, but should be clearly displayed.

### 2.5 Management fee

Implemented behavior:

- Fees accrue over time from NAV:

```text
management_fee_value =
  nav * mgmt_bps * elapsed_seconds / YEAR_SECONDS / 10_000
```

- Settlement mints new vault shares to the manager and optionally to protocol treasury.
- It does not directly transfer underlying assets out of the vault.

Security/product effect:

- The manager earns ownership of vault shares, not direct asset withdrawals.
- Depositors are diluted transparently.
- `preview_fee_settlement()` exposes the expected fee before settlement.
- `settle_fees()` is permissionless.

Recommended launch policy:

- Allow manager-configured values but hard-cap them for mainnet.
- Suggested mainnet cap: 500 bps / 5.00% annually.

### 2.6 Performance fee

Implemented behavior:

- Performance fee uses a share-price high-water mark.
- It only accrues on profit above the previous high-water mark.
- Settlement mints shares to the manager and optionally the protocol treasury.
- Repeated settlement without new profit does not double-charge.

Recommended launch policy:

- Suggested mainnet cap: 3000 bps / 30.00%.
- Typical manager default: 0-20%.

### 2.7 Protocol fee split

Implemented structure:

```rust
ProtocolFeePolicy {
    mgmt_protocol_bps,
    perf_protocol_bps,
}
```

Behavior:

- The protocol treasury can receive a governed split of minted management/performance fee shares.
- If no treasury is configured, protocol fee shares are zero.
- This is currently a split of manager/performance fee shares, not a separate asset transfer.

Recommendation:

- Protocol split should be transparent in every Arka profile.
- Initial policy can be conservative:
  - 0-25% of management fee shares to treasury.
  - 0-10% of performance fee shares to treasury.

## 3. Current implementation status

| Surface | Implemented | Notes |
| --- | --- | --- |
| One-time create fee | Yes | Optional factory-level fee. Token and amount governed. |
| Deposit fee | Yes | Stored in `Arka`, applied by share minting math. |
| Redeem / withdrawal fee | Yes | Stored in `Arka`, applied to denomination returned. |
| Management fee | Yes | Accrues over time and mints manager/protocol shares. |
| Performance fee | Yes | High-water mark prevents double charging. |
| Protocol treasury split | Yes | Share split, not direct asset extraction. |
| Fee preview | Yes | `preview_fee_settlement()`. |
| Permissionless fee settlement | Yes | `settle_fees()`. |
| Mainnet fee caps | Not hard-wired | Current code allows 0-10000 bps. Product caps need an additional on-chain policy or strict governance process. |
| Mainnet creation fee policy | Not final | Manifest must define token/amount. Zero should be reserved for permissioned beta, DAO waiver or explicit maintenance mode. |

## 4. Security model: can the manager steal vault assets?

The manager cannot call a generic withdraw-to-manager function. There is no manager method that simply transfers vault assets to the manager.

Manager powers are operational and bounded:

- rebalance through configured routing paths;
- operate configured Blend credit markets;
- update policy only before governor handoff, or if still the policy authority;
- earn fees as minted shares, not direct transfers.

Capital exits for ordinary users happen through `redeem(user, shares)` and require the user's signature.

### 4.1 User deposits are user-authorized

Deposit requires:

- `user.require_auth()`;
- positive amount;
- asset must be whitelisted;
- token transfer from user to vault.

This prevents the manager from forcing unauthorized deposits.

### 4.2 User withdrawals are share-authorized

Redeem requires:

- `user.require_auth()`;
- user must own enough shares;
- vault must have enough liquid denomination asset;
- shares are burned before payout;
- payout goes to the user.

This prevents the manager from redeeming user shares or sending user assets elsewhere.

### 4.3 Rebalance is manager-authorized but policy-bounded

Rebalance requires:

- `require_manager(manager)`;
- every input/output asset must be whitelisted;
- vault must have enough liquid balance for the trade;
- configured swap risk policy must pass if enabled;
- route must use allowed routers/adapters when allowlists are configured;
- slippage/price-impact/oracle staleness checks can fail closed.

Implemented controls:

- asset whitelist enforcement;
- allowed routers/adapters;
- max trade size as bps of current liquid balance;
- oracle age check;
- price impact cap;
- slippage cap;
- TWAP/reference deviation cap;
- min-out per route step.

Important nuance:

- `allowed_routers` and `allowed_adapters` are fail-open when their configured lists are empty.
- For mainnet, the launch manifest must configure them to be non-empty and DAO/governor controlled.

### 4.4 Supported protocols only

The routing adapters in the repo include:

- SoroSwap;
- Aquarius;
- Phoenix;
- Balanced generic adapter shape;
- Blend credit adapter.

The manager cannot safely use arbitrary protocols if the Arka is configured with:

- non-empty `allowed_adapters`;
- non-empty `allowed_routers`;
- a whitelist containing only approved assets;
- enabled swap risk policy;
- configured swap oracle.

Mainnet requirement:

- `set_allowed_venues(...)` must be executed for each Arka or factory-created default flow must guarantee it.
- Phoenix, SoroSwap and Aquarius have successful mainnet USDC-XLM canaries, but the current manifest keeps them `autoEnabled=false`; they should only become AUTO venues after governance explicitly enables the venue policy for the intended route set.
- Balanced/SODAX has mainnet evidence through the SODAX server-side intent lifecycle and is `autoEnabled=true` in the current manifest. This is not the retired Balanced/Comet AMM-router lane and must remain behind its health/status/receipt/refund/expiry gate.

### 4.5 Blend lending/borrowing controls

Blend actions are not routed as normal swaps. They are credit operations.

Implemented controls:

- manager-only execution;
- asset whitelist;
- configured credit market;
- per-market allowed action flags;
- oracle freshness policy;
- minimum health factor;
- fail-close behavior for NAV and risky actions;
- redeem liquidity protection when assets are locked as collateral.

Mainnet requirement:

- Only known Blend markets/assets should be selectable.
- Oracle coverage must exist for every collateral/debt asset.

### 4.6 Governance and bootstrap admin

Implemented controls:

- policy methods use `require_policy_auth`;
- after a governor is set, policy changes require governor authorization;
- bootstrap admin can upgrade contracts only inside a bounded expiry window;
- max bootstrap admin window is 365 days in `Arka`;
- governor can clear bootstrap admin;
- upgrade stores `last_wasm_hash` and publishes an event.

Recommended launch policy:

- Use a multisig, not a single EOA, for the bootstrap admin if possible.
- If using EOA for speed, set a short explicit expiry and disclose it in the app.
- DAO/governor should take over long-lived policy and upgrade powers.

## 5. Security measures verified in code

| Control | Verified in code | Evidence |
| --- | --- | --- |
| Manager cannot freely withdraw assets | Yes | No generic manager withdrawal method; redemptions require user auth and shares. |
| Deposits require user auth | Yes | `deposit` calls `user.require_auth()`. |
| Redemptions require user auth | Yes | `redeem` calls `user.require_auth()` and checks user shares. |
| Asset whitelist on deposit | Yes | `deposit` calls `assert_asset_allowed`. |
| Asset whitelist on rebalance | Yes | `enforce_swap_risk_policy_for_step` checks asset in/out. |
| Manager-only rebalance | Yes | `rebalance` calls `require_manager`. |
| Allowed routers/adapters | Yes | `set_allowed_venues` + `assert_address_allowed_or_fail`. |
| Slippage / price impact / TWAP checks | Yes | Enforced when swap policy and oracle checks are enabled. |
| Oracle stale/invalid fail-close | Yes | Swap and Blend policies both include stale/invalid checks. |
| Blend action allowlist | Yes | `assert_credit_action_allowed`. |
| Redeem liquidity protection | Yes | `redeem` fails on insufficient liquid denomination. |
| Fees are share-minted, not direct manager transfer | Yes | Management/performance settlement mints shares. |
| High-water mark for performance fees | Yes | Implemented in `preview_fee_settlement_internal`. |
| Bootstrap admin expiry | Yes | Max 365 days in `Arka`; governor can clear. |

## 6. Gaps before mainnet

### Critical

1. Mainnet fee policy must be fixed.
   - Define creation fee token/amount.
   - Do not leave a public permissionless factory at zero opening fee without another anti-spam gate.
   - Define default management/performance/deposit/redeem fees.
   - Define protocol fee split.
   - Define listing/visibility criteria so spam Arkas do not pollute public product surfaces.

2. Hard fee caps are not currently enforced beyond 0-10000 bps.
   - Current code prevents invalid bps but does not enforce business caps.
   - Add on-chain caps or enforce through immutable/DAO policy before mainnet.

3. Mainnet Arka venue allowlists must be non-empty.
   - Empty router/adapter allowlists are fail-open.
   - This is acceptable for testnet flexibility, not for production vaults.

4. Oracle policy must be final.
   - Every admitted asset needs a provider/feed policy.
   - OracleGuard should be governed by DAO after bootstrap.

### High

1. Create Arka UI must show fee token in user-friendly asset terms, not raw contract ID.
2. Vault profile must show all fee terms before deposit.
3. Withdraw UI should preview gross out, withdrawal fee and net out.
4. Manager profile should show fee history and realized fee shares.
5. Protocol fee split should be visible as platform revenue, not hidden in internals.

## 7. Recommended mainnet economic policy v1

This is a product recommendation, not yet an on-chain final value.

| Item | Recommended v1 |
| --- | --- |
| Open Arka fee | Fixed `USDC` amount; recommended default `25 USDC` |
| Opening fee asset | USDC |
| Management fee manager cap | 5.00% yearly |
| Performance fee manager cap | 30.00% |
| Deposit fee cap | 0.50% |
| Withdrawal/redeem fee cap | 0.50% |
| Default deposit fee | 0.00% |
| Default withdrawal/redeem fee | 0.00% |
| Protocol management split | 0-25% of management fee shares |
| Protocol performance split | 0-10% of performance fee shares |
| Bootstrap admin | Multisig preferred; bounded expiry; DAO handoff |
| Venue allowlists | Non-empty, DAO governed |
| Oracle provider policy | OracleGuard with at least provider/freshness/divergence policy per asset |

## 8. Product requirements derived from this spec

Create Arka:

- Show "Opening fee: none" or the exact fee asset/amount.
- Show management/performance/deposit/withdrawal fees before signing.
- Use dropdowns/selectors for fee token if governance config is edited.

Vault deposit:

- Show deposit asset, amount, deposit fee, shares expected and share price basis.

Vault withdraw/redeem:

- Show shares burned, gross value, withdrawal fee, net amount and liquidity constraints.

Vault profile:

- Show current fee policy and protocol split.
- Show fee settlement history once indexed.

Governance/contracts:

- Fee changes must be proposal-based after DAO handoff.
- Creation fee changes must show token, amount and treasury.

Security UI:

- Show whitelisted assets.
- Show enabled protocols.
- Show blocked protocols and reason.
- Show oracle status and freshness.
- Show bootstrap admin expiry countdown until DAO handoff.

## 9. Industry reference

Arka should not copy Enzyme mechanically, but the broad pattern is aligned:

- Enzyme exposes management, performance, entrance and exit fees as configurable vault economics.
- Enzyme's public material describes vault fees as user-visible and contract-enforced, with management/performance and entrance/exit fee concepts.
- Enzyme also uses access/deposit controls and protocol/adapter restrictions as part of the vault safety model.

Sources:

- Enzyme docs FAQ: https://docs.enzyme.finance/onyx-faq
- Enzyme Blue vs Onyx product comparison: https://enzyme.finance/blue-vs-onyx
- Enzyme fee mechanics overview: https://medium.com/enzymefinance/monetising-your-vaults-the-inner-workings-of-fees-on-enzyme-d5b275e7b9f5
