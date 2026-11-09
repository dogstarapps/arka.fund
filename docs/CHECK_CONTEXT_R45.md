# R45 — mensajes de Check transaction por sesión

5 de noviembre de 2026. Base R43: `ea4e37f36c955612186c6d9204d663f3a64193ef`. Se corrige R44-01 en una revisión local nueva; R43, R44 y todos los sellos anteriores se conservan.

## Cambio

La rama de consulta captura el objeto de contexto existente y publica tanto el resultado como el error sólo si ese objeto sigue vigente. La identidad es estable dentro de una sesión de fondo/wallet/owner y cambia al cruzar sus límites; por eso también descarta la primera sesión A después de A→B→A. El finally conserva el desbloqueo busy, incluso al descartar una respuesta. Los éxitos y errores actuales siguen visibles; un polling o rerender de la misma sesión no invalida la comprobación.

Un único archivo de ejecución cambia: apps/web/src/components/product/ManagedProductSurface.tsx. No se añade estado de negocio, planificador, endpoint, reintento o automatismo financiero. Contratos, 24 WASM, ABI, backend, SDK, routing, locks y flags de ejecución conservan su identidad. Noah permanece V2; Sushi sin activar, Phoenix sólo legado, Balanced entre cadenas sin cualificar y Curve aplazado.

## Pruebas y límites

20 casos nuevos con el componente, generalMainnet y el validador de envelopes reales; HTTP, datos de fondos y lectores de dirección pública son dobles. Se construyen XDR sin firmas con actores sintéticos. No se llama al ejecutor ni al método de firma. Cubren éxito actual, rechazo actual, recuperación manual, validación de wallet cambiada, polling/rerender, éxito/error tras cuenta o fondo A→B y A→B→A, lookup público, desconexión, desmontaje y una nueva comprobación explícita en la sesión nueva.

La suite frontend completa pasa 1.346 casos, con 57 omisiones explícitas. Los 20 nuevos están incluidos en ese total, no se suman otra vez. Se reejecutan además los 40 casos de límites de lectura/depósito/recibo de R44. Las pruebas negativas del candidato R43 se registran por separado y no son PASS del producto. Backend, SDK, release, lint, tipos y compilado Chromium sólo se consideran aprobados cuando pasan sus recibos de artifacts/check-context-r45-20261105. El cierre exige un build nuevo de la dapp modificada; nunca se reutiliza el compilado de R43 como si contuviera la corrección.

Finanzas/gobierno nativos y métricas anteriores se retienen por identidad, no se vuelven a ejecutar: 303 pruebas Rust, 710 pasos con WASM real. No hay nueva compilación de contratos, scan remoto de dependencias, cualificación del destino, liquidez actual, wallet/dispositivo o consenso. El control de red/firma permanece activo. Todo es local, sin wallets reales, firmas incluidas efímeras, envíos, producción, push ni contacto con auditores.

## Pendientes

R44-01 queda cerrado en el alcance local validado cuando se verifica el cierre. Siguen abiertos R14-07/minimatch y R14-09/crypto-bigint; sin override incompatible, remiendo o waiver. Permanecen los nueve grupos de cualificación/política: destino/código/ABI/templates/roles/índice, activación y desactivación Sushi/SoroSwap/Aquarius, historia/backups/capacidad/recuperación, recursos y liquidez actuales, wallet/dispositivo/canary, CI alojado, revisión independiente y aprobación final. mainnetApproved=false no reevalúa una aprobación histórica de producción.

Se enlazan dependencias y outputs de backend/SDK sólo tras verificar fuentes y locks; no se copian cachés ni bases. El crecimiento y cualquier retirada del caché webpack propio nuevo se documentan al cierre, preservando fuentes, ejecutables compilados y evidencias.
