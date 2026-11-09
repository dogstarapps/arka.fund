# R32 — Corrección de Governor/Guardian opcionales

Fecha: 4 de noviembre de 2026. Base: R31, commit `b695d8703b46ade22d4a78bc9ceba7ae070ffae2`. **R31-03 queda corregido y validado localmente.** Noah sigue V2. Cero wallets reales, firmas —también efímeras—, envíos a la cadena, consultas de producción o contactos externos.

## Cambio y compatibilidad

Se corrigen 38 lecturas en 15 contratos que admiten Governor opcional; en venue-registry se incluye Guardian. La lectura usa `Option<Address>` y aplana la ausencia del registro. Acepta claves ausentes, Address existentes y el Void que serializa `None`. Otros tipos siguen rechazándose mediante la conversión del SDK.

No cambian setters, ABI, claves/formato de storage, jerarquía de roles, plazos, retirada de bootstrap, reglas financieras, planificador, rutas, dapp ni dependencias. No hay migración de datos, segundo inicializador, workaround, reintento, keeper o mecanismo de recuperación automática. La corrección es compatible con las representaciones de datos ya admitidas por el ABI.

Contratos afectados: adapter-aquarius, adapter-balanced, adapter-blend, adapter-phoenix, adapter-soroswap, arka-registry, arka-token, arka-vesting, emissions-controller, governance-executor, governance-token, oracle-guard, router, share-token y venue-registry. Se revisan aparte los siete módulos que sólo escriben Governor como Address y el Guardian de oracle-guard, cuya eliminación borra la clave; no necesitan el mismo cambio.

Se recompilan los 24 WASM con el perfil fijado y se reproduce después la selección completa. Cambian los 15 afectados; los otros nueve conservan exactamente sus hashes. Arka, factory y Sushi permanecen idénticos. Los 24 specs de contrato completos conservan sus bytes, funciones y tipos. La generación real de bindings TypeScript de siete roles coincide en once archivos; se actualizan los pins de constructor, inicialización y gobierno, sin regenerar código cliente distinto.

## Pruebas

- Suite nativa completa: **300 pruebas pasan**, incluidas quince regresiones nuevas. Cada contrato afectado tiene un caso de roles vacíos y límites administrativos. Se prueban getters, escritura de registro, rotación, expiry, separación del issuer de shares y rechazo del administrador retirado.
- Prueba nueva con WASM reales: **53 pasos**; Governor vacío permite programar llamadas/despliegue mediante el administrador vigente, mantiene delay y rechaza al extraño. Guardian vacío devuelve ausencia y permite la pausa legítima por gobierno de los tres venues. Recuperar el guardian no le concede activación. Eliminar Governor no restaura bootstrap retirado. Diez ejecuciones por contrato no requieren autorización SourceAccount en la raíz.
- Factory con Governor del registro puesto expresamente en None: **192 pasos** desde creación hasta retirada íntegra por Sushi. Cobra y registra correctamente, completa cinco lotes y paga 998.8018227 XLM, sin residuo. Reutiliza los inputs unsigned recién obtenidos con R32 y vuelve a ejecutarlos en RAM nueva; no reutiliza los resultados anteriores.
- Matriz de lanzamiento gobernada de los tres venues: **250 pasos**, trece checkpoints, 39 observaciones de estado y nueve rechazos con rollback. Configuración pausada, manual, pausa por guardian, deprecación y recuperación; AUTO permanece apagado.
- Backend recompilado: **178 unitarias y 41 de integración pasan**, con tres casos de firma omitidos. Dapp/routing/wallet: **77 pruebas** del subconjunto de ciclo de protocolos pasan, sin firmar.
- Los resultados, ABI/bindings, fuente exacta y comprobaciones complementarias de integración/release se fijan en la cualificación y el sello de evidencias R32.

## Ciclos financieros con contrapartes reales congeladas

