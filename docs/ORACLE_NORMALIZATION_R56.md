# R56 — corrección de R55-01

**R55-01 queda corregido y validado en el candidato local R56.** Solo cambia el WASM seleccionado de OracleGuard; los otros 23, incluido Arka de 130.856 bytes, permanecen idénticos a R47. R47, R54, R55 y sus sellos se conservan. La autoridad sigue siendo **GBHIT7TXZSRWT4QZXKINECMQWKC7NC7GBJAGK6XFOURI3T6ZHJDTHCMD**. Noah permanece V2; no se ha consultado ni modificado producción en R56.

## Cambio de contrato

OracleGuard declara salida **USD con 14 decimales**. Consulta base() y decimals() de cada proveedor; un proveedor sin metadata válida queda no utilizable. Un proveedor con otra base necesita una configuración explícita ProviderNormalization: base esperada, oracle de conversión y activo que ese oracle cotiza. Solo existe un tramo directo a USD, sin resolución recursiva ni otro contrato de producto. La ruta de precios y sus controles se conservan.

Para los bindings de R55 se configura la primaria CALI… con base Stellar(USDC), conversor CAFJ… y activo Other(USDC). La fórmula es **XLM/USDC × USDC/USD**, usando la escala declarada de ambos feeds. No se presupone paridad USDC/USD ni se duplica un feed para simular dos fuentes independientes de XLM. El conversor compartido no se cuenta como una tercera fuente de confirmación del precio de XLM.

La aritmética usa un producto de 256 bits y una única reducción de escala; devuelve un resultado i128 válido y positivo o invalida la fuente. Se admiten escalas entre 0 y 38; se rechazan escala inválida, resultado no representable y subprecisión que redondea a cero. La marca de tiempo normalizada es la **mínima de ambos tramos**. Cualquiera de los dos precios nulo, negativo, futuro o caducado invalida la conversión. Una pausa de la divisa base también la invalida. Un cambio de la base declarada respecto a la configuración se rechaza; el conversor debe declarar USD. No se relajan los 900 segundos ni los límites de divergencia del ensayo.

La configuración y su retirada usan las comprobaciones existentes de admin/governor y caducidad del bootstrap. Se prueban planificación/ejecución por el contrato de gobierno, rechazo de ejecución temprana, rechazo del admin retirado, mutación inválida con rollback, revocación que bloquea la cotización y recuperación gobernada. La autoridad productiva no se sustituye y los tiempos cortos del ensayo no se proponen para mainnet.

## Identidad y clientes

WASM OracleGuard final: **0ca18a466c83583e22683cf5a9e18bb57a7655d4dc0b08629c82430ece1e8593**, 35258 bytes. Se conservan los argumentos y retornos de los **38 métodos existentes**. Se añaden base, decimals y set/clear/get de ProviderNormalization. SDK y backend incorporan bindings regenerados; el SDK ofrece lectura de metadata/configuración y preparación tipada de set/clear, sin otra API financiera ni panel de producto.

El backend recibe ahora 15382007304161/10^14 **USD por XLM**, en lugar de etiquetar como USD la primaria de 15366546279266/10^14 **USDC por XLM** de la captura R55. La clasificación USD del backend se comprueba con el resultado del WASM corregido. Los parámetros de factory/constructor se enlazan al hash nuevo; el helper legacy bootstrap_auxiliaries se excluye porque no acredita el guard nuevo.

## Pruebas finales

