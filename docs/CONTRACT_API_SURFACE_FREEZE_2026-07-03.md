# Contract API Surface Freeze

Date: 2026-07-03

## Decision

Arka freezes the current production ABI before removing public entrypoints. We do not redefine the frontend or contracts by intuition. Every duplicate-looking method must be classified as one of:

- canonical product API
- compatibility alias blocked for direct frontend use
- protocol-specific policy/admin method
- test fixture or non-production artifact

The current manager-facing credit API is protocol-agnostic:

- `credit_supply`
- `credit_borrow`
- `credit_repay`
- `credit_withdraw`
- `credit_*` read methods for markets, positions, values, health and status

The direct `blend_*` credit entrypoints remain present in the current contract ABI only as compatibility surface. They are not allowed as direct frontend calls. The dApp must route credit actions and reads through the `credit_*` namespace.

The current contract implementation centralizes the write logic behind private internal helpers. The compatibility `blend_*` entrypoints and canonical `credit_*` entrypoints do not maintain separate copies of the supply, borrow, repay or withdraw logic.

## Current Compatibility Surface

The compatibility gate is implemented in `scripts/contract_api_surface_gate.py`.

It classifies:

- `arka.blend_lend` -> `arka.credit_supply`
- `arka.blend_borrow` -> `arka.credit_borrow`
- `arka.blend_repay` -> `arka.credit_repay`
- `arka.blend_withdraw` -> `arka.credit_withdraw`
- Blend-specific read aliases -> equivalent `credit_*` read methods
- `arka-factory.set_implementation` -> `arka-factory.set_implementation_controlled`
- `arka-factory.set_share_token_implementation` -> `arka-factory.set_share_impl_controlled`

Direct frontend calls to compatibility aliases are blocked by frontend unit tests.

## Next ABI-Breaking Cleanup

When we decide to deploy a new ABI intentionally, the next cleanup should:

- remove or make internal the direct Blend write aliases;
- decide whether protocol-specific Blend reads remain as documented diagnostics or are removed;
- add a generic governed credit-risk setter before removing `set_blend_risk_policy`;
- retire legacy factory setters once the controlled/governed lane is the only supported operation path;
- update deployment manifests and regenerate WASM hashes.

Until that explicit ABI migration, compatibility aliases stay identified, tested and blocked from direct dApp usage.
