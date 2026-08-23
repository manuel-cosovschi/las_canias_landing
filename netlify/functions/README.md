# Funciones de Netlify

Las funciones no hablan con Google Sheets directamente: le pegan a webhooks de
n8n, que son los que leen y escriben la planilla *Las Cañas - Reservas*.

## Las dos claves

Hay dos secrets distintos y **no son intercambiables**. Ambos viajan a n8n en el
header `x-lc-secret`, y ninguno llega nunca al navegador.

| Secret | Para qué | Funciones |
|---|---|---|
| `N8N_SECRET` | Flujo público de reserva | `availability`, `create-reservation`, `submit-proof` |
| `LC_OWNER_SECRET` | Acciones de dueño (y `assertAuth` del panel) | el resto |

`auth-login` le entrega `LC_OWNER_SECRET` al panel de admin, así que cualquier
endpoint que valide con `assertAuth` tiene que comparar contra ese mismo valor.
Mezclarlos da 401 sin ninguna pista de por qué.

## Variables por función

| Variable | La usan |
|---|---|
| `N8N_BASE_URL` | todas |
| `N8N_SECRET` | `availability`, `create-reservation`, `submit-proof` |
| `LC_OWNER_SECRET` | `auth-login`, `reservation-status` y todas las de dueño |
| `ADMIN_USER` / `ADMIN_PASS` | `admin-login`, `auth-login` |
| `N8N_AVAILABILITY_PATH` | `availability` |
| `N8N_PROOF_WEBHOOK_PATH` | `submit-proof` |
| `N8N_RESERVATION_STATUS_PATH` | `reservation-status` |
| `N8N_GET_PRICE_PERIODS_PATH` | `price-periods` (opcional, tiene default) |
| `N8N_SET_PRICE_PERIODS_PATH` | `set-price-periods` (opcional, tiene default) |
| `N8N_GET_CALENDAR_CONFIG_PATH` | `calendar-config` (opcional, tiene default) |
| `N8N_SET_CALENDAR_CONFIG_PATH` | `set-calendar-config` (opcional, tiene default) |
| `N8N_OWNER_GET_PRICES_PATH` | `get-prices`, `public-prices` (tarifa base, ya sin uso) |
| `N8N_OWNER_SET_PRICES_PATH` | `set-prices` (ya sin uso) |
| `N8N_OWNER_LIST_PENDING_PATH` | `list-pending` |
| `N8N_OWNER_LIST_CONFIRMED_PATH` | `list-confirmed` |
| `N8N_OWNER_APPROVE_PATH` | `confirm-transfer` |
| `N8N_OWNER_CANCEL_PATH` | `cancel-reservation` |
| `N8N_OWNER_CANCEL_CONFIRMED_PATH` | `cancel-confirmed` |
| `N8N_OWNER_BLOCK_PATH` / `N8N_OWNER_UNBLOCK_PATH` | `owner-blocks`, `owner-unblocks` |
| `N8N_GET_PRICE_PERIODS_PATH` | `reservation-document` (opcional, tiene default) |
| `N8N_ADMIN_UPDATE_RESERVATION_PATH` | `admin-update-reservation` (opcional) |
| `WA_VERIFY_TOKEN` / `N8N_WA_INCOMING_URL` | `wa-webhook` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` / `LC_SHEET_ID` / `LC_SHEET_TAB` | `list-calendar`, `search-reservations` |

**Las variables nuevas se aplican recién en el siguiente deploy.** Cargarlas en
el panel de Netlify no alcanza: hay que redesplegar para que las funciones las
vean.

### Ojo: el límite de 4KB

Netlify inyecta **todas** las variables del sitio en **cada** función, y AWS
Lambda no admite más de 4KB en total. Este sitio ya está cerca del límite:
agregar dos variables de path rompió el deploy con
`Your environment variables exceed the 4KB limit imposed by AWS Lambda`, y el
mensaje aparece como un genérico `exit code 2` que no dice nada.

Por eso los paths de webhook nuevos van con valor por defecto en el código en
vez de gastar una variable: no son secretos, y otras funciones ya los tienen
escritos así.

Quien más ocupa es `GOOGLE_SERVICE_ACCOUNT_JSON` (un JSON de service account
son unos 2KB). `OPENAI_API_KEY` no la lee ninguna función: si no se usa en el
build, conviene borrarla o dejarla con alcance sólo de build.

La solución de fondo es migrar el sitio fuera del *Lambda compatibility mode*,
que elimina el límite: https://ntl.fyi/functions-migrate

## Estados de una reserva

Los que escribe la planilla, en orden habitual de vida:

`HOLD_TRANSFER` → `PROOF_SENT` → `CONFIRMED`

y los finales `CANCELLED` y `EXPIRED`. `reservation-status` sólo devuelve estos
valores (lista blanca) más `expires_at`; nunca datos del huésped, porque el
huésped consulta ese endpoint desde el navegador sin ninguna clave.

## Precios

Los precios los definen los dueños desde el panel, como **períodos**: un rango
de fechas con el precio por noche de cada casa. Viven en la data table
`precios_periodos` de n8n y se leen con `price-periods` (pública) y se escriben
con `set-price-periods` (requiere clave de dueño).

Reglas que valida n8n antes de guardar:

- fechas `AAAA-MM-DD`, con `desde <= hasta`
- `hasta` es **inclusivo**: es la última noche que se cobra a ese precio
- precio positivo para las cinco casas
- entre 1 y 50 períodos
- **sin superposiciones**: gana el primer período que matchea, así que un cruce
  cobraría el tramo equivocado sin que nada avise

Una fecha que no cae en ningún período **no tiene precio y no se puede
reservar**. Es a propósito: darle una tarifa de respaldo cobraría de menos sin
que nadie se entere. Si abrís un mes nuevo en el calendario, acordate de
cargarle su período.

La tarifa base vieja (`get-prices` / `set-prices` / `public-prices`) quedó sin
uso: la página de reservas ya no la lee.

## Los dos caminos a la planilla

No todo pasa por n8n. Para **escribir** una reserva sí (n8n manda mails, arma
el hold y actualiza el estado), pero para **leer muchas filas de una** las
funciones van derecho a Google Sheets con la service account:

| Camino | Funciones | Por qué |
|---|---|---|
| n8n | `list-pending`, `list-confirmed`, `confirm-transfer`, … | escriben, o disparan mails |
| Sheets directo | `list-calendar`, `search-reservations` | sólo leen, y necesitan la planilla entera |

`_sheet.js` tiene el cliente compartido: el rango y el nombre de la pestaña
viven ahí para que dos funciones no terminen leyendo columnas distintas.
`list-calendar` todavía tiene su propia copia, anterior al módulo.

## Buscador de reservas

`search-reservations` (dueño) filtra la planilla completa por texto, estado,
casa y rango de fechas. Es lo único que muestra reservas vencidas o canceladas:
`list-pending` sólo trae holds vivos y `list-confirmed` sólo confirmadas.

El texto ignora mayúsculas y acentos —"pena" encuentra "Peña"— y busca en
nombre, teléfono, mail, DNI, id, referencia de pago y notas. El rango de fechas
se cruza contra la estadía, con `check_out` exclusivo: quien se va el 10 no
aparece si buscás el 10.

## Comprobantes

Cuando un huésped sube el comprobante, `submit-proof` lo manda a n8n (que
avisa por mail, como siempre) y además guarda una copia en el blob store
`proofs` de Netlify, con el id de la reserva como clave. `proof-file` la
devuelve al panel:

- `?id=XXX` → los bytes del archivo
- `?ids=A,B,C&meta=1` → cuáles de esos ids tienen comprobante, para no ofrecer
  un botón que no lleva a ningún lado

Las dos cosas piden Basic + `x-lc-secret`: son datos de pago de un huésped y
no pueden salir sin credenciales. Por eso el panel lo baja con `fetch` y lo
muestra desde un object URL, en vez de apuntar un `<img src>` a la función.
La CSP de `netlify.toml` habilita `blob:` justo para eso.

Guardar la copia es **best-effort**: va en un `try/catch` y el `require` de
`@netlify/blobs` es perezoso. Si el almacenamiento falla, se pierde la copia
del panel y nada más — la reserva sigue su curso y el mail igual sale. Los
comprobantes anteriores a esto no están: para esos, sigue estando el mail.

## Reglas del calendario

Igual que los precios, las define el dueño desde el panel (pestaña *Reglas*).
Viven en la data table `config_calendario` de n8n, se leen con `calendar-config`
(pública) y se escriben con `set-calendar-config` (requiere clave de dueño).

Son cuatro cosas, en una fila por regla; la columna `tipo` dice cómo leer las
demás:

| `tipo` | Qué guarda |
|---|---|
| `ventana` | `desde` / `hasta`: primera y última **noche** reservable. `desde` vacío = desde hoy |
| `minimo_default` | `noches`: el mínimo general |
| `finde_fijo` | `desde` = check-in, `hasta` = check-out; se reserva entero o nada |
| `minimo` | `desde` / `hasta` inclusivos, `noches`: mínimo de ese tramo |

Reglas que valida n8n antes de guardar:

- fechas `AAAA-MM-DD`; en los findes el check-out tiene que ser posterior al
  check-in, y en los mínimos `desde <= hasta`
- mínimos entre 1 y 30 noches
- hasta 50 findes y 50 mínimos
- **sin superposiciones** entre findes ni entre mínimos: gana el primero que
  matchea, así que un cruce aplicaría la regla equivocada sin avisar

Si estas reglas no se pueden leer, **la página no deja reservar nada** y lo
dice en pantalla — mismo criterio que con los precios. Inventar una ventana o
un mínimo abriría fechas que los dueños no habilitaron.

Ojo: habilitar un mes nuevo son **dos** pasos — correr la ventana en *Reglas* y
cargarle su período en *Precios*. Con uno solo el mes sigue sin poder
reservarse.

## El documento de reserva confirmada

`reservation-document` devuelve, ya armado y con los colores de Las Cañas, el
documento que antes se mandaba a mano en Word: unidad y dirección, todos los
huéspedes con su DNI, fechas con horarios de ingreso y egreso, importes (total,
seña y las 2 cuotas) y las condiciones del complejo.

Se le manda la fila de la reserva en el body y responde el HTML. Con
`?format=html` devuelve la página directamente en vez de envolverla en JSON.

```
POST /.netlify/functions/reservation-document
x-lc-secret: <LC_OWNER_SECRET>

