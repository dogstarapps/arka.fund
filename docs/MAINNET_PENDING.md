# Pendientes mainnet — R56

R55-01 está corregido y validado localmente en OracleGuard. La aplicación real sigue pendiente; no se declara producción reparada ni se revoca por esto la aprobación histórica de otra instalación.

- Destino nuevo: identidad de los artefactos y fuentes, configuración explícita USDC→USD antes de activar Sushi/SoroSwap/Aquarius, autoridad existente y tiempos finales. No usar el helper legacy ni actualizar Noah automáticamente.
- Cualificación vigente: liquidez, catálogo/historial/backup, recursos, upload, TTL/restore/admisión. R56 repite snapshots congelados; no consulta producción.
- Dependencias: minimatch y crypto-bigint siguen abiertos sin overrides ni waiver.
- CI alojada, revisión independiente, wallet/dispositivo/canary y aplicación requieren el cierre o autorización aplicable; no se ejecutan aquí.

Incidencia: la primera suite de release creó 9 firmas efímeras locales por la activación interna de un test antiguo. Se comunicó, no hubo wallet real/envío/red de producción y el arnés ya exige opt-in externo; no se repiten pruebas positivas de firma.

[Pruebas, semántica y límites](ORACLE_NORMALIZATION_R56.md). Noah V2; mainnetApproved=false.
