# Lecturas coherentes y reset del depósito — R41

R41 corrige R40-01/02 sobre el commit19337a50dc66b85bccc32de0712f7adbdd1af52f de R39. Sólo cambia un archivo de ejecución en la dapp. Todos los contratos,24 WASM, ABI, backend, SDK, routing y seis locks permanecen idénticos. No se consulta ni modifica producción, ni se reevalúa su aprobación histórica. Noah permanece V2; ejecución y Sushi sin activar, Curve aplazado.

## R40-01: lecturas superadas

R40 reprodujo una lectura102 reemplazada por101 tanto en componentes reales como en Next compilado con Chromium y backend HTTP local. Los loaders ya estaban iguales en R37/R39; no se atribuye el fallo a la corrección histórica de R39. Ahora cada vista acepta éxito/error sólo de la última solicitud iniciada de su sesión. La cartera conserva aborto al cambiar owner; el fondo invalida solicitudes al limpiar el efecto y mantiene la comparación fondo/wallet/owner. También cubre A→B→A. Una respuesta anterior no borra un error actual y un error anterior no deshabilita datos actuales. Se descarta también el error superado antes de propagarlo al manejador del refresco posterior a una confirmación; una regresión adicional reproduce y cierra esa alerta incorrecta.

No se comparan saldos ni números de ledger para adivinar vigencia: se admiten cambios legítimos del mismo ledger y una cartera actual vacía. Se conservan guardas de revisión, recibos, errores visibles e historial fijado; no hay otro planificador, endpoint, retry o automatización financiera.

## R40-02: causa del borrado del importe

La investigación de R40 dejó la causa abierta. La traza R41 del componente R39 y el test original, instrumentados únicamente en memoria, reproduce la secuencia input-change(10) → reset-effect(reset0). El efecto pasivo inicial borra el importe sin una confirmación. En run5 falla la aserción original de foco con importe vacío. Es un defecto del ciclo del formulario confirmado localmente, sin incidente de producción demostrado; no se despacha como simple flakiness.

Se elimina el reset pasivo al montar. El estado inicial ya es vacío. Cuando cambia la señal existente de depósito confirmado, el componente ajusta su propio importe/error/quote antes del commit, con una condición acotada al reset aplicado. Se conservan activo y tolerancia; una operación rechazada y el polling no limpian la entrada. No se cambian el test original ni sus aserciones/foco, ni se añaden esperas o saltos para obtener verde.

Ocho procesos diagnósticos posteriores ejecutan tres tests originales cada uno:24/24 pasan. Las trazas conservan10 tras escribir y registran confirmed-reset(1) sólo tras éxito sintético. Son evidencia causal instrumentada, separada de la suite de producto sin instrumentar. Una primera suite amplia de1308 casos pasó antes de reforzar ese último camino; se conserva y se ejecuta una nueva suite sobre el código final. Dos probes exploratorios inválidos se conservan con sus fallos (resolución setup y evento en Profiler antes de handler); no cuentan como pruebas de cierre.

## Validación y límites

109 casos focalizados pasan sin instrumentación:15 nuevos (11 de lecturas y4 de ciclo de depósito), más regresiones existentes de historial, depósitos, catálogo y retiradas. Las pruebas nuevas usan modelos reconciliados, actores públicos sintéticos y dobles explícitos de ejecución sin wallet/firma/envío. El test de confirmación observa que cada commit tras éxito ya tiene el importe vacío; no dispara eventos desde el callback de commit.

1309 casos frontend pasan; 57 omitidos explícitos por perfiles y restricciones. Los109 focalizados son subconjunto. Build/tipos/navegador/cierre sólo se completan con sus recibos finales, separados de esta suite.

El navegador final debe usar la build nueva de R41, GET HTTP exclusivamente en loopback y datos financieros/identidades sintéticos; ningún PASS de navegador se hereda de R39. La identidad exacta permite retener303 casos Rust y710 pasos financieros/gobierno actual-WASM, backend/SDK y anteriores ensayos largos; no se presentan como nueva ejecución o liquidez actual. Las restricciones y57 skips de frontend se mantienen; no se ejecutan los casos de firma ni el VM opt-in.

Los scripts, fuentes revisadas, recibos y diagnósticos están en artifacts/read-coherence-r41-20261104 y read-coherence-r41-20261104. El sello y verificación final atan el candidato, build, evidencia válida y fallida. R39/R40 y sellos previos se conservan. [Pendientes reales](MAINNET_PENDING.md): dos advisories de dependencias sin waiver, cualificación del destino y activación/desactivación, recursos/liquidez/recuperación actuales, wallet/canary/CI autorizados, revisión independiente y aprobación final. mainnetApproved=false; sin wallets reales, firmas incluidas efímeras, envíos, producción, push ni contacto externo.
