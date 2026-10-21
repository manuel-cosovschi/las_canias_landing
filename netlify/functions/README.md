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

### Mandar el secret no alcanza: n8n tiene que leerlo

`callN8n` pone `x-lc-secret` en **todos** los pedidos. Eso no significa que el
workflow del otro lado lo mire: el header puede llegar y nadie leerlo.

Es lo que pasaba con `create-reservation`. El nodo que validaba la solicitud
nunca tocaba los headers, así que **el webhook aceptaba cualquier POST de
cualquiera**, y cada POST aceptado crea un `HOLD_TRANSFER` que bloquea la casa
seis horas. Pesaba más que en los otros porque su path está hardcodeado en
`create-reservation.js` —`/webhook/f484ae09-…`— y este repo es público: la URL
no había que adivinarla.

Se auditaron de a uno los 18 paths que están hardcodeados en el repo, mandando
un POST sin secret con un payload que no puede modificar nada (un `id` que no
existe). **Era el único abierto**; todos los demás, lectura y escritura,
contestan `Unauthorized (secret inválido)`. Si se agrega un webhook nuevo,
vale repetir la prueba: que conteste 200 no dice nada sobre si validó.

| Webhook | Secret que espera |
|---|---|
| `create-reservation` | `N8N_SECRET` |
| el resto de los que escriben | `LC_OWNER_SECRET` |

El valor concreto vive hardcodeado en el nodo Code de cada workflow, no en una
variable: n8n Cloud no expone `$env` dentro de un Code node. Si se rota un
secret hay que cambiarlo **en cada workflow que lo valide más la env var de
Netlify**, y son varios.

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
| `N8N_CREATE_MANUAL_PATH` | `owner-blocks`, `create-manual-reservation` (opcional, tiene default) |
| `N8N_OWNER_UNBLOCK_PATH` | `owner-unblocks` (opcional, tiene default) |
| `N8N_GET_PRICE_PERIODS_PATH` | `reservation-document` (opcional, tiene default) |
| `N8N_SET_PAYMENT_PATH` | `set-reservation-payment` (opcional, tiene default) |
| `WA_VERIFY_TOKEN` / `N8N_WA_INCOMING_URL` | `wa-webhook` |
| `N8N_WA_CONVERSATIONS_PATH` | `wa-conversations` (opcional, tiene default) |
| `N8N_WA_ACTION_PATH` | `wa-panel-action` (opcional, tiene default) |
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

### Quién lee los períodos

Todo lo que dice un precio sale de `price-periods`, que es la misma tabla que
los dueños editan en el panel: `reservar.html`, el panel de admin, el documento
de reserva, y el bot de WhatsApp (nodo `Get Prices` del workflow en n8n).

Ese último es el que conviene tener presente: **vive en n8n, no en este repo**,
así que no aparece buscando acá. Durante un tiempo apuntó a `public-prices` y
nadie lo notó — este README decía que esa tarifa estaba "sin uso" mientras el
bot la seguía leyendo, y cotizaba los precios de agosto para una estadía de
enero. Si algún día cambia la forma de la respuesta de `price-periods`, hay que
tocar ese nodo también.

La tarifa base vieja (`get-prices` / `set-prices` / `public-prices`) ya no la
lee nadie: devuelve valores sueltos sin fechas, que es exactamente lo que causó
aquel error.

## Quién vence los holds (no es n8n)

Cuando alguien reserva por la web, la fila queda en `HOLD_TRANSFER` con un
`expires_at` 6 horas más tarde. Si no manda el comprobante, algo tiene que
cancelarla y liberar las fechas. **Ese algo es un Google Apps Script pegado a
la planilla, no n8n.**

Dejarlo escrito acá porque no hay forma de deducirlo: no está en este
repositorio, no está en n8n, y buscar "apps script" en el código no devuelve
nada. La única huella que deja es el texto `Auto-expired (Apps Script)` en la
columna `status_reason` de las reservas que venció, y el `reminder_1h_sent_at`
del aviso de 1 hora antes.

En n8n existen dos workflows que hacían ese trabajo, **`LC - Cron Expire
Holds`** y **`LC - Aviso 1h antes de vencer`**, y están apagados a propósito:
se apagaron el 28/01/2026 y el Apps Script empezó a vencer holds el 29/01.
Prenderlos haría que cada reserva se venza dos veces y que salgan dos avisos
por cada una.

Cómo saber si sigue funcionando: una reserva web que venció lleva
`status_reason = "Auto-expired (Apps Script)"` y `expired_at` cargado. Si
aparece una fila en `HOLD_TRANSFER` con `expires_at` pasado y sin cancelar, el
script dejó de correr — y conviene mirarlo rápido, porque `owner-list-pending`
filtra los holds vencidos y esa fila **no se ve en el panel** mientras sigue
bloqueando las fechas.

## Workflows de n8n que quedaron apagados

n8n acumuló prototipos y versiones viejas que seguían **activas**, con webhook
publicado, años después de haber sido reemplazadas. Un webhook activo que nadie
llama no es inofensivo: contesta.

Estos quedaron despublicados, todos con **cero ejecuciones** en el historial:

