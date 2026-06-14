# Sistema de Tokens y Tokenomics de Arka.fund (2026-04-11)

Este documento consolida el **sistema completo de tokens propios de la plataforma** y su tokenomics real en este repositorio, tomando como fuente de verdad:

- contratos en `contracts/*`
- validaciones y IDs en `deployments.testnet.json`
- documentación funcional existente (`TOKENOMICS.md`, `TOKEN_POWER.md`, `COVERAGE.md`, `ARCHITECTURE.md`)

## 1. Resumen ejecutivo

Arka.fund tiene tres capas tokenizadas principales:

1. **Token de protocolo y poder de gobernanza:** `ARKA` + `locked ARKA`.
2. **Tokenización por vault (Arka):** share token por vault (mint/burn en `deposit/redeem` y settlement de fees).
3. **Capa de cobertura/seguro:** `reserve_token` (capital y claims) + `bootstrap_reward_token` (incentivos).

Además, existe una **capa de distribución programable** (no un token nuevo) para ARKA:

- `arka-vesting` (grants con vesting lineal)
- `emissions-controller` (streams lineales de emisiones/distribución)

`dARKA` está explícitamente **diferido** y **no forma parte** del stack de primera release implementado.

## 2. Inventario de tokens propios y relacionados

### 2.1 Tokens canónicos de tokenomics (primera release)

### A) ARKA (`arka-token`)

- **Contrato:** `contracts/arka-token/src/lib.rs`
- **Naturaleza:** token líquido transferible.
- **Superficie:**
  - `init(admin, name, symbol, decimals, max_supply?)`
  - `mint`, `burn`, `admin_burn`
  - `approve`, `allowance`, `transfer`, `transfer_from`
  - `set_admin`, `max_supply`, `total_supply`
- **Supply/cap:**
  - supply cap **opcional** en `init` (`max_supply: Option<i128>`).
  - si hay cap, `mint` lo respeta (`MaxSupplyExceeded`).
- **Tokenomics/uso económico:**
  - activo base de alineación y gobernanza.
  - activo de financiación de vesting/emisiones.
  - activo que se bloquea en `locked-arka` para poder de voto.

### B) locked ARKA (`locked-arka`)

- **Contrato:** `contracts/locked-arka/src/lib.rs`
- **Naturaleza:** poder de voto no transferible derivado de ARKA bloqueado.
- **Superficie:**
  - `create_lock`, `increase_amount`, `extend_lock`, `withdraw`
  - `delegate`, `get_votes`, `get_past_votes`, `get_past_total_supply`
  - `set_vote_sequence`
- **Modelo económico:**
  - 1:1 entre principal bloqueado y poder de voto.
  - no es un modelo de decaimiento temporal tipo ve-token clásico.
  - lock window gobernado por `min_lock_ledgers` y `max_lock_ledgers`.
- **Tokenomics/uso económico:**
  - gobernanza (voto y delegación).
  - checkpointing histórico para compatibilidad con Governor.

### C) Distribución de ARKA: vesting y emisiones (motores)

#### `arka-vesting`

- **Contrato:** `contracts/arka-vesting/src/lib.rs`
- **No crea token nuevo:** administra asignaciones de ARKA ya financiadas.
- **Flujo económico:**
  - `create_grant` transfiere ARKA aprobado al contrato.
  - `claim`/`claim_all` libera ARKA linealmente.
  - `revoke` puede devolver no vested a `refund_recipient`.

#### `emissions-controller`

- **Contrato:** `contracts/emissions-controller/src/lib.rs`
- **No crea token nuevo:** administra streams de ARKA ya financiados.
- **Flujo económico:**
  - `create_stream` fondea el stream con ARKA aprobado.
  - `release`/`release_all` libera ARKA accrual.
  - `cancel_stream` devuelve no accrued a `refund_recipient`.

### 2.2 Tokenización de vaults (Arkas)

