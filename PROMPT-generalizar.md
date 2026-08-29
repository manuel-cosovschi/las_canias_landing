# Prompt para generalizar el sistema

Copiá todo lo que está entre las líneas de guiones y pegalo en un chat nuevo,
con el repo `las_canias_landing` abierto.

---

Este repo es el sistema de alquiler del complejo Las Cañas (Mar de Cobo,
Argentina): una landing, una página de reservas, un panel de dueños y funciones
de Netlify que hablan con n8n y con una planilla de Google.

Quiero convertirlo en una **plantilla** que sirva para vender el mismo sistema a
otros complejos turísticos, con un despliegue separado por cliente. **No** quiero
multi-inquilino todavía: cada complejo va a tener su propio sitio de Netlify, su
propia planilla y sus propios workflows de n8n.

## Objetivo medible

Hoy, buscar la identidad del complejo en el código da esto:

- `"Las Cañas"` / `"lascanias"` → 23 archivos
- `"Mar de Cobo"` → 12 archivos
- el WhatsApp `542236882986` → 8 archivos
- la paleta `#DED2B9 #F5F1E9 #4A3728 #8C7662` → 6 archivos
- `LC1`..`LC5` → 58 archivos (incluye nombres de fotos)

**Cuando termines, buscar cualquiera de esas cosas fuera del archivo de
configuración tiene que dar CERO** en `las-canas-react/src`,
`las-canas-react/public/*.html`, `netlify/functions` y `n8n`. Las fotos son la
excepción: se mueven a una convención de carpetas, no se renombran una por una.

Dejá ese chequeo escrito como un test que se pueda correr, para que si alguien
vuelve a escribir la marca en el código, falle.

## Qué hacer

### 1. Un archivo de configuración, único lugar donde vive la identidad

Creá algo tipo `config/complejo.json` (o `.js`, elegí vos y explicá por qué) con:

- **Identidad**: nombre, nombre corto, localidad, provincia, país, dominio,
  logo, descripción, coordenadas geográficas, dirección.
- **Contacto**: WhatsApp (un solo número, hoy repetido en 8 archivos),
  Instagram, mail.
- **Marca**: los cuatro colores y las dos tipografías.
- **Unidades**: una lista, donde cada una tiene código (hoy `LC1`), nombre para
  mostrar (`Las Cañas 1`), capacidad máxima, la sugerencia de ocupación que hoy
  está en `HOUSE_RULES` de `reservar.html`, y la carpeta de fotos.
- **Temporada**: hoy está fijo que arranca en diciembre (`temporadaDe()` en
  `admin.html`). Que sea configurable, porque en otro complejo puede no serlo.

### 2. Que todo lo lea de ahí

Los lugares concretos, ya localizados:

| Qué | Dónde |
|---|---|
| `const CASAS = ["LC1".."LC5"]` | `netlify/functions/`: `owner-blocks.js`, `price-periods.js`, `reservation-document.js`, `create-manual-reservation.js` |
| Nombres para mostrar | `netlify/functions/_documento.js` (línea ~13), `list-calendar.js` (línea ~98) |
| `HOUSE_RULES` con capacidades | `las-canas-react/public/reservar.html` (línea ~459) |
| `<option value="LC1">` | `reservar.html` (~129), `admin.html` (~422 y ~571) |
| Marca, SEO, Open Graph, schema.org `LodgingBusiness` | `las-canas-react/index.html` |
| Paleta de Tailwind (repetida inline) | `index.html`, `admin.html`, `reservar.html`, `terminos.html`, `tips+sugerencias.html` |
| Textos e Instagram | `src/components/` (Navbar, Hero, Footer, Contact, Location, About) |

Ojo con dos cosas:

- La paleta está **repetida inline** en cada HTML suelto porque usan Tailwind por
  CDN. Necesitás una forma de generar ese bloque desde la config, o un archivo
  compartido que los cinco incluyan.
