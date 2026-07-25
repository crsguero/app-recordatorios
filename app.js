(function () {
  "use strict";

  const form = document.getElementById("task-form");
  const input = document.getElementById("task-input");
  const list = document.getElementById("task-list");
  const filters = document.getElementById("filters");
  const emptyState = document.getElementById("empty-state");
  const footer = document.getElementById("footer");
  const countRemaining = document.getElementById("count-remaining");
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
  let filter = "active"; // active | done

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
    planned.unshift({ id: newId(), text: trimmed });
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
      if (task.done) task.completedAt = todayISO();
      else delete task.completedAt;
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
  const detailSubtasks = document.getElementById("detail-subtasks");
  const subtaskForm = document.getElementById("subtask-form");
  const subtaskInput = document.getElementById("subtask-input");
  const dateMode = document.getElementById("detail-date-mode");
  const dateFields = document.getElementById("date-fields");
  const dateStart = document.getElementById("date-start");
  const dateEnd = document.getElementById("date-end");
  const dateSep = document.getElementById("date-sep");
  let openTaskId = null;

  function getOpenTask() {
    return tasks.find((t) => t.id === openTaskId) || null;
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

  function openDetail(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
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
    // Guarda la nota al cerrar y refresca la lista (para el indicador de nota)
    if (openTaskId !== null) {
      setNote(openTaskId, detailNote.value);
      render();
    }
    openTaskId = null;
    overlay.hidden = true;
    document.body.classList.remove("no-scroll");
  }

  detailClose.addEventListener("click", closeDetail);

  detailDelete.addEventListener("click", () => {
    if (openTaskId === null) return;
    const task = tasks.find((t) => t.id === openTaskId);
    const label = task ? task.text : "esta tarea";
    if (!confirm('¿Eliminar "' + label + '"?')) return;
    const id = openTaskId;
    openTaskId = null; // evita que closeDetail intente guardar la nota
    overlay.hidden = true;
    document.body.classList.remove("no-scroll");
    deleteTask(id);
  });

  overlay.addEventListener("click", (e) => {
    // Cerrar al tocar fuera del panel
    if (e.target === overlay) closeDetail();
  });

  detailNote.addEventListener("input", () => {
    if (openTaskId !== null) setNote(openTaskId, detailNote.value);
  });

  function autoGrow(el) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  detailTitle.addEventListener("input", () => {
    autoGrow(detailTitle);
    const task = getOpenTask();
    const value = detailTitle.value.trim();
    // Solo guarda si no queda vacío (evita tareas sin texto)
    if (task && value) {
      task.text = value;
      save();
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
    const task = getOpenTask();
    if (task && !detailTitle.value.trim()) {
      detailTitle.value = task.text;
      autoGrow(detailTitle);
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

  function visibleTasks() {
    let result = tasks;
    if (filter === "active") result = tasks.filter((t) => !t.done);
    else if (filter === "done") result = tasks.filter((t) => t.done);
    // Las destacadas primero; el orden relativo se mantiene (sort estable)
    return result
      .map((task, index) => ({ task, index }))
      .sort((a, b) => {
        if (a.task.starred !== b.task.starred) return a.task.starred ? -1 : 1;
        return a.index - b.index;
      })
      .map((entry) => entry.task);
  }

  function renderPlanned() {
    const container = document.getElementById("planned-list");
    const empty = document.getElementById("planned-empty");
    if (!container) return;
    container.innerHTML = "";
    planned.forEach((item) => {
      const li = document.createElement("li");
      li.className = "planned-item";

      const input = document.createElement("input");
      input.type = "text";
      input.className = "planned-input";
      input.value = item.text;
      input.setAttribute("aria-label", "Tarea planificada");
      input.addEventListener("input", () => setPlannedText(item.id, input.value));

      const del = document.createElement("button");
      del.type = "button";
      del.className = "planned-del";
      del.textContent = "🗑";
      del.setAttribute("aria-label", "Eliminar tarea planificada");
      del.addEventListener("click", () => deletePlanned(item.id));

      li.append(input, del);
      container.appendChild(li);
    });
    if (empty) empty.hidden = planned.length !== 0;
  }

  function render() {
    list.innerHTML = "";

    const visible = visibleTasks();

    visible.forEach((task) => {
      const li = document.createElement("li");
      li.className =
        "task-item" +
        (task.done ? " is-done" : "") +
        (task.starred ? " is-starred" : "");
      li.dataset.id = task.id;

      // Estado de la fecha: define la etiqueta de la segunda línea y si se
      // usa el reloj (🕑) en lugar del checkbox.
      //  from    → 🕑 + "A partir de [inicio]"
      //  before  → checkbox + "Antes de [inicio]"
      //  between → antes de la 1ª fecha: 🕑 + "A partir de [inicio]"
      //            una vez cumplida:      checkbox + "Antes de [fin]"
      let dateLabel = "";
      let useClock = false;
      if (task.done) {
        // Tarea completada: muestra la fecha en que se completó
        if (task.completedAt) {
          dateLabel = "Completada el " + formatDate(task.completedAt);
        }
      } else if (task.dateMode === "from" && task.dateStart) {
        dateLabel = "A partir de " + formatDate(task.dateStart);
        useClock = true;
      } else if (task.dateMode === "before" && task.dateStart) {
        dateLabel = "Antes de " + formatDate(task.dateStart);
      } else if (task.dateMode === "between") {
        if (task.dateStart && !isReached(task.dateStart)) {
          dateLabel = "A partir de " + formatDate(task.dateStart);
          useClock = true;
        } else if (task.dateEnd) {
          dateLabel = "Antes de " + formatDate(task.dateEnd);
        }
      }

      // Control de estado: reloj o checkbox según lo anterior
      let control;
      if (useClock) {
        control = document.createElement("button");
        control.type = "button";
        control.className = "task-clock";
        control.textContent = "🕑";
        control.setAttribute("aria-label", "Marcar como completada");
        control.addEventListener("click", () => toggleTask(task.id));
      } else {
        control = document.createElement("input");
        control.type = "checkbox";
        control.className = "task-check";
        control.checked = task.done;
        control.setAttribute("aria-label", "Marcar como completada");
        control.addEventListener("change", () => toggleTask(task.id));
      }

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

      // Segunda línea con la fecha
      if (dateLabel) {
        const dateLine = document.createElement("span");
        dateLine.className = "task-date";
        dateLine.textContent = dateLabel;
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
      list.appendChild(li);
    });

    // Estado vacío
    emptyState.hidden = visible.length !== 0;

    // Resumen y pie
    const remaining = tasks.filter((t) => !t.done).length;
    const total = tasks.length;

    if (total === 0) {
      summary.textContent = "Sin tareas todavía";
    } else if (remaining === 0) {
      summary.textContent = "¡Todo completado! 🎉";
    } else {
      summary.textContent =
        remaining + (remaining === 1 ? " tarea pendiente" : " tareas pendientes");
    }

    footer.hidden = total === 0;
    countRemaining.textContent =
      remaining + (remaining === 1 ? " pendiente" : " pendientes");
  }

  /* ---------- Eventos ---------- */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    addTask(input.value);
    input.value = "";
    input.focus();
  });

  filters.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    filter = btn.dataset.filter;
    document
      .querySelectorAll(".filter-btn")
      .forEach((b) => b.classList.toggle("is-active", b === btn));
    render();
  });

  clearDoneBtn.addEventListener("click", clearDone);

  /* ---------- Reordenar con drag & drop (ratón y táctil) ---------- */
  const LONG_PRESS_MS = 300; // mantener pulsado para empezar a arrastrar
  const MOVE_CANCEL_PX = 8; // si se mueve antes de tiempo, es scroll/tap

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
      ...list.querySelectorAll(".task-item:not(.dragging)"),
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
    dragEl.classList.add("dragging");
    try {
      if (pointerId != null) dragEl.setPointerCapture(pointerId);
    } catch (e) {
      /* algunos navegadores no lo permiten; no es crítico */
    }
  }

  function commitOrder() {
    // Reordena el array real según el orden actual del DOM (solo visibles),
    // manteniendo en su sitio las tareas no visibles por el filtro.
    const domIds = [...list.querySelectorAll(".task-item")].map(
      (li) => li.dataset.id
    );
    const domSet = new Set(domIds);
    const byId = {};
    tasks.forEach((t) => (byId[t.id] = t));

    const slots = [];
    tasks.forEach((t, i) => {
      if (domSet.has(t.id)) slots.push(i);
    });
    domIds.forEach((id, k) => {
      tasks[slots[k]] = byId[id];
    });
    save();
  }

  list.addEventListener("pointerdown", (e) => {
    if (e.button && e.button !== 0) return; // solo botón principal
    const li = e.target.closest(".task-item");
    if (!li) return;
    dragEl = li;
    startX = e.clientX;
    startY = e.clientY;
    cancelPress();
    pressTimer = setTimeout(() => startDrag(e.pointerId), LONG_PRESS_MS);
  });

  list.addEventListener("pointermove", (e) => {
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
      list.appendChild(dragEl);
    } else if (after !== dragEl) {
      list.insertBefore(dragEl, after);
    }
  });

  function consumeClick(e) {
    e.stopPropagation();
    e.preventDefault();
  }

  function endDrag() {
    cancelPress();
    if (dragging) {
      dragging = false;
      if (dragEl) dragEl.classList.remove("dragging");
      commitOrder();
      // Anula el "click" que el navegador dispara tras soltar (abriría el
      // detalle). Se auto-elimina al primer click o tras un breve margen.
      list.addEventListener("click", consumeClick, { capture: true, once: true });
      setTimeout(() => {
        list.removeEventListener("click", consumeClick, true);
      }, 350);
    }
    dragEl = null;
  }

  list.addEventListener("pointerup", endDrag);
  list.addEventListener("pointercancel", endDrag);

  // Impide el scroll de la página mientras se arrastra con el dedo
  document.addEventListener(
    "touchmove",
    (e) => {
      if (dragging) e.preventDefault();
    },
    { passive: false }
  );

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
    renderPlanned(); // asegura la lista al día al abrir
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
    planificadas: "tab-planificadas",
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
  }

  function startFirebaseSync() {
    fbReady = true;
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
