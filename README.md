# Arka.fund

Arka.fund is an on-chain asset management protocol built on the Soroban/Stellar network. It allows managers to create customizable investment arkas with diverse strategies, leveraging integrations with various DeFi protocols available on Stellar (AMMs like Aquarius, SoroSwap, Phoenix, Comet, Balanced, and lending protocols like Blend).

Depositors can easily invest in these arkas, gaining exposure to different strategies through arka-specific tokens representing their share. The protocol also features a DAO governance system for decentralized decision-making regarding fees, asset whitelists, protocol integrations, and other key parameters.

## Key Features

*   **Customizable Arkas:** Managers define parameters like denomination asset, fees, whitelisted assets, and deposit/redemption limits.
*   **DeFi Integration:** Utilizes a Router and Adapter system to interact seamlessly with multiple AMMs and lending protocols for optimal execution.
*   **DAO Governance:** Token holders can propose and vote on protocol changes through a Governor and Timelock system.
*   **On-chain Transparency:** All major operations (deposits, redemptions, rebalances, profit logging) emit events for easy tracking and auditing.

## Documentation

- Architecture: `docs/ARCHITECTURE.md`
- Deployment: `docs/DEPLOYMENT.md`
- Governance: `docs/GOVERNANCE.md`
- Security: `docs/SECURITY.md`
- UI Spec: `docs/UI_SPEC.md`

---

*This project is currently under development.* 

## Reproduce E2E (Testnet)

- Prerequisites: Soroban/Stellar CLI v23+, funded testnet key alias (e.g., `arka-holder`).
- Contract IDs and accounts: see `deployments.testnet.json`.
- Full walkthrough and context: `docs/TRANCHE1_E2E.md`.
- Aquarius end-to-end helper:
  
  ```bash
  NETWORK=testnet HOLDER_ALIAS=arka-holder bash scripts/aquarius/e2e.sh
  ```

This runs fee acquisition (if needed), pool creation, liquidity deposit, and a test swap (including via `adapter-aquarius`).

SoroSwap end-to-end helper:

```bash
NETWORK=testnet HOLDER_ALIAS=arka-holder bash scripts/soroswap/e2e.sh
``` 