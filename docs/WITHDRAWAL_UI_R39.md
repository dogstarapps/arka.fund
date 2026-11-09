# R39 — Continuidad del historial y avisos de retiradas

4 de noviembre de 2026. Base: R37, commit `645a82955e69b73864de504ebe72bc4698d0551b`. Referencia de auditoría: R38. R37, R38 y sus sellos permanecen intactos.

## Cambios

**R38-01:** el componente conserva una sesión histórica mientras el desplegable está abierto. Página, cantidad, importe acumulado y validación usan la observación elegida al abrir. El refresco de la inversión no remonta esa sesión ni mezcla páginas. Cerrar descarta la sesión; reabrir usa la observación más reciente. Cambiar fondo, propietario o código reinicia el componente y descarta respuestas tardías. Los errores y reintentos manuales de lectura conservan la observación elegida.

**R38-02:** si una solicitud observada no aparece en una vista activa completa y no truncada, el aviso deja de reutilizar el mensaje de pendiente. Muestra un mensaje neutro que remite a las retiradas. No afirma pago, cancelación o devolución por ausencia ni deduce el resultado de un agregado. Una fila terminal verificada conserva sus mensajes específicos de pago o cancelación. Una lectura incompleta no se convierte en una confirmación.

El cambio de producto se limita a tres archivos de dapp. Contratos, los 24 WASM seleccionados, ABI, almacenamiento, backend, SDK, routing, planificador, comisiones, autorizaciones y los seis locks permanecen iguales a R37. No hay nuevo endpoint ni ejecución automática.

## Validación local

La suite focalizada pasa 94 casos, incluidos 11 nuevos: refresco real de diez segundos en la superficie de producto, navegación fijada y actualización al reabrir; pago, cancelación, residuo y pago automático; ausencia sin índice completo; filas terminales verificadas; cambios de fondo/propietario/código, respuestas tardías al cerrar/reabrir y reintento tras un error. Los ejecutores y datos financieros de estos tests son dobles locales explícitos; no crean firmas ni envían transacciones.

La primera ejecución conservada rechazó una fixture de página nueva con ledger antiguo, como debe hacer la guarda de identidad. También hubo un fallo de sincronización del test existente del formulario de depósito: el DOM mostraba el importe reiniciado antes de su acción. Se corrigió la fixture del historial y la segunda ejecución completa de los cinco archivos pasó. No se relajaron las guardas ni se modificó el flujo de depósito. Se conservan ambos intentos.

La suite completa de frontend pasa 1294 casos, con 57 omitidos explícitos por las restricciones y perfiles de prueba. Los 94 casos focalizados están incluidos y no se suman dos veces. Tipos, compilación y comprobación de fuentes/cierre tienen recibos separados en artifacts/withdrawal-ui-r39-20261104; sólo se consideran completados si sus recibos finales pasan.

Los ensayos financieros, gobernanza, historial largo, backend y SDK de R37/R38 se retienen únicamente tras verificar fuentes, locks y WASM. No se presentan como nuevos replays ni builds de contratos. La reauditoría interna no sustituye la revisión independiente ni valida el destino actual.

## Pendientes

Minimatch y crypto-bigint siguen abiertos con su exposición caracterizada y sin waiver ni versiones forzadas. Quedan configuración e identidades reales del destino, activación/desactivación de Sushi/SoroSwap/Aquarius, capacidad y recuperación operativas, recursos/liquidez/TTL actuales, wallet/dispositivo/canary, CI alojado, revisión independiente y autorización final. Véanse [MAINNET_PENDING.md](MAINNET_PENDING.md) y el registro JSON.

Noah permanece V2. Sin wallets reales, firmas incluidas efímeras, envíos a la cadena, lecturas/escrituras de producción, push ni contacto o envío a auditores. Sushi sigue sin activar; Phoenix sólo legado, Balanced entre cadenas sin cualificar y Curve aplazado. `mainnetApproved=false` describe este candidato y no reevalúa una aprobación histórica de producción.
