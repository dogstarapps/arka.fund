# R27 · Creación gobernada de Sushi

R27 resuelve la creación de un nuevo adaptador Sushi con el contrato de gobierno como administrador desde su constructor. Sushi conserva exactamente su WASM y su administrador inmutable. Cambia el ejecutor de gobierno, que incorpora operaciones de creación tipadas y sujetas al mismo gobierno que sus operaciones existentes. No se añade proxy, inicializador alternativo, rotación de administrador Sushi ni escritura directa de storage.

El candidato está aislado de R21 y de producción. Noah permanece V2; no se han utilizado wallets reales, claves privadas, firmas, envíos ni acceso a producción. Los resultados locales no reevalúan la aprobación del despliegue ya existente.

## Mecanismo

`schedule_deployment(caller, operation_id, ContractDeployment)` fija el hash de WASM, el salt de 32 bytes y todos los argumentos del constructor. `ContractDeployment` no es específico de Sushi: es una operación tipada de creación de contratos WASM en el namespace del ejecutor.

Solo el scheduler autorizado puede programarla. Comparte el namespace de IDs con las llamadas existentes: un ID de llamada tampoco puede reutilizarse para una creación, ni al contrario. La demora y ventana se fijan al programar. Se conserva un registro `QueuedDeployment` tipado y se mantienen sin cambios los registros y ABI anteriores `QueuedOperation`/`GovernanceAction`.

La función existente `execute(operation_id)` comprueba Pending, ready_at y expires_at. Marca la operación como ejecutada antes de invocar la creación, con rollback atómico si falla. El propio ejecutor autoriza **solo** el contexto del constructor en la dirección derivada y sus argumentos revisados, y utiliza `with_current_contract(salt).deploy_v2`. Así Sushi puede exigir `admin.require_auth()` con el ejecutor como administrador sin una firma de cuenta ni una implementación permisiva de `__check_auth`.

`cancel_deployment` conserva el retorno tipado de la creación; utiliza la misma transición de cancelación que las llamadas. `current_operation_status` e `is_ready` cubren ambos tipos. `deployment_operation` devuelve el registro completo y `deployment_address` permite revisar la dirección prevista. La existencia de una dirección prevista no demuestra que el contrato ya exista: se comprueban además estado, resultado, código e instancia.

Las 19 funciones anteriores y sus firmas de wire se mantienen. También se conservan exactamente los tipos GovernanceAction, QueuedOperation, OperationStatus, ExecutorConfig, ExecutionReceipt y Error. Las cuatro funciones públicas añadidas son schedule_deployment, cancel_deployment, deployment_operation y deployment_address. La nueva clave de storage es tipada y distinta; no se reinterpretan registros anteriores.

## Validación local

Se compila el ejecutor con el perfil fijado, overflow checks activos y dependencias bloqueadas. El pipeline estándar reproduce exactamente el WASM nuevo de **17.394 bytes**, hash `3e44fd9025a344530fbcc1916835b5ef7891caa9d03d22619cdfdc1af16c65a5`. Los otros 23 WASM, incluidos Sushi, Arka y factory, permanecen idénticos a R21. Se añadió rust-src de la misma toolchain fijada; no se cambiaron versiones ni locks de dependencias del producto.

Pasan **15 pruebas Rust**: nueve pruebas anteriores, tres nuevas y tres integraciones anteriores. Las nuevas usan el WASM real de Sushi y autorizaciones de scheduler limitadas a la llamada correspondiente; el constructor y las operaciones posteriores del ejecutor no reciben auth de cuenta. Las pruebas antiguas que usan mock_all_auths son regresiones de lógica, no evidencia criptográfica.

El replay P29 ejecuta el WASM compilado en modo Enforcing sobre la captura Sushi retenida del ledger 65206504. Dos instancias reales del ejecutor prueban una autoridad de contrato a contrato: una hace de consejo de prueba y programa en la otra. Esto no añade una capa al producto ni prueba votación DAO/multisig real. La autoridad externa del consejo es una identidad pública sintética; no hay claves.

La matriz de creación tiene **75 pasos y 13 rechazos esperados**. Valida creación a ready_at, rechazo temprano, reejecución, constructor con principal no autorizado, colisión de salt, ID de creación reutilizado como llamada, cancelación y expiración. El constructor fallido y la colisión conservan Pending y revierten todo el estado. Dos casos adicionales prueban que el antiguo administrador temporal no puede programar creaciones y que una cuenta no puede hacerse pasar por el gobernador contractual.

La instancia Sushi creada tiene el ejecutor como administrador desde su nacimiento. El administrador temporal no puede gestionar callers; la suplantación de la dirección de contrato se rechaza. Las rutas inmutables y la admisión/revocación de callers se configuran mediante operaciones de gobierno. Las transiciones del registro de Sushi/SoroSwap/Aquarius se ejercitan con el ejecutor nuevo. No se migra ningún fondo existente.