- **318 tests Rust** del workspace, incluidos escalas mixtas, precisión, producto intermedio ancho, desbordamiento final, caducidad de cada tramo, cambio de base, pausa de la divisa, fuentes independientes y autorización. Los fixtures sin metadata se declaran explícitamente como fixtures de USD/14; un test conserva el rechazo de un oracle sin metadata.
- **Aquarius: 80 pasos**, con snapshot R55 del ledger 65322910, proveedores y precios reales capturados sin modificación, nuevo guard, configuración gobernada, factory, inversión, liquidación en cinco lotes y retirada de 999,6002016 XLM sobre 1.000 XLM sintéticos. Residuo y doce balances/allowances a cero. No es una nueva lectura de salud de red.
- **Sushi: 195 pasos; SoroSwap: 189 pasos**, ambos con el nuevo guard. Usan pools históricos y precios sintéticos declarados USD/14 por un wrapper exclusivo de pruebas que remite al fixture histórico. No se presentan como cualificación de liquidez o precios actuales. Ambos completan la retirada íntegra sin residuos ni allowances.
- Total de escenarios financieros finales: **464 pasos**. Hay **14 pasos adicionales** de rechazo/recuperación/edad; no se suman los prefijos repetidos para obtener cotizaciones o planes. Los ensayos previos al último cambio de pausa se conservan y no se usan como cierre.
- SDK: **34 tests y una omisión criptográfica**, compilación SDK y backend, **7 tests de precios del backend**, bindings exactos y ABI de los 24 artefactos. La verificación final de fuentes y tests de release se recoge en los recibos de cierre.

El pico del ciclo Aquarius fue **81.568.589 instrucciones simuladas** y **19.160.543 bytes** de memoria, bajo los límites de la captura (400.000.000 instrucciones y 41.943.040 bytes). Esto no acredita admisión, upload o TTL actuales. No hay cambios de dependencias ni versiones forzadas; los avisos minimatch/crypto-bigint continúan abiertos. El frontend y sus dependencias no cambian; no se copia ni se recompila su build anterior como si fuese una build nueva.

## Incidencia de firma y corrección del arnés

**Se incumplió la restricción de no firmar durante el primer comando de tests de release.** Ese comando incluyó un test histórico que activaba por sí mismo el perfil efímero en sus hijos y creó **9 firmas con claves efímeras locales**. La red estaba bloqueada, no se utilizaron wallets reales y no se enviaron transacciones ni se tocó producción. La incidencia se comunicó al usuario y se conservan sus contadores y 33 archivos de evidencia. No se declara cero firmas para el conjunto de R56.

Se ha corregido ese test: las pruebas positivas y el worker requieren ahora opt-in explícito **del proceso que llama**; el test ya no activa firmas en hijos por iniciativa propia. En R56 el opt-in permanece en 0. Las cinco pruebas positivas quedan omitidas y se comprueban ocho denegaciones sin nuevas firmas. Las pruebas financieras, Rust, SDK sin opt-in y los casos de gobierno no crean firmas. Ver signature-policy-incident.json y signature-denial-check.json.

También se conservan los logs de fixtures iniciales sin metadata, el rechazo correcto de un digest de factory obsoleto y los timeouts locales sin salida. Para las nuevas direcciones de guard se obtuvo el digest real de la factory antes de recrear cada fondo; no se debilitó esa protección. Los retries de un proceso sin salida conservaron input y binario. Los snapshots generados por nuestros tests en R56 se archivaron antes de restaurar su baseline; no se borró información única.

## Aplicación pendiente

La corrección está en **un candidato local nuevo y no publicado**, basado en el commit R47, con cambios sin commit e identidad completa en source-manifest.json. No está aplicada a la instalación existente ni autoriza su despliegue. La secuencia exacta de configuración se conserva en launch-normalization-plan.json. Primero se crea/cualifica el guard seleccionado para el nuevo alcance bajo la autoridad existente, se configura y comprueba la conversión, y después se revisan las activaciones manuales de los venues. No se cambia automáticamente el guard legacy compartido ni Noah.

Siguen pendientes la cualificación vigente del destino y sus políticas de tiempo/identidades, liquidez y recursos/TTL/restore/admisión, cobertura real del catálogo/backup, avisos de dependencias, CI alojada, revisión externa y autorización de wallet/dispositivo/canary y aplicación. R55-01 no queda abierto en el código del candidato; la aplicación real permanece pendiente. mainnetApproved=false.