### D) Share token por Arka

- **Contratos relevantes:**
  - `contracts/arka/src/lib.rs`
  - `contracts/arka-factory/src/lib.rs`
- **Naturaleza:** token de participación de cada vault (ownership del AUM).
- **Ciclo de vida:**
  - `deposit` en Arka => mint de shares.
  - `redeem` => burn de shares.
  - settlement de fees => mint adicional de shares a manager/tesorería (dilución explícita).
- **Tokenomics del share:**
  - no hay emisión fija global; la emisión es función de depósitos/fees.
  - el valor se ancla al NAV del vault.
- **Notas de implementación:**
  - la dirección del share token se guarda en `DataKey::ShareToken`.
  - la implementación del share token se fija a nivel factory vía `set_share_token_implementation`.
  - en este repo, para validaciones y despliegues de referencia se usa `artifacts/test-token.wasm` como implementación de share token gobernable.

### 2.3 Capa de cobertura (coverage subsystem)

### E) reserve_token

- **Contrato económico:** `contracts/coverage-fund/src/lib.rs` (configurado por dirección).
- **Rol:**
  - activo de stake de comunidad.
  - activo de primas reales.
  - activo de payout de claims (con `coverage-vault` + `claims-manager`).
- **Tokenomics:**
  - es el activo que soporta solvencia real del subsistema de cobertura.
  - claims consumen primero retained reserve y luego principal staked socializado.

### F) bootstrap_reward_token

- **Contrato económico:** `contracts/coverage-fund/src/lib.rs` (configurado por dirección).
- **Rol:**
  - incentivo adicional bootstrap para stakers.
- **Tokenomics:**
  - stream separado de rewards respecto a reserve rewards.
  - claim independiente o conjunto (`claim_bootstrap_reward`, `claim_all`).

### 2.4 Tokens de soporte/no canónicos (no parte del tokenomics final de producto)

- `contracts/test-token/src/lib.rs`: token utilitario de test/harness (también usado como implementación de share token en algunos flujos de validación).
- `contracts/governance-token/src/lib.rs`: token mínimo para demos/compatibilidad histórica; **no** es la base canónica del modelo actual (`ARKA + locked ARKA + executor`).
- `tokens.ARKA1/ARKA2` en `deployments.testnet.json`: activos de pruebas de integración de swaps, no el token de gobernanza ARKA del protocolo.

## 3. Tokenomics por flujo económico

### 3.1 Flujo A: ARKA -> vesting/emisiones -> lock/voto

1. Gobernanza/admin mint de ARKA (cap opcional).
2. Fondeo de `arka-vesting` y `emissions-controller` con ARKA.
3. Beneficiarios reclaman/liberan ARKA accrued.
4. Parte del ARKA líquido se puede bloquear en `locked-arka` para votar.

Resultado: separación limpia entre liquidez (ARKA) y poder de gobernanza (locked ARKA).

### 3.2 Flujo B: Depósito en Arka -> shares -> fees

1. Usuario deposita activo de denominación.
2. Arka calcula shares sobre NAV y minta shares al usuario.
3. En `redeem`, quema shares y devuelve activos netos.
4. Management/performance fees se materializan en shares nuevas para manager/tesorería según policy.

Resultado: tokenomics de vault basado en NAV + inflación de shares por fee settlement.

### 3.3 Flujo C: Cobertura -> primas -> reservas/recompensas/claims

1. Stakers aportan `reserve_token`.
2. Vaults cubiertos pagan primas según:

`premium = covered_nav * annual_premium_bps * coverage_period_bps / 10_000 / 10_000`

3. `pay_premium` enruta según policy:
  - `reserve_retention_bps` -> retained reserve
  - `treasury_share_bps` -> tesorería (solo si target de reserva cumplido)
  - resto -> reserve rewards para stakers
4. `bootstrap_reward_token` añade incentivo paralelo.
5. En incidentes: manager first-loss (`coverage-vault`) y luego comunidad (`coverage-fund`).

