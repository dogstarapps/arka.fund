# R34 — Avance de cola y retirada íntegra

4 de noviembre de 2026. Base: R32, commit `79351bb5870335c68d87d2cfc8719192ba5a57b0`, reauditoría R33. **R33-02 queda corregido y validado localmente. R33-01 del catálogo continúa abierto.** No se ha desplegado ni modificado producción; Noah permanece V2.

## Corrección

La retirada inmediata ya comprueba que no existen shares pendientes. Al crear esa solicitud instantánea, si tampoco quedan solicitudes pendientes, sitúa el cursor en el siguiente ID antes de liquidarla. Este paso es constante: no recorre un historial arbitrario. Las solicitudes anteriores, sus propietarios, pagos y reservas permanecen en storage. Si hay un inversor pendiente, no se salta; si falta efectivo, revierte la operación completa.

En colas mixtas sigue utilizándose `settle_withdrawals(16)`. El getter existente `withdrawal_status` avanza una copia de la cola sobre un máximo de 16 registros cerrados. La diferencia positiva de ese cursor respecto a `managed_queue_state`, con el mismo `next_id`, prueba que se puede avanzar sin liquidar shares. Backend y dapp usan esa prueba determinista; no estiman tamaños ni introducen otro planificador.

El backend acepta una liquidación de cero shares sólo si ese avance está probado, la diferencia está entre 1 y 16 y la respuesta u32 `visited` cubre el avance sin superar 16. Sigue rechazando cero progreso, datos ausentes/malformados, IDs distintos o fuera de rango, una simulación inválida y una solicitud todavía no elegible sin prefijo cerrado. Mantiene identidad/catálogo, cuerpo y auth exactos, ausencia de restore, fee cap, recheck, caducidad y archivo.

La dapp habilita el mismo botón de revisión para ese avance aunque no haya efectivo o shares pendientes. Conserva el bloqueo por lectura incompleta, valoración no disponible, modo de sólo lectura y operaciones en curso. Cada acción requiere su propia revisión; no hay nuevos loops de firma/envío, keeper, reintentos o ejecuciones automáticas.

## Compilación y compatibilidad

Sólo cambia el WASM de Arka: `a27c7eff24702cd7e4c0346ea683d9a60dea3806766f4d1f43d741d5be4737ec`, 130.754 bytes, 27 más que R32 y por debajo de 131.072. Se compila con el perfil fijado y se reproduce mediante el proceso de build de la release. Los otros 23 WASM conservan sus hashes; no se presentan como 23 recompilaciones nuevas.

Los specs completos de los 24 contratos siguen idénticos. La generación de bindings de siete roles coincide en once archivos TypeScript. No cambian ABI, claves, formatos de storage, reservas, FIFO, ventanas de cancelación, reglas de fees, permisos o límites de negociación/liquidación. Se actualizan los pins del candidato y los perfiles de factory/initialization; no se migra ninguna instancia existente.

## Pruebas

- **302 pruebas nativas Rust pasan**, con dos regresiones nuevas: fronteras 0/15/16/17/34, rechazo ante inversores pendientes y falta de caja, conservación de una reserva ajena. Las pruebas previas de cancelación parcial y su ventana siguen pasando. La autenticación de estas unitarias es doble; se distingue del enforcement real de los ensayos WASM.
- **111 pruebas de revisión backend pasan**, una criptográfica omitida. Incluyen avances con cero shares, no-op, cursor incoherente/fuera de rango, visitas insuficientes/no acotadas, invalidación de una review antigua y conservación del fee cap.
- Backend recompilado: **178 unitarias y 41 de integración pasan**, con dos y una omisiones de firma respectivamente.
- **158 pruebas de frontend pasan**, incluyendo revisión de prefijos cerrados sin caja y bloqueo tras el avance o ante estados no disponibles. Las promesas de cotización de tres clicks de una prueba existente se esperan antes de pulsar; no se altera el comportamiento de depósitos.
- Compilaciones de backend y Next, tipos web, bindings y reproducción del WASM pasan. Las comprobaciones de integridad, perfiles y prohibición de firma completan la cualificación sellada.

Ocho escenarios integrados usan factory y WASM seleccionados reales en RAM local, el backend `VerifiedGateway`, la verificación unsigned del cliente y el componente de procesamiento de la dapp:

