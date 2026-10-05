# App Recordatorios

## QA
No usar herramientas de preview (screenshot, snapshot, eval, DOM inspection) para verificar cambios.
La usuaria hace el QA manualmente. Tras implementar, informar de los cambios y esperar.

## Pestaña "Compras"

Cuarta lista de tareas, igual que Recados/Pendientes (`compras`, `ctxCompras`,
`saveCompras`, `renderCompras`). Nube: `recordatorios/compras`; IndexedDB:
`compras`. Va debajo de Tareas en la navegación. Sus tareas "En fecha" salen en
Agenda/Hoy y las que esperan, en "En espera". Las destacadas **no** van a Mis
tareas (como Pendientes).

## Pestaña "En espera"

Reúne lo apartado, por dos vías: **por fecha** (espera a que llegue) y **a
mano** (el interruptor "En espera" del panel de la tarea). Mientras espera, la
tarea **no aparece** en Tareas / Compras / Recados / Pendientes / Mis tareas /
Rutinas.

- Esperan por fecha: `dateMode` `"on"` ("En fecha"), `"from"` ("A partir de") y
  `"between"` ("Entre", por su `dateStart`; la de fin es solo el límite). Estas
  vuelven **solas** a su lista el día que la fecha se cumple.
- **No** espera `"before"` ("Antes de"): es un plazo, se puede hacer ya.
- Esperan a mano: las que llevan `enEspera: true`. **No** vuelven solas: se
  quedan hasta que se desmarque el interruptor. Este se ofrece solo en las
  cuatro listas propias (Tareas / Compras / Recados / Pendientes): en una copia
  de rutina no, porque vuelve a nacer sola, ni en una tarea "sin tipo", que ya
  tiene el estado "En espera" de su proyecto (`projectState`, otra cosa: ese
  aparta la tarea dentro del proyecto y **no** la trae a esta pestaña).
- **Motivo**: con el interruptor puesto, debajo aparece un campo de texto
  (`detail-espera-motivo`) que se guarda en `esperaMotivo`. Sale al final del
  byline, con el 🕑 delante (como "A partir de …"), de la tarea **solo** en la pestaña "En espera" (`ctxEspera.itemOpts` →
  `showMotivo` de `createTaskItem`). Al desmarcar el interruptor se borra.
- En esta pestaña la fecha y el motivo van en una **línea propia, la última**,
  debajo de la de procedencia y proyecto (`splitDateLine`, también en
  `ctxEspera.itemOpts`). El resto de listas no cambia.
- Vista de solo lectura en cuanto a creación: no tiene formulario. Los ítems son
  los objetos reales de sus listas, así que se editan y completan desde aquí.
- Orden: primero las de fecha, por `dateStart` ascendente (la que antes vuelve,
  primero), y al final las apartadas a mano, que no vuelven solas. Cada ítem
  lleva su procedencia en el byline (Tarea / Compra / Recado / Pendiente).
- Agenda y Hoy no cambian: una tarea "En fecha" sigue colocada en su día.
- "En espera" manda sobre "Añadir a Hoy": mientras espera, la tarea **no** sale
  en la sección "Durante el día" de Hoy, aunque tenga el fijado puesto. Vuelve a
  aparecer ahí sola en cuanto deja de esperar (`hoyPinnedTasks`).

Código (`app.js`): `isTaskWaitingByDate()` (solo la fecha), `isTaskWaiting()` =
`enEspera || isTaskWaitingByDate` (el predicado de la pestaña), `isTaskHidden()`
= `isTaskWaiting || isTaskOnHold` (el filtro que usan todas las listas),
`ctxEspera` y el hook `sortPending` de `renderList`. UI: `detail-espera` en
`index.html`, `renderDetailEspera()` (colgado de `renderDetailType()`).

## Planificadas recurrentes → tareas en "Mis tareas"

Las tareas de la pestaña **Planificadas** con "Repetir" distinto de "Nunca" se
**materializan** automáticamente como tareas normales en **Mis tareas**. Hay dos
frecuencias:
- **Semanalmente** (`repeat: "weekly"`, `repeatDay` 1=Lunes … 7=Domingo).
- **Mensualmente** (`repeat: "monthly"`, `repeatDom` 1-31; el día se recorta al
  máximo del mes, así el 31 cae el 30 en abril y el 28/29 en febrero).
- **Anualmente** (`repeat: "yearly"`, `repeatMonth` 1-12, `repeatDom` 1-31; el
  día se recorta al máximo del mes, así 29-feb en año no bisiesto pasa a 28-feb).