Resultado: cobertura con capital real y control explícito de solvencia.

## 4. Gobernanza y control de política tokenómica

- `ARKA`:
  - admin rota con `set_admin`.
  - mint/burn bajo auth de admin o holder (según método).
- `locked-arka`:
  - admin/governor controlan policy crítica (`set_vote_sequence`, gobierno).
- `arka-vesting` y `emissions-controller`:
  - `set_governor` permite handoff a executor gobernado.
  - creación/cancelación/revocación bajo auth de policy.
- `coverage-fund`:
  - policy de primas y distribución gobernada (`set_economics_policy`, `set_covered_vault_policy`).

## 5. Estado testnet validado (evidencia)

`deployments.testnet.json -> validatedModules` incluye contratos validados:

### `tokenomicsFoundation`

- `arkaToken`: `CALQK6EXWMS6DTLEXH2VMUYOQTKLF2VU7YL6W2MFDFVPJKMCTAA2MLAF`
- `lockedArka`: `CB2WWHAJYF7WPQMBCAEUBK7TWGTYMWRMFD36NOX5VCTRWF6TKXALV5M7`
- `arkaVesting`: `CCXLFWBZOEZSV4G6YGJKBZ3EH24KH6FRODYOFOE2UHP4KVYA5HNFZC6J`
- `emissionsController`: `CCOJLJIJFOUGK5YJKY4ISI3U3SOUNRHMDYUST67MQCHBRTOVLUBWGAZ4`

Checks registrados:

- `teamVotesFinal = 1000`
- `teamLiquidAfterLock = 2000`
- `teamVestedFinal = 3000`
- `ecosystemReleasedInitial = 2400`

### `coverageClaims`

- `reserveToken`: `CCP2QJYCVBIFFLW6NLEUWZHPTN2NV4I6DDH2OVCGMRFJDIUYWQ32RLG4`
- `bootstrapToken`: `CCHFRAFSQMCJAX56K5VJKEDH3F4ALVLHISUNB2RYKHSGV5LOXRRKIZTY`
- `coverageVault`: `CC2T3KOREH53DT5BWHAVEQA6RND6G6R3PBYS5BEZZLNOYLO4EYP75YAS`
- `coverageFund`: `CBARYR5MWGURIUFQLA2DFS6RO4O5VF55XZ2RO3HO4UKJHCKXAAHLFTSP`

Nota: estos IDs son de módulos validados y su procedencia queda trazada en `provenance`.

## 6. Qué NO forma parte del tokenomics canónico actual

- `dARKA`: explícitamente diferido.
- Balanced/Comet legacy: fuera de la superficie activa; no introduce tokenomics canónico.
- `governance-token` legacy de demo: no sustituye el modelo `ARKA + locked ARKA`.

## 7. Riesgos/decisiones abiertas recomendadas

1. Definir explícitamente política de `max_supply` de ARKA en despliegue canónico (si aplica).
2. Endurecer y publicar estándar definitivo de implementación de share token (actualmente configurable por factory).
3. Publicar en frontend/backoffice panel único de métricas tokenómicas:
   - supply ARKA
   - total locked/votes
   - grants y streams activos
   - reserve ratio / solvency gap / payout capacity

## 8. Referencias directas

- `contracts/arka-token/src/lib.rs`
- `contracts/locked-arka/src/lib.rs`
- `contracts/arka-vesting/src/lib.rs`
- `contracts/emissions-controller/src/lib.rs`
- `contracts/arka/src/lib.rs`
- `contracts/arka-factory/src/lib.rs`
- `contracts/coverage-fund/src/lib.rs`
- `contracts/coverage-vault/src/lib.rs`
- `docs/TOKENOMICS.md`
- `docs/TOKEN_POWER.md`
- `docs/COVERAGE.md`
- `deployments.testnet.json`
