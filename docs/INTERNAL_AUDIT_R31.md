# Auditoría interna R31 de Arka.fund

Fecha: 4 de noviembre de 2026. Base: R27, commit `c0d008fe09ab3651a2e73c8aa0173e7d86a63302`. Correcciones aisladas en R31. Noah permanece V2. Cero firmas, wallets reales, envíos a la cadena, consultas de producción o contactos con auditores.

## Dictamen y alcance

Esta revisión encuentra cuatro hallazgos nuevos: tres corregidos y uno abierto. No se ha demostrado un nuevo defecto crítico/alto de pérdida o apropiación de fondos en las rutas revisadas. Eso no prueba ausencia de vulnerabilidades y no constituye aprobación de despliegue.

R31 corrige la concurrencia del servicio de catálogo/perfiles y la activación implícita del perfil de firma en el comando de pruebas. No cambia contratos, ABI, planificador, reglas financieras, rutas, interfaz, dependencias ni los 24 WASM seleccionados. No añade reintentos, keeper, automatización financiera ni planificadores paralelos. Los controladores y sellos R27–R30 se conservan.

El trabajo combina revisión manual de límites de confianza, comparación del código desde R14, reproducciones adversariales contra R27, regresiones sobre R31 y aceptación real de HTTP/Chromium. Las pruebas anteriores se retienen sólo donde coinciden fuentes, configuración y dependencias; no se presentan como ejecuciones nuevas. Los 24 avisos del analizador estático se concilian con las disposiciones manuales de R28. El analizador inventaría 27 contratos, 654 entradas públicas y 85 entradas con llamadas externas; su resultado no es una prueba de autorización entre módulos.

## Hallazgos

| ID | Severidad y ámbito | Estado |
| --- | --- | --- |
| R31-01 | Moderada, disponibilidad/coherencia del catálogo | Corregido y validado localmente |
| R31-02 | Baja, integridad de metadatos de perfiles | Corregido y validado localmente |
| R31-03 | Moderada, disponibilidad condicionada a eliminar roles opcionales | Abierto: requiere corrección y revalidación de contratos |
| R31-04 | Baja, política del comando de validación local | Corregido y validado sin ejecutar firmas |

### R31-01: publicación de un snapshot antiguo después del nuevo

Dos llamadas autorizadas a `CatalogService.sync()` podían leer en paralelo y publicar en orden inverso. Se ha reproducido un snapshot actual antiguo mientras el histórico ordenado conservaba como última la observación nueva. Los controles posteriores de reconciliación rechazan la incoherencia; no se ha demostrado una operación financiera indebida.

La corrección comparte una única operación en curso por instancia del servicio, desde la lectura hasta la publicación/histórico/monitorización. Libera esa operación tanto al completar como al fallar. La siguiente sincronización sigue siendo una decisión del operador; no existe reintento automático.

Las regresiones prueban solapamiento, ocho peticiones HTTP autorizadas, fallo del lector, fallo al publicar y recuperación posterior. Dos instancias con almacenes independientes progresan en paralelo. El modelo sigue exigiendo un único escritor por directorio de datos: esta corrección no es un bloqueo distribuido para varios procesos compartiendo archivos.

El método ya existe en el historial de junio de 2026; estaba en R4 y R27. La evidencia local no establece qué código o configuración ejecuta producción.

### R31-02: dos actualizaciones de perfil reconocidas, una conservada

La lectura-modificación-escritura del archivo de identidades podía perder una actualización concurrente. Se reprodujo con dos perfiles distintos. Afecta a nombres/metadatos; no modifica permisos financieros ni derechos sobre shares.

Las mutaciones de Arka y manager pasan ahora por la misma secuencia local del servicio. Una mutación rechazada no bloquea la siguiente. Se validan las dos actualizaciones con persistencia real de archivos y la combinación de perfil de fondo/manager.

Para aislar la concurrencia, estas pruebas sustituyen exclusivamente el verificador de identidad por un doble explícito. No generan claves ni firmas y no demuestran una nueva cualificación criptográfica. Las verificaciones y mensajes del producto permanecen intactos. El código vulnerable figura en el historial de julio de 2026.

### R31-03: roles opcionales guardados como Void y leídos como Address

El SDK representa `Option<Address>::None` como `Void`. Algunas rutas guardan ese valor, pero lo leen después como `Address`, provocando un error de conversión en vez de tratarlo como rol ausente.

Reproducciones con los WASM reales seleccionados, en RAM privada y con autorización SourceAccount del host:

- El executor acepta quitar su gobernador y `config()` devuelve ausencia, pero la programación posterior por el administrador activo falla antes del fallback. Asignar de nuevo un gobernador permite programar.
- Quitar el gobernador del registro bloquea la creación desde la factory, incluso con registrar autorizado. La creación fallida revierte todo el estado, incluida la comisión. Reasignar el gobernador permite crear con el mismo salt.
- Quitar el guardian del registro de venues hace fallar su lectura y `disable_venue`, incluso para el gobernador. El gobernador aún puede pausar con `set_venue_status(..., 0)`; asignar un guardian restablece `disable_venue`.

No se ha demostrado robo, pérdida de fondos, omisión de autenticación ni incidente en producción. La severidad moderada refleja creación/operación de emergencia indisponible bajo una configuración admitida por el ABI. La función del executor precede a R27 en el historial de junio.

**Pendiente técnico concreto:** leer los roles opcionales con un tipo coherente, compatible con entradas ausentes, Address y Void; revisar el patrón en módulos auxiliares y legados; preservar la retirada permanente de bootstrap y el rechazo de llamadores no autorizados. Después, compilar los WASM afectados, actualizar bindings/constructor/perfiles y repetir las matrices de gobierno, creación con rollback, pausa/recuperación y ciclo financiero de los tres venues. No se ha aplicado una modificación contractual sin esa validación.

La configuración propuesta de lanzamiento mantiene gobernadores y guardian explícitos; no contiene operaciones para eliminarlos. Esto limita la exposición del plan ensayado, pero no cierra el defecto. La revisión de lanzamiento debe decidir expresamente su cierre; no se debe ofrecer la eliminación de estos roles como operación cualificada.

### R31-04: el comando completo de pruebas activaba firmas por defecto

`release/check-local.mjs` añadía `--ephemeral-signatures` a cuatro jobs aunque el operador no lo pidiera. Se reprodujo capturando las órdenes de sus procesos hijos sin ejecutarlos.

Ahora el comando exige esa opción explícita y conserva por defecto la verificación de evidencias criptográficas existentes. Dos pruebas de proceso confirman tanto la ausencia del opt-in por defecto como su propagación limitada cuando se especifica. Esas pruebas capturan órdenes: no crean ninguna firma. La autorización de esta tarea sigue prohibiendo incluso firmas efímeras.

## Cobertura de la revisión

| Área | Revisión y evidencia aplicable | Límite práctico |
| --- | --- | --- |
| Contabilidad, fees, shares y retiradas | Relectura del flujo de cola, escrow, reservas, precios de liquidación, claims y lotes; rutas exactas y balance físico. Fuentes/WASM financieros idénticos a R27; ciclo completo y recursos retenidos de R28. | Estado Sushi congelado, oráculo/funding/actores sintéticos; no profundidad de mercado actual. |
| Factory e inicialización | Revisión del cobro atómico, digest de términos, código/salt, creación Arka/share y registro; nueva reproducción de fallo profundo y rollback por R31-03. | Autoridades y destino reales pendientes; la creación positiva local no autoriza despliegue. |
| Routing y protocolos | Revisión de router, Sushi y bindings direccionales; matrices locales Sushi/SoroSwap/Aquarius R27/R29 conservadas por identidad. Phoenix legado, Blend crédito y Balanced diferido constan en el alcance. | No activar nuevos venues/activos con datos históricos. Balanced/SODAX no tiene cualificado el ciclo externo completo. |
| Gobierno, cobertura y legado | Revisión del despliegue tipado del executor, namespace/estado/cancelación/expiry/rollback, permisos bootstrap y rutas opcionales. Disposiciones R14/R28 y fuentes sin cambios para cobertura, claims y tokenomics. R31-03 queda abierto. | Gobernanza y configuración son dependencias de confianza; no se prueba solvencia económica de cobertura ni un DAO real. |
| Oráculos y valoración | Revisión de precios/freshness y del tratamiento de lecturas indisponibles; datos y reservas del catálogo contrastados con getters y backing. | No se cualifican feeds vivos, emisores, permisos KYC/RWA ni liquidez de salida. |
| Catálogo, indexación y backend de revisión | Lectura manual de creación histórica, holders/requests, proyección, persistencia y ABI/auth/resources/fees; dos reproducciones y correcciones de concurrencia, suite completa y dapp HTTP. | RPC/catálogo siguen siendo observaciones de fuentes confiadas, no una prueba de consenso. Un escritor por directorio; backups completos requieren quiescencia. |
| Dapp, wallet y SDK | Revisión de cambios desde R14, continuidad owner/review/factory/fee, hash/body, recibos y recuperación; web/SDK idénticos a R27, builds y suites R28 retenidas. Chromium usa el backend R31 real. | No se ha invocado wallet. El helper de envío legado de catálogo no tiene llamadores en el runtime actual y no queda cualificado para futura activación; no debe equipararse al SDK/dapp revisados. |
| Release, herramientas y dependencias | Inventario, 24 triages manuales, fuente/lock/WASM, política de firma corregida, higiene y checks de release. Minimatch/crypto-bigint conservan evaluación R23 por locks idénticos. | Sin nueva consulta a registros externos. Avisos sin resolver ni dispensar; CI alojada y revisión independiente pendientes. |

