# Migración del Excel de los dueños

Los dueños llevaban las reservas en `Las Cañas ALQUILERES.xlsx`, una hoja por
temporada. Estos scripts pasaron esa información a la planilla `reservas` que
usa la web, para que el panel de admin sea el único lugar donde se maneja la
ocupación.

Se corrió el 24/08/2026 con las hojas **Temporada 25-26** y **Temporada 26-27**,
más una fila suelta el 25/08. En total: 92 estadías, 518 noches, $75.693.799.

## Cómo está armado el Excel (y por qué el conversor es más largo de lo esperable)

Tres cosas del Excel obligan a interpretar en vez de leer derecho:

1. **Una estadía que cruza de mes está partida en dos filas**, para poder
   imputarle la facturación a cada mes. La segunda fila arranca el día 1 y no
   repite el nombre del inquilino. Hay que unirlas o cuentan doble.

2. **La columna `dias` no es confiable.** En varias filas cuenta también el día
   de salida y queda una noche de más. Las fechas, en cambio, encadenan
   perfecto: el check-out de una estadía es el check-in de la siguiente. Así que
   **mandan las fechas** y `dias` sólo sirve de control cruzado — cuando no
   coinciden, el conversor avisa y sigue con las fechas.

   Se verificó caso por caso: en `LC1 r31` y `LC5 r191` (“15 al 17”, `dias`=3),
   `importe / prom` da exactamente 2, que son las noches que dicen las fechas.

3. **Hay fechas mal tipeadas.** `"a al 10"` en vez de `"1 al 10"`, filas con un
   número suelto (`"31"`) que son el arranque de una estadía que termina el mes
   siguiente, y una (`LC3 r111`) donde la fecha se tipeó una columna más a la
   derecha, encima del anticipo.

4. **Hay filas de estadía sin fecha.** Tienen importe, días y a veces hasta el
   nombre del inquilino, pero la celda de la fecha quedó vacía.

## El error que costó $1.470.000

La primera carga exigía que la fila tuviera `fecha` para considerarla una
estadía. Las que no la tenían **desaparecían sin decir nada**: cuatro estadías
por $1.470.000 que nadie hubiera notado, porque el resumen final sólo contaba lo
que sí había entrado.

Dos cosas cambiaron para que no vuelva a pasar:

- Una fila con plata es una estadía aunque le falte la fecha. Si no se puede
  ubicar, sale listada al final con el importe y el nombre — ruidosa, no
  silenciosa.
- `convertir.py` contrasta lo cargado contra **la fila `Total` que el propio
  Excel calculaba para cada casa**. Es el único control externo que hay: si no
  da, algo se está perdiendo. La primera versión no lo hacía.

De las cuatro, dos se recuperaron: `LC3 r111` (la fecha estaba corrida de
columna) y `LC5 r190` (ubicada por las 3 noches de junio y el bloqueo de LC5 en
esas mismas fechas). Con eso LC1, LC3 y LC5 cierran exacto contra el Excel.

Las otras dos siguen sin ubicar, y no hay con qué: son de abril, sin fecha y sin
nombre.

### El arreglo del conversor no alcanzaba: había que volver a cargar

Lo de arriba es lo que produce `convertir.py` **hoy**. Pero la carga a la
planilla se hizo *antes* de ese arreglo, así que `LC3 r111` quedó afuera igual:
el conversor aprendió a leerla y nadie la volvió a mandar. Durante un día el
README decía que LC3 cerraba exacto mientras en producción faltaban $520.000.

Se descubrió comparando la fila `Total` de cada casa del Excel contra los
números del panel:

| Casa | Total del Excel | Estaba cargado | Diferencia |
|---|---|---|---|
| LC2 | $13.666.800 | $13.266.800 | $400.000 (r62, sin ubicar) |
| LC3 | $13.870.999 | $13.350.999 | **$520.000 (r111)** |
| LC4 | $14.379.000 | $14.079.000 | $300.000 (r145, sin ubicar) |

La fila que faltaba se cargó el 25/08/2026 como
`XL-2526-LC3-2026-08-08` (Gustavo Amarilla, 8 al 15 de agosto, $520.000). El
`anticipo` quedó **vacío a propósito**: esa celda del Excel la pisó la fecha, así
que el dato no existe. La columna `Restan` de esa fila dice $260.000, lo que
sugiere que se había cobrado esa mitad, pero es una inferencia y no se cargó
como si fuera un dato.