| Workflow | Por qué |
|---|---|
| `Reserva por transferencia` | El prototipo original del flujo, del 5 de enero — un día antes de `create-reservation`. Sin validar secret ni fechas ni solapamientos, escribiendo directo en la planilla con `status: PENDING_TRANSFER` (que no existe en la máquina de estados, así que **la fila no bloquea las fechas**), las fechas en `DD/MM/YYYY`, y cuatro campos con `=={{ }}` que Sheets habría tomado como fórmula |
| `owner-unblock` | Devolvía siempre `{"ok":true,"deleted_count":"=1"}` sin tocar nada. Lo reemplazó `owner-unblock-v2` |
| `owner-block` | Lo reemplazó `create-manual-reservation`, que es el que llama `owner-blocks.js`. Su env var `N8N_OWNER_BLOCK_PATH` no se usa en ningún archivo |
| `Admin Update Status` | Su única function apuntaba a un path que no estaba registrado, así que sólo podía dar 404. Lo reemplazó `set-reservation-status` |

Antes de apagar uno vale mirar dos cosas: que ninguna function del repo lo
llame (ojo con los paths hardcodeados como fallback de la env var) y que su
historial de ejecuciones esté vacío. Las dos juntas, porque una function puede
llamarlo por env var sin que el path aparezca en el código.

`Availability - Las Cañas` todavía normaliza fechas en `DD/MM/YYYY` además de
`YYYY-MM-DD`. Es la huella del prototipo de arriba: el único que escribía en
ese formato. Se deja porque es inofensivo y porque si quedó alguna fila vieja
así, sacarlo la volvería invisible.

## La web aceptaba reservas encima de un bloqueo

Hay tres lugares que deciden si una casa está ocupada, y durante meses no
dijeron lo mismo:

| Quién | Cuenta `BLOCKED` como ocupado |
|---|---|
| `Availability - Las Cañas` (lo que pinta el calendario) | sí, con un comentario que lo dice |
| `create-reservation`, primer chequeo | **no** |
| `create-reservation`, recheck antes de escribir | **no** |

`BLOCKED` son las fechas que los dueños sacan de la venta, y casi nunca es
mantenimiento: hoy 16 de los 18 bloqueos de la planilla dicen *"Alquiler"* o
*"alquilada"* en las notas. Son reservas que entraron por teléfono o WhatsApp.

Como el calendario sí las tapa, el agujero no se veía navegando: para caer en
él hacía falta que el bloqueo apareciera **después** de que el visitante cargó
la página. Que es exactamente el caso para el que existe el recheck — y el
recheck tenía la misma falta, así que no atajaba nada.

En criollo: los dueños bloqueaban una semana ya alquilada por teléfono, y la
web seguía aceptando una reserva encima. Nadie se enteraba hasta que dos
familias llegaban a la misma casa.

Ahora los dos chequeos cuentan `BLOCKED`. Las pruebas de
`n8n/create-reservation--validar.test.js` cubren los cuatro casos que importan:
que un bloqueo rechace, que uno en minúscula también, que uno de otra casa no
estorbe, y que uno que **arranca el día de salida** no estorbe tampoco — el
check-out de uno puede ser el check-in del otro.

Lo que no cambió, y conviene saberlo: entre leer la planilla y escribir la fila
hay una ventana en la que dos pedidos simultáneos pueden pasar los dos. El
recheck la hace chica, no la cierra. Con el volumen de hoy es teórico, pero no
es imposible, y Sheets no tiene forma de evitarlo del todo.

## Avisos del sistema (la campanita)

Hay cosas que la planilla no puede impedir y que nadie va a encontrar leyendo
150 renglones: dos filas con el mismo código, una casa ocupada dos veces, un
bloqueo sin motivo que dejó una semana de enero fuera de venta. El panel las
busca solo cada vez que alguien entra.

Seis chequeos, todos sobre las filas que el panel ya lee (`search-reservations`,
sin filtro de estado). No hay nada guardado del lado del servidor:

| Qué busca | Cuándo es urgente |
|---|---|
| La misma casa ocupada dos veces | si alguna de las dos todavía no pasó |
| Dos filas con el mismo código | siempre "revisar" |
| Bloqueo sin motivo, sin huésped y sin importe | si cae en temporada alta |
| Solicitudes vencidas que siguen abiertas | nunca, es para ordenar |
| Filas de prueba ocupando fechas | si todavía no pasaron |
| Check-out anterior al check-in | siempre |

El resultado va a la campanita del header, con el número en rojo. **Lo urgente
no espera a que alguien la toque: salta como pop-up apenas entran.** El resto
queda en el panel, cada aviso con qué hacer al respecto.

Cada aviso se puede marcar como visto. Eso vive en el `localStorage` del
navegador, no en el servidor: si entran desde otro teléfono, el aviso vuelve a
aparecer. Es a propósito — preferimos repetir un aviso a que se pierda.

Dos detalles de implementación que cuestan de encontrar:

- El panel vive **fuera** del `<header>`. Adentro no entra: anclado al botón se
  salía de la pantalla por la izquierda en el celular, y `position: fixed`
  tampoco funciona ahí, porque el header tiene `backdrop-blur` y un filtro hace
  que lo fijo se posicione contra el header en vez de contra la ventana.
- "Ver todos los avisos" abre el panel en el tick siguiente (`setTimeout`). El
  listener de "click afuera" corre en el mismo evento, y como ese botón está en
  el modal y no en el panel, lo cerraba apenas se abría.

## El botón "Confirmar" podía duplicar una reserva

