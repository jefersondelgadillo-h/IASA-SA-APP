# Notificaciones automaticas con Power Automate

Cada vez que un mecanico o electrico actualiza el estado de una
actividad (Pendiente, En progreso, Completado, Con problema) y guarda
un comentario, la app hace automaticamente una llamada HTTP (POST) a
una URL que tu configuras. Esa URL es la de un flujo de Power Automate,
que se encarga de avisarte (correo, Teams, lo que prefieras).

No necesitas tocar codigo para crear o cambiar el flujo: todo se hace
en Power Automate y solo hay que pegar la URL resultante en el archivo
`.env` del servidor.

## Paso 1: Crear el flujo en Power Automate

1. Entra a https://make.powerautomate.com con tu cuenta de Microsoft
   365 de IASA.
2. Haz clic en **Crear** → **Flujo de nube instantaneo**.
3. Ponle un nombre, por ejemplo `Aviso actualizacion mantenimiento`.
4. Como desencadenador (trigger) elige **"Cuando se recibe una
   solicitud HTTP"** (en ingles: *"When a HTTP request is received"*).
5. Crea el flujo.

## Paso 2: Definir el esquema del JSON que va a recibir

En el paso del trigger, haz clic en **"Usar un payload de ejemplo para
generar el esquema"** y pega este ejemplo:

```json
{
  "event": "activity_status_updated",
  "activity": {
    "id": 123,
    "order_number": "204178453",
    "description": "Cambio de rodamientos",
    "area": "Envasado",
    "equipment": "Llenadora 3",
    "activity_type": "Mecanico",
    "assigned_to": "WPAQUI",
    "activity_date": "2026-09-07"
  },
  "old_status": "Pendiente",
  "new_status": "Con problema",
  "comment": "Falta el repuesto, se pide a bodega",
  "updated_by": "Juan Perez",
  "updated_at": "2026-09-07T14:32:00.000Z"
}
```

Power Automate genera automaticamente los campos disponibles para usar
en los pasos siguientes (puedes hacer clic en cada uno desde el
selector de "contenido dinamico").

## Paso 3: Agregar la accion de notificacion

Agrega un paso nuevo, por ejemplo:

- **Enviar un correo electronico (V2)** (Office 365 Outlook), con
  destinatario **PRA_JDelgadilloH@IASA-SA.COM** (o el correo/lista que
  prefieras usar para recibir estos avisos), o
- **Publicar un mensaje en un canal de Microsoft Teams**.

Sugerencia de cuerpo del mensaje/correo, usando contenido dinamico:

```
Asunto: [Mantenimiento IASA] Actualizacion: {activity.description}

{updated_by} actualizo la actividad "{activity.description}"
(orden {activity.order_number}, {activity.area} - {activity.equipment})
de {old_status} a {new_status}.

Comentario: {comment}
Fecha de la actividad: {activity.activity_date}
Hora de actualizacion: {updated_at}
```

Opcional: agrega una condicion antes de esta accion para que solo
notifique cuando `new_status` sea igual a `Con problema`, si no quieres
recibir un aviso por cada cambio de estado, solo cuando hay un
inconveniente. Tambien puedes crear dos ramas: una notificacion normal
por correo, y una mas urgente (Teams + correo) cuando el estado es
"Con problema".

## Paso 4: Guardar el flujo y copiar la URL

1. Guarda el flujo.
2. Vuelve a abrir el paso del trigger "Cuando se recibe una solicitud
   HTTP": ahi aparece la **URL de la direccion HTTP POST**, generada
   automaticamente por Power Automate.
3. Copia esa URL.

## Paso 5: Configurar la app con esa URL

En el servidor, edita el archivo `server/.env` (crealo copiando
`server/.env.example` si no existe) y pega la URL:

```
POWER_AUTOMATE_WEBHOOK_URL=https://prod-00.westus.logic.azure.com/workflows/....
```

Reinicia el servidor para que tome el cambio. A partir de ese momento,
cada actualizacion de estado disparara el flujo automaticamente.

## Notas

- Si `POWER_AUTOMATE_WEBHOOK_URL` no esta configurada, la app funciona
  con normalidad, simplemente no se envia ninguna notificacion (queda
  un aviso en los logs del servidor).
- Si el flujo falla o Power Automate no responde, la actualizacion del
  tecnico igual queda guardada en la app: la notificacion nunca bloquea
  ni revierte el cambio de estado.
- Con el mismo mecanismo puedes agregar mas adelante otro flujo, por
  ejemplo para avisar automaticamente cuando llega el Excel nuevo cada
  lunes por Outlook y subirlo solo a la app (usando el endpoint
  `POST /api/admin/upload`, protegido con la clave de administrador).