## Ciclo financiero

El replay crea Arka y su share token desde la factory, con bindings hacia el adaptador recién creado mediante gobierno. Deposita 1.000 XLM ficticios, invierte **200 XLM** contra los contratos reales congelados de Sushi y añade tres unidades mínimas de USDC para cubrir el residuo. El contrato genera los cinco lotes de liquidación; no hay tamaños calculados en el cliente ni reintentos financieros.

Los **191 pasos** terminan cobrando **998,8018227 XLM**, con todas las participaciones liquidadas, cola/reservas/NAV a cero, saldos de fondo/adaptador/router a cero y allowances a cero. Se prueba el cobro de efectivo ya reservado con el venue pausado y el caller revocado. El importe incluye comisiones y ejecución del estado congelado: retirada íntegra significa cobrar todos los activos resultantes, no garantizar el principal. El ensayo R24 invertía 100 XLM; estos importes no son una comparación de rentabilidad.

El ejecutor de gobierno **no es el router de swaps**. El binding Sushi conserva su executor/router interno de Arka y su adaptador Sushi nuevo. La cotización nativa debe coincidir con ese binding; no se ha cambiado a la familia SoroswapVault/AquariusVault ni retargeteado un binding existente.

Pasan además **15 casos de routing, lectura de dapp y revisión backend** alimentados por resultados/getters/errores del replay nuevo. Verifican el cuerpo unsigned exacto, caller/estado, invalidación de revisiones y rechazos sin habilitar envíos. El transporte RPC, cabecera, secuencia, índice, perfil y cotización del planificador son fixtures explícitos. No es una nueva prueba de navegador compilado; el código frontend/backend/SDK y sus locks no cambian.

Seis casos de aislamiento rechazan código no permitido, salt fuera del namespace reservado, Noah en el constructor o en una acción anidada, creación directa del adaptador reservado y un origen desconocido. El host mantiene captura estricta, SourceAccount auth, cero auto-restore y procesos sin acceso de red ni escritura de archivos durante la ejecución.

## Orden de lanzamiento pendiente

1. Reconciliar código/autoridades/destino: un ejecutor anterior no dispone de esta nueva API. La selección de R27 requiere el hash nuevo; no se ha actualizado ningún ejecutor real.
2. Revisar el presupuesto de código/TTL y subir los WASM exactos que falten, únicamente con autorización. La estimación offline de subida fresca del ejecutor es **25,5323661 XLM** con los precios/TTL congelados; no es un precio actual ni una operación enviada. No se modifica el límite de las operaciones financieras para admitir esa subida administrativa.
3. Configurar gobernador y bootstrap finito del ejecutor, probar el control previsto y retirar el acceso temporal. La autoridad DAO/multisig/dispositivo real continúa pendiente.
4. Programar la creación con Sushi hash seleccionado, salt revisado y constructor_args `[executor, verifiedSushiFactory]`; comprobar el registro y la dirección prevista. Esperar a ready_at y ejecutar dentro de la ventana.
5. Verificar estado Executed, código e instancia, administrador inmutable y factory. Configurar mediante gobierno las dos rutas, registro y templates coincidentes; no hay callers implícitos.
6. Tras todos los gates y autorización, habilitar manualmente en 1 antes de crear un fondo ligado desde la factory. Verificar nacimiento/código/digest/fee/catálogo del fondo y aprobarlo expresamente como caller mediante gobierno.
7. Exigir revisión fresca de cada operación y conservar pausa inmediata del guardián, recuperación gobernada y cobro de derechos reservados. AUTO, keeper financiero y envíos permanecen deshabilitados.

La prueba de subida fresca es una simulación no aplicada con ausencia explícita del código sintético nuevo; no afirma ausencia observada ni admisión actual de mainnet. Captura, precios/oráculo, funding e identidades son los límites ya declarados del replay. No hay consulta actual de pools, recursos ni autoridades.

## Pendientes y auditoría

La revisión interna del cambio cubre permisos de programación, namespace de IDs, payload inmutable, autorización exacta de constructor, colisiones, estado previo a invocación, rollback, cancelación, expiración, storage/ABI y control posterior de callers. No queda abierto el problema local de construcción de Sushi identificado en R26.

Siguen abiertos los gates del destino real, liquidez/admisión actuales, wallet/dispositivo/canary, avisos de dependencias y política de auditorías estrictas, CI alojada, revisión independiente y autorización final. La auditoría externa debe incluir el ejecutor nuevo. No se ha aceptado riesgo, ocultado un aviso, forzado una versión ni enviado documentación al exterior.

Los logs, intentos de compilación/pruebas, inputs XDR unsigned y resultados nativos quedan conservados en la evidencia R27 fuera del árbol de producto. R21/R24/R25/R26 y sus sellos se conservan. La calificación se limita a este cambio y al replay descrito; no sustituye una auditoría integral nueva ni una aprobación de producción.
