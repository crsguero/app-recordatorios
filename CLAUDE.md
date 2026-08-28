# App Recordatorios

## QA
No usar herramientas de preview (screenshot, snapshot, eval, DOM inspection) para verificar cambios.
La usuaria hace el QA manualmente. Tras implementar, informar de los cambios y esperar.

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
  `materializationDone` en `startFirebaseSync`), para evitar duplicados entre
  dispositivos y bucles con el `save()` interno.
- `deleteTask` registra el despeje por eliminación (fija `lastClearedAt` y
  limpia `currentInstanceId` de la planificada). La compleción no necesita
  enganche: la fecha la aporta `completedAt` y la recoge la comprobación.
- Migración: las planificadas semanales sin `createdAt` reciben la fecha de hoy
  en la primera comprobación (empiezan a generar desde su próxima ocurrencia).

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
