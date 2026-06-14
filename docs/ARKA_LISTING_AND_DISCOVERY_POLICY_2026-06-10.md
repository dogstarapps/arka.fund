# Arka listing and discovery policy

Date: 2026-06-10

This note defines how Arka creation, registry inclusion, public listing, and curated discovery should be separated for mainnet.

## 1. Core principle

Creating an Arka is not the same thing as being promoted in the product.

The platform should treat these as separate states:

- `registered`: the Arka exists on-chain and is known by the canonical registry.
- `indexed`: the catalog can read the Arka and compute a product record from real contract data.
- `listed`: the Arka appears in default public discovery and ranking surfaces.
- `curated`: the Arka or its manager is intentionally promoted by governance or a delegated curator process.
- `delisted`: the Arka is hidden from public discovery because it is spam, broken, unsafe, deprecated, or policy-ineligible.

This separation lets the protocol become permissionless without forcing Discover to display every low-quality or spam vault.

## 2. Current implementation

Implemented on-chain today:

- `ArkaRegistry.register(caller, manager, arka)` records Arkas through an authorized writer.
- `ArkaRegistry.get_arkas(offset, limit)` returns active Arkas.
- `ArkaRegistry.get_arkas_by_manager(manager, offset, limit)` returns active Arkas for one manager.
- `ArkaRegistry.set_manager_curated(caller, manager, curated)` marks a manager as curated.
- `ArkaRegistry.set_delisted(caller, arka, delisted)` hides or restores a specific Arka.
- `ArkaRegistry.count()` and `count_by_manager(...)` exclude delisted Arkas.

Important behavior:

- Delisted Arkas are excluded by registry reads.
- Curation is currently manager-level, not per-Arka.
- There is no distinct per-Arka `listed` or `verified` status yet.

Implemented off-chain today:

- `catalog-api` carries `curated` and `delisted` fields.
- `catalog-api` supports curated and delisted filtering.
- The dApp can request curated-only leaderboard/discovery views.

## 3. Mainnet v1 policy

For a guarded mainnet launch, public surfaces should use this rule:

- Default Discover and leaderboard views show indexed, non-delisted Arkas that pass product eligibility.
- Curated/featured views show only governance-curated managers or future per-Arka curated records.
- Direct address/profile access can still show a valid registered Arka that is not listed, with clear status.
- Delisted Arkas should not appear in default public lists.

Product eligibility should require:

- valid mainnet contract addresses;
- real assets only;
- denomination asset configured;
- price/oracle coverage for TVL;
- successful catalog indexing;
- no delisted flag;
- no blocked protocol/venue dependency;
- either a paid creation fee, a DAO/curator waiver, a minimum TVL/deposit, or another objective anti-spam signal.

## 4. Creation fee relationship

Creation fee and listing are related, but not identical.

The creation fee is an anti-spam cost at factory creation time. Listing is a product and governance decision about what appears in public discovery.

Recommended launch posture:

- Keep a small fixed USDC creation fee while creation is public.
- Allow DAO-approved waivers for strategic or internal launches.
- Do not treat payment alone as a right to be featured.
- Do not treat creation alone as a right to appear in every public ranking.

Future free creation is possible only if one of these controls is active:

- permissioned/beta creation;
- minimum deposit before public listing;
- listing bond;
- DAO/curator approval;
- strict product eligibility enforced by the catalog and public UI;
- rate limiting or an equivalent anti-spam mechanism.

If creation is free and permissionless while every Arka is automatically registered and listed, the public product can be spammed and the registry/catalog can become noisy.

## 5. Governance model

The frontend can choose its presentation, but the canonical policy should not live only in the frontend.

Recommended authority split:

- Registry/governor controls delisting and curation.
- Factory/governor controls creation fee.
- Catalog applies objective eligibility checks derived from on-chain state and pricing/indexing status.
- Frontend uses the catalog policy by default and exposes filters without inventing hidden rules.

During bootstrap, the time-bounded admin may operate these settings. After handoff, the DAO or a DAO-appointed curator/multisig should own them.

This avoids arbitrary product decisions while preserving emergency response. A frontend-only allowlist is acceptable as an additional product filter, but not as the sole source of truth for a credible open protocol.

## 6. Recommended future contract/indexer extension

The current registry is enough for a guarded launch, but a cleaner long-term model would add one of:

- per-Arka `listed` flag;
- per-Arka `verified` flag;
- per-Arka `ListingTier` enum such as `Registered`, `Listed`, `Curated`, `Suspended`;
- events for listing-tier changes so indexers can build an auditable discovery history.

This would make the public discovery policy more precise than the current manager-level curation plus Arka-level delisting model.

## 7. Mainnet checklist impact

Before mainnet public creation:

- decide the creation fee token and amount;
- decide whether creation is permissionless, permissioned, or waiver-based;
- publish the public listing criteria;
- configure the dApp to default to listed/non-delisted Arkas;
- ensure delisting/curation actions are available through the admin/DAO operations surface;
- document who can delist during bootstrap and when that authority expires;
- add a migration path to per-Arka listing tiers if the launch expects free permissionless creation later.