- **Trimestralmente** (`repeat: "quarterly"`, `repeatStart` ISO): ocurrencias en
  `repeatStart`, `+3 meses`, `+6 meses`, … (con recorte de día al mes destino).
- **Cada dos años** (`repeat: "biennial"`, `repeatStart` ISO): ocurrencias en
  `repeatStart`, `+2 años`, `+4 años`, … (mismo día/mes, con el mismo recorte).

  (Trimestral y "cada dos años" comparten el mismo campo `repeatStart` y, en la
  UI, el mismo wrap de "Fecha de inicio".)

Toda la lógica está en `app.js` y es común a las frecuencias (solo cambia el
cálculo de la "siguiente ocurrencia").

### Reglas
- Solo materializan las planificadas semanales (`repeatDay`), mensuales
  (`repeatDom`), anuales (`repeatMonth` + `repeatDom`), trimestrales o cada dos
  años (`repeatStart`).
- **Sin duplicados:** como máximo una copia *pendiente* por planificada.
  Mientras esa copia siga pendiente, no se crea otra.
- **Siguiente ocurrencia:** cuando la copia se **completa** o **elimina**, la
  siguiente aparece en la **primera ocurrencia estrictamente posterior** a esa
  fecha de despeje (completar el mismo día → la semana siguiente). Las tareas
  completadas siguen en la pestaña Completadas pero cuentan como despejadas.
- **Catch-up:** la comprobación corre en **cada carga**, no solo el día exacto.
  Si el día pasó con la app cerrada, la copia se crea en la siguiente apertura.
- **Copia = instantánea:** la tarea creada lleva `text` + `note` de la
  planificada, pero es independiente. Editar la planificada solo afecta a
  ocurrencias **futuras**, no a copias ya creadas.
- Fechas por la **hora local** del dispositivo.

### Modelo de datos
- Tarea (instancia): `sourcePlannedId` = id de la planificada de origen y
  `occurrenceDate` (ISO de la ocurrencia; se muestra en la 2ª línea con formato
  relativo hoy/ayer/mañana).
- Planificada: `createdAt` (ISO), `currentInstanceId` (id de la copia del ciclo
  actual, o null), `lastClearedAt` (ISO del último despeje, o null) y la config
  de repetición: `repeat` + (`repeatDay`) o (`repeatMonth`, `repeatDom`) o
  (`repeatStart`).

### Puntos clave del código (`app.js`)
- `runPlannedMaterialization()`: recorre `planned` recurrentes y aplica el
  algoritmo (resolver estado de la copia actual → generar la siguiente si toca).
- `plannedNextOccurrence(p, boundary, after)`: calcula la siguiente ocurrencia
  según `p.repeat`. Helpers de fecha: `dowOf`, `addDaysISO`,
  `firstOccurrenceOnOrAfter/After` (semanal);
  `monthlyOccurrenceOnOrAfter/After` (mensual, con recorte de día); `yearlyDateISO`,
  `yearlyOccurrenceOnOrAfter/After` (anual, con recorte de día);
  `biennialOccurrenceOnOrAfter/After` (cada dos años a partir de `repeatStart`);
  `addMonthsISO` + `quarterlyOccurrenceOnOrAfter/After` (cada 3 meses).
- UI del selector: `renderRepeat`, `populateDomOptions` (rellena "Día del mes"
  según el mes elegido; en mensual siempre ofrece los 31). El wrap
  `repeat-dom-wrap` ("Día del mes") lo comparten anual y mensual; el
  `repeat-year-wrap` ("Mes") es solo anual.
- Se ejecuta **una sola vez por carga**, tras la primera sincronización de la
  nube de `tasks` **y** `planned` (flags `tasksSynced`/`plannedSynced` +
  `materializationDone`), para evitar duplicados entre dispositivos y bucles con
  el `save()` interno. Se repite en cada **cambio de día** con la app abierta
  (ver "Cambio de día con la app abierta"); es idempotente, así que no duplica.
- `plannedIsRecurrent(p)` dice si una planificada genera tareas (tiene
  repetición y los datos que esa repetición necesita). Lo comparten la
  materialización y la Agenda.
- `deleteTask` registra el despeje por eliminación (fija `lastClearedAt` y
  limpia `currentInstanceId` de la planificada). La compleción no necesita
  enganche: la fecha la aporta `completedAt` y la recoge la comprobación.
- Migración: las planificadas semanales sin `createdAt` reciben la fecha de hoy
  en la primera comprobación (empiezan a generar desde su próxima ocurrencia).

