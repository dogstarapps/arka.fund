# Identity Metadata Frontend Impact Audit

Date: 2026-07-07

This document scopes the frontend impact of adding editable commercial identity for Arkas and managers.

The goal is not to replace contract addresses. The goal is to make addresses the canonical technical identity while adding user-facing names, descriptions and verification state.

## Product Rule

Every public surface should show:

- Primary label: editable display name when present.
- Secondary label: shortened canonical address.
- Trust label: `Unverified`, `Curated`, `Verified`, or `Official`.

Addresses remain searchable, copyable and visible. A display name alone must never imply endorsement.

## Data Required

Arka metadata:

- `arkaId`
- `displayName`
- `description`
- `avatarUrl`
- `verificationStatus`
- `updatedAt`
- `updatedBy`
- `signature`

Manager metadata:

- `managerAddress`
- `displayName`
- `bio`
- `avatarUrl`
- `websiteUrl`
- `socialUrl`
- `verificationStatus`
- `updatedAt`
- `signature`

## Edit Permissions

Arka metadata:

- Editable by the Arka manager/controller account.
- Update must be wallet-signed.

Manager metadata:

- Editable by the manager wallet.
- Update must be wallet-signed.

Platform verification:

- `Curated`, `Verified`, and `Official` are not self-asserted.
- These states should be controlled by governed policy or an operator/admin policy during bootstrap.

## Affected Frontend Surfaces

### Create Arka

Add an identity step before review:

- Arka name input.
- Optional short description.
- Optional logo/avatar.
- Manager display name prompt if no manager profile exists.
- Preview card showing `Name + shortened address after creation`.

The Arka contract is only known after create, so the form should explain that the address will be generated at creation.

### Create Success

After successful create:

- Show `Arka created`.
- Show display name if supplied.
- Show generated contract address.
- Offer `Open profile`, `Go to execution`, and `Copy address`.
- If metadata save happens after contract creation, show a separate metadata save state.

### Discover

Cards should use:

- Arka display name as card title.
- Shortened Arka address below.
- Manager display name if present.
- Shortened manager address below or inside a detail row.
- Verification badge visible near the name.

Sorting/search should match both display names and addresses.

### Arkas Leaderboard

Rows/cards should use:

- Display name first.
- Address as secondary technical identifier.
- Verification state as a badge.
- Existing TVL/profit/volume metrics unchanged.

### Arka / Vault Detail

Hero should use:

- Display name as page title.
- Shortened contract address as secondary line with copy action.
- Edit profile action only when connected wallet is authorized.
- Verification state near the title.

Profile sections should keep the technical contract visible for auditability.

### Managers

Manager list should use:

- Manager display name first.
- Shortened wallet address below.
- Verification state.
- Count of managed Arkas and TVL unchanged.

### Manager Detail

Hero should use:

- Manager display name as title.
- Shortened wallet address as secondary line with copy action.
- Edit profile action only when connected wallet matches the manager address.
- Managed Arka cards should use Arka display names.

### Assets And Dashboard

Any “current leader”, “largest exposure”, “manager”, or “top Arka” reference should use the identity component:

- Display name where available.
- Shortened address as secondary.
- Verification state when the reference is clickable or reputational.

### Integrations / Execution / Operator Surfaces

Selectors and execution handoffs should show:

- Display name for human recognition.
- Contract address for signing/audit safety.
- Search by both.

Technical routes that require raw contract IDs can keep addresses prominent, but should not use addresses as the only label when the user is selecting an Arka or manager.

### Search

Global/search boxes should match:

- Arka name.
- Arka address.
- Manager display name.
- Manager address.

If duplicate display names exist, results must disambiguate by address and verification state.

## Anti-Impersonation Requirements

- Duplicate names are allowed by default but clearly disambiguated by address.
- Verification state must be visually separate from the display name.
- Reserved names can be blocked or reviewed by governance/operator policy.
- The platform must not show `Official` unless the identity was granted by policy.
- Copy should avoid implying that unverified names are endorsed.

## Testing Requirements

- Unit tests for metadata formatting and fallback labels.
- Integration tests for signed metadata update validation.
- E2E tests for:
  - Create Arka with metadata.
  - Create Arka without metadata fallback.
  - Edit Arka profile as authorized manager.
  - Reject edit as unauthorized wallet.
  - Edit manager profile as wallet owner.
  - Duplicate display names in listings.
  - Search by name and address.
  - Verification badges on public cards and detail pages.
