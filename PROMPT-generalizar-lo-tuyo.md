# Lo que tenés que hacer vos

El chat nuevo puede tocar el código, pero hay cosas que sólo podés hacer vos
porque necesitan tus cuentas. Esto es lo que queda de tu lado.

## Antes de arrancar el chat

**1. Sacá una copia del repo.**
No arranques sobre `las_canias_landing`, que es el que está en producción y le
da de comer al complejo. Creá un repo nuevo (por ejemplo `complejo-plantilla`)
a partir de este. En GitHub: *Use this template* si lo marcás como plantilla, o
simplemente un fork.

**2. Decidile al chat dónde están los tests.**
La batería de pruebas de navegador vivía fuera del repo y se perdió cuando
terminó la sesión. O le pedís que escriba nuevos, o asumís que no hay red de
seguridad — y ahí conviene ir más despacio y mirar cada paso en el navegador.

## Por cada complejo nuevo que vendas

### La planilla de Google
1. Duplicá la planilla `Las Cañas - Reservas` (dejá las columnas como están,
   incluidas las de plata en AA:AD).
2. Borrá todas las filas de datos, quedate sólo con los encabezados.
3. Compartila con la **service account** de Google, con permiso de editor. El
   mail de la service account está adentro de la variable
   `GOOGLE_SERVICE_ACCOUNT_JSON` de Netlify, en el campo `client_email`.
4. Anotá el id de la planilla: es lo que está en la URL entre `/d/` y `/edit`.

### n8n
5. Duplicá los 7 workflows. En cada uno, cambiá el id de la planilla por el
   nuevo. Si el chat hizo bien el paso 4 del prompt, va a ser **un** valor por
   workflow en vez de andar buscando nodo por nodo.
6. Publicá los workflows duplicados y anotá las URLs de los webhooks.
7. Revisá los mails: el texto que le llega al huésped tiene que decir el nombre
   del complejo nuevo, no "Las Cañas".

### Netlify
8. Creá un sitio nuevo apuntando al repo del cliente.
9. Cargá las variables de entorno. Estas son las que el sistema pide hoy:

   | Variable | Qué es |
   |---|---|
   | `ADMIN_USER`, `ADMIN_PASS` | usuario y clave del panel de dueños |
   | `LC_OWNER_SECRET` | segunda llave, la que va en `x-lc-secret`. Inventá una larga y distinta por cliente |
   | `LC_SHEET_ID` | el id de la planilla del paso 4 |
   | `LC_SHEET_TAB` | el nombre de la pestaña (hoy `reservas`) |
   | `GOOGLE_SERVICE_ACCOUNT_JSON` | el JSON de la service account, entero |
   | `N8N_BASE_URL` | la URL de tu n8n |
   | `N8N_SECRET` | la clave con la que Netlify le habla a n8n |
   | `N8N_PROOF_WEBHOOK_PATH` | la ruta del webhook de comprobantes |
   | `N8N_ADMIN_UPDATE_RESERVATION_PATH`, `N8N_CREATE_MANUAL_PATH`, `N8N_SET_PAYMENT_PATH` | las rutas de los otros webhooks |

10. Conectá el dominio del cliente.

### El contenido del complejo
11. Juntá y mandale al chat: nombre, localidad, dirección, coordenadas, número
    de WhatsApp, Instagram, logo, y por cada casa/unidad su nombre, capacidad
    máxima y una frase de ocupación ideal.
12. Las fotos: una carpeta por unidad. Que sean livianas — hoy hay `.MOV` y
    `.MP4` de varios megas en `public/`, y eso hace lenta la home en el celular.

## Dos cosas que te conviene decidir antes, no después

**El límite de la planilla de Google.** Para un complejo funciona. Para diez
clientes son diez planillas que hay que compartir a mano, y cualquier cambio de
columnas rompe en silencio — ya nos pasó una vez: el código leía hasta la
columna Z y las cuatro columnas de plata (que están en AA:AD) nunca llegaban.
La sección Números mostraba todo en cero y no había forma de darse cuenta,
porque las fechas y los nombres sí se veían bien. Si pensás vender esto a más de
tres o cuatro, planificá el paso a una base de datos de verdad antes de firmar
el tercero.

**Un solo usuario por complejo.** Hoy hay un `ADMIN_USER` y un `ADMIN_PASS` por
sitio: todos los dueños comparten la misma clave y no queda registro de quién
hizo qué. Para una familia está bien. Si un cliente tiene empleados o
administrador externo, vas a querer cuentas por persona.

## Qué NO hace falta que hagas

- **Netlify Blobs** (donde se guardan los comprobantes) se configura solo y es
  por sitio: cada cliente tiene su almacén separado sin que toques nada.
- Los certificados de HTTPS y los dominios los maneja Netlify.
