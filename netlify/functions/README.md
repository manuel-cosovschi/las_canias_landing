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
| `N8N_GET_SEASON_GOALS_PATH` | `season-goals` (opcional, tiene default) |
| `N8N_SET_SEASON_GOAL_PATH` | `set-season-goal` (opcional, tiene default) |
| `N8N_OWNER_GET_PRICES_PATH` | `get-prices`, `public-prices` (tarifa base, ya sin uso) |
| `N8N_OWNER_SET_PRICES_PATH` | `set-prices` (ya sin uso) |
| `N8N_OWNER_LIST_PENDING_PATH` | `list-pending` |
| `N8N_OWNER_LIST_CONFIRMED_PATH` | `list-confirmed` |
| `N8N_OWNER_APPROVE_PATH` | `confirm-transfer` |
| `N8N_OWNER_CANCEL_PATH` | `cancel-reservation` |
| `N8N_OWNER_CANCEL_CONFIRMED_PATH` | `cancel-confirmed` |
| `N8N_OWNER_BLOCK_PATH` / `N8N_OWNER_UNBLOCK_PATH` | `owner-blocks`, `owner-unblocks` |
| `N8N_GET_PRICE_PERIODS_PATH` | `reservation-document` (opcional, tiene default) |
| `N8N_SET_PAYMENT_PATH` | `set-reservation-payment` (opcional, tiene default) |
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

## Los importes de una reserva

La planilla no guardaba nada de plata: el total, el anticipo y el saldo vivían
sólo en el Excel de los dueños. Por eso el documento de confirmación tenía que
recalcular el total con las tarifas en vez de leerlo.

Ahora la hoja `reservas` tiene cuatro columnas más, en **AA:AD** (las A:Z ya
estaban todas ocupadas): `importe`, `anticipo`, `facturado` y `cotizacion_usd`.

- `reservar.html` manda el importe ya calculado al crear la reserva, así queda
  guardado desde el arranque.
- `set-reservation-payment` los edita desde el panel. Sólo pisa los campos que
  vienen en el pedido, así se puede guardar el anticipo sin tocar el resto.
- El **saldo no se guarda**: sale de `importe - anticipo`. Guardarlo sería
  tener dos números que pueden quedar en desacuerdo.
- El documento de confirmación usa el importe guardado si existe, y si no cae
  al cálculo con tarifas de siempre.

## La tienda

Los dueños quieren vender reposeras y cosas de playa al lado del alquiler. El
catálogo lo cargan ellos desde el panel (sección **Tienda**) y vive en
**Netlify Blobs**, no en la planilla: la planilla lleva la ocupación y la plata
de los alquileres, y ya nos mordió una vez leyendo hasta la columna Z. Meterle
stock encima era pedirlo de nuevo.

Todo el trato con el almacenamiento pasa por `_tienda.js`. El catálogo entero
va en una sola clave (`catalogo`) como un JSON, y cada foto en `foto/<id>`.
Son decenas de productos, no miles: guardarlo junto evita quedarse a mitad de
camino con media lista escrita.

| Función | Quién entra | Qué hace |
| --- | --- | --- |
| `store-catalog` | público (con matices) | Devuelve el catálogo |
| `set-store-catalog` | sólo dueño | Reemplaza la lista completa |
| `upload-store-photo` | sólo dueño | Sube la foto de un producto |
| `store-photo` | público (con matices) | Sirve la foto de un producto |

### El "Próximamente" es de verdad

Mientras la tienda no esté publicada, `store-catalog` **no devuelve ni un
nombre** a quien pida sin `x-lc-secret`: contesta `{ publicada: false,
productos: [] }`. `store-photo` hace lo mismo — si no, las fotos serían la
rendija por donde se ve el catálogo que el cartel tapa.

Esto importa porque la primera versión tenía el catálogo en `src/data/tienda.js`
y ahí esconderlo era pintura: los nombres y precios viajaban igual en el
javascript de la página y se leían con el inspector.

Los dueños ven la vista previa desde la tienda misma, con el botón **Soy
dueño**: valida contra `auth-login` (las mismas credenciales del panel) y con
el secret que devuelve vuelve a pedir el catálogo, esta vez entero.

### La tienda es una página aparte

Vive en `public/tienda.html` y se sirve en **/tienda** (la URL linda sale de
una regla en `_redirects`, que va antes del comodín de la SPA o se la come).

Empezó siendo una sección de la home y estaba mal: una tienda es otra cosa que
un alquiler, el botón del menú era un ancla que no llevaba a ninguna página, y
el que entra a comprar una reposera tenía que pasar por las cinco casas antes.
Además el catálogo viajaba en el javascript de la landing, que lo carga todo
el mundo aunque no vaya a comprar nada.

Es HTML plano con Tailwind por CDN, como `reservar.html` y `terminos.html`: la
misma paleta y las mismas tipografías que el resto, sin React. Tiene portada,
filtros por categoría, ficha del producto y un pedido con cantidades que sale
en **un solo WhatsApp** con la lista y el total ya escritos — si el dueño tiene
que preguntar "¿cuál querías?", se pierde la mitad de los pedidos.

### Guardar reemplaza todo

`set-store-catalog` recibe la lista completa, igual que los precios y las
reglas: así el orden que ve el dueño en el panel es el que sale publicado, sin
inventar un campo de orden que después nadie mantiene.

- Un producto guardado nunca es lo que llegó del navegador: se arma campo por
  campo, así una clave de más en el pedido no termina en el almacenamiento.
- Los productos inválidos (sin nombre, id con mayúsculas, precio negativo, id
  repetido) se descartan, y la respuesta trae `guardados` y `recibidos` para
  que el panel avise. Mandar 10 y que entren 9 en silencio es cómo se pierde
  un producto sin enterarse.
- Los que salen de la lista se llevan su foto: `fotosBorradas` cuenta las que
  existían de verdad, no los productos sacados (`productosSacados`).
- `precio: null` (o vacío) es **"Consultar"**, que es un estado válido: hay
  cosas que se cotizan. Cero no es lo mismo.

### Las fotos

`upload-store-photo` recibe un `multipart/form-data` con `id` y `foto`. Acepta
JPG, PNG y WEBP hasta 3 MB — las fotos las mira todo el que entra a la tienda,
y una de 8 MB hace lenta la página en el celular, que es donde se mira. Busboy
corta el archivo al llegar al límite en vez de fallar, así que la function
escucha el evento `limit` y responde 413: sin eso guardaría una imagen truncada,
que es peor que no guardar nada.

Se suben al toque, sin esperar a **Guardar**: el panel las manda apenas se
elige el archivo, y la ficha muestra la miniatura. `tieneFoto` no se le cree al
navegador — `store-catalog` le pregunta al almacenamiento cuáles existen, para
que nadie pueda escribir una URL a mano ni quede un `<img>` roto.
