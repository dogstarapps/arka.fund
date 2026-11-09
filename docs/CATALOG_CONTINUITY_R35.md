# R35 — Continuidad del catálogo y recuperación del historial

4 de noviembre de 2026. Base: R34, commit `6143cdc50bfff1470b830becbc52c330ae05e6ba`. **R33-01 queda corregido y validado localmente.** R33-02 y los hallazgos R31 siguen cerrados localmente. No se ha accedido a producción; Noah permanece V2.

## Cambio

El escritor podía publicar la generación 10.001, pero el lector y restore rechazaban cadenas de más de 10.000. Se elimina ese límite arbitrario en ambos recorridos, manteniendo verificación SHA-256 de cada objeto, identidad de red/registro, secuencia consecutiva, ledger no decreciente, detección de ciclos y llegada a una raíz válida. La validación numérica sigue rechazando valores no representables antes de escribir una generación nueva.

El recorrido común es iterativo. `current()` valida toda la cadena sin conservar todos los payloads históricos: retiene la cabecera, los objetos en curso y el conjunto de hashes visitados. No utiliza una caché para omitir validaciones. Un antecesor corrupto sigue bloqueando lectura, escritura y backup incluso después de una lectura correcta o de una petición aparentemente idéntica. `chain()` conserva su API de materialización completa cuando el llamador pide expresamente el historial.

`commit()` evita solamente escrituras con **el mismo ledger y el mismo payload JSON**. Un cambio real del mismo ledger se conserva; un ledger posterior sigue siendo un checkpoint nuevo, aunque sus datos económicos coincidan. No se descartan observaciones posteriores ni se debilita el rechazo de rewinds. Las obligaciones activas se siguen leyendo y reconciliando.

El backup se escribe incrementalmente en el formato JSON v1 existente y con el mismo checksum que produciría el serializador anterior. Sólo se publica tras validar la cadena completa y sincronizar los bytes. La publicación crea el destino sin sobrescribirlo; tras éxito se retira únicamente el enlace temporal creado por esa operación, cuyos bytes permanecen en el archivo publicado. Los fallos conservan su staging para diagnóstico. No se borra ni compacta historial, ni se sustituye un archivo previo.

Restore conserva el formato v1 y valida checksum, todos los objetos, enlaces, secuencias, ledgers, raíz y pertenencia de todos los objetos antes de crear el destino. Ya no rechaza 10.001 objetos por su cantidad. Un destino existente, backup incompleto, digest incorrecto o identidad ajena siguen rechazándose.

## Pruebas del límite y de integridad

- **183 pruebas unitarias pasan**, con dos casos de firma omitidos. Una regresión focalizada adicional pasa: en conjunto se cubren las seis nuevas regresiones de continuidad. La ejecución focalizada evita repetir el ensayo grande, cuya lógica no ha cambiado.
- Fixture histórica sintética de 9.999 generaciones, con payload de 4 KiB por generación. El repositorio real publica las 10.000, 10.001 y 10.002; reinicia, respalda y restaura **10.002 objetos byte a byte**, y después publica la 10.003. El origen permanece intacto.
- Lectura completa de esa cadena en un proceso Node con `--max-old-space-size=48`: aproximadamente 1,63 segundos, 36,6 MB de heap usado al finalizar y 119,9 MB de RSS. El parámetro limita el old-space de V8, no todo el RSS del proceso.
- Mismo ledger/payload no aumenta generaciones; cambios reales del mismo ledger y observaciones posteriores sí. Se conservan pagos, reservas y derechos. Dos backups simultáneos sobre el mismo destino producen un único archivo completo; el otro rechaza `EEXIST`.
- Formato v1 byte idéntico al esperado, incluyendo Unicode; recuperación compatible; rechazo de corrupción de antecesores, salto de secuencia, reversión de ledger y raíz falsa. Las pruebas anteriores de publicación interrumpida y escritor terminado con SIGKILL siguen pasando.
- Backend recompilado; **41 pruebas de integración y 111 de revisión pasan**, con una omisión de firma en cada conjunto. Sin cambios de versiones, instalaciones u overrides.

Se abre además en sólo lectura la fixture sellada R33 que quedó publicada en 10.001 y resultaba ilegible con el código anterior. R35 recupera el mismo tip y genera un backup de sus 10.001 objetos, sin cambiar su puntero ni sus archivos. Demuestra recuperación de un historial ya afectado sin reset, truncado o migración.