`owner-approve` escribía `status: CONFIRMED` sin mirar nada: ni en qué estado
estaba la fila, ni si las fechas seguían libres. Y el panel muestra el botón
**también en los holds vencidos** — los pinta de rojo, pero el botón está.

El camino no era rebuscado, era el día normal de los dueños:

1. Entra una solicitud por la web. Queda `HOLD_TRANSFER`, seis horas.
2. El dueño abre el panel y va a mirar el banco.
3. Pasan las seis horas. El Apps Script la cancela, o alguien bloquea esas
   fechas porque cerró la misma semana por teléfono.
4. El dueño vuelve, ve la tarjeta roja y hace click en **Confirmar**.
5. Queda `CONFIRMED` encima de la otra ocupación. **Dos reservas para la misma
   casa y las mismas noches.**

Lo llamativo es que los dos workflows hermanos sí lo chequeaban desde el primer
día: `set-reservation-dates` y `create-manual-reservation` leen la planilla
entera y contestan 409 con *"Esas fechas se pisan con …"*. El único que no era
el que más se usa.

Ahora `owner-approve` hace lo mismo: lee la planilla completa antes de escribir
y rechaza con 409 si otra fila de la misma casa se pisa. Confirmar algo que ya
está confirmado sigue funcionando (el botón es idempotente), y una fila que no
existe sigue respondiendo "Reserva no encontrada" desde donde lo hacía antes.

En el panel, además, confirmar una solicitud vencida pide confirmación: mientras
el hold estuvo vencido esas fechas estuvieron a la venta.

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

### El webhook del comprobante tampoco validaba el secret

`submit-proof` manda `x-lc-secret` con `N8N_SECRET`, pero el workflow
`LC – Proof Upload (Send Email)` **no miraba los headers en ningún nodo**: su
primer nodo pedía un `id` y un archivo, y con eso seguía de largo.

Lo que habilitaba no era leer datos — los mails salen para los dueños y para
el huésped, no para quien pegó. Era **mandar**: cualquiera que conociera la URL
podía hacer que a los tres dueños les llegara un adjunto presentado como el
comprobante de una reserva real, con los datos de la fila de la planilla en el
cuerpo del mail para que se viera legítimo, y que al huésped le llegara un
*"recibimos tu comprobante"* desde el Gmail del complejo. Un comprobante falso
que entra por ese camino es indistinguible de uno real hasta que alguien mira
la cuenta bancaria.

La validación va al principio de `validar input + armar binary`, **antes** de
leer la planilla y antes de los dos nodos de Gmail, así un pedido sin secret no
dispara nada. Un pedido rechazado sale por el nodo `ERROR`, que es el camino
que ya existía para los pedidos mal formados.

A diferencia del de `create-reservation`, este path **no** está hardcodeado en
el repo: vive sólo en `N8N_PROOF_WEBHOOK_PATH`. Había que conocer la URL. Eso
lo hacía menos urgente, no menos roto.

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

### El servidor lee las mismas reglas que la página

`reservar.html` respeta estas reglas, pero la página es sólo la vitrina: quien
decide es el webhook `create-reservation`. Y ahí las reglas estaban
**hardcodeadas** en el nodo Code — una lista de findes fijos escrita a mano,
un mínimo de noches fijo y ningún tope de ventana.

Hoy coincidían de casualidad. El problema era de fecha de vencimiento: los
findes fijos cargados en n8n llegan hasta diciembre de 2026, así que **el día
que los dueños carguen los de enero y febrero de 2027 desde el panel, la página
los iba a respetar y el servidor no**. Y el tope de la ventana no existía del
lado del servidor en absoluto: `config_calendario` dice hasta 2027-03-31 y n8n
aceptaba 2030.

Ahora el workflow tiene un nodo HTTP (*Leer reglas del calendario*) que pide
`/api/calendar-config` —**la misma respuesta que lee `reservar.html`**, no la
data table cruda— y el nodo Code valida contra eso. Se lee la respuesta ya
traducida a propósito: si cada lado interpretara la tabla por su cuenta
volveríamos a tener dos reglas que se pueden separar.

La normalización es la misma que `normalizeCalendarConfig` en `reservar.html`,
incluido que **una regla ilegible invalida toda la config**.

Si el endpoint no responde, el nodo Code usa las reglas de respaldo (las que
estaban hardcodeadas) y lo avisa por consola. No corta la reserva: la página
tampoco carga sin esa misma config, así que un pedido legítimo no llega hasta
ahí con el endpoint caído, y cortar dejaría la web sin reservas por una falla
de red.

La copia versionada del nodo está en **`n8n/create-reservation--validar.js`**.
Si cambiás una, cambiá la otra.

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

- `reservar.html` manda el importe al crear la reserva y `create-reservation` lo
  recalcula con las tarifas del panel antes de pasarlo a n8n, así el número que
  se guarda no es el que eligió el navegador.
- `set-reservation-payment` los edita desde el panel. Sólo pisa los campos que
  vienen en el pedido, así se puede guardar el anticipo sin tocar el resto.

### El importe se perdía al guardar

Durante meses este archivo decía que el importe "queda guardado desde el
arranque". No era cierto, y no se podía ver desde el repo: el nodo **Append row
in sheet** del workflow `create-reservation` de n8n mapea las columnas una por
una, y tenía diecinueve — ninguna era `importe`. El número llegaba a n8n y se
descartaba al escribir la fila.