**La moraleja para la próxima:** arreglar el conversor no arregla la planilla.
El control que vale es comparar contra la fila `Total` del Excel **lo que quedó
cargado en producción**, no lo que imprime el script.

## Las cinco temporadas que todavía no se cargaron

El libro tiene 14 hojas y sólo se importaron dos. Las que faltan:

| Temporada | Casas | Noches | Facturado |
|---|---|---|---|
| 21-22 | 3 | 404 | $3.314.500 |
| 22-23 | 3 | 400 | $7.569.945 |
| 23-24 | 4 | 506 | $25.637.767 |
| 24-25 | 4 | 484 | $53.902.000 |

(Más `Alquileres 2017` a `2020` y `Temporada 20-21`, con otra estructura.)

El complejo fue creciendo: Las Cañas 4 aparece en la 23-24 y la 5 en la 25-26.
Por eso `extraer.py` no sirve para éstas — tiene las filas de cada bloque
hardcodeadas. `extraer_general.py` las encuentra por el encabezado `Mes`.

Sin la 24-25 cargada, **la comparación “vs temporada anterior” de la sección
Números nunca se muestra**: compara contra una temporada que no existe en la
planilla.

### Lo que falta para poder cargarlas

Una prueba en seco de las cuatro da 321 estadías, 1728 noches y $88.604.880,
que cierra contra los totales del Excel salvo $1.819.332 (2%). Queda:

- **Un solape**: `LC2 r36` dice `del 23 al 17` con `días`=4. Se lee como 23 de
  diciembre al 17 de enero (25 noches) y pisa la estadía siguiente. Los días
  dicen que en realidad es del 23 al 27.
- **$1.819.332 repartidos** en filas sueltas sin fecha, sobre todo en la 23-24.

No se cargó nada de esto: son 321 filas que aparecerían en Confirmadas, Buscar
y el calendario, así que es una decisión de los dueños, no del script.

| Casa | Fila | Mes | Días | Importe |
|---|---|---|---|---|
| LC2 | r62 | Abril | 3 | $400.000 |
| LC4 | r145 | Abril | 2 | $300.000 |

## Los pasos

```bash
cd migracion
pip install openpyxl

python3 extraer.py     # alquileres.xlsx        -> extraido.json
python3 convertir.py   # extraido.json          -> reservas_excel.json
python3 filas.py       # reservas_excel.json    -> filas_planilla.json

N8N_BASE_URL=... LC_OWNER_SECRET=... python3 enviar.py   # -> webhook importar-excel
```

`convertir.py` además chequea que dos estadías de la misma casa no se pisen
(dieron 0 solapamientos) y `filas.py` que no haya ids repetidos.

## Cómo quedaron las filas

- `id`: `XL-<temporada>-<casa>-<check_in>`, por ejemplo `XL-2526-LC2-2025-12-01`.
  El prefijo `XL-` hace obvio de un vistazo qué vino del Excel.
- `status`: `CONFIRMED` — son estadías que ya pasaron o están cerradas.
- `source`: `excel`.
- `notes`: deja anotada la temporada y el número de fila de origen, para poder
  volver al Excel si algo no cierra.
- `email`, `guests` y `payment_method` quedan vacíos: el Excel no los tenía y no
  se inventaron.
- Los cinco inquilinos que en el Excel figuran sin nombre quedaron como
  `(sin nombre en el Excel)`.

## El workflow de n8n

`../n8n/importar-excel.sdk.js` es el código del workflow que escribe en la
planilla. **Quedó despublicado a propósito** una vez terminada la carga: es un
webhook que agrega filas a las reservas de producción y no tiene por qué estar
escuchando. Si hace falta volver a usarlo, hay que publicarlo de nuevo desde
n8n y despublicarlo al terminar.

Mapea por nombre de columna (`autoMapInputData`) con `handlingExtraData:
ignoreIt`, así un campo que no exista en la planilla se descarta en vez de
crear una columna nueva. Escribe en `RAW` para que las fechas queden como texto
`YYYY-MM-DD` y no las convierta Google Sheets.
