# Arka Identity And Create Success UX

Date: 2026-07-07

This note records the proposed product direction for two user-facing gaps:

- New Arka creation currently confirms the transaction, but the success state is too easy to miss.
- Arka and manager screens currently rely too heavily on contract addresses, which is technically correct but weak as a commercial product identity.

## Create Success State

After a wallet signs and the factory confirms the Arka creation transaction, the UI should show a clear success state.

Recommended pattern:

- Keep the existing transaction rail for detailed status.
- Add a short live success notice using the same visual language as transaction feedback cards.
- Add a persistent success dialog or completion panel with the created Arka address and next actions.

Suggested user copy:

Title: `Arka created`

Body: `Your Arka is ready.`

Details:

- `Arka address`: shortened contract address, with copy action.
- `Manager`: shortened manager wallet, with copy action.
- `Next step`: `Open the profile to review the Arka, or go to execution tools to prepare deposits, allocations and routes.`

Primary actions:

- `Open profile`
- `Go to execution`
- `Copy address`

Acceptance criteria:

- The success message is visible without reading raw transaction logs.
- All text stays inside its containers at desktop and mobile widths.
- Address boxes have enough vertical and horizontal padding.
- Status badges such as `Ready` never touch their borders.
- The pattern reuses the existing Arka transaction surface style instead of introducing an unrelated toast system.

## Editable Commercial Identity

The contract address remains the canonical technical identity of an Arka. The manager wallet remains the canonical technical identity of a manager. These identities must not be hidden or replaced.

On top of that, Arka should support editable commercial metadata:

- Arka display name.
- Arka short description.
- Arka logo or avatar.
- Manager display name.
- Manager avatar.
- Optional manager website/social links.

Recommended ownership model:

- Arka metadata can be edited by the Arka manager/controller account.
- Manager metadata can be edited only by the manager wallet.
- Edits must require wallet signature.
- The frontend should always keep the shortened canonical address visible near the display name.

Recommended trust model:

- Display names are not unique by default.
- Verification status must be explicit and separate from the name.
- Suggested statuses: `Unverified`, `Curated`, `Verified`, `Official`.
- `Official` should be reserved for tightly controlled cases.
- `Curated` and `Verified` should be governed by platform policy.

Anti-impersonation requirements:

- Do not allow a display name alone to imply platform endorsement.
- Show the shortened address beside or below the display name on profile and discovery cards.
- Show verification state consistently wherever a name appears.
- Preserve address search as a first-class lookup path.
- Reserve or block misleading names through governance or operator policy if needed.

Implementation direction:

- Start with signed off-chain metadata stored by the indexer/API for speed and iteration.
- Keep metadata updates non-custodial: the server verifies signatures but does not sign for users.
- Later, if needed, anchor metadata hashes or a name registry on-chain.
