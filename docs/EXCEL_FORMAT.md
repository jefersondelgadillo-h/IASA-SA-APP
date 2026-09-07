# Formato esperado del Excel semanal

La app lee el Excel que llega cada lunes por Outlook y lo convierte en la
programacion de la semana. Para que la carga funcione sin ajustes, la
primera fila de la hoja debe tener encabezados de columna, por ejemplo:

| Fecha | Area | Equipo | Actividad | Tipo | Responsable | Turno | Prioridad |
|-------|------|--------|-----------|------|-------------|-------|-----------|
| 2026-09-07 | Envasado | Llenadora 3 | Cambio de rodamientos | Mecanico | Juan Perez | Dia | Alta |
| 2026-09-07 | Envasado | Tablero TP-1 | Revision de breakers | Electrico | Ana Gomez | Noche | Media |

**Columnas obligatorias:** `Actividad` (la descripcion de la tarea) y
`Tipo` (debe decir "Mecanico" o "Electrico" para que la actividad se
asigne a la vista correcta).

**Columnas opcionales pero recomendadas:** `Fecha`, `Area`, `Equipo`,
`Responsable` (nombre del tecnico), `Turno`, `Prioridad`.

## Si los nombres de columna en el archivo real son distintos

No es necesario cambiar el codigo. Edita el archivo
`server/config/excel-mapping.json` y agrega el nombre exacto de la
columna tal como aparece en el Excel a la lista correspondiente. Por
ejemplo, si la columna de responsable en el archivo real se llama
"Encargado", agrega `"Encargado"` a la lista `responsable`.

## Formato de fecha

Acepta fechas de Excel (celda tipo fecha), o texto en formato
`dd/mm/aaaa` o `aaaa-mm-dd`.

## Columna "Tipo"

Se reconoce automaticamente si el valor es alguna variante de
"Mecanico" o "Electrico" (con o sin tilde, mayusculas/minusculas,
abreviado "MEC"/"ELEC"/"M"/"E"). Las filas que no se puedan clasificar
como Mecanico o Electrico se omiten de la carga (por ejemplo,
subtitulos o filas en blanco dentro del Excel).

## Que pasa si subo el Excel de una semana que ya existia

El sistema reemplaza por completo las actividades de esa semana
(identificada por la fecha de inicio de semana que se indica al
subir el archivo). Es seguro volver a subir el mismo archivo corregido.

## Tecnicos

Los nombres que aparecen en la columna `Responsable` se guardan
automaticamente en la lista de tecnicos que aparece al iniciar sesion
en la app, junto con su rol (Mecanico/Electrico). No hace falta
registrarlos a mano.