### Rutinas en la Agenda (semana del calendario)

Cada día de la pestaña **Agenda** muestra, además de lo suyo, las rutinas que
tocan **ese día de la semana en curso**, para poder ver la semana entera por
delante (en Rutinas solo salen la de hoy y las pendientes de días anteriores).

- Si la copia de la rutina **ya existe** (la materialización la crea el día que
  toca), se pinta la **tarea real**: se completa, se abre y se reordena como
  cualquier otra entrada del día. Se muestra aunque esté completada: ese día se
  hizo. Va por `occurrenceDate`, así que una copia pendiente de una semana
  anterior no aparece en la semana de ahora.
- Si **aún no existe** (los días que no han llegado), se pinta una
  **previsualización** (`is-previa`): sin casilla, en borde punteado y apagada,
  y al tocarla se abre la **rutina**, no una tarea. No entra en `dayOrder` (su
  id, `rutina:<id>:<iso>`, no es el de ninguna tarea), así que se pinta al final
  del día y fuera del arrastre.
- Una ocurrencia ya despejada no deja fantasma: si la copia se **eliminó**,
  `lastClearedAt` la tapa (`plannedOccurrenceCleared`). Si se **completó**, se
  ve la copia.
- Esto es **solo de la Agenda**: "Durante el día" (Hoy) no cambia. Por eso las
  copias entran por el `extra` de `dayEntries` desde `renderAgenda`, y no dentro
  de `dayEntries`, que es común a las dos pestañas.

Código: `plannedIsRecurrent`, `plannedOccursOn` (compara con la primera
ocurrencia en o después de esa fecha), `plannedOccurrenceCleared`,
`plannedCopyFor`, `agendaRutinasFor`, `agendaRutinaPreviaEl` y la opción
`onOpen` de `createTaskItem`. `renderPlanned()` repinta la Agenda, porque
cualquier cambio en las rutinas la afecta.

### Tareas de App lactancia y App tareas en la Agenda

La Agenda también reparte por días las tareas de esas dos apps, con el día que
cada una lleva encima (`agendaExternasFor`, en el `extra` de `dayEntries` como
las copias de rutinas):

- **App tareas** (raíz `tasks`, solo Cristina): `addedDate`, la fecha con la que
  nace la tarea (la pone su propia repetición o el día en que se creó a mano).
- **App lactancia** (`tareas-mama`): `desde` si la tarea está diferida a un día
  futuro ("Bañar a Sofía" nace para dos días después de recoger el baño) y, si
  no lo tiene, `fecha`, que llevan las copias diarias de su plantilla
  (`lactDiaDe`).

Notas:
- Lo que no tiene ninguna de esas fechas —una tarea suelta de lactancia— no
  pertenece a ningún día y no sale en la Agenda: sigue en Cuanto antes/Rutinas.
- De **App lactancia** no se previsualiza nada: sus tareas no repiten por día de
  la semana, nacen de lo que se va registrando. De **App tareas** sí, ver abajo.
- Salen completadas incluidas, como el resto de la Agenda, y llevan su
  procedencia en el byline (`ORIGEN.lactancia` / `ORIGEN.appTareas`), que en
  Cuanto antes se omite porque allí basta el color.
- Su 2ª línea propia se oculta cuando es justo la fecha que las coloca en ese
  día; se conserva en las del baño ("Hace N días") mediante `keepByline`, que
  `dayEntryEl` traduce a `hideDate`.
- `renderRutinas()` repinta la Agenda, porque esos datos la alimentan.

### Previsión de App tareas en la Agenda

Los días de la Agenda **que aún no han llegado** anuncian también lo que App
tareas creará, a partir de sus plantillas (`detail-tasks`).

`atOccursOn(t, iso)` es una **réplica de las reglas de repetición de App
tareas**. Vive en la otra app: si allí se tocan, hay que repasarla. Cubre sus
seis frecuencias (`AT_REPEATS`), y su `date` es la **fecha de inicio**:
- `daily`: todos los días desde el inicio.
- `weekly`: por `weekday` ('0'=Domingo … '6'=Sábado).
- `monthly`: mismo día del mes que el inicio (que es obligatorio; sin él no
  repite). App tareas **no recorta** el día al máximo del mes, así que una del
  31 no tiene ocurrencia en los meses de 30, y aquí tampoco.
- `quarterly`: mismo día del mes y meses desde el inicio múltiplos de 3.
- `yearly`: mismo día y mes que el inicio.
- `biannually`: mismo día y mes, y años desde el inicio pares.