Cómo se confirmó, por si vuelve a pasar: en la hoja `reservas`, las **27 filas
con `source = web` tenían la columna AA vacía**, y sólo las de `source = excel`
—cargadas por el import del Excel, que escribe la fila completa— tenían monto.
Esa asimetría es la huella del problema.

El arreglo está en n8n, no acá: el nodo ahora mapea también `importe`, tomándolo
de `{{ $items("Webhook")[0].json.body.importe }}`, que es el valor que
`create-reservation` ya recalculó del lado del servidor.

**Si se agrega otra columna de plata a la planilla, agregarla también a ese
nodo.** Un mapeo incompleto no falla: escribe la fila sin esa columna y
devuelve `ok`. Es el mismo error de forma que el `A:Z` de `_sheet.js`.
- El **saldo no se guarda**: sale de `importe - anticipo`. Guardarlo sería
  tener dos números que pueden quedar en desacuerdo.
- El documento de confirmación usa el importe guardado si existe, y si no cae
  al cálculo con tarifas de siempre.

### `Number("300.000")` es 300

El destrozo más caro del panel y el más difícil de ver. Las tres funciones que
reciben plata —`set-reservation-payment`, `create-manual-reservation`,
`owner-blocks`— leían el monto así:

```js
Number(String(v).replace(/[^\d.-]/g, ""))
```

En castellano el punto separa miles, y eso hace dos cosas distintas según
cuántos puntos tenga el número:

| lo que escribe el dueño | lo que se guardaba |
|---|---|
| `300.000` | **300** — trescientos pesos |
| `1.333.000` | **NaN** → "importe inválido", sin decir por qué |

El primero es el peor: no falla, no avisa, y deja un precio mil veces más chico
en la planilla. El segundo era el que lo hacía visible — el dueño escribía
`1.333.000`, el panel lo rechazaba, y nadie entendía qué tenía de malo el
número.

Ahora las tres usan `_plata.js`, que tiene una sola regla: **el separador
decimal es el último** (`1.333.000,50` y `1,333,000.50` son el mismo número), y
un punto es de miles salvo que el número no tenga forma de miles — `1.5` es uno
y medio, `1.500` es mil quinientos. El test vive en `netlify/tests/plata.test.js` —y no al lado, porque Netlify
publica como función cada archivo de `netlify/functions` y un nombre con
punto no es válido: el deploy entero falla— y cubre las formas en que los
dueños escriben la plata. Se corre con `node netlify/tests/plata.test.js`.

El panel tiene el mismo parser en `parsearMonto`, y además:

- Los campos de plata son `type="text"`, no `type="number"`. Un campo numérico
  **no admite el punto**: escrito `1.333.000` el navegador devuelve `""`, así
  que el importe se perdía entero al guardar en vez de llegar mal.
- Se escriben con el signo `$` adentro, a la izquierda, y el punto de miles
  aparece solo mientras se tipea (`formatearMientrasEscribe`). El signo es un
  adorno con `pointer-events: none`: no entra en el valor ni se puede borrar.
- Al servidor viaja el número pelado (`montoParaGuardar`), nunca el texto con
  puntos. El parser del servidor es la red de seguridad, no el camino normal.

**Si se agrega un campo donde se escriba plata, pasarlo por
`activarCampoDePlata` y leerlo con `montoDe` o `montoParaGuardar`.** Un
`Number(input.value)` suelto vuelve a traer el problema entero.

## El calendario daba más que Números

Los dueños sumaron diciembre del 26 en el calendario, lo compararon con la
barra **dic 26** de Números y les faltaba plata. No es un error de suma: eran
dos formas distintas de contar, y las dos estaban escritas en el código.

**1. La barra del mes repartía cada estadía noche por noche.** Una del 27 de
diciembre al 3 de enero son 7 noches, 5 en diciembre: la barra de diciembre
mostraba 5/7 del importe y el resto se iba a enero. Más exacto, sí, y
completamente inútil para cerrar contra un calendario, donde esa reserva es una
sola cosa que pasa en diciembre.

Ahora **cada reserva cuenta entera en el mes en que entra**. La suma de los doce
meses sigue dando el total de la temporada, y además deja de perderse plata en
el borde: una estadía que entra el 28 de noviembre pertenece a la temporada
anterior, así que sus noches de diciembre no se dibujaban en ninguno de los dos
gráficos.

**El Excel que se baja sigue partiendo las estadías por mes**, en dos filas, que
es como los dueños llevaban la planilla y lo que el conversor deshace al
importar. Son dos cuentas distintas a propósito: el gráfico del panel se lee
contra el calendario, el Excel contra la facturación del mes.

Esto no era sólo confuso: hizo perder plata. La reserva de Las Cañas 1 del 27/12
al 3/1 valía **$1.380.000**, y en la planilla quedó en **$985.715** — que es
exactamente 5/7 de 1.380.000, la parte que la barra mostraba en diciembre.
Alguien tomó el número de la barra y lo escribió como importe de la reserva.
**Si un número de Números no se puede explicar mirando el calendario, el que
está mal es Números.**

**2. Las noches bloqueadas sin importe ocupan el calendario y no suman un
peso.** Un bloqueo con plata cargada cuenta como cualquier reserva; uno sin
plata son fechas fuera de venta y no entra en ningún total. Esa diferencia
existía y sólo se veía en un recuadro al pie.

