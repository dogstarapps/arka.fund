# Sushi-only application candidate R58
Configuration and application sequence only. Product runtime and all 24 selected WASM are R56 unchanged. The seven shared roles and two templates are the launch subset, not permission to upgrade existing components. Noah stays V2 and the existing root authority is retained.

frontend-build-env.json is the exact input to the fresh local Next build. The execution capability is compiled in, but the backend must keep mainnetApproved=false and executionEnabled=false until target qualification and separate authorization. No wallet interface, signing or submission is exercised here. This local Mac output does not establish compatibility with a hosted Linux build.

application.json is a reviewed draft, not a deployable production configuration: target IDs, salts, constructor arguments, template hash, RPC/catalog URLs, timelock values, treasury and final fee are deliberately unresolved. The last observed 10-USDC production fee is distinct from the 5-USDC R57 fixture. No fee change is authorized. The historical Aquarius auxiliary pin in factory-constructor-profile.json is compiled helper metadata; bootstrap_auxiliaries is forbidden and the new managed allowlist is Sushi-only.

Do not enable Sushi merely by applying the frontend. Activation, caller admission, guardian disable and timelocked recovery are contract operations. Frontend release, backend release/configuration and contract application are separate steps. Fixed claims must remain collectable after route disable. No migration, blind legacy upgrade, automatic keeper, signing or retry is added.

R58 external evidence binds source commit/release ID, exact environment, build ID/output digests, retained R57 frames, real local catalog/review HTTP and compiled-browser checks. Frozen R57 data verifies local UI integration; it does not qualify current liquidity, RPC retention, oracle freshness, TTL/restore/admission or production authorization.

Remaining launch gates: qualify current destination/production parameters; hosted exact-source CI and independent audit including open minimatch/crypto-bigint advisories; separately authorized real-wallet/device canary and controlled application/activation. Curve, RWA, SoroSwap and Aquarius are outside this launch scope.