Fuera quedan, a propósito:
- Las que **alternan** (`alternaTareas`): dependen del historial de App tareas
  (a cuál le tocó la vez anterior), que no tenemos.
- Su regla de "no acumular" (si queda una pendiente de esa serie, no crea la
  siguiente): es un guardarraíl del momento de crear, no del calendario, y hoy
  no dice si mañana estará pendiente.

`agendaAtPreviasFor(iso)` añade encima:
- **Solo a futuro** (`iso > todayISO()`): hoy y los días pasados enseñan lo que
  existe de verdad, para que una tarea que se creó y se borró en App tareas no
  vuelva aquí como si estuviera por venir.
- **Sin duplicar**: si App tareas ya creó la tarea de ese día, su plantilla no se
  anuncia. La marca fiable es `seriesId` (el id de la plantilla, que App tareas
  guarda en la tarea); el texto vale de apoyo para las creadas antes de que lo
  guardara.

Se pintan con `agendaPreviaEl` (común con las rutinas previstas) más `is-at`
(su amarillo) e `is-external`: no se abren, se editan en App tareas. El listener
de `AT_DETAIL_ROOT` repinta la Agenda.

`atWeeklyForDow(dow)` se queda para la **Previsión semanal**, que es una semana
tipo sin fechas y por eso no puede usar `atOccursOn`. Ahí las que alternan sí
se siguen viendo: esa vista no ha cambiado.

### Cambio de día con la app abierta

El reloj de `startApp` (cada minuto) ya no solo resetea "Hoy": cuando cambia la
fecha vuelve a materializar las rutinas (para que las del día nazcan sin
recargar) y repinta listas, Hoy y Agenda. Así, al cruzar de domingo a lunes, la
Agenda pasa sola a la semana nueva: se van las ocurrencias de la semana anterior
y entran las de esta. La materialización solo se repite si ya corrió una vez con
los datos de la nube delante (`materializationDone`, ahora de ámbito módulo).

### Previsión semanal
Tab "Previsión semanal" en Planificadas (junto a "Lista"): una semana tipo, de
lunes a domingo, sin fechas. Solo muestra las planificadas "Semanalmente",
agrupadas por su `repeatDay`, más las plantillas de **App tareas** con
Repetición "Semanalmente" (raíz Firebase `detail-tasks`, `repeat: "weekly"`,
`weekday` '0'=Dom…'6'=Sáb; solo owner Cristina y `enabled !== false`). Las de
App tareas llevan el byline "App tareas" y no se abren. Solo lectura. Código:
`applyPlannedTab`, `renderPlannedWeek`, listener de `AT_DETAIL_ROOT` en
`startFirebaseSync` (`atDetailRaw`).

### Almacenamiento
- Tareas: ruta Firebase `recordatorios/tasks` + IndexedDB (`tasks`).
- Planificadas: ruta Firebase `recordatorios/planned` + IndexedDB (`planned`).

## Borrados definitivos (que lo borrado no reaparezca)

El SDK web de Firebase encola las escrituras pendientes **solo en memoria**: si
se borra algo sin conexión (o el móvil suspende la app antes de que salga la
escritura) y luego se cierra la pestaña, esa escritura se pierde. La tarea
desaparece en el momento —el respaldo de IndexedDB sí se guardó—, pero en la
siguiente carga la nube la manda de vuelta y reaparece.

Solución: un **registro local de borrados** ("tumbas") en IndexedDB
(`deletedIds`, array de `{id, at}`), que **no** se sincroniza: hay que poder
apuntarlo sin conexión.

- `rememberDeleted(id)` / `rememberDeletedMany(ids)`: apuntan el borrado. Se
  llaman desde `deleteTask`, `clearDoneIn`, `deleteAgenda`, `deletePlanned`,
  `deleteHoy`, `deleteProyecto` y `plannedToTask`. **Mover** una tarea de lista
  (`moveTaskToList`, `taskToPlanned`) no apunta nada: conserva el id.
- `applyDeleted(lista)`: quita de una lista recién llegada de la nube lo ya
  borrado aquí. Devuelve la **misma** lista si no sobraba nada, así el listener
  sabe (comparando con `!==`) si tiene que volver a subirla ya limpia.
- Cada listener de `startFirebaseSync` la aplica antes de adoptar los datos, y
  si sobraba algo llama a su `save*()` para que el borrado llegue por fin a la
  nube y al resto de dispositivos.
- Los ids son únicos en toda la app, así que el mismo registro sirve para todas
  las listas. Se podan a los 90 días (`DELETED_TTL_DAYS`) en cada carga.
