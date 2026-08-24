# Migración del Excel de los dueños

Los dueños llevaban las reservas en `Las Cañas ALQUILERES.xlsx`, una hoja por
temporada. Estos scripts pasaron esa información a la planilla `reservas` que
usa la web, para que el panel de admin sea el único lugar donde se maneja la
ocupación.

Se corrió una sola vez, el 24/08/2026, con las hojas **Temporada 25-26** y
**Temporada 26-27**: 91 estadías, 511 noches, $75.173.799 facturados.

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

3. **Hay fechas mal tipeadas.** `"a al 10"` en vez de `"1 al 10"`, y filas con
   un número suelto (`"31"`) que son el arranque de una estadía que termina el
   mes siguiente.

Una fila quedó afuera a propósito: `LC5 r190` (junio) no tiene fecha alguna, así
que no hay forma de ubicarla en el calendario.

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
