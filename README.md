# App de mantenimiento IASA SA — Planta Don Felipe

App sencilla para que mecanicos y electricos vean la programacion
semanal de mantenimiento desde el celular, reporten el avance de cada
actividad (Pendiente / En progreso / Completado / Con problema) con un
comentario opcional, y para que el supervisor cargue el Excel semanal y
reciba un aviso automatico (via Power Automate) cada vez que alguien
actualiza una actividad.

## Estructura del proyecto

```
server/   API (Node.js + Express + SQLite)
client/   Frontend (React + Vite + Tailwind), pensado para movil
docs/     Guias: formato del Excel y configuracion de Power Automate
```

## Requisitos

- Node.js 18 o superior

## Instalacion y ejecucion en local

```bash
# 1. Backend
cd server
cp .env.example .env      # y edita ADMIN_PASSWORD (y luego POWER_AUTOMATE_WEBHOOK_URL)
npm install
npm run dev                # http://localhost:4000

# 2. Frontend (en otra terminal)
cd client
npm install
npm run dev                # http://localhost:5173
```

Abre http://localhost:5173 en el navegador (o en el celular, si esta en
la misma red, usando la IP de la maquina).

## Uso

1. **Primer uso (supervisor):** entra a `/admin`, escribe la clave de
   administrador (definida en `server/.env`), sube el Excel de la
   semana indicando la fecha del lunes de inicio. Ver el formato
   esperado en [`docs/EXCEL_FORMAT.md`](docs/EXCEL_FORMAT.md).
2. **Mecanicos y electricos:** entran a la app, eligen su rol y su
   nombre (una sola vez, queda guardado en el dispositivo), y ven solo
   las actividades de su especialidad. Pueden filtrar "solo mis
   actividades" o por estado, y tocar cualquier actividad para
   actualizar su estado y dejar un comentario.
3. **Notificaciones automaticas:** cada actualizacion dispara (si esta
   configurada) un flujo de Power Automate. Guia paso a paso en
   [`docs/POWER_AUTOMATE.md`](docs/POWER_AUTOMATE.md).

## Despliegue (produccion)

La forma mas simple es correr todo en un solo servidor Node:

```bash
cd client
npm install
npm run build          # genera client/dist

cd ../server
npm install
cp .env.example .env   # configura ADMIN_PASSWORD, POWER_AUTOMATE_WEBHOOK_URL, PORT
npm start              # sirve la API y el frontend ya compilado en un solo puerto
```

El servidor detecta automaticamente `client/dist` y sirve el frontend
desde ahi, asi que con un solo proceso (`npm start` en `server/`) queda
todo funcionando en, por ejemplo, `http://IP-DEL-SERVIDOR:4000`,
accesible desde cualquier celular conectado a la red de la planta. Para
acceso desde internet (fuera de la planta) se recomienda ponerlo detras
de un dominio con HTTPS (por ejemplo con un reverse proxy como Nginx o
un servicio como Azure App Service / Render / Railway).

Para instalar la app como acceso directo en el celular ("Agregar a
pantalla de inicio"), el navegador la reconoce como app instalable
(PWA) automaticamente gracias al `manifest.json` incluido.

## Variables de entorno (`server/.env`)

| Variable | Descripcion |
|---|---|
| `PORT` | Puerto de la API (por defecto 4000) |
| `ADMIN_PASSWORD` | Clave para entrar al panel de administracion |
| `POWER_AUTOMATE_WEBHOOK_URL` | URL del flujo de Power Automate que recibe las notificaciones (ver `docs/POWER_AUTOMATE.md`) |
| `CLIENT_ORIGIN` | Origen permitido para CORS si el frontend se sirve por separado |

## Datos

Se guardan en un archivo SQLite (`server/data/iasa.db`), que se crea
solo la primera vez que arranca el servidor. No requiere instalar ni
administrar un motor de base de datos aparte. Conviene incluir ese
archivo en el respaldo/backup del servidor.

## Nota de seguridad

El endpoint que procesa archivos `.xlsx` (`POST /api/admin/upload`) esta
protegido con la clave de administrador y solo deberia usarlo el
supervisor con el archivo que llega por Outlook. La libreria `xlsx`
(SheetJS) usada para leerlo tiene vulnerabilidades conocidas sin parche
disponible en el registro publico de npm (el parche solo se distribuye
desde el CDN propio de SheetJS). Como el endpoint no es publico y el
archivo siempre proviene de una fuente conocida (el correo semanal),
el riesgo practico es bajo, pero si en el futuro se habilita carga
publica de archivos, conviene primero actualizar a la version
parcheada (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) o
migrar a una libreria alternativa como `exceljs`.

## Proximos pasos sugeridos

- Automatizar tambien la **entrada** del Excel: un flujo de Power
  Automate que, cuando llegue el correo de Outlook con el archivo
  adjunto cada lunes, lo suba solo a `POST /api/admin/upload` (evita
  que el supervisor tenga que subirlo a mano).
- Exportar el tablero del panel admin a Excel/PDF para reportes.
- Historial de cambios por actividad (ya se guarda en la base de
  datos, tabla `activity_history`; se puede exponer en el panel admin
  si se necesita).
