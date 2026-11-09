# R47 — cotizaciones del gestor y ciclo de vida

5 de noviembre de 2026. Base R45: `a4bf1a8296487543ec183fed32ac606b2833e015`. Se corrige R46-01 en un candidato nuevo, preservando R45/R46 y todos los sellos anteriores.

## Cambio

ManagerPortfolioSwap reutiliza el patrón mounted y selección que ya usan depósito y procesamiento. Al desmontarse, su cotización antigua deja de poder llamar onReview en el padre que continúa montado. Éxito y error sólo se publican si la instancia sigue montada y conserva fondo/wallet/activo/dirección/importe. El cleanup de loading también queda en la instancia vigente. Cada nueva instancia empieza con su estado normal, de modo que A→B→A no acepta la cotización de la primera A. No hay estado de negocio nuevo, planificador, heurística de mercado, endpoint, retry o automatismo financiero.

Un único archivo de ejecución cambia: apps/web/src/components/product/ManagedProductSurface.tsx. Contratos, 24 WASM, ABI, backend, SDK, routing, seis locks y flags de ejecución permanecen iguales a R45. Noah V2, Sushi sin activar, Phoenix sólo legado, Balanced entre cadenas sin cualificar y Curve aplazado.

## Pruebas y límites

22 regresiones nuevas usan el componente y generalPortfolioQuote reales con HTTP/modelos/direcciones públicas sintéticos: cotización y error actuales, nueva revisión manual, cuenta/fondo A→B y A→B→A, lookup público, desconexión, desmontaje, éxitos/errores tardíos, StrictMode, polling/rerender, doble click y conservación de una revisión de retirada preparada en el fondo nuevo. No se pulsa confirmación, llama al ejecutor o firma. La rama local de cotización conserva además sus regresiones existentes.

Frontend completo: 1.368 PASS, 0 FAIL, 57 omisiones explícitas. Los 22 nuevos están incluidos en 1.368; no se suman dos veces. Se reejecutan 72 casos externos de límites de lectura/depósito/recibo y revisión adversarial de R44/R46. Las cuatro aserciones de ausencia seleccionadas en R45 se guardan aparte como diagnóstico del defecto original, no como PASS ni omisiones de la suite positiva. Backend/SDK/release/build/tipos/lint/Chromium sólo se consideran aprobados al pasar sus recibos de artifacts/manager-quote-r47-20261105. El cierre exige un build fresco de la dapp modificada.

303 pruebas Rust y 710 pasos financieros/gobierno de WASM real se retienen por identidad, sin nuevo replay nativo. Sin compilación de contratos, scan remoto de dependencias, cualificación real de destino/liquidez/wallet/dispositivo/consenso. Sin wallets reales, firmas incluidas efímeras, envíos, producción, push ni auditor contactado. Las pruebas de fondo cambian params sobre el mismo componente; no califican la navegación del router en producción. Las pruebas de cuenta cambian la dirección pública dentro del padre montado.

## Pendientes

R46-01 queda cerrado en el alcance local validado cuando se verifica el cierre. Siguen abiertos minimatch/R14-07 y crypto-bigint/R14-09 sin override incompatible, remiendo, supresión o waiver. Se mantienen los nueve grupos operativos/política: destino/código/ABI/templates/constructores/roles/índice, activación/desactivación Sushi/SoroSwap/Aquarius, historia/backups/recuperación/capacidad, recursos y liquidez actuales, wallet/dispositivo/canary, CI alojado, revisión independiente y autorización final. mainnetApproved=false no reevalúa una aprobación histórica.

Se reutilizan dependencias y outputs inalterados por links y hashes; no se copian cachés/bases. El crecimiento local y cualquier retirada de packs webpack propios nuevos se documentan al cierre, conservando compilado y evidencias.