Ahora está en la tabla, casa por casa, en la columna **S/cargar**:

```
Casa          Noches   S/cargar   ...
Las Cañas 1      7        7       ← 14 noches ocupadas en el calendario,
                                     la mitad sin importe cargado
```

`Noches + S/cargar` es exactamente lo que se ve ocupado en el calendario. Si las
dos cuentas no cierran, la columna dice dónde está la diferencia.

De paso se fue la columna **Est.** (cantidad de estadías), que no se usaba para
decidir nada y empujaba las nueve columnas fuera del ancho del panel.

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

### Son `.mjs` y formato v2, y tiene que ser así

Las otras 31 funciones son formato v1 (`exports.handler`). Estas cuatro son
v2 (`export default`, entra un `Request` y sale una `Response`) porque
**Netlify le inyecta `NETLIFY_BLOBS_CONTEXT` sólo a las v2**. En v1,
`getStore()` tira `MissingBlobsEnvironmentError` y no hay tienda.

No es una suposición: se midió en un deploy real, con la misma llamada a
Blobs en los dos formatos, al mismo sitio y al mismo store.

```
v2 -> { "tieneContexto": true,  "blobs": "ok" }
v1 -> { "motivo": "MissingBlobsEnvironmentError" }
```

**Le pasaba lo mismo a los comprobantes**, que usan el mismo mecanismo desde
`submit-proof`. Ahí el error se traga a propósito —perder la copia no puede
cortarle la reserva a nadie— así que venía fallando en silencio desde el
primer día: el panel mostraba "sin comprobante" para todas las reservas. Ya
están migrados: `_proofs.mjs`, `submit-proof.mjs` y `proof-file.mjs`.

La plomería que comparten las funciones v2 —leer el secret de un `Request`,
armar una `Response`— vive en `_v2.mjs`. Ahí **no** va el Basic del panel:
sale de `verifyAdminAuth` en `_sheet.js`, que carga `googleapis` al
importarse, y metido en `_v2.mjs` se lo llevaría puesto el bundle de
`store-catalog`, que es público, caliente y no toca Sheets. Lo importa
`proof-file`, que es el único que lo necesita.

De paso, v2 simplifica dos cosas: la foto sale como bytes en la `Response`
(en v1 había que pasarla a base64 y avisar con una bandera), y el multipart
lo lee `req.formData()` en vez de Busboy, que corta el archivo al llegar al
límite en vez de fallar y obligaba a escuchar el evento `limit` para no
guardar una imagen truncada.

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

## El calendario del panel

### Cada casa, siempre el mismo renglón

Las Cañas 1 va arriba de todo y Las Cañas 5 abajo, **todos los días**. Sin esto,
FullCalendar amontona los eventos hacia arriba: en un día con una sola reserva,
esa reserva ocupa el primer renglón sea de la casa que sea, así que Las Cañas 5
caía en el renglón 2 un día y en el 1 al día siguiente, dentro de la misma
semana. Buscar una casa en la grilla se volvía imposible.

Son dos piezas, y hacen falta las dos:

1. **`eventOrder: "orden"`** ordena los eventos de cada día por número de casa.
   Por sí solo no alcanza: respeta el orden, pero si una casa no tiene nada ese
   día, las de abajo suben igual.
2. **Huecos invisibles** (`calcularHuecos`): un evento vacío por cada casa y día
   sin reserva, que ocupa el alto de un chip y le guarda el renglón. Van con
   `visibility: hidden` y no `display: none`, justamente porque tienen que
   seguir ocupando el lugar.

Para no estirar el calendario al pedo, **por semana se reservan renglones sólo
hasta la casa más alta que tenga algo esa semana**: una semana con sólo Las
Cañas 1 mide un renglón, y una semana sin nada no mide ninguno. El número de
renglón sigue siendo el de la casa, así que no se mueve de una semana a otra; lo
único que no se dibuja son los renglones vacíos del final.

Dos cosas para no romperlo:

- Los huecos se recalculan en `datesSet`, que es cuando cambia el mes a la
  vista, y usan **`info.startStr`, no `info.start`**: `info.start` es un `Date`
  local a las 00:00 y pasarlo por `toISOString()` en Argentina devuelve el día
  anterior. Mismo error de siempre.
- `eventClick` corta si el evento es un hueco: no es una reserva y no tiene
  detalle que mostrar.

### Confirmada y bloqueada se dibujan igual

El calendario muestra **dos estados, no tres**. Una reserva confirmada y un
bloqueo salen idénticos —mismo color, mismo chip, mismo texto— porque para los
dueños son el mismo hecho: *esa casa no se alquila esos días*. Lo pidieron así.

El único estado que se separa es el **hold**, que va con el rayado, porque
todavía se puede caer y eso sí cambia lo que hay que hacer.

La diferencia real no se pierde: al tocar el evento, el detalle dice si es una
reserva o un bloqueo, y de eso dependen las acciones (desbloquear sólo saca
`BLOCKED`). Lo que se sacó es la distinción **visual en la grilla**, no el dato.

El texto del chip sale de `list-calendar`: `CONFIRMED` y `BLOCKED` devuelven sólo
el nombre de la casa, y `HOLD_TRANSFER` le agrega `· Hold`. De paso el nombre
entra entero en el celular: antes se leía `Las Cañas 1 · Blo…`.

