# Aislamiento de errores de lectura y recibos — R43

R43 corrige R42-01 y R42-02 sobre R41, commit e08961156d0c030979c239069674dcd64d8248ad. Sólo cambia un archivo de ejecución de la dapp. Contratos, 24 WASM, ABI, backend, SDK, routing y seis locks permanecen idénticos. Noah sigue V2; sin wallets reales, firmas, envíos, producción, push ni contacto externo.

## Cambios

Después de una operación o consulta de recibo resuelta, el refresco sigue usando loadError y ledgerUnavailable. Su fallo no entra en el catch de la operación financiera ya terminada. El error vigente bloquea controles hasta una lectura correcta; recuperarse limpia ese error de lectura. Un rechazo real de ejecución sigue visible y una confirmación desconocida conserva su recibo, sin reenvío.

La referencia de contexto existente conserva su objeto mientras fondo/wallet/owner sean iguales, y lo sustituye al cambiar cualquiera. La consulta de recibo captura ese objeto y comprueba su identidad en éxito y error, conservando además owner=wallet. Así descarta resultados antiguos incluso al volver A→B→A, y permite el polling y rerenders normales de la misma sesión. Se conserva la liberación del estado busy al terminar la consulta, la retirada exclusiva del recibo coincidente y el reset de depósito sólo ante confirmación válida.

No se añaden planificadores, endpoints, estados de negocio, colas, heurísticas financieras o reintentos. Las correcciones de R41 de orden de lecturas y reset permanecen integradas.

## Validación

Las dos regresiones principales se contrastan contra R41 sin modificarlo: allí reproducen los defectos y en R43 exigen su ausencia. Se añaden 17 casos de integración: error de lectura después de confirmar y después de recuperar un recibo; bloqueo hasta recuperación; rechazo real de operación; error vigente de recibo y reintento manual; resultado on-chain fallido; confirmación desconocida; errores y éxitos tardíos tras cambio de owner, A→B→A y fondo A→B→A; consulta pública de otro owner; polling/rerenders durante consulta; sustitución de un recibo pendiente por otro; desmontaje. Se usan componentes reales, claves públicas sintéticas y ejecutor/recibo dobles sin firma o envío.

1326 pruebas frontend pasan; 57 omitidas explícitas por restricciones/perfiles. Las 126 focalizadas son subconjunto. Los 17 casos nuevos pasan y la revisión de depósito original mantiene su foco y aserciones.

Los recibos aceptados de build nueva, tipos, navegador local, fuentes y cierre se consultan en artifacts/receipt-errors-r43-20261104. Hasta que sus recibos pasen no se consideran completados por este documento. La suite focalizada es subconjunto de la completa, sin duplicar su total. El primer intento focalizado y el fallo previo de preparación se conservan: el test de recuperación debía esperar que la respuesta se presentara; ahora espera el encabezado del fondo recuperado, sin sleeps, omisiones o debilitamiento de aserciones.

La validación financiera/gobierno, contratos/Rust, backend y SDK anterior se retiene por identidad exacta, no se presenta como nueva ejecución. Una nueva build Next es necesaria por el cambio de código de dapp; se reutilizan dependencias por enlace sin instalación/copia. Tras terminar las comprobaciones se retira únicamente su caché webpack regenerable no referenciada, conservando servidor/static compilados, tipos, fuentes y pruebas. No se recompilan contratos ni se regeneran sus cachés.

## Pendientes

[MAINNET_PENDING.md](MAINNET_PENDING.md) conserva los nueve grupos operativos/política y las dos dependencias conocidas abiertas. Quedan cualificación del destino y autoridades/configuración/activación-desactivación de Sushi, SoroSwap y Aquarius, historia/recuperación/capacidad, liquidez/recursos/TTL actuales, wallet/dispositivo/canary autorizado, CI, revisión independiente y autorización final. Phoenix sólo legado, Sushi sin activar y Curve aplazado. mainnetApproved=false; no se reevalúa ni revoca una aprobación histórica de producción.
