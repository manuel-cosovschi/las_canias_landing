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
| `N8N_OWNER_GET_PRICES_PATH` | `get-prices`, `public-prices` (tarifa base, ya sin uso) |
| `N8N_OWNER_SET_PRICES_PATH` | `set-prices` (ya sin uso) |
| `N8N_OWNER_LIST_PENDING_PATH` | `list-pending` |
| `N8N_OWNER_LIST_CONFIRMED_PATH` | `list-confirmed` |
| `N8N_OWNER_APPROVE_PATH` | `confirm-transfer` |
| `N8N_OWNER_CANCEL_PATH` | `cancel-reservation` |
| `N8N_OWNER_CANCEL_CONFIRMED_PATH` | `cancel-confirmed` |
| `N8N_OWNER_BLOCK_PATH` / `N8N_OWNER_UNBLOCK_PATH` | `owner-blocks`, `owner-unblocks` |
| `N8N_ADMIN_UPDATE_RESERVATION_PATH` | `admin-update-reservation` (opcional) |
| `WA_VERIFY_TOKEN` / `N8N_WA_INCOMING_URL` | `wa-webhook` |

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