### El color es la casa, nunca el estado

Cada casa tiene su color (`HOUSE_COLORS` en `admin.html`) y **ese color no
cambia según el estado**. Una reserva confirmada de Las Cañas 2 y un bloqueo de
Las Cañas 2 son el mismo azul.

Es fácil romperlo sin darse cuenta, porque el estado también se dibuja encima.
Ya pasó dos veces:

- el bloqueo llevaba `opacity: .72`, así que salía despintado y parecía otra casa
- el hold llevaba un rayado blanco al 45% cubriendo casi medio chip, y el azul de
  Las Cañas 2 se leía celeste

**La regla: el estado puede agregar borde o textura, nunca teñir el fondo.** Hoy
el hold va con un rayado fino y translúcido y el bloqueo con borde cortado; los
dos conservan el color exacto de la casa. Si se toca esto, conviene medirlo —
abrir los tres estados de una casa y comparar el `background-color` computado,
que tiene que ser idéntico y con `opacity: 1`.

El chip además dice el estado en palabras ("Las Cañas 2 · Bloqueada"), así que la
información no depende sólo de lo visual.

### Las fechas se muestran día/mes/año

El detalle de una ocupación mostraba el ISO crudo de la planilla
(`2026-11-20 → 2026-11-23`), que arranca por el año y se lee como de otro país.
`fmtYmdAR` lo reordena a `20/11/2026`, igual que los calendarios de bloqueo, que
ya usaban `d/m/Y`.

**Reordena el texto, no usa `new Date`.** `"2026-11-20"` es una fecha sin hora y
`Date` la lee como medianoche UTC: en Argentina (UTC-3) eso cae a las 21:00 del
19, y formatearla con la zona local restaría un día. Es exactamente el error que
ya había mordido en `toMinusOneDayISO`.

Quedaban sueltas las de **Números** (la lista de quién debe, el recuadro de
bloqueos), las de pendientes y confirmadas, el modal de importes y los avisos
del calendario. Todas pasan ahora por `fmtDates`, que es `fmtYmdAR` de los dos
lados con la flecha en el medio. **Si se muestra una fecha nueva, va por ahí:**
el ISO crudo en pantalla es un error, no un estilo.

### Bloquear y desbloquear no habilitan las mismas fechas

Son operaciones inversas, así que los calendarios también lo son:

| Modo | Qué se puede elegir |
|---|---|
| **Bloquear** | sólo fechas **libres** — lo ocupado va apagado (`disable`) |
| **Desbloquear** | sólo fechas **bloqueadas** — todo lo demás va apagado (`enable`) |

Antes los dos modos compartían el mismo set, el de las fechas ocupadas. Al
bloquear estaba bien; al desbloquear quedaban apagadas **justo las fechas que
había que elegir**, que son las que están bloqueadas.

Los rangos del desbloqueo salen de `list-calendar` y no de `availability`, porque
hace falta el **estado**: `availability` devuelve todo lo ocupado junto, sin
distinguir un bloqueo manual de una reserva confirmada. Desbloquear sólo saca
`BLOCKED`, así que ofrecer una confirmada sería un botón que no hace nada — o que
se lleva una reserva con huésped e importe.

Dos detalles:

- El check-out de un bloqueo es **el día siguiente a su última noche**: uno del 20
  al 23 ocupa las noches 20, 21 y 22, y para sacarlo hay que poder elegir salida
  el 23. Por eso el calendario de salida habilita un rango corrido un día.
- Si no se pueden leer los bloqueos, **no se habilita ninguna fecha** y se dice en
  pantalla. Desbloquear a ciegas borra la fila entera; no dejar elegir es mejor
  que dejar elegir cualquier cosa.

### Un `"2026-10-16"` suelto no le dice nada a flatpickr

Lo de arriba estuvo escrito y sin funcionar durante un día entero: los rangos se
armaban bien y el calendario seguía dejando elegir fechas alquiladas.

flatpickr parsea los strings que van en `disable` y `enable` **con el
`dateFormat` que tiene configurado**, y acá es `"d/m/Y"` porque es el formato en
el que escriben los dueños. Con ese formato `"2026-10-16"` no se entiende, y
flatpickr no avisa: descarta el rango en silencio.

| Qué se le pasa | Qué apaga |
|---|---|
| `dateFormat: "d/m/Y"` + `{from:"2026-10-16", to:"2026-10-19"}` | **nada** |
| `dateFormat: "d/m/Y"` + `{from:"16/10/2026", to:"19/10/2026"}` | 16, 17, 18, 19 |
| `dateFormat: "d/m/Y"` + objetos `Date` | 16, 17, 18, 19 |
| `dateFormat: "Y-m-d"` + `{from:"2026-10-16", …}` | 16, 17, 18, 19 |

En `disable` el efecto era dejar elegible una fecha ocupada. En `enable` es peor:
como significa "sólo estas fechas", no entender ninguna deja el calendario
entero muerto.

La conversión a `Date` vive dentro de `initPickers`, que es el único punto por el
que los rangos entran a flatpickr y por lo tanto el único lugar donde no se
puede olvidar. Y los `Date` se construyen con el constructor **local**, no con
`Date.UTC`: la medianoche UTC en Argentina cae a las 21:00 del día anterior, que
es el mismo error de un día que ya mordió dos veces en este calendario.