## Ensayo del servicio completo

El ensayo usa el backend compilado, `RpcManagedSnapshotSource`, `DurableManagedRequests`, proyección, stores persistentes y API HTTP reales. Sólo el transporte RPC, los actores públicos y las observaciones financieras son fixtures; no se ejecutan ni se envían transacciones.

1. Dos cadenas sintéticas de 9.999 generaciones preparan el archivo del catálogo y los checkpoints de solicitudes. La sincronización real publica 10.000 y 10.001; la API muestra correctamente shares pendientes y efectivo reservado.
2. Se detiene el proceso propio y se captura el estado quiescente. Se respaldan **10.001 objetos del catálogo y 10.001 de solicitudes**.
3. Se restauran ambos historiales en directorios nuevos. Todos los objetos y los cuatro archivos de estado se comparan byte a byte. Otro proceso sirve exactamente la misma posición e historial antes de volver a sincronizar; identidades antiguas permanecen iguales.
4. Se sincroniza el estado de pago posterior y se publica la generación 10.002. Pending y claimable pasan a cero, paid conserva `400000000` unidades, y la historia mantiene las observaciones anteriores. Repetir el ledger no crea otro checkpoint ni otra observación.
5. El archivo restaurado genera otro backup completo de 10.002 objetos. Los archivos y punteros del origen permanecen iguales. Cadena incompleta con digest recalculado, digest erróneo, red ajena, destino existente y POST HTTP de sync se rechazan.

Las cuatro sincronizaciones medidas tardan aproximadamente 2,1–3,2 segundos en esta fixture. El backup de ambos historiales tarda unos 3,4 segundos; su restauración durable, 127,8 segundos, incluyendo los fsync por objeto. Son medidas locales del Mac y no una garantía de rendimiento del destino.

## Compatibilidad y límites

Sólo cambia la implementación de `durableCatalog.ts`, además de pruebas y documentación. Permanecen idénticos los contratos, 24 WASM, ABI, SDK, routing, dapp, lógica financiera, gobierno, activación de venues y seis locks de dependencias. La evidencia R34 de esas capas se retiene por identidad; no se presenta como una recompilación o replay financiero nuevo.

No se introduce otro formato de backup, base de datos, índice, caché de integridad, planificador, keeper o automatización financiera. Se conserva la restricción de un escritor de catálogo por directorio; no se crean bloqueos entre proyectos.

El coste de leer/verificar la cadena crece con el historial y el conjunto de hashes visitados también crece. Backup evita materializar todos los payloads. La restauración JSON v1 conserva memoria proporcional al fichero completo; el almacenamiento, RAM y tiempo de recuperación del destino deben dimensionarse y probarse con sus datos reales. El cierre demuestra la continuidad más allá de 10.000, no capacidad infinita ni recuperación de una instalación de producción. No se eluden checksums o validaciones para mejorar una cifra.

La primera compilación de las nuevas pruebas encontró una importación equivocada y un doble de transporte incompleto; se conservan los logs y se corrigieron sólo las fixtures. No se cuentan intentos fallidos como PASS. Evidencias y controladores: `artifacts/catalog-continuity-r35-20261104` y `catalog-continuity-r35-20261104`, junto a la release. Los sellos anteriores se verifican de nuevo sin modificarlos.

## Pendientes

No queda otro defecto de aplicación confirmado abierto en el registro local. Esto no es una auditoría independiente ni una aprobación de mainnet. Siguen los avisos minimatch/crypto-bigint sin waiver ni actualización de registry, CI alojado, revisión independiente y autorización final; identidad/configuración/roles/oráculos/rutas del destino, activación/desactivación de Sushi/SoroSwap/Aquarius, historia/backup operativo, recursos/liquidez actuales y wallet/dispositivo/canary.

Noah sigue V2. Cero wallets reales, claves privadas, firmas —incluidas efímeras—, envíos a la cadena, lecturas/escrituras de producción, pushes o contactos con auditores. Sushi no se activa; Phoenix retirado sólo para rutas nuevas; Balanced entre cadenas no cualificado; Curve aplazado. Véanse [pendientes](MAINNET_PENDING.md) y [auditoría](../release/internal-audit.json).