{ "reservation": { ...la fila de la planilla... } }
```

El total sale de las tarifas cargadas (`precios_periodos`), cobrando noche por
noche igual que `reservar.html`. Si alguna noche no tiene tarifa, el documento
igual se genera pero con los importes a coordinar: vale más que salga sin
precios a que el huésped no reciba nada al confirmar.

### El mail automático

Al confirmar, el mail ya sale solo: lo manda el workflow `owner-approve` de n8n,
que antes enviaba un resumen de dos líneas y ahora manda este documento.

El armado no pasa por esta function. El nodo `Preparar Email (CONFIRMED)` genera
el HTML inline, con las tarifas que le pasa un nodo Data Table (`precios_periodos`)
intercalado después de `Update row in sheet`. Es a propósito: ese mail sale en el
momento en que se confirma una reserva y no puede quedar colgado de que Netlify
esté arriba. El nodo tiene try/catch — si el armado falla, sale un mail simple
antes que ninguno.

El costo de esa decisión es que el documento vive en dos lugares. **Si lo cambiás
acá, cambialo también en `n8n/owner-approve--preparar-email.js`**, que es copia
exacta del código del nodo y está en el repo para que quede versionado.

Esta function queda para el botón **Ver documento** del panel, que abre el mismo
documento de cualquier reserva confirmada para imprimirlo o reenviarlo a mano.
