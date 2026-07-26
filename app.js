(function () {
  "use strict";

  const form = document.getElementById("task-form");
  const input = document.getElementById("task-input");
  const list = document.getElementById("task-list");
  const emptyState = document.getElementById("empty-state");
  const doneSection = document.getElementById("done-section");
  const doneList = document.getElementById("done-list");
  const toggleDoneBtn = document.getElementById("toggle-done");
  const clearDoneBtn = document.getElementById("clear-done");
  const summary = document.getElementById("summary");

  /* ---------- Firebase (mismo proyecto que la app de tareas) ----------
     Las cuentas de acceso son compartidas por ser el mismo proyecto. Los
     datos de esta app viven en la ruta "recordatorios" para no mezclarse
     con los de otras apps. Todas las cuentas con login comparten estos datos. */
  const firebaseConfig = {
    apiKey: "AIzaSyDEBCJbasCSAH_o6L-VR63LLxoL9IM9BWk",
    authDomain: "app-tareas-f38e5.firebaseapp.com",
    databaseURL:
      "https://app-tareas-f38e5-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "app-tareas-f38e5",
    storageBucket: "app-tareas-f38e5.firebasestorage.app",
    messagingSenderId: "991941627960",
    appId: "1:991941627960:web:7a6eeedda963354e3596cd",
  };
  firebase.initializeApp(firebaseConfig);
  const fdb = firebase.database();
  const fauth = firebase.auth();
  const FB_ROOT = "recordatorios"; // ruta raíz de esta app en la base de datos
  const FB_KEY = "tasks"; // recordatorios/tasks = array de tareas
  const FB_KEY_PLANNED = "planned"; // recordatorios/planned = tareas planificadas

  /* ---------- Respaldo local (IndexedDB) ----------
     Usamos IndexedDB en lugar de localStorage porque los archivos abiertos
     con file:// comparten un mismo localStorage pequeño; IndexedDB tiene
     mucho más espacio. Mantenemos la lista en memoria (tasks) para que el
     resto del código siga siendo síncrono. */
  const LEGACY_KEY = "mis-tareas.v1"; // datos antiguos guardados en localStorage
  const DB_NAME = "app-recordatorios";
  const STORE = "kv";
  const IDB_KEY = "tasks";
  const IDB_KEY_PLANNED = "planned";
  let db = null;
  let fbReady = false; // true cuando Firebase está autenticado y escuchando
  let appStarted = false; // evita arrancar la app dos veces

  let tasks = [];
  let planned = []; // tareas planificadas (solo texto, sin completar)
  let doneVisible = false; // sección de completadas desplegada/plegada

  /* ---------- Aviso de errores visible ---------- */
  function showError(msg) {
    const el = document.getElementById("sync-error");
    if (el) {
      el.textContent = "⚠️ " + msg;
      el.hidden = false;
    }
  }
  function clearError() {
    const el = document.getElementById("sync-error");
    if (el) el.hidden = true;
  }
  window.addEventListener("error", (ev) => {
    showError((ev.message || "error desconocido"));
  });
  window.addEventListener("unhandledrejection", (ev) => {
    const r = ev.reason;
    showError("Promesa: " + (r && r.message ? r.message : r));
  });

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function idbGet(key) {
    return new Promise((resolve) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    });
  }
  function idbSet(key, value) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /* ---------- Persistencia ---------- */
  function save() {
    // Respaldo local (IndexedDB): instantáneo y funciona sin conexión.
    if (db) idbSet(IDB_KEY, tasks).catch(() => {});
    // Nube (Firebase): sincroniza entre dispositivos. Sin conexión, Firebase
    // encola la escritura y la envía al recuperarla.
    if (fbReady) {
      fdb
        .ref(FB_ROOT + "/" + FB_KEY)
        .set(tasks && tasks.length ? tasks : null)
        .catch((e) => showError("Al sincronizar: " + (e && e.message ? e.message : e)));
    }
  }

  function savePlanned() {
    if (db) idbSet(IDB_KEY_PLANNED, planned).catch(() => {});
    if (fbReady) {
      fdb
        .ref(FB_ROOT + "/" + FB_KEY_PLANNED)
        .set(planned && planned.length ? planned : null)
        .catch((e) =>
          showError("Al sincronizar: " + (e && e.message ? e.message : e))
        );
    }
  }

  /* ---------- Acciones: planificadas ---------- */
  function addPlanned(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    planned.unshift({ id: newId(), text: trimmed, createdAt: todayISO() });
    savePlanned();
    renderPlanned();
  }

  function setPlannedText(id, text) {
    const item = planned.find((p) => p.id === id);
    if (item) {
      item.text = text;
      savePlanned();
    }
  }

  function deletePlanned(id) {
    planned = planned.filter((p) => p.id !== id);
    savePlanned();
    renderPlanned();
  }

  function setPlannedNote(id, note) {
    const item = planned.find((p) => p.id === id);
    if (item) {
      item.note = note;
      savePlanned();
    }
  }

  /* ---------- Materialización de planificadas semanales ----------
     Convierte cada planificada "Semanalmente" en una tarea de Mis tareas según
     el día configurado, sin duplicados y con recuperación (catch-up). Ver el
     plan/documentación para las reglas completas. Se ejecuta una vez por carga
     tras sincronizar tasks y planned. */
  function runPlannedMaterialization() {
    const today = todayISO();
    let tasksChanged = false;
    let plannedChanged = false;

    planned.forEach((p) => {
      const isWeekly = p.repeat === "weekly" && p.repeatDay;
      const isYearly = p.repeat === "yearly" && p.repeatMonth && p.repeatDom;
      const isBiennial = p.repeat === "biennial" && p.repeatStart;
      const isQuarterly = p.repeat === "quarterly" && p.repeatStart;
      if (!isWeekly && !isYearly && !isBiennial && !isQuarterly) return;

      // Migración: planificadas antiguas sin fecha de creación
      if (!p.createdAt) {
        p.createdAt = today;
        plannedChanged = true;
      }

      // Estado de la instancia actual del ciclo
      if (p.currentInstanceId) {
        const inst = tasks.find((t) => t.id === p.currentInstanceId);
        if (inst && !inst.done) {
          return; // pendiente → no duplicar
        }
        if (inst && inst.done) {
          p.lastClearedAt = inst.completedAt || today; // completada
        } else if (!inst) {
          if (!p.lastClearedAt) p.lastClearedAt = today; // eliminada
        }
        p.currentInstanceId = null;
        plannedChanged = true;
      }

      // Inactiva → ¿toca crear una nueva copia?
      const boundary = p.lastClearedAt || p.createdAt;
      const nextOcc = plannedNextOccurrence(p, boundary, !!p.lastClearedAt);

      if (nextOcc && nextOcc <= today) {
        const inst = {
          id: newId(),
          text: p.text,
          done: false,
          starred: false,
          sourcePlannedId: p.id,
        };
        if (p.note && p.note.trim()) inst.note = p.note; // instantánea de la nota
        tasks.unshift(inst);
        p.currentInstanceId = inst.id;
        tasksChanged = true;
        plannedChanged = true;
      }
    });

    if (plannedChanged) savePlanned();
    if (tasksChanged) {
      save();
      render();
    }
  }

  /* ---------- Acciones ---------- */
  function addTask(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    tasks.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      text: trimmed,
      done: false,
      starred: false,
    });
    save();
    render();
  }

  function toggleTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (task) {
      task.done = !task.done;
      if (task.done) {
        task.completedAt = todayISO();
        task.starred = false; // al completar, deja de estar destacada
      } else {
        delete task.completedAt;
      }
      save();
      render();
    }
  }

  function toggleStar(id) {
    const task = tasks.find((t) => t.id === id);
    if (task) {
      task.starred = !task.starred;
      save();
      render();
    }
  }

  function deleteTask(id) {
    // Si es una copia de una planificada, registra el despeje por eliminación
    const task = tasks.find((t) => t.id === id);
    if (task && task.sourcePlannedId) {
      const p = planned.find((pp) => pp.id === task.sourcePlannedId);
      if (p && p.currentInstanceId === id) {
        p.lastClearedAt = todayISO();
        p.currentInstanceId = null;
        savePlanned();
      }
    }
    tasks = tasks.filter((t) => t.id !== id);
    save();
    render();
  }

  function clearDone() {
    tasks = tasks.filter((t) => !t.done);
    save();
    render();
  }

  function setNote(id, note) {
    const task = tasks.find((t) => t.id === id);
    if (task) {
      task.note = note;
      save();
    }
  }

  /* ---------- Vista de detalle ---------- */
  const overlay = document.getElementById("detail-overlay");
  const detailClose = document.getElementById("detail-close");
  const detailTitle = document.getElementById("detail-title");
  const detailNote = document.getElementById("detail-note");
  const detailCheck = document.getElementById("detail-check");
  const detailDelete = document.getElementById("detail-delete");
  const detailTaskFields = document.getElementById("detail-task-fields");
  const detailSubtasks = document.getElementById("detail-subtasks");
  const subtaskForm = document.getElementById("subtask-form");
  const subtaskInput = document.getElementById("subtask-input");
  let openPlannedId = null; // id de la planificada abierta en el modal (solo nota)
  const dateMode = document.getElementById("detail-date-mode");
  const dateFields = document.getElementById("date-fields");
  const dateStart = document.getElementById("date-start");
  const dateEnd = document.getElementById("date-end");
  const dateSep = document.getElementById("date-sep");
  const detailRepeatSection = document.getElementById("detail-repeat-section");
  const repeatMode = document.getElementById("detail-repeat-mode");
  const repeatDayWrap = document.getElementById("repeat-day-wrap");
  const repeatDay = document.getElementById("detail-repeat-day");
  const repeatYearWrap = document.getElementById("repeat-year-wrap");
  const repeatMonth = document.getElementById("detail-repeat-month");
  const repeatDom = document.getElementById("detail-repeat-dom");
  const repeatBiennialWrap = document.getElementById("repeat-biennial-wrap");
  const repeatStart = document.getElementById("detail-repeat-start");
  let openTaskId = null;

  function getOpenTask() {
    return tasks.find((t) => t.id === openTaskId) || null;
  }

  // Entidad abierta en el modal: tarea o planificada
  function getOpenEntity() {
    if (openTaskId !== null) return tasks.find((t) => t.id === openTaskId) || null;
    if (openPlannedId !== null)
      return planned.find((p) => p.id === openPlannedId) || null;
    return null;
  }
  function saveOpen() {
    if (openTaskId !== null) save();
    else if (openPlannedId !== null) savePlanned();
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  // Día de la semana de una fecha ISO: 1=Lunes … 7=Domingo
  function dowOf(iso) {
    const p = iso.split("-").map(Number);
    const wd = new Date(p[0], p[1] - 1, p[2]).getDay(); // 0=Dom … 6=Sáb
    return wd === 0 ? 7 : wd;
  }
  function addDaysISO(iso, n) {
    const p = iso.split("-").map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    d.setDate(d.getDate() + n);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }
  // Primera fecha con ese día de la semana (1..7), en o después de `iso`
  function firstOccurrenceOnOrAfter(iso, day) {
    const target = Number(day);
    let cur = iso;
    for (let i = 0; i < 7; i++) {
      if (dowOf(cur) === target) return cur;
      cur = addDaysISO(cur, 1);
    }
    return cur;
  }
  // Primera ocurrencia estrictamente posterior a `iso`
  function firstOccurrenceAfter(iso, day) {
    return firstOccurrenceOnOrAfter(addDaysISO(iso, 1), day);
  }

  const MONTH_NAMES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  function pad2(n) {
    return String(n).padStart(2, "0");
  }
  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate(); // month 1-12 → día 0 del siguiente
  }
  // Fecha anual (mes 1-12, día 1-31). Recorta el día al máximo del mes de ese
  // año (así 29-feb en año no bisiesto pasa a 28-feb).
  function yearlyDateISO(year, month, dom) {
    const d = Math.min(dom, daysInMonth(year, month));
    return year + "-" + pad2(month) + "-" + pad2(d);
  }
  function yearlyOccurrenceOnOrAfter(iso, month, dom) {
    const y = Number(iso.split("-")[0]);
    const cand = yearlyDateISO(y, month, dom);
    return cand >= iso ? cand : yearlyDateISO(y + 1, month, dom);
  }
  function yearlyOccurrenceAfter(iso, month, dom) {
    return yearlyOccurrenceOnOrAfter(addDaysISO(iso, 1), month, dom);
  }

  // Ocurrencias cada 2 años a partir de `start` (mismo día/mes, año +2k).
  function biennialOccurrenceOnOrAfter(iso, start) {
    const sp = start.split("-").map(Number);
    const startY = sp[0];
    const m = sp[1];
    const d = sp[2];
    const isoY = Number(iso.split("-")[0]);
    // Empezamos un par de pasos antes del año de `iso` y avanzamos de 2 en 2.
    let k = Math.floor((isoY - startY) / 2) - 1;
    if (k < 0) k = 0;
    for (let i = 0; i < 10000; i++) {
      const cand = yearlyDateISO(startY + 2 * k, m, d);
      if (cand >= iso) return cand;
      k++;
    }
    return yearlyDateISO(startY + 2 * k, m, d);
  }
  function biennialOccurrenceAfter(iso, start) {
    return biennialOccurrenceOnOrAfter(addDaysISO(iso, 1), start);
  }

  // Suma n meses a una fecha ISO, recortando el día al máximo del mes destino.
  function addMonthsISO(iso, n) {
    const p = iso.split("-").map(Number);
    const total = p[1] - 1 + n; // mes base 0 acumulado
    const y = p[0] + Math.floor(total / 12);
    const m = ((total % 12) + 12) % 12 + 1; // 1-12
    const d = Math.min(p[2], daysInMonth(y, m));
    return y + "-" + pad2(m) + "-" + pad2(d);
  }

  // Ocurrencias cada 3 meses a partir de `start`.
  function quarterlyOccurrenceOnOrAfter(iso, start) {
    const sp = start.split("-").map(Number);
    const ip = iso.split("-").map(Number);
    const monthsDiff = (ip[0] - sp[0]) * 12 + (ip[1] - sp[1]);
    let k = Math.floor(monthsDiff / 3) - 1;
    if (k < 0) k = 0;
    for (let i = 0; i < 10000; i++) {
      const cand = addMonthsISO(start, 3 * k);
      if (cand >= iso) return cand;
      k++;
    }
    return addMonthsISO(start, 3 * k);
  }
  function quarterlyOccurrenceAfter(iso, start) {
    return quarterlyOccurrenceOnOrAfter(addDaysISO(iso, 1), start);
  }

  // Siguiente ocurrencia de una planificada (semanal, anual o cada dos años)
  function plannedNextOccurrence(p, boundary, after) {
    if (p.repeat === "weekly") {
      return after
        ? firstOccurrenceAfter(boundary, p.repeatDay)
        : firstOccurrenceOnOrAfter(boundary, p.repeatDay);
    }
    if (p.repeat === "yearly") {
      return after
        ? yearlyOccurrenceAfter(boundary, p.repeatMonth, p.repeatDom)
        : yearlyOccurrenceOnOrAfter(boundary, p.repeatMonth, p.repeatDom);
    }
    if (p.repeat === "biennial") {
      return after
        ? biennialOccurrenceAfter(boundary, p.repeatStart)
        : biennialOccurrenceOnOrAfter(boundary, p.repeatStart);
    }
    if (p.repeat === "quarterly") {
      return after
        ? quarterlyOccurrenceAfter(boundary, p.repeatStart)
        : quarterlyOccurrenceOnOrAfter(boundary, p.repeatStart);
    }
    return null;
  }

  // Migración puntual: las tareas ya completadas antes de guardar la fecha de
  // completado reciben el 25/07/2026. Idempotente (solo afecta a las que no
  // tienen fecha; las nuevas siempre la guardan). Se puede retirar más adelante.
  const LEGACY_COMPLETED_DATE = "2026-07-25";
  function backfillCompletedDates() {
    let changed = false;
    tasks.forEach((t) => {
      if (t.done && !t.completedAt) {
        t.completedAt = LEGACY_COMPLETED_DATE;
        changed = true;
      }
    });
    return changed;
  }

  /* ---------- Subtareas ---------- */
  function renderSubtasks(task) {
    detailSubtasks.innerHTML = "";
    const subs = task.subtasks || [];
    subs.forEach((sub) => {
      const li = document.createElement("li");
      li.className = "subtask-item" + (sub.done ? " is-done" : "");

      const check = document.createElement("input");
      check.type = "checkbox";
      check.className = "subtask-check task-check";
      check.checked = sub.done;
      check.setAttribute("aria-label", "Completar subtarea");
      check.addEventListener("change", () => toggleSubtask(sub.id));

      const span = document.createElement("span");
      span.className = "subtask-text";
      span.textContent = sub.text;

      const del = document.createElement("button");
      del.type = "button";
      del.className = "subtask-del";
      del.textContent = "×";
      del.setAttribute("aria-label", "Eliminar subtarea");
      del.addEventListener("click", () => deleteSubtask(sub.id));

      li.append(check, span, del);
      detailSubtasks.appendChild(li);
    });
  }

  function addSubtask(text) {
    const trimmed = text.trim();
    const task = getOpenTask();
    if (!trimmed || !task) return;
    if (!task.subtasks) task.subtasks = [];
    task.subtasks.push({ id: newId(), text: trimmed, done: false });
    save();
    renderSubtasks(task);
  }

  function toggleSubtask(subId) {
    const task = getOpenTask();
    if (!task || !task.subtasks) return;
    const sub = task.subtasks.find((s) => s.id === subId);
    if (sub) {
      sub.done = !sub.done;
      save();
      renderSubtasks(task);
    }
  }

  function deleteSubtask(subId) {
    const task = getOpenTask();
    if (!task || !task.subtasks) return;
    task.subtasks = task.subtasks.filter((s) => s.id !== subId);
    save();
    renderSubtasks(task);
  }

  subtaskForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addSubtask(subtaskInput.value);
    subtaskInput.value = "";
    subtaskInput.focus();
  });

  /* ---------- Fecha de la tarea ---------- */
  function renderDate(task) {
    const mode = task.dateMode || "none";
    dateMode.value = mode;
    dateStart.value = task.dateStart || "";
    dateEnd.value = task.dateEnd || "";
    // Muestra los campos según el modo:
    //  none    → ninguno
    //  before  → una fecha (límite máximo)
    //  from    → una fecha (a partir de)
    //  between → dos fechas
    dateFields.hidden = mode === "none";
    dateEnd.hidden = mode !== "between";
    dateSep.hidden = mode !== "between";
  }

  dateMode.addEventListener("change", () => {
    const task = getOpenTask();
    if (!task) return;
    task.dateMode = dateMode.value;
    if (task.dateMode === "none") {
      delete task.dateStart;
      delete task.dateEnd;
    } else if (task.dateMode !== "between") {
      delete task.dateEnd;
    }
    save();
    renderDate(task);
    render();
  });

  dateStart.addEventListener("change", () => {
    const task = getOpenTask();
    if (!task) return;
    task.dateStart = dateStart.value || undefined;
    save();
    render();
  });

  dateEnd.addEventListener("change", () => {
    const task = getOpenTask();
    if (!task) return;
    task.dateEnd = dateEnd.value || undefined;
    save();
    render();
  });

  /* ---------- Repetir ---------- */
  // Días que ofrece el selector según el mes (feb→29, meses de 30, resto 31)
  function daysInMonthForSelect(month) {
    const m = Number(month);
    if (m === 2) return 29;
    if (m === 4 || m === 6 || m === 9 || m === 11) return 30;
    return 31;
  }
  function populateDomOptions(month, selected) {
    const max = daysInMonthForSelect(month);
    repeatDom.innerHTML = "";
    for (let d = 1; d <= max; d++) {
      const opt = document.createElement("option");
      opt.value = String(d);
      opt.textContent = String(d);
      repeatDom.appendChild(opt);
    }
    repeatDom.value = String(Math.min(Number(selected) || 1, max));
  }

  function renderRepeat(entity) {
    const mode = entity.repeat || "never";
    repeatMode.value = mode;
    repeatDay.value = entity.repeatDay || "1";
    repeatMonth.value = String(entity.repeatMonth || 1);
    populateDomOptions(repeatMonth.value, entity.repeatDom || 1);
    repeatStart.value = entity.repeatStart || "";
    repeatDayWrap.hidden = mode !== "weekly"; // día de la semana → solo semanal
    repeatYearWrap.hidden = mode !== "yearly"; // mes + día → solo anual
    // Fecha de inicio: compartida por "cada dos años" y "trimestralmente"
    repeatBiennialWrap.hidden = !(mode === "biennial" || mode === "quarterly");
  }

  repeatMode.addEventListener("change", () => {
    const entity = getOpenEntity();
    if (!entity) return;
    entity.repeat = repeatMode.value;
    // Limpia la config de las otras frecuencias y fija la de la elegida
    delete entity.repeatDay;
    delete entity.repeatMonth;
    delete entity.repeatDom;
    delete entity.repeatStart;
    if (entity.repeat === "weekly") {
      entity.repeatDay = repeatDay.value || "1";
    } else if (entity.repeat === "yearly") {
      entity.repeatMonth = Number(repeatMonth.value) || 1;
      entity.repeatDom = Number(repeatDom.value) || 1;
    } else if (entity.repeat === "biennial" || entity.repeat === "quarterly") {
      entity.repeatStart = repeatStart.value || todayISO();
    }
    saveOpen();
    renderRepeat(entity);
  });

  repeatDay.addEventListener("change", () => {
    const entity = getOpenEntity();
    if (!entity) return;
    entity.repeatDay = repeatDay.value;
    saveOpen();
  });

  repeatMonth.addEventListener("change", () => {
    const entity = getOpenEntity();
    if (!entity) return;
    entity.repeatMonth = Number(repeatMonth.value) || 1;
    // Reajusta los días al mes (recorta el día si ya no cabe)
    populateDomOptions(repeatMonth.value, entity.repeatDom || repeatDom.value);
    entity.repeatDom = Number(repeatDom.value) || 1;
    saveOpen();
  });

  repeatDom.addEventListener("change", () => {
    const entity = getOpenEntity();
    if (!entity) return;
    entity.repeatDom = Number(repeatDom.value) || 1;
    saveOpen();
  });

  repeatStart.addEventListener("change", () => {
    const entity = getOpenEntity();
    if (!entity) return;
    entity.repeatStart = repeatStart.value || todayISO();
    saveOpen();
  });

  // Abre el modal con SOLO el campo nota, para una tarea planificada
  function openPlannedNote(id) {
    const item = planned.find((p) => p.id === id);
    if (!item) return;
    openTaskId = null;
    openPlannedId = id;
    detailCheck.hidden = true; // las planificadas no se completan
    detailTaskFields.hidden = true; // oculta fecha y subtareas (título sí se ve)
    detailDelete.hidden = false; // eliminar desde el modal
    detailTitle.value = item.text;
    detailTitle.classList.remove("is-done");
    renderRepeat(item);
    detailRepeatSection.hidden = false; // "Repetir" solo en planificadas
    detailNote.value = item.note || "";
    overlay.hidden = false;
    document.body.classList.add("no-scroll");
    autoGrow(detailTitle);
  }

  function openDetail(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    openPlannedId = null;
    detailCheck.hidden = false;
    detailTaskFields.hidden = false; // restaura los campos de tarea
    detailRepeatSection.hidden = true; // "Repetir" solo en planificadas
    detailDelete.hidden = false;
    openTaskId = id;
    detailTitle.value = task.text;
    detailTitle.classList.toggle("is-done", task.done);
    detailNote.value = task.note || "";
    detailCheck.checked = task.done;
    renderDate(task);
    renderSubtasks(task);
    subtaskInput.value = "";
    overlay.hidden = false;
    document.body.classList.add("no-scroll");
    // Ajusta la altura del título ya con el modal visible (si no, scrollHeight es 0)
    autoGrow(detailTitle);
  }

  function closeDetail() {
    // Guarda la nota al cerrar
    if (openTaskId !== null) {
      setNote(openTaskId, detailNote.value);
      render();
    } else if (openPlannedId !== null) {
      setPlannedNote(openPlannedId, detailNote.value);
      renderPlanned();
    }
    openTaskId = null;
    openPlannedId = null;
    overlay.hidden = true;
    document.body.classList.remove("no-scroll");
  }

  detailClose.addEventListener("click", closeDetail);

  detailDelete.addEventListener("click", () => {
    if (openTaskId !== null) {
      const task = tasks.find((t) => t.id === openTaskId);
      const label = task ? task.text : "esta tarea";
      if (!confirm('¿Eliminar "' + label + '"?')) return;
      const id = openTaskId;
      openTaskId = null; // evita que closeDetail intente guardar la nota
      overlay.hidden = true;
      document.body.classList.remove("no-scroll");
      deleteTask(id);
    } else if (openPlannedId !== null) {
      const item = planned.find((p) => p.id === openPlannedId);
      const label = item ? item.text : "esta tarea";
      if (!confirm('¿Eliminar "' + label + '"?')) return;
      const id = openPlannedId;
      openPlannedId = null;
      overlay.hidden = true;
      document.body.classList.remove("no-scroll");
      deletePlanned(id);
    }
  });

  overlay.addEventListener("click", (e) => {
    // Cerrar al tocar fuera del panel
    if (e.target === overlay) closeDetail();
  });

  detailNote.addEventListener("input", () => {
    if (openTaskId !== null) setNote(openTaskId, detailNote.value);
    else if (openPlannedId !== null) setPlannedNote(openPlannedId, detailNote.value);
  });

  function autoGrow(el) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  detailTitle.addEventListener("input", () => {
    autoGrow(detailTitle);
    const value = detailTitle.value.trim();
    if (!value) return; // no guardar vacío
    if (openTaskId !== null) {
      const task = getOpenTask();
      if (task) {
        task.text = value;
        save();
      }
    } else if (openPlannedId !== null) {
      setPlannedText(openPlannedId, value);
    }
  });

  // Enter confirma la edición en lugar de añadir un salto de línea
  detailTitle.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      detailTitle.blur();
    }
  });

  // Si se deja vacío, restaura el texto guardado al salir del campo
  detailTitle.addEventListener("blur", () => {
    if (detailTitle.value.trim()) return;
    if (openTaskId !== null) {
      const task = getOpenTask();
      if (task) {
        detailTitle.value = task.text;
        autoGrow(detailTitle);
      }
    } else if (openPlannedId !== null) {
      const item = planned.find((p) => p.id === openPlannedId);
      if (item) {
        detailTitle.value = item.text;
        autoGrow(detailTitle);
      }
    }
  });

  detailCheck.addEventListener("change", () => {
    if (openTaskId === null) return;
    toggleTask(openTaskId);
    const task = tasks.find((t) => t.id === openTaskId);
    detailTitle.classList.toggle("is-done", task && task.done);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) closeDetail();
  });

  /* ---------- Render ---------- */
  function formatDate(iso) {
    if (!iso) return "";
    const parts = iso.split("-");
    if (parts.length !== 3) return iso;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  // ¿La fecha (yyyy-mm-dd) ya ha llegado? (hoy es igual o posterior)
  function isReached(iso) {
    if (!iso) return false;
    const parts = iso.split("-");
    if (parts.length !== 3) return false;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.getTime() >= d.getTime();
  }

  // Construye el <li> de una tarea (se usa en la lista de pendientes y en la
  // de completadas).
  function createTaskItem(task) {
    const li = document.createElement("li");
    li.className =
      "task-item" +
      (task.done ? " is-done" : "") +
      (task.starred ? " is-starred" : "");
    li.dataset.id = task.id;

    // Etiqueta de la segunda línea y si lleva 🕑 delante ("A partir de …")
    let dateLabel = "";
    let showClock = false;
    if (task.done) {
      if (task.completedAt) {
        dateLabel = "Completada el " + formatDate(task.completedAt);
      }
    } else if (task.dateMode === "from" && task.dateStart) {
      dateLabel = "A partir de " + formatDate(task.dateStart);
      showClock = true;
    } else if (task.dateMode === "before" && task.dateStart) {
      dateLabel = "Antes de " + formatDate(task.dateStart);
    } else if (task.dateMode === "between") {
      if (task.dateStart && !isReached(task.dateStart)) {
        dateLabel = "A partir de " + formatDate(task.dateStart);
        showClock = true;
      } else if (task.dateEnd) {
        dateLabel = "Antes de " + formatDate(task.dateEnd);
      }
    }

    // Control de estado: siempre checkbox
    const control = document.createElement("input");
    control.type = "checkbox";
    control.className = "task-check";
    control.checked = task.done;
    control.setAttribute("aria-label", "Marcar como completada");
    control.addEventListener("change", () => toggleTask(task.id));

    const main = document.createElement("div");
    main.className = "task-main";
    main.addEventListener("click", () => openDetail(task.id));

    const span = document.createElement("span");
    span.className = "task-text";
    span.textContent = task.text;

    if (task.subtasks && task.subtasks.length) {
      const done = task.subtasks.filter((s) => s.done).length;
      const badge = document.createElement("span");
      badge.className = "subtask-badge";
      badge.setAttribute("aria-label", "Subtareas completadas");
      badge.textContent = "☑ " + done + "/" + task.subtasks.length;
      span.appendChild(badge);
    }

    main.appendChild(span);

    if (dateLabel) {
      const dateLine = document.createElement("span");
      dateLine.className = "task-date";
      dateLine.textContent = (showClock ? "🕑 " : "") + dateLabel;
      main.appendChild(dateLine);
    }

    const star = document.createElement("button");
    star.className = "star-btn";
    star.type = "button";
    star.setAttribute("aria-label", task.starred ? "Quitar destacado" : "Destacar tarea");
    star.setAttribute("aria-pressed", task.starred ? "true" : "false");
    star.textContent = task.starred ? "★" : "☆";
    star.addEventListener("click", () => toggleStar(task.id));

    li.append(control, main, star);
    return li;
  }

  // "Todos los lunes/martes/…" a partir del día guardado (1=Lunes … 7=Domingo)
  function repeatPhrase(day) {
    const names = {
      1: "lunes",
      2: "martes",
      3: "miércoles",
      4: "jueves",
      5: "viernes",
      6: "sábados",
      7: "domingos",
    };
    const n = names[Number(day)];
    return n ? "Todos los " + n : "";
  }

  function renderPlanned() {
    const container = document.getElementById("planned-list");
    const empty = document.getElementById("planned-empty");
    if (!container) return;
    container.innerHTML = "";
    planned.forEach((item) => {
      const li = document.createElement("li");
      li.className = "planned-item";
      li.dataset.id = item.id;
      // Pulsar la fila abre el modal (título + nota)
      li.addEventListener("click", () => openPlannedNote(item.id));

      const main = document.createElement("div");
      main.className = "planned-main";

      const text = document.createElement("span");
      text.className = "planned-text";
      text.textContent = item.text;
      main.appendChild(text);

      // Segunda línea con la repetición
      let repeatLine = "";
      if (item.repeat === "weekly" && item.repeatDay) {
        repeatLine = repeatPhrase(item.repeatDay);
      } else if (item.repeat === "yearly" && item.repeatMonth && item.repeatDom) {
        repeatLine =
          "Todos los " +
          item.repeatDom +
          " de " +
          MONTH_NAMES[Number(item.repeatMonth) - 1];
      } else if (item.repeat === "biennial" && item.repeatStart) {
        repeatLine = "Cada dos años desde el " + formatDate(item.repeatStart);
      } else if (item.repeat === "quarterly" && item.repeatStart) {
        repeatLine = "Cada tres meses desde el " + formatDate(item.repeatStart);
      }
      if (repeatLine) {
        const line = document.createElement("span");
        line.className = "task-date";
        line.textContent = repeatLine;
        main.appendChild(line);
      }

      li.append(main);
      container.appendChild(li);
    });
    if (empty) empty.hidden = planned.length !== 0;
  }

  function render() {
    // Pendientes (destacadas primero, orden estable) y completadas
    const pending = tasks
      .map((task, index) => ({ task, index }))
      .filter((e) => !e.task.done)
      .sort((a, b) => {
        if (a.task.starred !== b.task.starred) return a.task.starred ? -1 : 1;
        return a.index - b.index;
      })
      .map((e) => e.task);
    // Completadas: siempre por fecha de completado, la más reciente primero.
    // Las que no tengan fecha van al final.
    const done = tasks
      .filter((t) => t.done)
      .slice()
      .sort((a, b) => {
        const ca = a.completedAt || "";
        const cb = b.completedAt || "";
        if (ca === cb) return 0;
        return ca < cb ? 1 : -1;
      });

    list.innerHTML = "";
    pending.forEach((task) => list.appendChild(createTaskItem(task)));

    doneList.innerHTML = "";
    done.forEach((task) => doneList.appendChild(createTaskItem(task)));

    // Estado vacío (referido a las pendientes)
    emptyState.hidden = pending.length !== 0;

    // Sección de completadas (plegable, debajo de las pendientes)
    if (done.length === 0) doneVisible = false;
    doneSection.hidden = done.length === 0;
    doneList.hidden = !doneVisible;
    toggleDoneBtn.textContent =
      (doneVisible ? "Ocultar completadas" : "Mostrar completadas") +
      " (" + done.length + ")";

    // Resumen de la cabecera
    const remaining = pending.length;
    const total = tasks.length;
    if (total === 0) {
      summary.textContent = "Sin tareas todavía";
    } else if (remaining === 0) {
      summary.textContent = "¡Todo completado! 🎉";
    } else {
      summary.textContent =
        remaining + (remaining === 1 ? " tarea pendiente" : " tareas pendientes");
    }
  }

  /* ---------- Eventos ---------- */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    addTask(input.value);
    input.value = "";
    input.focus();
  });

  toggleDoneBtn.addEventListener("click", () => {
    doneVisible = !doneVisible;
    render();
  });

  clearDoneBtn.addEventListener("click", clearDone);

  /* ---------- Reordenar con drag & drop (ratón y táctil) ---------- */
  const LONG_PRESS_MS = 300; // mantener pulsado para empezar a arrastrar
  const MOVE_CANCEL_PX = 8; // si se mueve antes de tiempo, es scroll/tap
  let reorderDragging = false; // hay un arrastre activo (bloquea scroll táctil)

  // Habilita el reordenado por arrastre en una lista. Reutilizable:
  //  container → el <ul>
  //  itemClass → clase de cada elemento (debe tener dataset.id)
  //  getItems  → devuelve el array real a reordenar
  //  saveFn    → persiste tras reordenar
  function enableReorder(container, itemClass, getItems, saveFn) {
    let pressTimer = null;
    let dragEl = null;
    let dragging = false;
    let startX = 0;
    let startY = 0;

    function cancelPress() {
      clearTimeout(pressTimer);
      pressTimer = null;
    }

    function getDragAfterElement(y) {
      const items = [
        ...container.querySelectorAll("." + itemClass + ":not(.dragging)"),
      ];
      let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
      items.forEach((child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          closest = { offset: offset, element: child };
        }
      });
      return closest.element;
    }

    function startDrag(pointerId) {
      if (!dragEl) return;
      dragging = true;
      reorderDragging = true;
      dragEl.classList.add("dragging");
      try {
        if (pointerId != null) dragEl.setPointerCapture(pointerId);
      } catch (e) {
        /* algunos navegadores no lo permiten; no es crítico */
      }
    }

    function commitOrder() {
      // Reordena el array real según el orden del DOM (solo elementos visibles),
      // dejando en su sitio los que no estén en el DOM (por filtro).
      const items = getItems();
      const domIds = [...container.querySelectorAll("." + itemClass)].map(
        (li) => li.dataset.id
      );
      const domSet = new Set(domIds);
      const byId = {};
      items.forEach((t) => (byId[t.id] = t));
      const slots = [];
      items.forEach((t, i) => {
        if (domSet.has(t.id)) slots.push(i);
      });
      domIds.forEach((id, k) => {
        items[slots[k]] = byId[id];
      });
      saveFn();
    }

    function consumeClick(e) {
      e.stopPropagation();
      e.preventDefault();
    }

    function endDrag() {
      cancelPress();
      if (dragging) {
        dragging = false;
        reorderDragging = false;
        if (dragEl) dragEl.classList.remove("dragging");
        commitOrder();
        // Anula el "click" que el navegador dispara tras soltar (abriría el
        // detalle). Se auto-elimina al primer click o tras un breve margen.
        container.addEventListener("click", consumeClick, {
          capture: true,
          once: true,
        });
        setTimeout(() => {
          container.removeEventListener("click", consumeClick, true);
        }, 350);
      }
      dragEl = null;
    }

    container.addEventListener("pointerdown", (e) => {
      if (e.button && e.button !== 0) return; // solo botón principal
      const li = e.target.closest("." + itemClass);
      if (!li) return;
      dragEl = li;
      startX = e.clientX;
      startY = e.clientY;
      cancelPress();
      pressTimer = setTimeout(() => startDrag(e.pointerId), LONG_PRESS_MS);
    });

    container.addEventListener("pointermove", (e) => {
      if (!dragEl) return;
      if (!dragging) {
        // Movimiento antes del long-press → es scroll o tap, no arrastre
        if (
          Math.abs(e.clientY - startY) > MOVE_CANCEL_PX ||
          Math.abs(e.clientX - startX) > MOVE_CANCEL_PX
        ) {
          cancelPress();
        }
        return;
      }
      e.preventDefault();
      const after = getDragAfterElement(e.clientY);
      if (after == null) {
        container.appendChild(dragEl);
      } else if (after !== dragEl) {
        container.insertBefore(dragEl, after);
      }
    });

    container.addEventListener("pointerup", endDrag);
    container.addEventListener("pointercancel", endDrag);
  }

  enableReorder(list, "task-item", () => tasks, save);
  enableReorder(
    document.getElementById("planned-list"),
    "planned-item",
    () => planned,
    savePlanned
  );

  // Impide el scroll de la página mientras se arrastra con el dedo
  document.addEventListener(
    "touchmove",
    (e) => {
      if (reorderDragging) e.preventDefault();
    },
    { passive: false }
  );

  /* ---------- Navegación principal ---------- */
  const appNav = document.getElementById("app-nav");
  const navToggle = document.getElementById("nav-toggle");
  const navClose = document.getElementById("nav-close");

  function openNav() {
    appNav.classList.add("is-open");
    document.body.classList.add("no-scroll");
  }
  function closeNav() {
    appNav.classList.remove("is-open");
    document.body.classList.remove("no-scroll");
  }

  navToggle.addEventListener("click", openNav);
  navClose.addEventListener("click", closeNav);

  document.querySelectorAll(".app-nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      const view = item.dataset.view;
      document
        .querySelectorAll(".app-nav-item")
        .forEach((n) => n.classList.toggle("is-active", n === item));
      document.getElementById("view-tareas").hidden = view !== "tareas";
      document.getElementById("view-planificadas").hidden = view !== "planificadas";
      if (view === "planificadas") renderPlanned();
      closeNav(); // en móvil, cierra el menú al elegir
    });
  });

  /* ---------- Ajustes ---------- */
  const settingsBtn = document.getElementById("settings-btn");
  const settingsOverlay = document.getElementById("settings-overlay");
  const settingsClose = document.getElementById("settings-close");
  const settingsTitle = document.getElementById("settings-title");
  const exportBtn = document.getElementById("export-btn");
  const importBtn = document.getElementById("import-btn");
  const importFile = document.getElementById("import-file");

  const plannedForm = document.getElementById("planned-form");
  const plannedInput = document.getElementById("planned-input");

  function openSettings() {
    settingsOverlay.hidden = false;
    document.body.classList.add("no-scroll");
  }
  function closeSettings() {
    settingsOverlay.hidden = true;
    document.body.classList.remove("no-scroll");
  }

  plannedForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addPlanned(plannedInput.value);
    plannedInput.value = "";
    plannedInput.focus();
  });

  settingsBtn.addEventListener("click", openSettings);
  settingsClose.addEventListener("click", closeSettings);
  settingsOverlay.addEventListener("click", (e) => {
    if (e.target === settingsOverlay) closeSettings();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !settingsOverlay.hidden) closeSettings();
  });

  // Navegación entre pestañas del modal
  const settingsTabs = document.querySelectorAll(".settings-tab");
  const settingsSections = {
    datos: "tab-datos",
    sesion: "tab-sesion",
  };
  settingsTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const name = tab.dataset.tab;
      settingsTabs.forEach((t) => t.classList.toggle("is-active", t === tab));
      Object.keys(settingsSections).forEach((key) => {
        const el = document.getElementById(settingsSections[key]);
        if (el) el.hidden = key !== name;
      });
      settingsTitle.textContent = tab.textContent.trim();
    });
  });

  // Exportar: descarga un JSON con todas las tareas
  exportBtn.addEventListener("click", () => {
    const data = JSON.stringify(tasks, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tareas-" + todayISO() + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // Importar: reemplaza las tareas con las del archivo elegido
  importBtn.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", () => {
    const file = importFile.files && importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!Array.isArray(parsed)) {
          throw new Error("El archivo no contiene una lista de tareas.");
        }
        if (
          !confirm(
            "Esto reemplazará TODAS tus tareas actuales por las del archivo. ¿Continuar?"
          )
        ) {
          importFile.value = "";
          return;
        }
        // Garantiza que cada tarea tenga id (necesario para editar/reordenar)
        tasks = parsed.map((t) =>
          Object.assign({}, t, { id: t && t.id ? t.id : newId() })
        );
        save();
        render();
        closeSettings();
      } catch (err) {
        showError("Al importar: " + (err && err.message ? err.message : err));
      }
      importFile.value = "";
    };
    reader.onerror = () => showError("No se pudo leer el archivo.");
    reader.readAsText(file);
  });

  /* ---------- Arranque tras iniciar sesión ---------- */
  function loadLegacy() {
    // Migración: importa las tareas de la antigua versión con localStorage.
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  async function initLocal() {
    try {
      db = await openDB();
    } catch (e) {
      db = null;
    }
    let local = [];
    if (db) local = await idbGet(IDB_KEY);
    if (!local || !local.length) {
      const legacy = loadLegacy();
      if (legacy.length) {
        local = legacy;
        if (db) idbSet(IDB_KEY, local).catch(() => {});
      }
    }
    tasks = Array.isArray(local) ? local : [];
    if (backfillCompletedDates() && db) idbSet(IDB_KEY, tasks).catch(() => {});

    let localPlanned = [];
    if (db) localPlanned = await idbGet(IDB_KEY_PLANNED);
    planned = Array.isArray(localPlanned) ? localPlanned : [];

    render(); // pinta al instante con el respaldo local
    renderPlanned();
  }

  function startFirebaseSync() {
    fbReady = true;

    // La materialización de planificadas corre una sola vez, cuando ya han
    // llegado los primeros datos de la nube de tasks Y planned.
    let tasksSynced = false;
    let plannedSynced = false;
    let materializationDone = false;
    function maybeMaterialize() {
      if (tasksSynced && plannedSynced && !materializationDone) {
        materializationDone = true;
        runPlannedMaterialization();
      }
    }

    let first = true;
    const ref = fdb.ref(FB_ROOT + "/" + FB_KEY);
    ref.on(
      "value",
      (snap) => {
        const raw = snap.val();
        const remote = Array.isArray(raw)
          ? raw
          : raw
          ? Object.values(raw)
          : [];
        // Si la nube está vacía pero este dispositivo ya tiene datos, súbelos
        // para no perderlos (primera sincronización).
        if (first && remote.length === 0 && tasks.length > 0) {
          first = false;
          ref.set(tasks).catch(() => {});
          return;
        }
        first = false;
        tasks = remote;
        const migrated = backfillCompletedDates();
        if (db) idbSet(IDB_KEY, tasks).catch(() => {}); // respaldo local al día
        if (migrated) save(); // sube la migración a la nube
        clearError();
        render();
        tasksSynced = true;
        maybeMaterialize();
      },
      (err) =>
        showError("Al leer la nube: " + (err && err.message ? err.message : err))
    );

    // Segundo listener: tareas planificadas
    let firstP = true;
    const refP = fdb.ref(FB_ROOT + "/" + FB_KEY_PLANNED);
    refP.on(
      "value",
      (snap) => {
        const raw = snap.val();
        const remote = Array.isArray(raw) ? raw : raw ? Object.values(raw) : [];
        if (firstP && remote.length === 0 && planned.length > 0) {
          firstP = false;
          refP.set(planned).catch(() => {});
          return;
        }
        firstP = false;
        planned = remote;
        if (db) idbSet(IDB_KEY_PLANNED, planned).catch(() => {});
        clearError();
        renderPlanned();
        plannedSynced = true;
        maybeMaterialize();
      },
      (err) =>
        showError("Al leer la nube: " + (err && err.message ? err.message : err))
    );
  }

  async function startApp() {
    if (appStarted) return;
    appStarted = true;
    await initLocal(); // respaldo local → pinta ya
    startFirebaseSync(); // engancha la nube
  }

  /* ---------- Autenticación ---------- */
  fauth.onAuthStateChanged((user) => {
    const loading = document.getElementById("auth-loading");
    const loginOverlay = document.getElementById("login-overlay");
    const appRoot = document.getElementById("app-root");
    if (loading) loading.hidden = true;
    if (user) {
      if (loginOverlay) loginOverlay.hidden = true;
      if (appRoot) appRoot.hidden = false;
      const emailEl = document.getElementById("session-email");
      if (emailEl) emailEl.textContent = user.email || "";
      startApp();
    } else {
      if (loginOverlay) loginOverlay.hidden = false;
      if (appRoot) appRoot.hidden = true;
    }
  });

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const errorEl = document.getElementById("login-error");
    errorEl.textContent = "";
    try {
      await fauth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      errorEl.textContent = "Email o contraseña incorrectos";
    }
  });

  document.getElementById("logout-btn").addEventListener("click", () => {
    fauth.signOut().then(() => location.reload());
  });
})();
