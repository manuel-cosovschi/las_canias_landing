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
| `N8N_OWNER_GET_PRICES_PATH` | `get-prices`, `public-prices` |
| `N8N_OWNER_SET_PRICES_PATH` | `set-prices` |
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

## Estados de una reserva

Los que escribe la planilla, en orden habitual de vida:

`HOLD_TRANSFER` → `PROOF_SENT` → `CONFIRMED`

y los finales `CANCELLED` y `EXPIRED`. `reservation-status` sólo devuelve estos
valores (lista blanca) más `expires_at`; nunca datos del huésped, porque el
huésped consulta ese endpoint desde el navegador sin ninguna clave.