| Escenario | Resultado |
| --- | --- |
| 0, 15, 16, 17 y 34 cancelaciones | Retirada inmediata de 1.000 XLM; incremento real del balance local del propietario de 1.000 XLM; shares, NAV, efectivo y reservas finales a cero; historial conservado. |
| Cola mixta con 34 cancelaciones y dos inversores | Reviews manuales sobre cabezas 1 → 17 → 33 → 36; cero shares en esos avances; rechazo del siguiente no-op/ineligible; posterior settlement y cobro íntegro de 1.000 y 100 XLM. Ambos balances se reconcilian. |
| Reserva de otro inversor y 34 cancelaciones | Salida de 1.000 XLM conserva 100 XLM reservados aun con supply cero; su propietario cobra después esos 100 XLM. |
| Efectivo insuficiente tras 34 cancelaciones | Rechazo `ManagedNoLiquidity` y rollback; shares, cursor, reservas, activos y balance del propietario intactos. |

El frontend revisa el cuerpo unsigned exacto, el backend lo vuelve a comprobar y el arnés aplica ese mismo cuerpo una vez a RAM. No se invoca un signer, broadcaster o `sendTransaction` de producto. Un avance útil no se convierte en permiso para una operación vacía. La variante final del negativo de liquidez aporta SourceAccount explícito, procedente de una invocación local idéntica exitosa, para comprobar #50 también en enforcement y evitar confundir una pérdida de auth tras recording con el rechazo financiero.

Se repiten además los ciclos financieros completos con contrapartes reales congeladas:

| Venue | Pasos | Lotes de salida | Cobro local |
| --- | ---: | ---: | ---: |
| Sushi | 191 | 5 | 998,8018227 XLM |
| SoroSwap | 185 | 4 | 998,8023811 XLM |
| Aquarius | 187 | 5 | 999,6002008 XLM |

Terminan sin NAV, shares, reservas, residuos o allowances. Se mantienen los rechazos de pausa/ruta/caller y el cobro ya reservado con el venue pausado. Los 53 pasos WASM de Governor/Guardian y tres venues vuelven a pasar, con doce rechazos. R31-03 sigue cerrado localmente.

## Procedencia y límites

Evidencia/controladores nuevos en `artifacts/queue-progress-r34-20261104` y `queue-progress-r34-20261104`, junto a esta release. Se conservan R32, R33, sus sellos y todos los intentos fallidos. El manifiesto y el cierre fijan el código exacto y las pruebas aceptadas. Los recursos por invocación se contrastan con los límites de cada captura; no son una cotización actual de red.

Cada host se recompila con el manifiesto actual y una sola captura congelada; preserva scope, rechazo de lecturas desconocidas, auth SourceAccount/contrato y exclusión de Noah. Las cancelaciones y los cambios de estado se ejecutan por funciones del contrato; no se introduce storage para fabricar el prefijo. Las secuencias de cancelación de los escenarios finales se ejecutan juntas en el proceso nativo para evitar repetir innecesariamente la misma preparación, conservando cada invocación y su resultado.

El frame/header/sequence, la entrega del índice, actores/funding/oráculos y el transporte son fixtures locales explícitas; los valores financieros y las respuestas de simulación proceden del WASM. No se cualifica consenso ni un índice operativo. La dapp se ensaya en jsdom y se compila con Next; no es un Chromium nuevo ni una wallet/dispositivo real. Los importes no descuentan fees de una transacción de red porque no hay envíos.

Se conservan diagnósticos del arnés: encoding u32 de `visited`, resolución de setupFiles de Vitest, espera de una cotización asíncrona, URL de import.meta y mezcla de realms CJS/jsdom al recalcular un hash. Se corrigen las fixtures/imports conservando los verificadores reales, sin modificar librerías ni relajar controles de producto. No se cuentan esos intentos como pruebas aprobadas. Los inputs completos de los replays diagnósticos ocupan espacio apreciable y se conservan; el cierre documenta el consumo y el margen del volumen, sin borrar nada.

## Pendientes

Primero cerrar **R33-01**, continuidad del catálogo al superar 10.000 generaciones. Después siguen los dos avisos de dependencias sin waiver/override incompatible, CI alojado, revisión independiente, identidad/roles/oráculos/rutas y activación/desactivación en el destino, liquidez/recursos actuales, operación/backup del índice, wallet/dispositivo/canary y autorización final. No se presenta la plataforma como lista para desplegar sólo por cerrar R33-02.

Noah sigue V2; Sushi no se activa; Phoenix retirado sólo para rutas nuevas; Balanced entre cadenas no cualificado; Curve aplazado. Cero wallets reales, firmas —incluidas efímeras—, envíos a la cadena, lecturas/escrituras de producción, pushes o contacto con auditores. `mainnetApproved=false` se refiere al candidato local, sin revocar una aprobación histórica ni diagnosticar producción. Véanse [pendientes](MAINNET_PENDING.md) y [registro de auditoría](../release/internal-audit.json).
