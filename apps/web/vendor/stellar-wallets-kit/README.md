# Arka wallet subset

Licensed MIT source derived from @creit.tech/stellar-wallets-kit 1.9.5. This is a locally maintained subset, not an upstream release. Preserve LICENSE.

The application has always configured Freighter, Albedo and xBull. Their modules, original modal, state and types are preserved. index exports only those wallets and UI components; utils retains the original parseError without imports of unused wallets. No crypto implementation was changed. Hot Wallet, Trezor, Ledger and other unoffered modules are not shipped.

Maintain this directory in source control with package.json and lockfile. Check upstream module/security changes on future upgrades; rerun dependency audit, real-module connection/modal regressions, preview guards, and build. Signing validation is separately pending under human authorization.

Upstream: https://github.com/Creit-Tech/Stellar-Wallets-Kit