| Venue | Pasos del ciclo | Lotes de salida | Importe cobrado |
| --- | ---: | ---: | ---: |
| Sushi | 191 | 5 | 998.8018227 XLM |
| SoroSwap | 185 | 4 | 998.8023811 XLM |
| Aquarius | 187 | 5 | 999.6002008 XLM |

Cada ciclo crea Arka/share desde la factory, deposita 1.000 XLM, invierte, solicita la salida completa, usa el planificador del contrato, liquida, liquida las shares y cobra. NAV, shares, reservas, saldos de fondo/adapter/router y allowances terminan reconciliados, sin residuo. Se mantienen rechazos por pausa, ruta alterada, caller revocado, estado no permitido y activación por guardian. El cobro de efectivo ya reservado funciona con el venue pausado.

Los importes coinciden con los ensayos anteriores correspondientes. Son resultados de fixtures congeladas con funding, actores y oráculos sintéticos, no cotizaciones ni rendimientos esperados actuales. Sushi usa su snapshot sellado del ledger 65206504; SoroSwap/Aquarius usan el snapshot coherente sellado del ledger 65045926. No se mezclan estados de mercado de distintos ledgers.

## Recursos y límites

El máximo declarado en los tres ciclos es 39.175.830 instrucciones, frente a 400.000.000 del snapshot. La memoria máxima medida es 11.599.694 bytes, frente a 41.943.040. Lecturas/escrituras, footprint y eventos también respetan los límites ensayados. La memoria corresponde al medidor Soroban, no al RSS del Mac.

No se cualifican con esto precios actuales, surge/inclusión, firma real/multisig, liquidez vigente, mantenimiento completo del destino o consenso. No se aplica upload, restore, TTL ni operación real alguna. Las nuevas identidades de código exigen reconciliar el plan del destino; una estimación antigua de upload del executor no se presenta como cotización del nuevo código.

## Procedencia y controles conservados

Los hosts nuevos fijan los WASM R32 y cada snapshot por separado. Conservan scope de métodos, namespace nuevo, prohibición de Noah, autenticación SourceAccount/contrato y rechazo de lecturas desconocidas. La reproducción no fabrica ausencia de datos ni introduce filas de storage para saltar autorizaciones. Los literales de código del setup histórico se sustituyen explícitamente por los hashes de la selección R32 antes de obtener un digest nuevo del contrato.

La primera compilación de tests detectó un nombre de método incorrecto en una regresión nueva; se corrigió sólo la prueba y se conserva el intento. Un primer controlador de dos venues eligió el snapshot diagnóstico antiguo de R25 y rechazó una clave Aquarius no capturada. No se asumió que faltara ni se consultó red: el ensayo aceptado usa el snapshot coherente ya sellado y repite los dos ciclos completos. Se conservan ambos intentos.

Se preservan los snapshots nativos generados, los controladores/errores y las releases/sellos previos. El árbol histórico R31 no se modifica. La evidencia web/browser anterior sólo se retiene por identidad donde aplica; no se describe como un Chromium nuevo contra R32. Las comprobaciones que usan transporte RPC/índice/wallet doble lo declaran expresamente.

## Pendientes

R31-03 sale de los defectos de aplicación abiertos. R31-01, R31-02 y R31-04 siguen corregidos. Permanecen los avisos de minimatch y crypto-bigint sin override, parche incompatible, supresión o aceptación de riesgo.

Siguen las fases ya pendientes: CI del candidato exacto, revisión independiente, identidad/roles/rutas/oráculos/index del destino y su liquidez/recursos actuales, wallet/dispositivo/canary y autorización final de despliegue. No hay un nuevo fallo financiero demostrado que se esté atribuyendo al despliegue existente; producción no se ha consultado.

Véanse [pendientes actuales](MAINNET_PENDING.md) y [registro de auditoría](../release/internal-audit.json). Sushi no se activa, Phoenix sigue retirado sólo para nuevas rutas, Noah no se migra y Curve continúa aplazado.