El calendario se rearma al elegir el modo y después de cada bloqueo o desbloqueo,
así que no queda con una lista vieja. El solape además lo rechaza el servidor
(`create-manual-reservation` cuenta `CONFIRMED`, `HOLD_TRANSFER` y `BLOCKED` como
ocupación), o sea que el picker es la red de adelante y n8n la de atrás.

## Cargar los datos de una ocupación ya creada

`set-reservation-guest` escribe nombre, teléfono, mail, DNI y notas sobre una
fila que ya existe.

Existía un agujero: `set-reservation-status` sólo cambia el estado y
`set-reservation-payment` sólo toca la plata, así que **no había forma de
escribirle el nombre a una fila ya creada**. Se veía en los bloqueos: si el
dueño bloqueaba unas fechas apurado, sin cargar quién era, esa fila se quedaba
sin datos para siempre. Y el modal del calendario encima escondía los datos que
un bloqueo sí tenía — cortaba en `BLOCKED` y mostraba `-` en todo, aunque
`owner-blocks` ya guarde nombre, teléfono, DNI e importes al crear.

Es el hermano de `set-reservation-payment` y sigue el mismo camino en n8n:
valida el secret, busca la fila por id, **fusiona sólo los campos que llegaron**
sobre lo que ya estaba guardado, y recién ahí escribe. Esa fusión es lo que
permite guardar un teléfono sin borrar el nombre.

Del lado del panel, el botón **Cargar datos** del calendario llama a los dos
endpoints —este para los datos, `set-reservation-payment` para la plata— y si
uno falla dice cuál: "no se pudo guardar" a secas deja al dueño sin saber si el
nombre entró y el importe no.

### Un campo vacío ahora borra

Durante un tiempo la regla fue al revés: un campo vacío no se tocaba y había que
escribir un guión para borrar. Nadie la leyó nunca, y no es raro — el formulario
se abre con todos los datos a la vista, así que borrar uno de la pantalla
significa borrarlo, no "dejalo como estaba".

Lo que hacía era peor que confuso. El dueño vaciaba **Cobrado** para sacar una
seña, bajaba el importe, y el panel le contestaba *"lo cobrado no puede ser mayor
que el importe total"* con el campo de cobrado vacío delante: comparaba el
importe nuevo contra la seña vieja de la planilla, la que el blanco decía no
tocar. No había forma de entenderlo ni de salir.

Ahora el formulario manda **lo que cambió**: `cambioDeTexto` y `cambioDeMonto`
comparan cada campo contra el valor con el que se abrió. Sin cambios no viaja
nada; vacío viaja como `""`, que es borrar. El guión se sigue aceptando por si
alguien lo escribe de memoria, acá y en las funciones.

Y el aviso de "lo cobrado no puede ser mayor" se calcula con lo que se ve en
pantalla, no con lo guardado: si el mensaje contradice los dos números que el
dueño tiene delante, el mensaje está mal.

### El modal tiene que poder scrollear

Con el formulario abierto, el modal del calendario mide más que la ventana de un
portátil. Estaba centrado con `flex` y sin scroll, y eso corta **arriba y
abajo**: no se llegaba al botón de guardar ni a la ✕ para cerrarlo, y la rueda
del mouse movía la página de atrás.

La clase `.lc-modal` lo arregla para todos los modales a la vez: la caja de
adentro se centra con `margin: auto` en vez de `align-items`, y lleva
`max-height: calc(100dvh - 2rem)` con `overflow-y: auto`. Centrado con margen
automático se centra si entra y scrollea si no; centrado con `flex`, lo que
sobresale queda fuera de alcance. `100dvh` y no `100vh` por las barras del
navegador en el celular.

Variable de entorno opcional: `N8N_SET_GUEST_PATH` (por defecto
`/webhook/set-reservation-guest`).

## Las conversaciones de Cañita (sección *Conversaciones*)

`wa-conversations` alimenta la sección **Conversaciones** del panel: quién le
escribió al WhatsApp, qué consultó y la charla completa.

El texto de los mensajes **no se guardaba en ninguna parte**. `wa_memory` sólo
lleva el último estado de cada contacto (tema, personas, fechas, casa), y los
mensajes vivían nada más que en los logs de ejecución de n8n, que se purgan. Por
eso el bot ahora escribe cada intercambio en la data table
**`wa_conversaciones`** (`wa_id`, `nombre`, `entrante`, `saliente`, `intent`),
una fila por turno.

Ese registro cuelga **después** de los nodos de envío del workflow
`WhatsApp Bot – Las Cañas`, no antes: así no le agrega ni un milisegundo a lo que
espera el huésped. Y va con `onError: continueRegularOutput`, porque perder una
fila del historial no puede cortarle la atención a nadie.

La consecuencia a tener presente: **las transcripciones arrancan el día que esto
se desplegó**. Las consultas anteriores siguen apareciendo en la lista —salen de
`wa_memory`— pero con `mensajes: 0` y sin charla. El panel lo aclara en pantalla
en vez de mostrar una ficha vacía sin explicación.

El endpoint cruza las dos tablas y devuelve los contactos ordenados por última
actividad:

