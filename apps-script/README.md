# Mantenimiento de holds

`HoldsMaintenance.gs` es la copia del `Código.gs` del proyecto de Google Apps
Script **reemplazo de schedules**, vinculado a la planilla de reservas.
`runHoldsMaintenance` conserva el activador existente de diez minutos.
Los workflows viejos de n8n siguen apagados.

## Error investigado

El aviso del 20/10/2026 informa `We're sorry, a server error occurred. Please
wait a bit and try again.`. El 29/10 se comprobó en el editor otro fallo con el
mismo mensaje, del 24/10, sin traza ni línea del script. Las ejecuciones
posteriores se completaban normalmente. El historial visible cubría siete
días, por lo que no permitió recuperar la traza del incidente del día 20.

El 14/11/2026 volvió a pasar: la ejecución empezó a las 16:07:05 y terminó con
el mismo mensaje a las 16:15:05. Duró ocho minutos, más que el límite de seis
minutos que Apps Script impone a un script. Si el código hubiera seguido
corriendo, Google lo habría cortado con `Exceeded maximum execution time`, no
con este mensaje. Su registro tiene sólo la línea del error, sin `START`, así
que el código del script no llegó a ejecutarse.

El 10/11/2026 hubo otro: `START` a las 4:37:18 y el error a las 4:37:59, sin
`RETRY` ni `FAIL`. El fallo no fue una excepción de una lectura envuelta en
reintentos. Google cortó la ejecución desde afuera.

Los dos fallos ocurrieron con este código ya cargado en Google, comprobado el
15/11 en el editor. Fueron dos sobre unas mil ejecuciones de la semana; las
demás tardan unos dos segundos. Ningún `try/catch` ni reintento dentro del
script alcanza estos casos.

Según la [documentación de Google](https://developers.google.com/apps-script/guides/support/troubleshooting),
el mensaje puede corresponder a indisponibilidad temporal, errores sin mensaje
específico o fallos de Apps Script. No demuestra por sí solo una causa exacta.

## Recuperación

- Las lecturas de Sheets tienen hasta tres intentos,
  separados por esperas de uno y dos segundos, sólo ante errores transitorios.
- Los errores de permisos, cuotas y configuración se propagan sin reintentar.
- Un bloqueo de script evita que dos ejecuciones de este proyecto se solapen.
- No se reintenta `MailApp.sendEmail` ni el mantenimiento completo: hacerlo
  podría repetir un correo que Google ya aceptó.
- Las escrituras se hacen una sola vez: repetir una escritura ambigua con una
  copia anterior de la planilla podría pisar una confirmación hecha por n8n.
  El bloqueo de script sólo coordina este proyecto, no las escrituras de n8n.
- `flush()` confirma las escrituras antes de registrar `OK` y liberar el bloqueo.
- Si se agregan columnas de mantenimiento, la matriz y el rango de escritura
  se amplían juntos.
- Los registros `START`, `RETRY`, `FAIL`, `SKIP` y `OK` permiten distinguir qué
  operación alcanzó a ejecutarse, sin registrar datos de huéspedes.

Esto **no puede recuperar un fallo de Google anterior al inicio del código**,
ni una ejecución que Google deja colgada. En ese caso queda el siguiente disparo
del activador, diez minutos después. Como el script decide todo a partir de la
planilla, ese disparo vence los holds y manda los avisos que quedaron
pendientes. El activador ya notifica fallos **cada día** (comprobado el 15/11):
el correo es un resumen, y un fallo suelto aparece ahí aunque el disparo
siguiente lo haya resuelto. Pasarlo a **cada semana** reduce más los avisos,
pero también demora enterarse de un fallo persistente. Tampoco se ocultan fallos
persistentes: si los tres intentos fallan, la ejecución queda marcada con error.

El envío y el guardado de `reminder_1h_sent_at` son operaciones separadas. Si
Google acepta el correo pero falla el guardado de la marca, un disparo posterior
todavía podría volver a enviarlo. Tampoco hay una transacción compartida con
n8n entre leer y escribir la planilla: esa limitación previa requiere coordinar
todos los escritores para eliminarla. Este cambio no añade reintentos de
escritura que amplíen esa ventana.

## Actualizar el proyecto

1. Guardar una copia local del `Código.gs` actual antes de editarlo.
2. Conservar los valores actuales de `OWNER_EMAILS` y `CC_EMAILS`. Están vacíos
   en este archivo **para no publicar direcciones privadas**; no desplegarlo
   con esos valores vacíos porque se omitirían los avisos.
3. Copiar `HoldsMaintenance.gs` al archivo existente y restaurar esos dos
   valores en el editor de Google. No agregar una segunda definición de las
   funciones ni crear otro activador.
4. Guardar el proyecto. El activador usa el código guardado: no requiere una
   implementación web nueva. Netlify y un merge en GitHub no hacen este paso.
5. Ejecutar `inspectHoldsMaintenance` para verificar acceso y contar holds
   vencidos o pendientes de aviso. Es de sólo lectura y no manda correos.
6. Verificar el siguiente disparo automático en **Ejecuciones**: estado
   `Completada` y registro `OK runHoldsMaintenance`. No usar un envío manual de
   correos a propietarios como prueba.

## Pruebas

```sh
npm test
# Sólo este script:
node --test apps-script/HoldsMaintenance.test.js
```

Las pruebas ejecutan el archivo `.gs` real en Node con servicios de Google
simulados. Cubren recuperación de lecturas, límites de reintentos, no repetir
escrituras ambiguas ni correos, una confirmación concurrente de n8n, errores
permanentes, ejecuciones simultáneas y columnas faltantes. No acceden a reservas
reales ni mandan correos.