La matriz no afirma que se haya vuelto a leer cada línea de todos los módulos sin cambios. Identifica revisión diferencial nueva, puntos críticos reexaminados y evidencia manual/nativa retenida. Ningún total de tests sustituye este límite.

## Validación y procedencia

- Backend compilado nuevamente desde R31. Suite completa: 178 pruebas unitarias y 41 de integración pasan; tres pruebas de firma omitidas expresamente. Incluye ocho nuevas regresiones de concurrencia.
- Dos regresiones del comando de validación prueban las órdenes reales mediante captura de subprocess; cero ejecuciones de jobs de firma.
- Ocho comprobaciones de Chromium/Next → HTTP → catálogo/revisión R31 pasan: ráfagas de ocho syncs, pending/reserved/paid, error por índice atrasado, pantalla móvil, idempotencia y reinicio real. Sin respuestas API fabricadas en navegador.
- Los cuatro checkpoints de lectura y sus eventos/getters proceden del replay nativo R27 sellado en R28/R30. Las cuatro observaciones canónicas finales coinciden exactamente. El navegador no vuelve a ejecutar inversión/liquidación/claim.
- El binario Next se reutiliza tras verificar 616 archivos web y dependencias idénticos. El backend sí se recompila. El perfil del ensayo es de sólo lectura, vinculado a las fuentes de catálogo bajo revisión; no reidentifica ni acepta archivos de review antiguos como nuevos.
- R31 ejecuta además tres reproducciones nativas de roles opcionales: 6 pasos de executor, 60 de registro/factory y 10 de guardian/routing, en RAM sin firmas. Los controles verifican que los fallos revierten y que las asignaciones explícitas recuperan la operación.
- Se conserva la cualificación R28 de 1.934 tests, 62 omisiones, reproducción de 24 WASM y ciclo financiero. No se suman esos tests a los nuevos ni se vuelven a atribuir sus firmas históricas a esta sesión.
- El primer intento de sync tenía una expectativa errónea sobre el orden del histórico; la segunda reproducción corrige esa expectativa y conserva el primer intento. El primer ensayo de navegador falló por un selector de texto escapado y se conserva. El primer controlador de roles adicionales terminó después de una reproducción de factory válida al pedir un getter inexistente en Router; la revisión siguiente reutiliza esa prueba por identidad y ejecuta la matriz correcta.

Los resultados de checks, identidades de fuentes, reproducciones, logs, capturas y referencias de sellos están en el directorio de evidencias R31. El informe estructurado es [internal-audit.json](../release/internal-audit.json). El inventario final fija el candidato; el sello externo al árbol evita referencias circulares.

## Qué sigue abierto antes de mainnet y de la revisión externa

El siguiente trabajo técnico cerrable íntegramente en local es R31-03. Después debe repetirse la cualificación de los contratos realmente modificados y comprobar el nuevo candidato completo. Esta auditoría no declara todos sus hallazgos cerrados.

Separadamente siguen pendientes los dos avisos de dependencias (sin versiones forzadas ni aceptación de riesgo), CI del candidato exacto, revisión independiente y reconciliación autorizada del destino: códigos/roles, pools/rutas/callers, oráculos, histórico/index, recursos/TTL/restore y liquidez vigente. Wallet/dispositivo/canary y autorización de despliegue requieren su fase expresa; aquí no se han realizado. Véase [MAINNET_PENDING](MAINNET_PENDING.md).

Esto no revoca la aprobación histórica de la plataforma desplegada. No se ha consultado producción y no hay diagnóstico de su estado actual. Noah continúa V2; ejecución mainnet y venues nuevos permanecen sin activar.

