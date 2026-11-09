# R37 — Cierre local de R36-01 y R36-02

4 de noviembre de 2026. Base inmutable: R35, commit `41d89797fa22dd3bc5619d4ee15f8836fcf0f1e6`. Reauditoría de referencia: R36. **Ambos hallazgos quedan corregidos y validados localmente** en este candidato; no se despliega ni se consulta producción. Noah sigue V2.

## R36-02: progreso acreditado por el contrato

`ManagedSettlement` añade dos campos u64, `head_before` y `head_after`, que se rellenan con la cabecera antes y después de ejecutar el lote. No cambian reglas de liquidación, devolución de residuos, reservas, importes, autorización o tamaño máximo del lote.

La revisión permite una liquidación de cero shares cuando la simulación del código seleccionado acredita avance real: cabecera inicial igual al estado revisado, final dentro de la cola, avance positivo no mayor que las visitas reportadas y entre una y dieciséis visitas. Mantiene la coherencia del preview de estado, el rechazo de no-ops, identidad/código, antigüedad, ABI, autorización, comisiones y recheck. No replica el cálculo financiero del contrato.

La dapp permite **revisar** una solicitud activa aunque no haya cash; el backend sigue decidiendo si la simulación tiene progreso válido. El botón no autoriza, firma ni envía. Esto permite la devolución de una fracción cuyo pago redondea a cero.

Una regresión Rust recorre residuo → siguiente inversor todavía no elegible → no-op rechazable → liquidación y cobro posterior. Se preservan las shares devueltas y las reservas de otro propietario. El ensayo WASM crea el Arka desde la factory, invierte por Sushi y reproduce la devolución de 1 unidad raw de share: head 1→2, pending 1→0, devolución íntegra y `settled_shares=0`. La preparación real del backend acepta ese resultado; continúa sin capacidad de firma/envío.

**ABI:** cambian los campos del UDT de retorno `ManagedSettlement`; no cambian nombres/tipos de argumentos de funciones, campos anteriores ni claves de almacenamiento. Los clientes deben distribuirse junto al WASM y perfiles compatibles. Se regeneran y contrastan siete roles/once bindings, y se recompilan SDK, backend y dapp.

Arka seleccionado: `7ea4f823c87d3fd887ea13b51804dd52fee0ba63d12e19e5e264bff6deb7f007`, **130.856 bytes**, bajo el máximo de 131.072. Se reproduce con el pipeline de release. Los otros 23 WASM y los seis locks permanecen iguales a R35.

## R36-01: continuidad de solicitudes y consultas acotadas

Se retira el techo de 32.768 solicitudes acumuladas del checkpoint, lector persistente, proyección y validación de dapp. Los IDs conservan su dominio u64; siguen comprobándose secuencia completa, identidad, monotonicidad, conservación de pagos/reservas y obligaciones activas. Se evita también pasar todo el historial como argumentos de una llamada JavaScript, que introducía otro límite accidental.

Se conservan el presupuesto de backfill de ocho páginas de hasta 32 solicitudes por ejecución y el de 4.096 obligaciones activas. El recorrido sin checkpoint mantiene su presupuesto explícito por lectura. No se purga historial ni se omiten obligaciones; un backfill incompleto o una lectura activa fallida bloquea la publicación.

La posición usada por revisión/dapp solicita `view=active`: incluye todas las obligaciones vivas del propietario y un agregado de solicitudes cerradas con cantidad y pagos acumulados. Backend y dapp reconcilian `pagos activos + pagos cerrados = total pagado`. Un agregado histórico se acota por cantidad de solicitudes y máximo de cada importe individual, sin confundirlo con el límite de una transferencia i128. Cero registros cerrados no pueden fabricar pagos.

La respuesta de posición admite hasta 4 MiB, suficientes para el presupuesto existente de 4.096 registros activos con campos canónicos; las demás respuestas y páginas de 25 registros mantienen el límite de 1 MiB. Se prueba una respuesta de 4.096 obligaciones que supera 1 MiB y conserva todas sus reclamaciones. No se abre una respuesta sin límite.

El endpoint de posición completa conserva compatibilidad por defecto. El historial cerrado se consulta por páginas de 25, **más recientes primero**, fijadas a un mismo observationId, propietario, código y ledger. Publicar una observación posterior no cambia las páginas ya fijadas. La dapp ofrece historial anterior, navegación, importe cobrado y errores de lectura explícitos; no trata un error como saldo cero ni usa esas filas cerradas para ejecutar acciones.

