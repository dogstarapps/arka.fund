# DAO Governance Operations Notes

Date: 2026-04-24  
Scope: current Arka.fund frontend and governance/control-room implementation

## 1. Short answer

Yes, the platform has many security and configuration variables that are meant to be governance-controlled.

But the current frontend state is important to describe honestly:

- the dApp already exposes the **read and operator-control surfaces**
- the dApp already exposes the **formal governance lifecycle**
- the dApp does **not yet** expose a fully generic "compose any governed mutation as a proposal" builder for every DAO-controlled setter

So the governance model is real, but the proposal authoring UX is still only partially productized in the frontend.

## 2. Which variables are DAO-governed

The main governed parameters already documented in the platform docs are:

- vault fees
- protocol fee split policy
- vault whitelist
- router binding
- manager rotation
- swap risk policy
- swap oracle pinning
- allowed venues / routers / adapters
- coverage treasury and coverage policies
- covered-vault policy
- coverage lock ratio
- claims-manager bindings
- factory implementation and share-token implementation
- executor delay / grace windows

Primary references:

- [CONTRACTS_SECURITY_AUDIT.md](./CONTRACTS_SECURITY_AUDIT.md)
- [ARKAFUND_PLATFORM_DOSSIER_2026-04-17.md](./ARKAFUND_PLATFORM_DOSSIER_2026-04-17.md)

## 3. How the frontend currently handles these governed variables

There are two distinct UI surfaces involved.

### 3.1 `/contracts`

This route exposes typed and raw operator controls.

You can:

- inspect the methods
- inspect the parameters
- read the current values
- attempt operational execution where allowed

But for DAO-governed writes, the route intentionally does **not** behave like an unrestricted admin panel.

The relevant policy lives in:

- [daoExecutionPolicy.ts](../src/lib/workflows/daoExecutionPolicy.ts)

Current rule:

- methods matching `set_*` are treated as DAO-sensitive by default
- a documented mutation set is also treated as DAO-guarded
- typed writes outside the governance executor lane are blocked
- raw writes are blocked unless they target the governance executor lane appropriately

That is why `/contracts` is a powerful control surface but **not** a governance bypass.

### 3.2 `/governance`

This route is the formal lifecycle surface.

Current supported lifecycle actions:

- propose
- vote
- close
- execute

Current proposal types modeled directly in the UI:

- `Council`
- `Snapshot`

So `/governance` is where the proposal lifecycle is explicitly handled, while `/contracts` is where low-level controlled methods are inspected and, if they are DAO-governed, intentionally redirected toward governance flow.

## 4. Can DAO-controlled security/config changes be done fully through the UI today?

Answer: **partially, but not fully generically**.

What is already true:

- the lifecycle UI exists in `/governance`
- the governed variables are visible through operator/control surfaces
- DAO-governed writes are recognized and blocked outside the correct path

What is **not yet** true:

- there is no fully generic proposal composer in the UI for "take this arbitrary guarded setter and wrap it into a governance operation payload"
- not every DAO-controlled setter can be authored end-to-end as a governance proposal from the current frontend alone

So the truthful answer is:

- governance exists
- DAO guards exist
- the complete generic governance proposal builder for all governed mutations is still a pending frontend capability

## 5. How is migration handled?

Today, migration is **not** a fully productized click-through governance workflow in the frontend.

What the frontend currently exposes:

- read-side migration inspection in `/contracts`
  - `migrated_to`
  - `migrated_from`

What exists outside the FE:

- migration scripts and operational tooling documented in the platform dossier

That means:

- you can inspect migration-related state from the UI
- you cannot yet perform a full migration request / proposal / execution workflow entirely through a dedicated migration wizard in the UI

So if the question is:

"Can I request a migration end-to-end through the current UI?"

The honest answer is:

- **not yet as a full dedicated flow**

## 6. What is `Council` in the DAO?

In the current implementation, `Council` is a specific governance target/type exposed by the governor flow.

Evidence in code:

- [governance/page.tsx](../src/app/governance/page.tsx)
- [soroban.ts](../src/lib/soroban.ts) via `buildGovernorProposeCouncil(...)`

Operationally, the UI treats it as:

- a governance proposal that rotates the operational council to a new address

So `Council` here is **not** "the whole DAO" and not just a generic label.
It is a specific governed authority/role target whose address can be rotated through governance.

In the UI:

- selecting `Council` proposal kind means the proposal payload is a council rotation
- the `New council` field is the target address that would become active if the proposal passes and is executed

## 7. Recommended product interpretation

If we describe the system in product terms:

- `/governance` = lifecycle and legitimacy
- `/contracts` = low-level operator surface
- migrations and arbitrary governed config packages = still not fully productized in the UI

That is the right mental model today.

## 8. Practical conclusion

If someone asks:

- "Are many security/configuration variables governed by DAO?"
  - yes
- "Are they all editable directly from UI as finished governance workflows?"
  - no, not yet
- "Is there already governance lifecycle in UI?"
  - yes
- "Is migration request already a first-class UI flow?"
  - no, currently it is still inspection + operator/script territory
- "What is Council?"
  - a governed operational authority target that can be rotated by proposal
