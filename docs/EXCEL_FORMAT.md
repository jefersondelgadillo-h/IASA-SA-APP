# Formato del Excel semanal

Este documento describe el Excel real que llega cada lunes (tipo
"Programa SEM##"), verificado contra los archivos de las semanas 36 y
37 de 2026.

## Estructura

Una sola hoja, con una fila de encabezados y luego una fila por cada
**orden de trabajo**:

| Sector | Orden | Equipo | Descripción | Puesto | Inicio | Fin | Dur. | Mon 31 | Tue 01 | Wed 02 | Thu 03 | Fri 04 | Sat 05 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| APT | 204154422 | Reductor 6,8KW ... | Cambiar Aceite al Reductor. | WCASTELL | 01/09 | 01/09 | 1 | | 1 | | | | |
| ENSCR | 204180842 | Balanza Ensacadora Crown | CALIBRACIÓN BL 002 | DCRUZ | 05/09 | 05/09 | 5 | | | | | | 5 |

- **Sector**: zona/area de la planta (código corto, puede venir vacío).
- **Orden**: número de orden de trabajo.
- **Equipo**: equipo/máquina (a veces viene vacío).
- **Descripción**: la tarea (obligatoria).
- **Puesto**: código del técnico o equipo asignado (obligatorio). Puede
  traer **varios códigos separados por "/"** cuando la orden la hacen
  varias personas (ej. `CRIOS/EVARGAS/WHUACARA`).
- **Inicio / Fin / Dur.**: rango y duración total de la orden. La app
  no los usa para nada — las fechas reales salen de las columnas de
  día (ver abajo).
- **Columnas de día** (`Mon 31`, `Tue 01`, ...): una por cada día de la
  semana, con las **horas planificadas** ese día para esa orden. La
  app ignora el texto del encabezado (a veces viene como texto "Mon
  31", a veces como fecha real) y simplemente asume que son días
  consecutivos empezando el lunes que se indica al subir el archivo en
  el panel admin.

## Cómo lo convierte la app

Por cada fila del Excel, la app genera **una actividad por cada día
que tenga horas planificadas mayores a 0**. Por ejemplo, una orden con
horas en Lunes, Martes y Jueves genera 3 actividades (una por día),
cada una con su propio estado y comentario — así un técnico puede
marcar "Completado" el lunes aunque la misma orden siga pendiente el
jueves.

## Lo más importante: el Excel NO dice si una tarea es Mecánica o Eléctrica

A diferencia de lo que se asumió en una primera version de esta app,
el archivo real **no trae una columna de especialidad**. Lo único que
identifica quién hace la tarea es el código de "Puesto" (ej. `WPAQUI`,
`DCRUZ`, `CRIOS`...).

Por eso, la especialidad (Mecánico/Eléctrico) de cada actividad se
calcula así:

1. En el panel admin hay una sección **"Técnicos"** con todos los
   códigos que se han visto en los Excel cargados.
2. El supervisor completa **nombre completo y especialidad** para cada
   código, una sola vez (o cuando aparece un código nuevo).
3. Desde ese momento, cualquier actividad asignada a ese código se
   clasifica automáticamente. Si una orden tiene varios códigos y
   todos son de la misma especialidad, la actividad queda clasificada;
   si mezcla Mecánico y Eléctrico, o si algún código todavía no tiene
   especialidad registrada, la actividad queda como **"Sin
   clasificar"** (igual es visible en el panel admin y para el propio
   técnico asignado, solo que no aparece en el filtro general por
   especialidad hasta completar el roster).

**Cada vez que se sube un Excel, los códigos de "Puesto" que no
estén todavía en la lista de técnicos se agregan automáticamente**
(sin nombre ni especialidad) para que el supervisor solo tenga que
completarlos, no escribirlos desde cero.

Los dos códigos `PDF-MEC` y `PDF-ELEC` (limpieza de talleres) son
genéricos, no personas — se puede poner un nombre como "Taller
Mecánico" / "Taller Eléctrico" y su especialidad correspondiente. Lo
mismo pasa con `ELECTRIT`: no es una persona fija, es "cualquier
eléctrico del taller que este disponible" en ese momento.

## Roster inicial ya cargado

`server/config/technicians-seed.json` trae precargado el roster real
de la planta Don Felipe (confirmado por el supervisor a partir de las
semanas 36 y 37 de 2026: 20 personas/códigos genéricos, con sus alias
conocidos). Se aplica solo una vez por código, la primera vez que
arranca el servidor — nunca pisa un nombre o rol que ya se haya
editado desde el panel admin. Para agregar gente nueva de ahí en
adelante no hace falta tocar este archivo: los códigos nuevos se
detectan solos al subir cada Excel y se completan desde "Técnicos" en
el panel admin.

## El rol no tiene que ser Mecánico o Eléctrico

Algunos códigos de "Puesto" corresponden a supervisores u otro personal
de mantenimiento, no a técnicos de campo. En la sección "Técnicos" del
panel admin el campo de rol es texto libre (por ejemplo "Supervisor",
"Mantenimiento"): esa persona igual puede iniciar sesión y ver sus
propias actividades, solo que **no cuenta para clasificar una
actividad como Mecánica o Eléctrica** (eso lo hacen unicamente los
códigos marcados exactamente como "Mecanico" o "Electrico").

## Una misma persona puede tener mas de un código

El Excel real no siempre usa el mismo código para la misma persona de
una semana a otra (por ejemplo, alguien aparece como `ECAM` una semana
y como `ECAMACHO` la siguiente). Si en el panel admin se registra el
mismo nombre y rol para dos códigos distintos, la app los trata como
la misma persona: al iniciar sesión, esa persona ve sus actividades
sin importar cuál de sus códigos haya usado el Excel esa semana.

## Si los nombres de columna cambian

Editando `server/config/excel-mapping.json` (sin tocar código) se
puede ajustar a qué encabezados busca la app para Sector / Orden /
Equipo / Descripción / Puesto / Duración. Las columnas de día siempre
se toman como todas las columnas con encabezado no vacío que vienen
después de la columna de Duración.

## Volver a subir una semana

Subir el Excel de una semana que ya existía reemplaza por completo sus
actividades (identificadas por la fecha de inicio de semana que se
indica al subir). Es seguro volver a subir el mismo archivo corregido.