Los formatos persistentes de checkpoint, observaciones y backup v1 no cambian. No hay migración, compactación, índice paralelo, caché de integridad o nueva base de datos.

## Validación

- **303 pruebas Rust**, 178 unitarias generales del backend, 5 de continuidad corta y 2 nuevas de historial, 41 de integración, 117 de revisión, 186 de frontend en doce archivos y 34 de SDK. Los casos criptográficos permanecen omitidos; los controles de release se añaden al cierre sellado.
- Historia de **32.769 solicitudes cerradas más una viva**: sincronización, reserva, pago, posición pequeña, consulta completa conservada, páginas fijadas y recuperación de checkpoint/observaciones. El total pagado conserva `32771` unidades raw. La última fila histórica continúa accesible y las terminales no se vuelven a consultar en RPC.
- Otro caso lee **131.073 solicitudes terminales** sin truncado ni error por límite de argumentos JavaScript.
- Preparación/recheck reales sobre el catálogo compilado y validación de dapp; el proxy HTTP de **Next compilado** sirve la última página y conserva bloqueos de Origin y POST. El prefijo histórico, la creación/indexación y RPC/header/código de este ensayo son fixtures explícitas; la ejecución financiera WASM se prueba por separado.
- Ciclos nuevos completos de factory, inversión y salida por Sushi, SoroSwap y Aquarius: 191/185/187 pasos, respectivamente; cinco/cuatro/cinco lotes, saldo/reservas/shares y allowances residuales cero. Cobros: `9988018227`, `9988023811` y `9996002008` unidades raw. No son cotizaciones actuales.
- 53 comprobaciones actuales de gobierno/roles y 94 pasos del residuo. Los 710 pasos finales de estos cinco ensayos se conservan, además de los prefijos diagnósticos. Rechazos con rollback, pausa/revocación y cobro de reservas siguen pasando.
- Compilaciones de backend, SDK y Next, tipos, bindings, delta ABI, reproducción WASM y verificación de fuentes. Inventario estático fresco: 27 contratos/654 entradas; las 24 disposiciones previas se retienen. No sustituye una auditoría independiente.
- El catálogo durable de R35 y sus formatos permanecen byte idénticos. Se verifican los sellos R34/R35/R36 y se retiene por identidad el ensayo largo de 10.002 generaciones y continuidad en 10.003; no se presenta como otra ejecución nueva.

## Diagnósticos conservados

Los primeros vectores congelados todavía contenían el digest o una referencia transitiva al Arka anterior y fueron rechazados. Se recalculó el digest con el getter de la factory y se normalizaron los pins de los controladores al artefacto actual. No se admitió código desconocido ni se incorporó el WASM antiguo para pasar la prueba.

La primera comparación de recuperación contrastaba el objeto interno con un JSON HTTP que omite un campo opcional undefined; se corrige la comparación del formato público, conservando ambos recibos. La primera comprobación de ABI usó un nombre de discriminante incorrecto en el controlador; la revisión corregida confirma sólo los dos campos indicados. El intento de preparar dependencias antes de terminar el checkout no realizó instalaciones ni enlaces; el entorno se preparó tras comprobar su finalización. Los fallos quedan como diagnósticos y no se cuentan como PASS.

## Límites y pendientes

R37 cierra las reproducciones conocidas de R36; no promete ausencia de vulnerabilidades. Se mantienen los presupuestos de actividad/holders/lectura y el coste lineal de verificar/materializar los archivos locales. La restauración JSON v1 requiere memoria proporcional al backup; almacenar y verificar más historial tiene coste real. El destino requiere dimensionamiento y ensayo operativo con sus datos.

Persisten minimatch/crypto-bigint sin waiver, CI alojado, revisión independiente y autorización final; identidades, código/ABI/SDK/templates y autoridades reales del destino; historia/backup operativo, recursos/liquidez y wallet/dispositivo/canary. La activación/desactivación de Sushi, SoroSwap y Aquarius sigue pendiente del destino. No hay activación ni actualización automática de un contrato existente.

Noah permanece V2. Sin wallets reales, firmas —incluidas efímeras—, envíos a la cadena, lecturas/escrituras de producción, pushes ni contacto/envío a auditores. Phoenix sólo legado, Balanced entre cadenas no cualificado y Curve aplazado. `mainnetApproved=false` describe este candidato y no reevalúa una aprobación histórica de producción.

Véanse [pendientes actuales](MAINNET_PENDING.md), [registro de auditoría](../release/internal-audit.json) y los recibos de `artifacts/findings-r37-20261104`.