- `admin.html` tiene 6.088 líneas y `reservar.html` 2.132, con el JavaScript
  inline. No los reescribas: hacé los cambios mínimos para que lean la config.

### 3. Fotos por convención

Hoy están en `public/Casa 1 Imagenes/`, `Casa 2 Imagenes/`, etc., con los
nombres de archivo incluyendo `LC1`, `LC2`… Pasalas a `public/unidades/<código>/`
y que el componente arme las rutas desde la config. Los nombres de archivo
adentro pueden quedar como están.

### 4. n8n, que es la parte más molesta

Hay 7 workflows en `n8n/`. El id de la planilla de Google está **incrustado
adentro del JSON del workflow**, en 4 archivos:

```
documentId: { __rl: true, mode: 'list', value: '1ae4bC9751PVRWJ5wQ0eNY19voNDnwB6A04v_ZXqFRBE', ... }
```

Sacalo a una variable del workflow o a una variable de entorno de n8n, de modo
que duplicar los workflows para un cliente nuevo sea cambiar **un** valor y no
editar cuatro nodos a mano. Revisá también las plantillas de mail
(`owner-approve--preparar-email.js`), que tienen la marca escrita adentro.

### 5. Sacar la tienda

Borrá la tienda entera: `public/tienda.html`, las funciones `store-catalog.mjs`,
`set-store-catalog.mjs`, `upload-store-photo.mjs`, `store-photo.mjs`,
`_tienda.mjs`, la sección Tienda del panel en `admin.html`, la regla `/tienda`
de `public/_redirects` y los links del menú, la portada y el pie.

**Cuidado**: `_v2.mjs` y `_auth.js` NO se borran. Los usan los comprobantes
(`submit-proof.mjs`, `proof-file.mjs`), que dependen del formato v2 de funciones.

### 6. Documentar cómo se da de alta un complejo nuevo

Un `README` con los pasos, contando cuáles son manuales (crear la planilla,
compartirla con la service account, duplicar los workflows de n8n, cargar las
variables en Netlify) y cuáles son sólo editar la config.

## Cosas importantes del repo que tenés que saber

- **Las funciones de Netlify están en dos formatos.** La mayoría son v1
  (`exports.handler`). Las cuatro de la tienda y las dos de comprobantes son v2
  (`export default`, `.mjs`), porque **Netlify le inyecta el contexto de Netlify
  Blobs sólo a las v2**. Está medido y documentado en `netlify/functions/_v2.mjs`
  y en el README de esa carpeta. No conviertas funciones v1 a v2 sin necesidad, y
  si lo hacés, verificá en un deploy preview: importar un módulo CommonJS que
  tenga dependencias pesadas desde una función v2 hace que el bundler deje el
  `require` sin resolver y la función tire 502.
- **`LC_SHEET_ID` y `LC_SHEET_TAB` ya son variables de entorno** del lado de las
  funciones. Ese lado está bien; el problema es n8n.
- **La auth es de un solo usuario**: `ADMIN_USER` + `ADMIN_PASS` para el Basic
  del panel, y `LC_OWNER_SECRET` como segunda llave. Alcanza para un complejo
  familiar. No lo cambies en este trabajo, pero anotalo como límite.
- **Hay una batería de tests de navegador** con Playwright, fuera del repo, que
  corre contra el build de verdad. Si rompés la landing o el panel, no te vas a
  enterar solo. Pedile al usuario que te diga dónde están, o escribí los tuyos.
- Los comentarios del código están en castellano y explican **por qué**, no qué.
  Seguí ese estilo.
- Antes de mergear cualquier cosa, **verificá en el deploy preview de Netlify**,
  no sólo con los tests locales.

## Cómo quiero que trabajes

Andá por partes y mostrame cada una antes de seguir: primero la config y que la
landing la lea; después las funciones; después `reservar.html` y `admin.html`;
después n8n; al final sacar la tienda y escribir el README.

En cada paso, decime qué quedó en cero y qué todavía no.

---