```
GET /.netlify/functions/wa-conversations
x-lc-secret: <LC_OWNER_SECRET>

{ "ok": true, "total": 230, "contactos": [
  { "wa_id": "549…", "nombre": "…", "last_topic": "availability",
    "personas": 4, "fechas": ["2026-11-20","2026-11-23"], "casa": "LC3",
    "ultima": "2026-09-25T19:30:51.993Z", "mensajes": 2,
    "conversacion": [ { "entrante": "…", "saliente": "…", "intent": "faq", "ts": "…" } ] }
] }
```

En el panel el texto de cada mensaje se pinta con `textContent`, nunca con
`innerHTML`: lo escriben los huéspedes y un mensaje con HTML adentro no puede
terminar ejecutándose en la pantalla del dueño.

### Cuando el bot se rompe, n8n no se entera

Esta es la trampa más cara de todo el sistema, así que vale escribirla entera.

El nodo `ChatGPT Brain` tiene `onError: continueErrorOutput`: si la llamada a
OpenAI falla, el bot **no** explota — contesta un texto de disculpa, deriva a
una persona, y registra la fila con `intent: "error"`. Para n8n eso es una
ejecución **exitosa**.

El 8 de octubre de 2026 la consola de n8n mostraba **2736 ejecuciones y cero
errores**. El bot estaba roto hacía ocho días: la cuenta de OpenAI había sido
dada de baja y la API key devolvía `account_deactivated`. **18 clientes reales**
se quedaron sin respuesta, varios pidiendo quincenas de enero.

Y lo que lo hizo invisible: **"Hola" nunca dejó de funcionar.** Los saludos los
contesta el nodo `Fast Rules`, que no toca OpenAI. Cualquiera que probara el bot
de la forma obvia lo veía sano.

> **Para probar si el bot anda, nunca uses un saludo.** Mandale algo que lo
> obligue a pensar: *"Tenés disponibilidad del 20 al 23 de noviembre para 4
> personas?"*. Si contesta con casas y precios, el cerebro está vivo.

El workflow **`LC - Aviso: el bot está contestando con error`** existe para que
no vuelva a pasar en silencio. Cada hora cuenta las filas con `intent: error` de
`wa_conversaciones` y manda un mail si:

- hay **3 o más en la última hora** (una ráfaga: avisa al toque), o
- en el chequeo de las **9 de la mañana** hay 3 o más en las últimas 24 horas

El mail trae el runbook de qué revisar —empezando por la credencial de OpenAI— y
**la lista de las consultas que se quedaron sin responder, con nombre y
teléfono**, porque esas conversaciones casi siempre se recuperan si se contestan
a tiempo.

Dos detalles de implementación que importan:

- El texto de los clientes va **escapado** en el mail. Es texto que escribió un
  desconocido y termina en la casilla del dueño: un mensaje con `<` que sólo
  rompe el formato del mail sería el caso bueno.
- La credencial de OpenAI la comparten `ChatGPT Brain` y `Transcribir Audio`, así
  que **la misma caída se lleva los audios**. El mail lo recuerda.

La copia versionada del nodo está en **`n8n/wa-aviso-bot-error.js`**, con sus
pruebas al lado (`node n8n/wa-aviso-bot-error.test.js`).

### Atender una conversación a mano

`wa-panel-action` es lo que el panel usa para intervenir en una charla. Recibe
`{ accion, wa_id, texto }` y acepta tres acciones:

| Acción | Qué hace |
| --- | --- |
| `pausar` | Cañita deja de responderle a ese contacto |
| `reanudar` | Cañita vuelve a atenderlo |
| `responder` | Manda un mensaje como Las Cañas y lo guarda en la charla |

**El interruptor es lo primero, no un adorno.** Sin él, el dueño contesta a mano
y el bot le sigue respondiendo por encima a la misma persona: se pisan los dos en
el mismo chat. Por eso el botón pregunta "¿estás seguro?" antes de cortar a
Cañita, y avisa que si nadie atiende, esa persona se queda sin respuesta.

La pausa vive en la data table **`wa_pausados`**, que es un registro
*append-only*: cada pausa o reanudación agrega una fila y **gana la más
reciente**. Queda el historial de cuándo se tomó y cuándo se devolvió cada
conversación, y el endpoint sólo necesita insertar. El bot lo consulta apenas
entra un mensaje, antes de cualquier otra cosa, así lo respetan por igual los
mensajes de texto y los audios.

Ese chequeo va con `onError: continueRegularOutput` **a propósito**: si la
lectura de la tabla falla, el bot sigue contestando en vez de quedarse mudo.
Falla hacia el lado seguro.

#### La ventana de 24 horas

WhatsApp sólo permite texto libre dentro de las **24 hs** del último mensaje del
huésped; pasado eso Meta exige plantillas aprobadas. El panel lo resuelve así:

- **Dentro de la ventana** → cuadro de respuesta normal.
- **Fuera** → un aviso y un mensaje **ya escrito y editable**, con un botón que
  abre WhatsApp con ese texto cargado para mandarlo desde el teléfono del dueño.

Para saber si la ventana sigue abierta se usa `ultimo_entrante`, no la última
actividad: una respuesta manual del dueño actualizaría la actividad y haría
parecer que la ventana está abierta cuando ya venció.

Si Meta igual rechaza el envío, n8n contesta 400 con el motivo y el panel lo
muestra, en vez de un 500 opaco.
