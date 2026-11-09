# Arka.fund public UX standard

This document is the release contract for user-facing product surfaces. It applies to Dashboard, Discover, Arkas, Arka profiles and actions, Assets, Managers, Integrations, Governance, Coverage and Create Arka.

## Economic values

- Display token balances in human-readable asset units and include the asset symbol or an unambiguous asset label.
- Display USD only when the source field is explicitly USD-denominated. Native NAV or token balances must never be passed to a USD formatter.
- Display missing USD valuation as `$0.00` while retaining a clearly labelled native balance where it helps the user. Never synthesize TVL from a native amount.
- Display fees, slippage, price impact and governance ratios as percentages. Basis points may exist in transaction payloads and contract code, but not as the public input or label.
- Use context-sensitive precision. Remove insignificant trailing zeroes and avoid long fixed-decimal values in cards, tables and buttons.
- When the surrounding card or row already identifies the asset, a balance may omit the repeated symbol. It must never fall back to the generic word `units`.
- Never replace missing production data with demo totals, generic contract IDs or fabricated history.
- Public cards and rows use at most four decimal places for ordinary sub-unit balances. Extra precision is reserved for genuinely tiny non-zero balances that would otherwise appear as zero.

## Information architecture

- Each route has one primary purpose and one representation of its main dataset.
- Dashboard provides a portfolio overview. Discover provides featured Arkas and search. Arkas provides ranking and filtering. The Arka profile explains the mandate; the Arka actions page handles deposits, redemptions, execution and credit.
- Assets and Managers use one summary plus one browsable result set. They must not repeat the same entities as cards, tables and telemetry panels on the same page.
- Long related collections are paginated. A manager profile shows at most six managed Arkas per page while keeping the complete collection reachable.
- Public Governance and Coverage explain current user-relevant state. Operator controls remain on restricted operator routes.
- Create Arka uses one step form, one stepper and one final review. A second visual summary, implementation checklist or design-frame explanation is not permitted.
- Contract and account identifiers are supporting information. Keep them in a labelled details disclosure unless the user is explicitly selecting, signing or verifying that identifier.
- Public chrome exposes one wallet entry point. A second wallet card or repeated connect prompt is not permitted beside the same workflow.
- A filter is strict: selecting Curated, a protocol, an asset or a manager must never substitute records outside that selection when the result is empty.
- View selectors must look and behave like controls, with a visible selected state, keyboard semantics and stable borders.

## Copy and status

- Every visible sentence must either inform a user decision or explain an action the user can take.
- A warning must identify what happened and, when the user can resolve it, provide the next action.
- Public surfaces must not expose development or implementation vocabulary such as `telemetry`, `canonical`, `control deck`, `command deck`, `current query`, `proof points`, `live mandate`, `execution ready`, `credit plan`, `base units`, `needs attention` or `action required`.
- AUTO is presented as Best execution: Arka compares the enabled protocols and selects the best valid route. Direct protocol selection remains available where supported.
- Public protocol categories use `Swaps` and `Lending`. Adapter families, settlement models and router implementation labels belong only on operator or advanced-detail surfaces.
- Unknown assets are labelled as an asset plus an abbreviated contract. A raw contract ID must not masquerade as a ticker.
- Public Arka status uses `Listed`, `Curated` or `Delisted`. Indexer lifecycle terminology is not a public product status.
- Fee labels use their complete names: `Management fee`, `Performance fee`, `Deposit fee` and `Redemption fee`. Abbreviations such as `MGMT` and `PERF` are not public copy.

## Charts and responsive layout

- Render a full chart only when there are at least two meaningful data points in the same declared unit.
- A missing or constant history uses one compact state; it must not reserve the area of a full chart or repeat the absence across empty metric cards.
- Cards and controls have stable responsive dimensions. Text cannot overlap, clip vertically or create horizontal page overflow at supported desktop and mobile widths.
- Controls for known assets, protocols and markets use selectors rather than free-form contract input.
- Forms and transactional workspaces use one column by default. Two columns are allowed only when every field retains a readable width; operational forms must never use three or four compressed columns.
- Three or four columns are reserved for short, comparable metrics. Descriptions, amounts, addresses, warnings and transaction feedback use rows, tables or a full-width block.
- Multi-column layouts collapse before labels, values or controls wrap into an unreadable stack. Mobile operational surfaces always use one column.
- Transaction feedback stays close to the action and uses the content height it needs. It must not create a tall side rail or an otherwise empty column.

## Release gates

- TypeScript, unit and integration tests must pass.
- Public Playwright checks scan visible copy, horizontal overflow and the principal Arka action workspaces on desktop and mobile.
- Any economic history test must assert its unit explicitly. A native-value history is not acceptable evidence for USD TVL.
- Visual screenshots are reviewed before deployment. Passing HTTP and overflow checks alone is not sufficient.
- Filters, result counts, wallet entry points, amount precision and fee names have explicit Playwright assertions. A layout-only screenshot cannot replace these behavioral checks.
