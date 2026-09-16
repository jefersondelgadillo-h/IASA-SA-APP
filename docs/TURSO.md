# Guardar los datos de forma permanente con Turso

Por defecto, la app guarda todo (Excel cargados, estados de actividades,
indicadores, historial de laminadores) en un archivo SQLite dentro del
servidor. Eso funciona bien, pero en el plan gratis de Render el disco no
es permanente: cada vez que el servicio se reinicia (por inactividad, o al
volver a desplegar) se pierde todo lo que se haya subido.

[Turso](https://turso.tech) es una base de datos SQLite "en la nube", con
plan gratis, 100% compatible con lo que ya usa esta app. Conectando la app
a Turso, los datos quedan guardados de forma permanente sin importar
cuantas veces se reinicie el servicio en Render.

## Paso 1: Crear cuenta y base de datos en Turso

1. Entra a https://turso.tech y crea una cuenta (puedes usar GitHub o
   Google).
2. En el dashboard, busca **"Create Database"**.
3. Ponle un nombre, por ejemplo `iasa-mantenimiento`, y elige la region
   mas cercana (o la que venga por defecto).
4. Cuando se cree, entra a esa base de datos y busca la seccion
   **"Connect"** o **"Quickstart"**. Ahi aparecen dos datos que se
   necesitan mas abajo:
   - **Database URL** (empieza con `libsql://...`)
   - **Auth Token** (boton tipo "Create Token"/"Generate Token" — copialo,
     normalmente solo se muestra una vez)

## Paso 2: Configurar la app con esos datos

En el servidor, edita `server/.env` (o creala copiando
`server/.env.example` si no existe) y completa:

```
TURSO_DATABASE_URL=libsql://tu-base-datos-tu-usuario.turso.io
TURSO_AUTH_TOKEN=el-token-que-copiaste
```

Reinicia el servidor. Desde ese momento, todas las tablas se crean solas
en Turso la primera vez que arranca (igual que antes se creaban en el
archivo local), y los datos quedan ahi de forma permanente.

### En Render

1. Entra a tu servicio en https://dashboard.render.com.
2. Ve a **"Environment"**.
3. Agrega las variables `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` con los
   valores del Paso 1.
4. Guarda ("Save, rebuild, and deploy"). Render va a redesplegar el
   servicio tomando la nueva configuracion.

## Sin Turso configurado

Si `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` quedan vacias, la app sigue
funcionando exactamente igual que antes, usando el archivo SQLite local
(`server/data/iasa.db`) — util para probar en tu computadora sin crear
cuenta en ningun lado. Sirve para desarrollo, pero en Render (plan
gratis) ese archivo se pierde en cada reinicio.

## Notas

- El plan gratis de Turso alcanza de sobra para esta app (miles de
  lecturas/escrituras al dia, varios GB de almacenamiento).
- El `Auth Token` funciona como una contrasena de la base de datos:
  no lo compartas ni lo subas al repositorio de GitHub (`server/.env`
  ya esta en `.gitignore`).
- Si en algun momento quieres volver a usar solo el archivo local, alcanza
  con borrar (o dejar vacias) esas dos variables de entorno.
