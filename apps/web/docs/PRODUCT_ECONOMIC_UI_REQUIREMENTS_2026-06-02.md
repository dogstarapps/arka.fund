# Product Economic UI Requirements

Date: 2026-06-02

This document records the product requirement that was not fully satisfied by the current frontend: Arka.fund must behave like a financial product surface, not like a collection of technical contract panels.

## 1. Product Requirement

Public and manager-facing screens must explain:

- what each Arka is worth;
- what it is denominated in;
- what it holds;
- what it has earned or lost;
- how much volume and user flow it has seen;
- which venues, assets and oracle sources support the numbers;
- what action the user can safely take next.

Technical identifiers remain necessary internally, but they must not be the main user interface for product decisions.

## 2. Economic Information Required

The public product rail must expose these metrics when indexed data exists:

| Metric | Required display |
| --- | --- |
| NAV / AUM | Vault denomination first; USD estimate only when oracle-backed. |
| Return | 1D, 7D, 30D, 1Y and ALL where history exists. |
| P&L | In vault denomination and USD estimate where oracle-backed. |
| Volume | Routed volume in selected denomination and USD estimate where oracle-backed. |
| User flow | Deposits, redemptions, net flow and active depositors where available. |
| Portfolio | Asset weights, balances in token units, and value contribution. |
| Fees | Management, performance and any platform/coverage fee policy. |
| Risk/source | Oracle provider, timestamp, staleness/divergence state and missing-price blockers. |
| Scale | Number of Arkas, managers, assets and active venues. |

Rules:

- Do not aggregate NAV across mixed denominations unless an oracle-backed conversion is available.
- If oracle-backed USD valuation is unavailable, show grouped denomination totals instead of a fake single total.
- Do not show `base units` on public or manager product screens.
- `base units`, raw XDR, contract IDs and method names belong only in Advanced Console / operator diagnostics.

## 3. Selector And Dropdown Policy

Whenever the user is selecting something that already exists or must exist, the UI must use a catalog-backed selector instead of asking the user to type a contract, issuer, router, adapter or market ID.

Catalog-backed selector means one of:

- dropdown;
- searchable select;
- card selector;
- segmented control;
- typeahead that filters known records without creating arbitrary new IDs.

This applies to:

| Domain | Required user control |
| --- | --- |
| Asset / denomination | Select from core asset registry plus indexed catalog. |
| Allowed asset whitelist | Multi-select from known assets. |
| Vault / Arka | Searchable selector or linked list from registry/catalog. |
| Manager | Searchable selector from indexed managers or connected wallet identity. |
| Protocol venue | Dropdown/segmented control from enabled venue model. |
| Swap input/output asset | Select from current vault whitelist and route-supported assets. |
| Credit market | Select from configured Blend market catalog. |
| Oracle provider/feed | Select from configured oracle feed registry. |
| Fee policy preset | Dropdown or typed preset plus numeric fee fields. |
| DAO/governed action | Template selector; fields that reference known contracts/assets must also be selectors. |

Free text is allowed only for:

- numeric amounts;
- percentages;
- human-readable names/descriptions;
- proposal text;
- optional search filters;
- advanced operator raw contract/XDR tools.

## 4. Current Validation

Status: partially satisfied.

Observed compliant areas:

- Create Arka already uses a search/filter plus asset cards for denomination and whitelist selection.
- Create Arka persists selected denomination and whitelist in the wizard state instead of asking for manual contract entry.
- Vault execution uses selectors for deposit asset, rebalance protocol, input asset, output asset, credit protocol, credit action, credit market and credit asset.
- Balanced/SODAX token input/output is loaded from a token catalog and rendered as token selectors.
- Contracts uses typed action templates before raw invocation.

Observed gaps:

- The core asset registry currently covers only XLM, USDC, AQUA, XTAR and BLND; the intended initial asset universe also requires EURC, SHX, XRF, VELO and YBX.
- Some product copy still shows shortened contract IDs as primary detail when a known asset label should be primary.
- Integrations still exposes `Amount in base units` and `Minimum out base units`; that is acceptable only in operator/debug mode. Product and manager flows must use decimal token units.
- Governance composer still has contract-backed templates where target contract IDs or whitelist CSV values can be manual. Known vaults/assets should be selectable.
- Contracts and Migrations intentionally keep raw contract/hash inputs. Those surfaces must remain Advanced Console/operator-only and must never become the default product path.
- Public cards can still report technical posture without enough user decision value. A card must be a KPI, action, selection, warning or drill-down.

## 5. Required Data Model Changes

The asset registry must become the source of truth for visible asset selection and display:

- symbol;
- display name;
- network;
- classic code and issuer where applicable;
- SAC / selectable contract ID;
- decimals;
- home domain;
- icon source and TOML provenance;
- stablecoin flag;
- oracle feed IDs;
- supported venue coverage;
- mainnet/testnet availability state.

The catalog/API must expose:

- `denominationAsset`;
- `navDenomination`;
- `navUsdEstimate`;
- `sharePrice`;
- `returns`;
- `pnl`;
- `volume`;
- `flows`;
- `fees`;
- `portfolioWeights`;
- `oracleStatus`;
- `valuationSource`;
- `missingPriceReasons`.

## 6. Required UI Changes

Dashboard:

- replace ambiguous aggregate cards with AUM/NAV, returns, P&L, volume, flows, active Arkas and oracle confidence;
- group mixed-denomination totals or show oracle-backed USD estimates only.

Discover and Vault leaderboard:

- sortable rows/cards by NAV/AUM, return, P&L, volume, fees, asset count, manager and denomination;
- filters for denomination, asset, manager, protocol venue and status;
- no primary contract-ID labels where the asset/Arka has a known name.

Vault profile:

- Enzyme-like overview: NAV/share price, return chart, portfolio, activity, fees, depositors and policy;
- raw values only behind an advanced/provenance disclosure.

Create Arka:

- denomination and allowed assets stay catalog/card based;
- complete the initial asset universe;
- no manual contract field for denomination or whitelist on the normal path.

Integrations:

- public view becomes a compact venue capability matrix;
- operator details move behind Advanced Console;
- SODAX/Balanced inputs use token decimals and catalog labels in product/manager mode.

Governance:

- templates remain selected from dropdowns;
- known target contracts, assets, venues and oracle feeds become selectors;
- raw target/method/args stays only in the executor/operator handoff.

## 7. Acceptance Tests

Add or update tests so the requirement is enforceable:

- public and manager routes do not render `base units`;
- Create Arka denomination/whitelist has no manual contract input;
- known assets appear as labels/symbols before contract IDs;
- all initial assets are present in denomination and whitelist selectors;
- vault execution asset/protocol/credit controls are selectors;
- Governance known asset/venue/oracle fields use selectors;
- public NAV totals are not summed across denominations without oracle conversion;
- Integrations public view does not repeat blocked/unavailable panels without an action, warning or drill-down.

## 8. Product Rule

Before adding any new visible box, ask:

- Does it help the user evaluate economic performance?
- Does it help the user select an Arka, asset, venue or action?
- Does it warn about a real risk or missing prerequisite?
- Does it provide a drill-down into useful evidence?

If the answer is no, the box is noise and should not be on the public product rail.
