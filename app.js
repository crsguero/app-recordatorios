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

  // Vista Recados (segunda lista, misma funcionalidad sin planificadas auto)
  const recadosForm = document.getElementById("recados-form");
  const recadosInput = document.getElementById("recados-input");
  const recadosList = document.getElementById("recados-list");
  const recadosEmpty = document.getElementById("recados-empty");
  const recadosDoneSection = document.getElementById("recados-done-section");
  const recadosDoneList = document.getElementById("recados-done-list");
  const recadosToggleDone = document.getElementById("recados-toggle-done");
  const recadosClearDone = document.getElementById("recados-clear-done");
  const recadosSummary = document.getElementById("recados-summary");

  // Vista Pendientes (tercera lista, igual que Recados)
  const pendientesForm = document.getElementById("pendientes-form");
  const pendientesInput = document.getElementById("pendientes-input");
  const pendientesList = document.getElementById("pendientes-list");
  const pendientesEmpty = document.getElementById("pendientes-empty");
  const pendientesDoneSection = document.getElementById("pendientes-done-section");
  const pendientesDoneList = document.getElementById("pendientes-done-list");
  const pendientesToggleDone = document.getElementById("pendientes-toggle-done");
  const pendientesClearDone = document.getElementById("pendientes-clear-done");
  const pendientesSummary = document.getElementById("pendientes-summary");

  // Vista Rutinas: tareas automáticas (planificadas + lactancia)
  const rutinasList = document.getElementById("rutinas-list");
  const rutinasEmpty = document.getElementById("rutinas-empty");
  const rutinasDoneSection = document.getElementById("rutinas-done-section");
  const rutinasDoneList = document.getElementById("rutinas-done-list");
  const rutinasToggleDone = document.getElementById("rutinas-toggle-done");
  const rutinasClearDone = document.getElementById("rutinas-clear-done");
  const rutinasSummary = document.getElementById("rutinas-summary");

  /* ---------- Contextos de lista (Mis tareas / Recados) ----------
     Ambas listas comparten toda la lógica (render, modal, drag, completadas).
     Cada contexto sabe de qué array leer/escribir y en qué DOM pintar. */
  // Tareas y Rutinas comparten el mismo array `tasks`; se distinguen por filtro:
  //  - Tareas: solo las manuales (sin sourcePlannedId).
  //  - Rutinas: las automáticas (planificadas) + las externas de lactancia.
  const ctxTareas = {
    noun: "tarea",
    items: () => tasks,
    setItems: (v) => (tasks = v),
    save: () => save(),
    filter: (t) => !t.sourcePlannedId,
    listEl: list,
    doneListEl: doneList,
    emptyEl: emptyState,
    doneSectionEl: doneSection,
    toggleBtn: toggleDoneBtn,
    summaryEl: summary,
    doneVisible: false,
    plannedRank: false,
    // Filtro de las tabs: "all" | "starred" (destacadas) | "unstarred"
    tabsEl: document.getElementById("tareas-tabs"),
    starFilter: "all",
    emptyDefault: "No hay tareas aquí. ¡Añade una arriba! 🎉",
  };
  const ctxRutinas = {
    noun: "tarea",
    items: () => tasks,
    setItems: (v) => (tasks = v),
    save: () => save(),
    // "Cuanto antes" reúne: copias de rutinas + las tareas destacadas (★).
    // Las completadas pierden el destacado, así que salen solas de aquí.
    filter: (t) => !!t.sourcePlannedId || !!t.starred,
    listEl: rutinasList,
    doneListEl: rutinasDoneList,
    emptyEl: rutinasEmpty,
    doneSectionEl: rutinasDoneSection,
    toggleBtn: rutinasToggleDone,
    summaryEl: rutinasSummary,
    doneVisible: false,
    plannedRank: true,
    // Fuentes externas de Rutinas: App lactancia + App tareas (Cristina)
    externalPending: () => lactPending().concat(atareasPending()),
    externalDone: () => lactDone().concat(atareasDone()),
    // Recados destacados: objetos reales de `recados` (se pintan al final y
    // siguen siendo editables; sus acciones van a su lista de origen).
    extraPending: () => recados.filter((r) => r.starred && !r.done),
    // Etiqueta de procedencia: solo para las destacadas, no para las rutinas
    originOf: (t) => {
      if (t._lact || t._at || t.sourcePlannedId) return null;
      return recados.indexOf(t) !== -1 ? "Recados" : "Tareas";
    },
  };
  const ctxRecados = {
    noun: "recado",
    items: () => recados,
    setItems: (v) => (recados = v),
    save: () => saveRecados(),
    listEl: recadosList,
    doneListEl: recadosDoneList,
    emptyEl: recadosEmpty,
    doneSectionEl: recadosDoneSection,
    toggleBtn: recadosToggleDone,
    summaryEl: recadosSummary,
    doneVisible: false,
    plannedRank: false,
    tabsEl: document.getElementById("recados-tabs"),
    starFilter: "all",
    emptyDefault: "No hay recados aquí. ¡Añade uno arriba! 🎉",
  };
  const ctxPendientes = {
    noun: "tarea",
    items: () => pendientes,
    setItems: (v) => (pendientes = v),
    save: () => savePendientes(),
    listEl: pendientesList,
    doneListEl: pendientesDoneList,
    emptyEl: pendientesEmpty,
    doneSectionEl: pendientesDoneSection,
    toggleBtn: pendientesToggleDone,
    summaryEl: pendientesSummary,
    doneVisible: false,
    plannedRank: false,
  };

  // Busca una tarea por id en cualquiera de las listas. Las que están en
  // `tasks` van a Tareas o a Rutinas según si son automáticas (planificadas).
  function findTaskEntry(id) {
    let item = tasks.find((t) => t.id === id);
    if (item)
      return { item: item, ctx: item.sourcePlannedId ? ctxRutinas : ctxTareas };
    item = recados.find((t) => t.id === id);
    if (item) return { item: item, ctx: ctxRecados };
    item = pendientes.find((t) => t.id === id);
    if (item) return { item: item, ctx: ctxPendientes };
    return null;
  }

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
  const FB_KEY_RECADOS = "recados"; // recordatorios/recados = segunda lista
  const FB_KEY_PENDIENTES = "pendientes"; // recordatorios/pendientes = tercera lista
  const FB_KEY_HOY = "hoy"; // recordatorios/hoy = tareas del día (mañana/tarde)

  /* ---------- Integración con App lactancia (misma base de datos) ----------
     Mostramos en la lista "Tareas" las tareas de App lactancia (Mamá › Tareas),
     que viven en la raíz "lactancia". No son nuestras: solo las leemos y, al
     completar/borrar, reescribimos su nodo. lactancia ya escucha esos nodos y
     refleja el cambio solo. Esquema de cada tarea allí:
     { id, texto, hecha, creada, completada?, auto?, fecha?, desde?, banoFecha?, extra? } */
  const LACT_ROOT = "lactancia";
  const LACT_NODES = ["tareas-mama", "tareas-antes-extraccion"];
  let lactRaw = { "tareas-mama": [], "tareas-antes-extraccion": [] }; // copias vivas de la nube

  /* ---------- Integración con App tareas (misma base de datos) ----------
     App tareas (titulada "Rutinas") es dueña de la raíz: sus tareas están en el
     array raíz `tasks`. Mostramos en Rutinas las de la pestaña Cristina
     (owner === "cristina"; ausente = cristina) y, al completar/borrar, reescribimos
     ese array. App tareas ya lo escucha y refleja el cambio solo. Las tareas no
     tienen id estable: se identifican por su índice en el array vivo `atRaw`. */
  const AT_ROOT = "tasks";
  let atRaw = []; // copia viva del array raíz (ambos owners: cristina y fernando)

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
  const IDB_KEY_RECADOS = "recados";
  const IDB_KEY_PENDIENTES = "pendientes";
  const IDB_KEY_HOY = "hoy";
  let db = null;
  let fbReady = false; // true cuando Firebase está autenticado y escuchando
  let appStarted = false; // evita arrancar la app dos veces

  let tasks = [];
  let recados = []; // segunda lista (misma funcionalidad, sin planificadas auto)
  let pendientes = []; // tercera lista (igual que recados)
  let hoy = []; // tareas del día {id, text, section: <id sección>, done}
  // Secciones de Hoy. Las por defecto usan ids "manana"/"tarde" para no perder
  // los datos actuales (las tareas ya guardan esos ids en `section`).
  const HOY_DEFAULT_SECTIONS = [
    { id: "manana", name: "Mañana" },
    { id: "tarde", name: "Tarde" },
  ];
  const hoyDefaultSections = () =>
    HOY_DEFAULT_SECTIONS.map((s) => ({ id: s.id, name: s.name }));
  let hoySections = hoyDefaultSections();
  // Categorías de las tareas temporales (el color va en el CSS: .cat-<id>)
  const HOY_CATEGORIES = [
    { id: "hogar", name: "Hogar" },
    { id: "personal", name: "Personal" },
    { id: "salud", name: "Salud" },
    { id: "profesional", name: "Profesional" },
    { id: "relaciones", name: "Relaciones" },
    { id: "maternidad", name: "Maternidad" },
  ];
  let hoyDay = null; // día (ISO) al que pertenecen los estados "done" actuales
  let hoyReady = false; // true tras la primera sincronización de hoy
  let planned = []; // tareas planificadas (solo texto, sin completar)

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

  function saveRecados() {
    if (db) idbSet(IDB_KEY_RECADOS, recados).catch(() => {});
    if (fbReady) {
      fdb
        .ref(FB_ROOT + "/" + FB_KEY_RECADOS)
        .set(recados && recados.length ? recados : null)
        .catch((e) =>
          showError("Al sincronizar: " + (e && e.message ? e.message : e))
        );
    }
  }

  function savePendientes() {
    if (db) idbSet(IDB_KEY_PENDIENTES, pendientes).catch(() => {});
    if (fbReady) {
      fdb
        .ref(FB_ROOT + "/" + FB_KEY_PENDIENTES)
        .set(pendientes && pendientes.length ? pendientes : null)
        .catch((e) =>
          showError("Al sincronizar: " + (e && e.message ? e.message : e))
        );
    }
  }

  // ¿Hoy está "vacío"? (sin tareas y con las secciones por defecto). Sirve para
  // no persistir un objeto vacío y para el "first upload".
  function hoyIsEmpty() {
    if (hoy.length > 0) return false;
    if (hoySections.length !== HOY_DEFAULT_SECTIONS.length) return false;
    return hoySections.every(
      (s, i) =>
        s.id === HOY_DEFAULT_SECTIONS[i].id &&
        s.name === HOY_DEFAULT_SECTIONS[i].name
    );
  }

  // Almacena {day, sections, items}: el día resetea los "done" cada jornada.
  function saveHoy() {
    const payload = hoyIsEmpty()
      ? null
      : { day: hoyDay, sections: hoySections, items: hoy };
    if (db) idbSet(IDB_KEY_HOY, payload).catch(() => {});
    if (fbReady) {
      fdb
        .ref(FB_ROOT + "/" + FB_KEY_HOY)
        .set(payload)
        .catch((e) =>
          showError("Al sincronizar: " + (e && e.message ? e.message : e))
        );
    }
  }

  // Admite el formato antiguo (array o {day,items}) y el nuevo ({day,sections,items}).
  function parseHoy(raw) {
    const asArray = (v) =>
      Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : [];
    if (Array.isArray(raw)) {
      return { items: raw, day: null, sections: hoyDefaultSections() };
    }
    if (raw && typeof raw === "object") {
      const secs = asArray(raw.sections);
      return {
        items: asArray(raw.items),
        day: raw.day || null,
        sections: secs.length ? secs : hoyDefaultSections(),
      };
    }
    return { items: [], day: null, sections: hoyDefaultSections() };
  }

  // Resetea los estados "done" al cambiar de día (idempotente, sincronizado por
  // `hoyDay` para no pisar los checks hechos hoy en otro dispositivo).
  function resetHoyIfNewDay() {
    if (!hoyReady) return false;
    const today = todayISO();
    if (hoyDay === today) return false;
    let changed = false;
    hoy.forEach((h) => {
      // `lastDoneAt` NO se toca: es el histórico de la última compleción.
      delete h.prevDoneAt;
      if (h.done) {
        h.done = false;
        changed = true;
      }
    });
    hoyDay = today;
    saveHoy();
    return changed;
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
          // Backfill: copias creadas antes de existir occurrenceDate. La
          // ocurrencia se recalcula igual que cuando se creó (mismo boundary).
          if (!inst.occurrenceDate) {
            const occ = plannedNextOccurrence(
              p,
              p.lastClearedAt || p.createdAt,
              !!p.lastClearedAt
            );
            if (occ) {
              inst.occurrenceDate = occ;
              tasksChanged = true;
            }
          }
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

      // Inactiva → ¿toca crear una nueva copia? Si se saltaron varias
      // ocurrencias (app cerrada), se usa la MÁS ANTIGUA pendiente (firstOcc).
      const boundary = p.lastClearedAt || p.createdAt;
      const nextOcc = plannedNextOccurrence(p, boundary, !!p.lastClearedAt);

      if (nextOcc && nextOcc <= today) {
        const inst = {
          id: newId(),
          text: p.text,
          done: false,
          starred: false,
          sourcePlannedId: p.id,
          occurrenceDate: nextOcc, // fecha de la ocurrencia (2ª línea)
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
      renderTasksViews(); // las copias creadas viven en Rutinas
    }
  }

  /* ---------- Acciones ---------- */
  function addTaskTo(ctx, text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    ctx.items().unshift({
      id: newId(),
      text: trimmed,
      done: false,
      starred: false,
    });
    ctx.save();
    renderList(ctx);
  }

  function toggleTask(id) {
    const e = findTaskEntry(id);
    if (!e) return;
    const task = e.item;
    task.done = !task.done;
    if (task.done) {
      task.completedAt = todayISO();
      task.starred = false; // al completar, deja de estar destacada
    } else {
      delete task.completedAt;
    }
    e.ctx.save();
    renderAllLists();
  }

  function toggleStar(id) {
    const e = findTaskEntry(id);
    if (!e) return;
    e.item.starred = !e.item.starred;
    e.ctx.save();
    renderAllLists();
  }

  function deleteTask(id) {
    const e = findTaskEntry(id);
    if (!e) return;
    const task = e.item;
    // Si es una copia de una planificada, registra el despeje por eliminación
    if (task.sourcePlannedId) {
      const p = planned.find((pp) => pp.id === task.sourcePlannedId);
      if (p && p.currentInstanceId === id) {
        p.lastClearedAt = todayISO();
        p.currentInstanceId = null;
        savePlanned();
      }
    }
    e.ctx.setItems(e.ctx.items().filter((t) => t.id !== id));
    e.ctx.save();
    renderAllLists();
  }

  function clearDoneIn(ctx) {
    // Solo borra las completadas que pertenecen a esta vista (respeta el filtro,
    // ya que Tareas y Rutinas comparten el array `tasks`).
    const belongs = ctx.filter || (() => true);
    ctx.setItems(ctx.items().filter((t) => !(t.done && belongs(t))));
    ctx.save();
    renderAllLists();
  }

  function setNote(id, note) {
    const e = findTaskEntry(id);
    if (e) {
      e.item.note = note;
      e.ctx.save();
    }
  }

  /* ---------- Tareas de App lactancia (solo en la lista "Tareas") ---------- */
  // Traduce una tarea de lactancia al formato que usa esta app para pintar.
  // Horas de las 5 extracciones (mismo esquema que App lactancia).
  const TE_HORAS = ["3:00", "7:50", "12:40", "17:30", "22:10"];
  // Helpers de fecha equivalentes a los de lactancia (para los bylines).
  function diffDiasLact(isoA, isoB) {
    const a = new Date(isoA + "T00:00:00");
    const b = new Date(isoB + "T00:00:00");
    return Math.round((b - a) / 86400000);
  }
  function diasDesdeBano(fechaBano) {
    const d = diffDiasLact(fechaBano, todayISO());
    if (d <= 0) return "Hoy";
    return d === 1 ? "Hace 1 día" : "Hace " + d + " días";
  }
  function formatDayMesLact(fecha) {
    if (fecha === todayISO()) return "Hoy";
    if (fecha === addDaysISO(todayISO(), -1)) return "Ayer";
    const p = fecha.split("-").map(Number);
    const mes = new Date(p[0], p[1] - 1, p[2]).toLocaleDateString("es-ES", {
      month: "long",
    });
    return p[2] + " " + (mes.charAt(0).toUpperCase() + mes.slice(1));
  }
  // Byline como en lactancia: extracción ("Extracción N · hora") y "durante el
  // día" (baño: "Hace N días" pendiente / fecha completada; o fecha simple).
  function lactSubtitle(x, node) {
    if (node === "tareas-antes-extraccion" && x.extra) {
      const hora = TE_HORAS[x.extra - 1];
      return "Extracción " + x.extra + (hora ? " · " + hora : "");
    }
    if (node === "tareas-mama") {
      if (x.banoFecha) {
        return x.hecha ? formatDayMesLact(x.banoFecha) : diasDesdeBano(x.banoFecha);
      }
      if (x.fecha) return formatDayMesLact(x.fecha);
    }
    return "";
  }
  function lactToItem(x, node) {
    return {
      id: "lact:" + node + ":" + x.id, // id enrutable y único
      text: x.texto,
      done: !!x.hecha,
      completedAt: x.completada
        ? new Date(x.completada).toISOString().slice(0, 10)
        : undefined,
      subtitle: lactSubtitle(x, node), // 2ª línea (byline)
      _lact: { node: node, id: x.id }, // marca de origen + enrutado de escritura
    };
  }
  // Pendientes de lactancia: "antes de la extracción" primero, luego "durante el día"
  // (mismo criterio de visibilidad que la propia app lactancia).
  function lactPending() {
    const hoy = todayISO();
    const antes = (lactRaw["tareas-antes-extraccion"] || [])
      .filter((x) => !x.hecha)
      .map((x) => lactToItem(x, "tareas-antes-extraccion"));
    const mama = (lactRaw["tareas-mama"] || [])
      .filter((x) => !x.hecha && (!x.desde || x.desde <= hoy))
      .map((x) => lactToItem(x, "tareas-mama"));
    return antes.concat(mama);
  }
  // Completadas de lactancia (para la sección Completadas).
  function lactDone() {
    const out = [];
    LACT_NODES.forEach((node) =>
      (lactRaw[node] || [])
        .filter((x) => x.hecha)
        .forEach((x) => out.push(lactToItem(x, node)))
    );
    return out;
  }
  // Escribe de vuelta el array completo de un nodo de lactancia (optimista + nube).
  function writeLact(node, arr) {
    lactRaw[node] = arr;
    if (fbReady) {
      fdb
        .ref(LACT_ROOT + "/" + node)
        .set(arr && arr.length ? arr : null)
        .catch((e) =>
          showError("Al sincronizar lactancia: " + (e && e.message ? e.message : e))
        );
    }
    renderRutinas();
  }
  function toggleLactDone(ref) {
    const arr = (lactRaw[ref.node] || []).map((x) => x); // copia superficial del array
    const it = arr.find((x) => x.id === ref.id);
    if (!it) return;
    it.hecha = !it.hecha;
    it.completada = it.hecha ? Date.now() : null; // esquema de lactancia (ms)
    writeLact(ref.node, arr);
  }
  function deleteLact(ref) {
    writeLact(ref.node, (lactRaw[ref.node] || []).filter((x) => x.id !== ref.id));
  }

  /* ---------- Tareas de App tareas › Cristina (en Rutinas) ---------- */
  // Identidad por índice en el array vivo (App tareas no tiene ids estables).
  function atToItem(t, index) {
    return { id: "at:" + index, text: t.text, done: !!t.done, _at: { index: index } };
  }
  function atIsCristina(t) {
    return t && typeof t === "object" && (t.owner || "cristina") === "cristina";
  }
  function atareasPending() {
    const out = [];
    atRaw.forEach((t, i) => {
      if (atIsCristina(t) && !t.done) out.push(atToItem(t, i));
    });
    return out;
  }
  function atareasDone() {
    const out = [];
    atRaw.forEach((t, i) => {
      if (atIsCristina(t) && t.done) out.push(atToItem(t, i));
    });
    return out;
  }
  // Reescribe el array raíz completo de App tareas (conserva Fernando y todos los campos).
  function writeAt() {
    if (fbReady) {
      fdb
        .ref(AT_ROOT)
        .set(atRaw && atRaw.length ? atRaw : null)
        .catch((e) =>
          showError("Al sincronizar App tareas: " + (e && e.message ? e.message : e))
        );
    }
    renderRutinas();
  }
  function toggleAtDone(ref) {
    const t = atRaw[ref.index];
    if (!t) return;
    t.done = !t.done;
    writeAt();
  }
  function deleteAt(ref) {
    atRaw.splice(ref.index, 1);
    writeAt();
  }

  /* ---------- Vista de detalle ---------- */
  const overlay = document.getElementById("detail-overlay");
  const detailClose = document.getElementById("detail-close");
  const detailTitle = document.getElementById("detail-title");
  const detailNote = document.getElementById("detail-note");
  const detailCheck = document.getElementById("detail-check");
  const detailDelete = document.getElementById("detail-delete");
  const detailNoteLabel = document.querySelector(".detail-note-label");
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
  let openLactRef = null; // {node,id} si el modal muestra una tarea de lactancia
  let openAtRef = null; // {index} si el modal muestra una tarea de App tareas

  function getOpenTask() {
    const e = findTaskEntry(openTaskId);
    return e ? e.item : null;
  }
  function saveOpenTask() {
    const e = findTaskEntry(openTaskId);
    if (e) e.ctx.save();
  }
  function renderOpenTask() {
    const e = findTaskEntry(openTaskId);
    if (e) renderList(e.ctx);
  }

  // Entidad abierta en el modal: tarea (de cualquier lista) o planificada
  function getOpenEntity() {
    if (openTaskId !== null) return getOpenTask();
    if (openPlannedId !== null)
      return planned.find((p) => p.id === openPlannedId) || null;
    return null;
  }
  function saveOpen() {
    if (openTaskId !== null) saveOpenTask();
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
    saveOpenTask();
    renderSubtasks(task);
  }

  function toggleSubtask(subId) {
    const task = getOpenTask();
    if (!task || !task.subtasks) return;
    const sub = task.subtasks.find((s) => s.id === subId);
    if (sub) {
      sub.done = !sub.done;
      saveOpenTask();
      renderSubtasks(task);
    }
  }

  function deleteSubtask(subId) {
    const task = getOpenTask();
    if (!task || !task.subtasks) return;
    task.subtasks = task.subtasks.filter((s) => s.id !== subId);
    saveOpenTask();
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
    //  on      → una fecha (el día exacto)
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
    saveOpenTask();
    renderDate(task);
    renderOpenTask();
  });

  dateStart.addEventListener("change", () => {
    const task = getOpenTask();
    if (!task) return;
    task.dateStart = dateStart.value || undefined;
    saveOpenTask();
    renderOpenTask();
  });

  dateEnd.addEventListener("change", () => {
    const task = getOpenTask();
    if (!task) return;
    task.dateEnd = dateEnd.value || undefined;
    saveOpenTask();
    renderOpenTask();
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
    openLactRef = null;
    openAtRef = null;
    detailTitle.readOnly = false; // restaura edición del título
    detailNote.hidden = false; // restaura la nota
    if (detailNoteLabel) detailNoteLabel.hidden = false;
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

  // Tarea de App lactancia: modal en modo solo lectura (completar / eliminar).
  function openLactDetail(task) {
    openTaskId = null;
    openPlannedId = null;
    openAtRef = null;
    openLactRef = task._lact;
    detailCheck.hidden = false;
    detailCheck.checked = task.done;
    detailTitle.value = task.text;
    detailTitle.classList.toggle("is-done", task.done);
    detailTitle.readOnly = true; // el texto se edita en App lactancia
    detailTaskFields.hidden = true; // sin fecha ni subtareas
    detailRepeatSection.hidden = true;
    detailNote.hidden = true; // sin nota
    if (detailNoteLabel) detailNoteLabel.hidden = true;
    detailDelete.hidden = false;
    overlay.hidden = false;
    document.body.classList.add("no-scroll");
    autoGrow(detailTitle);
  }

  // Tarea de App tareas (Cristina): modal en modo solo lectura (completar / eliminar).
  function openAtDetail(task) {
    openTaskId = null;
    openPlannedId = null;
    openLactRef = null;
    openAtRef = task._at;
    detailCheck.hidden = false;
    detailCheck.checked = task.done;
    detailTitle.value = task.text;
    detailTitle.classList.toggle("is-done", task.done);
    detailTitle.readOnly = true; // el texto se edita en App tareas
    detailTaskFields.hidden = true; // sin fecha ni subtareas
    detailRepeatSection.hidden = true;
    detailNote.hidden = true; // sin nota
    if (detailNoteLabel) detailNoteLabel.hidden = true;
    detailDelete.hidden = false;
    overlay.hidden = false;
    document.body.classList.add("no-scroll");
    autoGrow(detailTitle);
  }

  function openDetail(id) {
    const e = findTaskEntry(id);
    if (!e) return;
    const task = e.item;
    openPlannedId = null;
    openLactRef = null;
    openAtRef = null;
    detailCheck.hidden = false;
    detailTitle.readOnly = false; // restaura edición del título
    detailNote.hidden = false; // restaura la nota
    if (detailNoteLabel) detailNoteLabel.hidden = false;
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
      renderOpenTask();
    } else if (openPlannedId !== null) {
      setPlannedNote(openPlannedId, detailNote.value);
      renderPlanned();
    }
    openTaskId = null;
    openPlannedId = null;
    openLactRef = null;
    openAtRef = null;
    overlay.hidden = true;
    document.body.classList.remove("no-scroll");
  }

  detailClose.addEventListener("click", closeDetail);

  detailDelete.addEventListener("click", () => {
    if (openLactRef) {
      const ref = openLactRef;
      if (!confirm("¿Eliminar esta tarea?")) return;
      openLactRef = null;
      overlay.hidden = true;
      document.body.classList.remove("no-scroll");
      deleteLact(ref);
      return;
    }
    if (openAtRef) {
      const ref = openAtRef;
      if (!confirm("¿Eliminar esta tarea?")) return;
      openAtRef = null;
      overlay.hidden = true;
      document.body.classList.remove("no-scroll");
      deleteAt(ref);
      return;
    }
    if (openTaskId !== null) {
      const task = getOpenTask();
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
        saveOpenTask();
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
    if (openLactRef) {
      toggleLactDone(openLactRef);
      detailTitle.classList.toggle("is-done", detailCheck.checked);
      return;
    }
    if (openAtRef) {
      toggleAtDone(openAtRef);
      detailTitle.classList.toggle("is-done", detailCheck.checked);
      return;
    }
    if (openTaskId === null) return;
    toggleTask(openTaskId);
    const task = getOpenTask();
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

  // Igual que formatDate pero devuelve "hoy" / "mañana" / "ayer" si aplica.
  function formatDateRel(iso) {
    if (!iso) return "";
    const today = todayISO();
    if (iso === today) return "hoy";
    if (iso === addDaysISO(today, 1)) return "mañana";
    if (iso === addDaysISO(today, -1)) return "ayer";
    return formatDate(iso);
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
  // de completadas). `origin` (opcional): etiqueta de procedencia, p. ej.
  // "Tareas" o "Recados", para las destacadas que se agrupan en Cuanto antes.
  function createTaskItem(task, origin) {
    const li = document.createElement("li");
    li.className =
      "task-item" +
      (task.done ? " is-done" : "") +
      (task.starred ? " is-starred" : "") +
      // Con procedencia (Cuanto antes): sin color de fondo
      (origin ? " has-origin" : "") +
      (task.sourcePlannedId ? " is-planned" : "") +
      (task._lact ? " is-lact" : "") +
      (task._at ? " is-at" : "");
    li.dataset.id = task.id;

    // Etiqueta de la segunda línea y si lleva 🕑 delante ("A partir de …")
    let dateLabel = "";
    let showClock = false;
    if (task._lact) {
      // Tarea de lactancia: su byline (p. ej. "Extracción 2 · 12:40")
      dateLabel = task.subtitle || "";
    } else if (task.done) {
      if (task.completedAt) {
        const rel = formatDateRel(task.completedAt);
        // "Completada hoy/ayer" en lugar de "Completada el hoy/ayer"
        dateLabel =
          rel === "hoy" || rel === "mañana" || rel === "ayer"
            ? "Completada " + rel
            : "Completada el " + rel;
      }
    } else if (task.dateMode === "on" && task.dateStart) {
      // Día concreto: se muestra la fecha tal cual (hoy / mañana / 5 sept 2026)
      const rel = formatDateRel(task.dateStart);
      dateLabel = rel.charAt(0).toUpperCase() + rel.slice(1);
    } else if (
      task.dateMode === "from" &&
      task.dateStart &&
      !isReached(task.dateStart)
    ) {
      // "A partir de" solo mientras no se haya cumplido la fecha
      dateLabel = "A partir de " + formatDateRel(task.dateStart);
      showClock = true;
    } else if (task.dateMode === "before" && task.dateStart) {
      dateLabel = "Antes de " + formatDateRel(task.dateStart);
    } else if (task.dateMode === "between") {
      if (task.dateStart && !isReached(task.dateStart)) {
        dateLabel = "A partir de " + formatDateRel(task.dateStart);
        showClock = true;
      } else if (task.dateEnd) {
        dateLabel = "Antes de " + formatDateRel(task.dateEnd);
      }
    } else if (task.occurrenceDate) {
      // Tarea generada por una planificada: solo la fecha de la ocurrencia
      const rel = formatDateRel(task.occurrenceDate);
      dateLabel = rel.charAt(0).toUpperCase() + rel.slice(1);
    }

    // Control de estado: siempre checkbox
    const control = document.createElement("input");
    control.type = "checkbox";
    control.className = "task-check";
    control.checked = task.done;
    control.setAttribute("aria-label", "Marcar como completada");
    control.addEventListener("change", () =>
      task._lact
        ? toggleLactDone(task._lact)
        : task._at
        ? toggleAtDone(task._at)
        : toggleTask(task.id)
    );

    const main = document.createElement("div");
    main.className = "task-main";
    main.addEventListener("click", () =>
      task._lact
        ? openLactDetail(task)
        : task._at
        ? openAtDetail(task)
        : openDetail(task.id)
    );

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

    // 2ª línea: procedencia (Tareas / Recados) primero, luego la fecha
    const dateText = dateLabel ? (showClock ? "🕑 " : "") + dateLabel : "";
    if (origin || dateText) {
      const dateLine = document.createElement("span");
      dateLine.className = "task-date";
      if (origin) {
        // La procedencia va en el color de acento
        const originEl = document.createElement("span");
        originEl.className = "task-origin";
        originEl.textContent = origin;
        dateLine.appendChild(originEl);
        if (dateText) dateLine.appendChild(document.createTextNode(" · "));
      }
      if (dateText) dateLine.appendChild(document.createTextNode(dateText));
      main.appendChild(dateLine);
    }

    // Tarea generada por una planificada o de lactancia: indicador (no "Destacar")
    let trailing;
    if (task._lact) {
      trailing = document.createElement("span");
      trailing.className = "planned-indicator";
      trailing.textContent = "🍼";
      trailing.setAttribute("aria-label", "Tarea de lactancia");
      trailing.setAttribute("title", "Tarea de App lactancia");
    } else if (task._at) {
      trailing = document.createElement("span");
      trailing.className = "planned-indicator";
      trailing.textContent = "🏠";
      trailing.setAttribute("aria-label", "Tarea de App tareas");
      trailing.setAttribute("title", "Tarea de App tareas (Cristina)");
    } else if (task.sourcePlannedId) {
      trailing = document.createElement("span");
      trailing.className = "planned-indicator";
      trailing.textContent = "🔁";
      trailing.setAttribute("aria-label", "Rutina");
      trailing.setAttribute("title", "Rutina");
    } else {
      trailing = document.createElement("button");
      trailing.className = "star-btn";
      trailing.type = "button";
      trailing.setAttribute(
        "aria-label",
        task.starred ? "Quitar destacado" : "Destacar tarea"
      );
      trailing.setAttribute("aria-pressed", task.starred ? "true" : "false");
      trailing.textContent = task.starred ? "★" : "☆";
      trailing.addEventListener("click", () => toggleStar(task.id));
    }

    li.append(control, main, trailing);
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

  function renderList(ctx) {
    const items = ctx.filter ? ctx.items().filter(ctx.filter) : ctx.items();
    // Pendientes: con plannedRank, las copias de planificadas van primero; luego
    // las destacadas; luego el resto. Orden estable dentro de cada grupo.
    const rankOf = (t) =>
      ctx.plannedRank && t.sourcePlannedId ? 0 : t.starred ? 1 : 2;
    const pendingNativas = items
      .map((task, index) => ({ task, index }))
      .filter((e) => !e.task.done)
      .sort((a, b) => {
        const ra = rankOf(a.task);
        const rb = rankOf(b.task);
        if (ra !== rb) return ra - rb;
        return a.index - b.index;
      })
      .map((e) => e.task);
    // Tareas externas (App lactancia), agrupadas al principio de la lista.
    const extPending = ctx.externalPending ? ctx.externalPending() : [];
    const extDone = ctx.externalDone ? ctx.externalDone() : [];
    // Items de otra lista que se muestran aquí (recados destacados), al final.
    const extraPending = ctx.extraPending ? ctx.extraPending() : [];
    const pendingAll = extPending.concat(pendingNativas, extraPending);
    // Tabs (solo Mis tareas): filtran la lista de pendientes por destacada.
    // El resumen y las completadas siguen contando la lista entera.
    const pending =
      ctx.starFilter === "starred"
        ? pendingAll.filter((t) => !!t.starred)
        : ctx.starFilter === "unstarred"
        ? pendingAll.filter((t) => !t.starred)
        : pendingAll;
    // Completadas: por fecha de completado, la más reciente primero.
    const done = items
      .filter((t) => t.done)
      .concat(extDone)
      .slice()
      .sort((a, b) => {
        const ca = a.completedAt || "";
        const cb = b.completedAt || "";
        if (ca === cb) return 0;
        return ca < cb ? 1 : -1;
      });

    const originOf = (t) => (ctx.originOf ? ctx.originOf(t) : null);

    ctx.listEl.innerHTML = "";
    pending.forEach((task) =>
      ctx.listEl.appendChild(createTaskItem(task, originOf(task)))
    );

    ctx.doneListEl.innerHTML = "";
    done.forEach((task) =>
      ctx.doneListEl.appendChild(createTaskItem(task, originOf(task)))
    );

    ctx.emptyEl.hidden = pending.length !== 0;
    if (ctx.starFilter === "starred")
      ctx.emptyEl.textContent = "Nada urgente ahora mismo. 🎉";
    else if (ctx.starFilter === "unstarred")
      ctx.emptyEl.textContent = "Nada que dejar para luego. 🎉";
    else if (ctx.emptyDefault) ctx.emptyEl.textContent = ctx.emptyDefault;

    // Contador en cada tab (sobre las pendientes, sin filtrar)
    if (ctx.tabsEl) {
      const starred = pendingAll.filter((t) => !!t.starred).length;
      const counts = {
        all: pendingAll.length,
        starred: starred,
        unstarred: pendingAll.length - starred,
      };
      ctx.tabsEl.querySelectorAll(".task-tab").forEach((tab) => {
        const n = counts[tab.dataset.star] || 0;
        tab.textContent = tab.dataset.label + (n ? " (" + n + ")" : "");
        const active = tab.dataset.star === ctx.starFilter;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
      });
    }

    if (done.length === 0) ctx.doneVisible = false;
    ctx.doneSectionEl.hidden = done.length === 0;
    ctx.doneListEl.hidden = !ctx.doneVisible;
    const fem = ctx.noun === "recado" ? "os" : "as"; // completad-os/-as
    ctx.toggleBtn.textContent =
      (ctx.doneVisible ? "Ocultar completad" : "Mostrar completad") +
      fem +
      " (" + done.length + ")";

    const remaining = pendingAll.length;
    const total = pendingAll.length + done.length;
    const plural = ctx.noun + "s";
    if (total === 0) {
      ctx.summaryEl.textContent = "Sin " + plural + " todavía";
    } else if (remaining === 0) {
      ctx.summaryEl.textContent = "¡Todo completado! 🎉";
    } else {
      ctx.summaryEl.textContent =
        remaining +
        " " +
        (remaining === 1 ? ctx.noun : plural) +
        (remaining === 1 ? " pendiente" : " pendientes");
    }
  }

  function render() {
    renderList(ctxTareas);
  }
  // Una misma tarea puede verse en dos vistas (una destacada sale en Tareas o
  // Recados y también en Cuanto antes), así que las acciones repintan todas.
  function renderAllLists() {
    renderList(ctxTareas);
    renderList(ctxRutinas);
    renderList(ctxRecados);
    renderList(ctxPendientes);
  }
  function renderRutinas() {
    renderList(ctxRutinas);
  }
  // `tasks` alimenta tanto Tareas como Rutinas: repinta ambas.
  function renderTasksViews() {
    renderList(ctxTareas);
    renderList(ctxRutinas);
  }
  function renderRecados() {
    renderList(ctxRecados);
  }
  function renderPendientes() {
    renderList(ctxPendientes);
  }

  /* ---------- Eventos ---------- */
  // Tabs de Mis tareas y Recados (Todo / Cuanto antes / Cuando se pueda)
  [ctxTareas, ctxRecados].forEach((ctx) => {
    if (!ctx.tabsEl) return;
    ctx.tabsEl.addEventListener("click", (e) => {
      const tab = e.target.closest(".task-tab");
      if (!tab) return;
      ctx.starFilter = tab.dataset.star;
      renderList(ctx);
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    addTaskTo(ctxTareas, input.value);
    input.value = "";
    input.focus();
  });

  recadosForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addTaskTo(ctxRecados, recadosInput.value);
    recadosInput.value = "";
    recadosInput.focus();
  });

  pendientesForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addTaskTo(ctxPendientes, pendientesInput.value);
    pendientesInput.value = "";
    pendientesInput.focus();
  });

  toggleDoneBtn.addEventListener("click", () => {
    ctxTareas.doneVisible = !ctxTareas.doneVisible;
    renderList(ctxTareas);
  });
  recadosToggleDone.addEventListener("click", () => {
    ctxRecados.doneVisible = !ctxRecados.doneVisible;
    renderList(ctxRecados);
  });
  pendientesToggleDone.addEventListener("click", () => {
    ctxPendientes.doneVisible = !ctxPendientes.doneVisible;
    renderList(ctxPendientes);
  });
  rutinasToggleDone.addEventListener("click", () => {
    ctxRutinas.doneVisible = !ctxRutinas.doneVisible;
    renderList(ctxRutinas);
  });

  clearDoneBtn.addEventListener("click", () => clearDoneIn(ctxTareas));
  recadosClearDone.addEventListener("click", () => clearDoneIn(ctxRecados));
  pendientesClearDone.addEventListener("click", () => clearDoneIn(ctxPendientes));
  rutinasClearDone.addEventListener("click", () => clearDoneIn(ctxRutinas));

  /* ---------- Reordenar con drag & drop (ratón y táctil) ---------- */
  const LONG_PRESS_MS = 300; // mantener pulsado para empezar a arrastrar
  const MOVE_CANCEL_PX = 8; // si se mueve antes de tiempo, es scroll/tap
  let reorderDragging = false; // hay un arrastre activo (bloquea scroll táctil)

  // Habilita el reordenado por arrastre en una lista. Reutilizable:
  //  container → el <ul>
  //  itemClass → clase de cada elemento (debe tener dataset.id)
  //  getItems  → devuelve el array real a reordenar
  //  saveFn    → persiste tras reordenar
  // handleClass (opcional): si se pasa, el arrastre solo empieza desde ese "asa".
  function enableReorder(container, itemClass, getItems, saveFn, handleClass) {
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
      const byId = {};
      items.forEach((t) => (byId[t.id] = t));
      const domIds = [...container.querySelectorAll("." + itemClass)]
        .map((li) => li.dataset.id)
        .filter((id) => byId[id]); // ignora tareas externas (no están en el array real)
      const domSet = new Set(domIds);
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
      // Con asa, solo se arrastra desde ella (evita chocar con el arrastre anidado)
      if (handleClass && !e.target.closest("." + handleClass)) return;
      const li = e.target.closest("." + itemClass);
      if (!li) return;
      // Las tareas externas (App lactancia / App tareas) no se reordenan aquí
      if (
        li.dataset.id &&
        (li.dataset.id.indexOf("lact:") === 0 || li.dataset.id.indexOf("at:") === 0)
      )
        return;
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
  enableReorder(rutinasList, "task-item", () => tasks, save);
  enableReorder(recadosList, "task-item", () => recados, saveRecados);
  enableReorder(pendientesList, "task-item", () => pendientes, savePendientes);
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
  // Cada vista tiene su propio hash en la URL (#hoy, #tareas, …), para poder
  // enlazar/guardar un acceso directo que abra siempre esa pestaña.
  const VIEWS = [
    "hoy",
    "rutinas",
    "agenda",
    "tareas",
    "recados",
    "pendientes",
    "planificadas",
  ];

  let currentView = "tareas";

  function activateView(view) {
    if (VIEWS.indexOf(view) === -1) view = "tareas"; // por defecto
    currentView = view;
    document
      .querySelectorAll(".app-nav-item")
      .forEach((n) => n.classList.toggle("is-active", n.dataset.view === view));
    syncMobileTabs();
    VIEWS.forEach((v) => {
      const el = document.getElementById("view-" + v);
      if (el) el.hidden = v !== view;
    });
    if (view === "hoy") renderHoy();
    else if (view === "tareas") render();
    else if (view === "rutinas") renderRutinas();
    else if (view === "recados") renderRecados();
    else if (view === "pendientes") renderPendientes();
    else if (view === "planificadas") renderPlanned();
  }

  function viewFromHash() {
    return (location.hash || "").replace(/^#/, "");
  }

  // Abre una vista: deja el hash como estado y la activa ya (sin esperar al
  // evento hashchange, que es asíncrono).
  function goToView(view) {
    const target = "#" + view;
    if (location.hash !== target) location.hash = target;
    activateView(view);
  }

  document.querySelectorAll(".app-nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      const view = item.dataset.view;
      if (!view) return; // p. ej. el botón de Ajustes (no es una vista)
      goToView(view);
    });
  });

  window.addEventListener("hashchange", () => activateView(viewFromHash()));

  /* ---------- Navegación móvil: barra inferior + menú "Más" + botón ＋ ----------
     La barra tiene Hoy / Tareas / Agenda y un "Más" con el resto de vistas
     (Ajustes incluido). El botón "Tareas" abre la vista Cuanto antes; la lista
     completa de Mis tareas queda en "Más". El botón ＋ pregunta qué crear y lleva a esa lista con
     el campo de añadir enfocado. */
  const mobileTabbar = document.getElementById("mobile-tabbar");
  const moreMenu = document.getElementById("more-menu");
  const moreClose = document.getElementById("more-close");
  // Vistas que tienen botón propio en la barra ("Tareas" abre Cuanto antes)
  const BAR_VIEWS = ["hoy", "rutinas", "agenda"];

  // Resalta la pestaña activa; si la vista no está en la barra (o el menú está
  // abierto), el resaltado va en "Más".
  function syncMobileTabs() {
    if (!mobileTabbar) return;
    const moreOpen = moreMenu && !moreMenu.hidden;
    const inBar = BAR_VIEWS.indexOf(currentView) !== -1;
    mobileTabbar.querySelectorAll(".mtab").forEach((b) => {
      const active = b.dataset.more
        ? moreOpen || !inBar
        : !moreOpen && b.dataset.view === currentView;
      b.classList.toggle("is-active", active);
    });
  }

  function openMoreMenu() {
    moreMenu.hidden = false;
    syncMobileTabs();
  }
  function closeMoreMenu() {
    if (!moreMenu || moreMenu.hidden) return;
    moreMenu.hidden = true;
    syncMobileTabs();
  }

  if (mobileTabbar) {
    mobileTabbar.addEventListener("click", (e) => {
      const btn = e.target.closest(".mtab");
      if (!btn) return;
      if (btn.dataset.more) {
        if (moreMenu.hidden) openMoreMenu();
        else closeMoreMenu();
        return;
      }
      closeMoreMenu();
      goToView(btn.dataset.view);
    });
  }

  if (moreMenu) {
    moreClose.addEventListener("click", closeMoreMenu);
    moreMenu.addEventListener("click", (e) => {
      const item = e.target.closest(".menu-item");
      if (!item) return;
      closeMoreMenu();
      if (item.dataset.action === "settings") {
        openSettings();
        return;
      }
      goToView(item.dataset.view);
    });
  }

  /* ---------- Botón ＋ (crear) ---------- */
  const fabBtn = document.getElementById("fab-btn");
  const fabOverlay = document.getElementById("fab-overlay");
  const fabCancel = document.getElementById("fab-cancel");
  // Qué vista y qué campo de texto corresponde a cada opción
  const CREATE_INPUTS = {
    tareas: "task-input",
    recados: "recados-input",
    planificadas: "planned-input",
    pendientes: "pendientes-input",
  };

  function openFab() {
    fabOverlay.hidden = false;
  }
  function closeFab() {
    fabOverlay.hidden = true;
  }

  if (fabBtn) {
    fabBtn.addEventListener("click", openFab);
    fabCancel.addEventListener("click", closeFab);
    fabOverlay.addEventListener("click", (e) => {
      if (e.target === fabOverlay) {
        closeFab();
        return;
      }
      const choice = e.target.closest(".fab-choice");
      if (!choice) return;
      const view = choice.dataset.create;
      closeFab();
      closeMoreMenu();
      goToView(view);
      // El campo ya es visible (activateView es síncrona): enfocarlo abre el
      // teclado, al venir de un toque del usuario.
      const el = document.getElementById(CREATE_INPUTS[view]);
      if (el) el.focus();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (fabOverlay && !fabOverlay.hidden) closeFab();
    else closeMoreMenu();
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
  // Exportar: descarga un JSON con las tres listas y las planificadas
  exportBtn.addEventListener("click", () => {
    const payload = { tasks, recados, pendientes, planned };
    const data = JSON.stringify(payload, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recordatorios-" + todayISO() + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // Importar: reemplaza las listas presentes en el archivo
  importBtn.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", () => {
    const file = importFile.files && importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    const ensureId = (t) =>
      Object.assign({}, t, { id: t && t.id ? t.id : newId() });
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        // Formato nuevo: objeto con listas. Formato antiguo: array = solo tareas.
        let inTasks = null;
        let inRecados = null;
        let inPendientes = null;
        let inPlanned = null;
        if (Array.isArray(parsed)) {
          inTasks = parsed;
        } else if (parsed && typeof parsed === "object") {
          inTasks = Array.isArray(parsed.tasks) ? parsed.tasks : null;
          inRecados = Array.isArray(parsed.recados) ? parsed.recados : null;
          inPendientes = Array.isArray(parsed.pendientes)
            ? parsed.pendientes
            : null;
          inPlanned = Array.isArray(parsed.planned) ? parsed.planned : null;
        } else {
          throw new Error("El archivo no tiene un formato válido.");
        }
        if (
          !confirm(
            "Esto reemplazará las listas incluidas en el archivo (tareas, recados, pendientes y rutinas). ¿Continuar?"
          )
        ) {
          importFile.value = "";
          return;
        }
        if (inTasks) {
          tasks = inTasks.map(ensureId);
          save();
          renderTasksViews();
        }
        if (inRecados) {
          recados = inRecados.map(ensureId);
          saveRecados();
          renderRecados();
        }
        if (inPendientes) {
          pendientes = inPendientes.map(ensureId);
          savePendientes();
          renderPendientes();
        }
        if (inPlanned) {
          planned = inPlanned.map(ensureId);
          savePlanned();
          renderPlanned();
        }
        closeSettings();
      } catch (err) {
        showError("Al importar: " + (err && err.message ? err.message : err));
      }
      importFile.value = "";
    };
    reader.onerror = () => showError("No se pudo leer el archivo.");
    reader.readAsText(file);
  });

  /* ---------- Modal de Hoy (secciones dinámicas) ---------- */
  const hoyOverlay = document.getElementById("hoy-overlay");
  const hoySettingsBtn = document.getElementById("hoy-settings-btn");
  const hoyClose = document.getElementById("hoy-close");
  const hoySectionsEl = document.getElementById("hoy-sections");
  const hoyAddSectionBtn = document.getElementById("hoy-add-section");
  const hoyViewSectionsEl = document.getElementById("hoy-view-sections");

  // Clase de color según la categoría (solo si la tarea es temporal)
  function hoyCatClass(item) {
    return item.temporal && item.category ? " cat-" + item.category : "";
  }

  // Fila de tarea del modal: texto editable + toggle "Temporal" + categoría
  function hoyModalItem(item) {
    const li = document.createElement("li");
    li.className = "hoy-item" + hoyCatClass(item);
    li.dataset.id = item.id;

    const row = document.createElement("div");
    row.className = "hoy-item-row";

    const handle = document.createElement("span");
    handle.className = "hoy-item-handle";
    handle.textContent = "⠿";
    handle.setAttribute("aria-label", "Reordenar tarea");
    handle.title = "Arrastra para reordenar";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "hoy-item-input";
    input.value = item.text;
    input.setAttribute("aria-label", "Editar tarea");
    // Al escribir: solo memoria + vista (no guardar, para no reconstruir el
    // modal por el eco de Firebase y perder el foco). Se persiste al salir.
    input.addEventListener("input", () => {
      const v = input.value.trim();
      if (v) {
        item.text = v;
        renderHoyView();
      }
    });
    input.addEventListener("blur", () => {
      const v = input.value.trim();
      if (v) {
        item.text = v;
        saveHoy();
      } else {
        input.value = item.text;
      }
    });

    // Selector de categoría (visible solo cuando es temporal)
    const cat = document.createElement("select");
    cat.className = "hoy-cat-select";
    cat.setAttribute("aria-label", "Categoría");
    cat.hidden = !item.temporal;
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "Sin categoría";
    cat.appendChild(none);
    HOY_CATEGORIES.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      cat.appendChild(opt);
    });
    cat.value = item.category || "";
    cat.addEventListener("change", () => {
      item.category = cat.value || undefined;
      li.className = "hoy-item" + hoyCatClass(item);
      saveHoy();
      renderHoyView();
    });

    // Toggle "Temporal"
    const toggle = document.createElement("label");
    toggle.className = "hoy-switch";
    const tlabel = document.createElement("span");
    tlabel.className = "hoy-switch-text";
    tlabel.textContent = "Temporal";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!item.temporal;
    cb.setAttribute("aria-label", "Temporal");
    cb.addEventListener("change", () => {
      item.temporal = cb.checked;
      cat.hidden = !cb.checked;
      li.className = "hoy-item" + hoyCatClass(item);
      saveHoy();
      renderHoyView();
    });
    const slider = document.createElement("span");
    slider.className = "hoy-switch-slider";
    toggle.append(tlabel, cb, slider);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "hoy-del";
    del.textContent = "🗑";
    del.setAttribute("aria-label", "Eliminar");
    del.addEventListener("click", () => deleteHoy(item.id));

    // Toggle "Mostrar última fecha de completado" (2ª línea en la vista Hoy)
    const lastToggle = document.createElement("label");
    lastToggle.className = "hoy-switch hoy-switch-wide";
    const llabel = document.createElement("span");
    llabel.className = "hoy-switch-text";
    llabel.textContent = "Mostrar última fecha de completado";
    const lcb = document.createElement("input");
    lcb.type = "checkbox";
    lcb.checked = !!item.showLastDone;
    lcb.setAttribute("aria-label", "Mostrar última fecha de completado");
    lcb.addEventListener("change", () => {
      item.showLastDone = lcb.checked;
      saveHoy();
      renderHoyView();
    });
    const lslider = document.createElement("span");
    lslider.className = "hoy-switch-slider";
    lastToggle.append(llabel, lcb, lslider);

    row.append(handle, input, toggle, del);
    li.append(row, cat, lastToggle);
    return li;
  }

  // Recuerda/restaura el foco al reconstruir el modal (para no perderlo al
  // añadir una tarea, cuyo repintado recrea los campos).
  function hoyCaptureFocus() {
    const a = document.activeElement;
    if (!a || !hoySectionsEl.contains(a)) return null;
    const caret = typeof a.selectionStart === "number" ? a.selectionStart : null;
    if (a.classList.contains("hoy-section-name"))
      return { type: "name", section: a.dataset.section, caret: caret };
    if (a.classList.contains("hoy-add-input"))
      return { type: "add", section: a.dataset.section, caret: caret };
    if (a.classList.contains("hoy-item-input")) {
      const li = a.closest(".hoy-item");
      return { type: "item", id: li && li.dataset.id, caret: caret };
    }
    return null;
  }
  function hoyRestoreFocus(key) {
    if (!key) return;
    let el = null;
    if (key.type === "name")
      el = hoySectionsEl.querySelector(
        '.hoy-section-name[data-section="' + key.section + '"]'
      );
    else if (key.type === "add")
      el = hoySectionsEl.querySelector(
        '.hoy-add-input[data-section="' + key.section + '"]'
      );
    else if (key.type === "item") {
      const li = hoySectionsEl.querySelector(
        '.hoy-item[data-id="' + key.id + '"]'
      );
      el = li && li.querySelector(".hoy-item-input");
    }
    if (el) {
      el.focus();
      if (key.caret != null) {
        try {
          el.setSelectionRange(key.caret, key.caret);
        } catch (e) {
          /* algunos inputs no lo soportan */
        }
      }
    }
  }

  // Modal: una sección por cada elemento de `hoySections` (nombre editable,
  // añadir/eliminar tareas, eliminar sección y reordenar).
  function renderHoyModal() {
    if (!hoySectionsEl) return;
    const focusKey = hoyCaptureFocus();
    hoySectionsEl.innerHTML = "";
    hoySections.forEach((sec) => {
      const wrap = document.createElement("section");
      wrap.className = "hoy-section";
      wrap.dataset.id = sec.id;

      const form = document.createElement("form");
      form.className = "new-task hoy-add-form";
      form.autocomplete = "off";
      const addInput = document.createElement("input");
      addInput.type = "text";
      addInput.className = "task-input hoy-add-input";
      addInput.dataset.section = sec.id;
      addInput.maxLength = 200;
      addInput.placeholder = "Añadir a " + sec.name + "…";
      addInput.setAttribute("aria-label", "Nueva tarea");
      const addBtn = document.createElement("button");
      addBtn.type = "submit";
      addBtn.className = "add-btn";
      addBtn.textContent = "+";
      addBtn.setAttribute("aria-label", "Añadir");
      form.append(addInput, addBtn);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        addHoy(sec.id, addInput.value);
        addInput.value = "";
        addInput.focus();
      });

      const head = document.createElement("div");
      head.className = "hoy-section-head";
      const handle = document.createElement("span");
      handle.className = "hoy-section-handle";
      handle.textContent = "⠿";
      handle.setAttribute("aria-label", "Reordenar sección");
      handle.title = "Arrastra para reordenar";
      const name = document.createElement("input");
      name.type = "text";
      name.className = "hoy-section-name";
      name.dataset.section = sec.id;
      name.value = sec.name;
      name.maxLength = 60;
      name.setAttribute("aria-label", "Nombre de la sección");
      name.addEventListener("input", () => {
        const v = name.value.trim();
        if (v) {
          sec.name = v;
          addInput.placeholder = "Añadir a " + v + "…";
          renderHoyView();
        }
      });
      name.addEventListener("blur", () => {
        const v = name.value.trim();
        if (v) {
          sec.name = v;
          saveHoy();
        } else {
          name.value = sec.name;
        }
      });
      const delSec = document.createElement("button");
      delSec.type = "button";
      delSec.className = "hoy-section-del";
      delSec.textContent = "🗑";
      delSec.setAttribute("aria-label", "Eliminar sección");
      delSec.addEventListener("click", () => deleteSection(sec.id));
      head.append(handle, name, delSec);

      const ul = document.createElement("ul");
      ul.className = "hoy-list";
      hoy
        .filter((it) => it.section === sec.id)
        .forEach((it) => ul.appendChild(hoyModalItem(it)));

      wrap.append(head, form, ul);
      hoySectionsEl.appendChild(wrap);

      // Reordenar las tareas de la sección desde su asa (solo afecta a sus ítems)
      enableReorder(ul, "hoy-item", () => hoy, saveHoy, "hoy-item-handle");
    });
    hoyRestoreFocus(focusKey);
  }

  // Byline "Hace N días" a partir de la última fecha de completado.
  function hoyLastDoneLabel(iso) {
    if (!iso) return "Sin completar todavía";
    const d = diffDiasLact(iso, todayISO());
    if (d <= 0) return "Hoy";
    return d === 1 ? "Hace 1 día" : "Hace " + d + " días";
  }

  // Vista "Hoy": una sección por cada `hoySections`, con checkbox. Las
  // completadas NO se ocultan.
  function renderHoyView() {
    if (!hoyViewSectionsEl) return;
    hoyViewSectionsEl.innerHTML = "";
    hoySections.forEach((sec) => {
      const wrap = document.createElement("section");
      wrap.className = "hoy-view-section";

      const title = document.createElement("h2");
      title.className = "hoy-view-title";
      title.textContent = sec.name;
      wrap.appendChild(title);

      const ul = document.createElement("ul");
      ul.className = "task-list";
      const secItems = hoy.filter((it) => it.section === sec.id);
      secItems.forEach((item) => {
        const li = document.createElement("li");
        li.className =
          "hoy-view-item" + (item.done ? " is-done" : "") + hoyCatClass(item);

        const check = document.createElement("input");
        check.type = "checkbox";
        check.className = "task-check";
        check.checked = !!item.done;
        check.setAttribute("aria-label", "Marcar como completada");
        check.addEventListener("change", () => toggleHoy(item.id));

        const main = document.createElement("div");
        main.className = "hoy-view-main";

        const text = document.createElement("span");
        text.className = "hoy-view-text";
        text.textContent = item.text;
        main.appendChild(text);

        // 2ª línea opcional: "Hace N días" desde la última compleción
        if (item.showLastDone) {
          const last = document.createElement("span");
          last.className = "hoy-view-date";
          last.textContent = hoyLastDoneLabel(item.lastDoneAt);
          main.appendChild(last);
        }

        li.append(check, main);
        ul.appendChild(li);
      });
      wrap.appendChild(ul);

      if (secItems.length === 0) {
        const empty = document.createElement("p");
        empty.className = "hoy-view-empty";
        empty.textContent = "Nada por ahora.";
        wrap.appendChild(empty);
      }
      hoyViewSectionsEl.appendChild(wrap);
    });
  }

  function renderHoy() {
    renderHoyModal();
    renderHoyView();
  }

  function addHoy(section, text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    hoy.push({
      id: newId(),
      text: trimmed,
      section: section,
      done: false,
      temporal: false,
      showLastDone: false,
    });
    saveHoy();
    renderHoy();
  }

  function deleteHoy(id) {
    hoy = hoy.filter((h) => h.id !== id);
    saveHoy();
    renderHoy();
  }

  function toggleHoy(id) {
    const item = hoy.find((h) => h.id === id);
    if (!item) return;
    item.done = !item.done;
    // Última fecha de completado (se guarda siempre, se muestre o no). Al
    // desmarcar se recupera la anterior, para deshacer un check por error.
    if (item.done) {
      if (item.lastDoneAt) item.prevDoneAt = item.lastDoneAt;
      else delete item.prevDoneAt;
      item.lastDoneAt = todayISO();
    } else {
      if (item.prevDoneAt) item.lastDoneAt = item.prevDoneAt;
      else delete item.lastDoneAt;
      delete item.prevDoneAt;
    }
    saveHoy();
    renderHoy();
  }

  /* ---------- Secciones de Hoy (crear / renombrar / eliminar) ---------- */
  function addSection() {
    hoySections.push({ id: newId(), name: "Nueva sección" });
    saveHoy();
    renderHoy();
  }

  function deleteSection(id) {
    const sec = hoySections.find((s) => s.id === id);
    const n = hoy.filter((h) => h.section === id).length;
    const label = sec ? sec.name : "";
    const msg = n
      ? 'Eliminar la sección "' + label + '" y sus ' + n + " tarea(s)?"
      : 'Eliminar la sección "' + label + '"?';
    if (!confirm(msg)) return;
    hoySections = hoySections.filter((s) => s.id !== id);
    hoy = hoy.filter((h) => h.section !== id);
    saveHoy();
    renderHoy();
  }

  function openHoy() {
    renderHoy();
    hoyOverlay.hidden = false;
    document.body.classList.add("no-scroll");
  }
  function closeHoy() {
    hoyOverlay.hidden = true;
    document.body.classList.remove("no-scroll");
    renderHoy(); // refleja en la vista los cambios/orden del modal
  }

  hoySettingsBtn.addEventListener("click", openHoy);
  hoyClose.addEventListener("click", closeHoy);
  hoyOverlay.addEventListener("click", (e) => {
    if (e.target === hoyOverlay) closeHoy();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !hoyOverlay.hidden) closeHoy();
  });
  hoyAddSectionBtn.addEventListener("click", addSection);

  // Reordenar las secciones (solo desde el asa, para no chocar con el arrastre
  // de las tareas de dentro). El contenedor es estable → se engancha una vez.
  enableReorder(
    hoySectionsEl,
    "hoy-section",
    () => hoySections,
    saveHoy,
    "hoy-section-handle"
  );

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

    let localRecados = [];
    if (db) localRecados = await idbGet(IDB_KEY_RECADOS);
    recados = Array.isArray(localRecados) ? localRecados : [];

    let localPendientes = [];
    if (db) localPendientes = await idbGet(IDB_KEY_PENDIENTES);
    pendientes = Array.isArray(localPendientes) ? localPendientes : [];

    let rawHoy;
    if (db) rawHoy = await idbGet(IDB_KEY_HOY);
    const parsedHoy = parseHoy(rawHoy);
    hoy = parsedHoy.items;
    hoyDay = parsedHoy.day;
    hoySections = parsedHoy.sections;

    let localPlanned = [];
    if (db) localPlanned = await idbGet(IDB_KEY_PLANNED);
    planned = Array.isArray(localPlanned) ? localPlanned : [];

    renderTasksViews(); // pinta Tareas + Rutinas con el respaldo local
    renderRecados();
    renderPendientes();
    renderHoy();
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
        renderTasksViews();
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

    // Tercer listener: recados (segunda lista, sin materialización)
    let firstR = true;
    const refR = fdb.ref(FB_ROOT + "/" + FB_KEY_RECADOS);
    refR.on(
      "value",
      (snap) => {
        const raw = snap.val();
        const remote = Array.isArray(raw) ? raw : raw ? Object.values(raw) : [];
        if (firstR && remote.length === 0 && recados.length > 0) {
          firstR = false;
          refR.set(recados).catch(() => {});
          return;
        }
        firstR = false;
        recados = remote;
        if (db) idbSet(IDB_KEY_RECADOS, recados).catch(() => {});
        clearError();
        renderRecados();
      },
      (err) =>
        showError("Al leer la nube: " + (err && err.message ? err.message : err))
    );

    // Cuarto listener: pendientes (tercera lista)
    let firstPen = true;
    const refPen = fdb.ref(FB_ROOT + "/" + FB_KEY_PENDIENTES);
    refPen.on(
      "value",
      (snap) => {
        const raw = snap.val();
        const remote = Array.isArray(raw) ? raw : raw ? Object.values(raw) : [];
        if (firstPen && remote.length === 0 && pendientes.length > 0) {
          firstPen = false;
          refPen.set(pendientes).catch(() => {});
          return;
        }
        firstPen = false;
        pendientes = remote;
        if (db) idbSet(IDB_KEY_PENDIENTES, pendientes).catch(() => {});
        clearError();
        renderPendientes();
      },
      (err) =>
        showError("Al leer la nube: " + (err && err.message ? err.message : err))
    );

    // Quinto listener: tareas de "Hoy" (secciones mañana/tarde)
    let firstH = true;
    const refH = fdb.ref(FB_ROOT + "/" + FB_KEY_HOY);
    refH.on(
      "value",
      (snap) => {
        const parsed = parseHoy(snap.val());
        // Nube vacía pero este dispositivo tiene tareas o secciones propias → sube
        if (firstH && parsed.items.length === 0 && !hoyIsEmpty()) {
          firstH = false;
          saveHoy();
          return;
        }
        firstH = false;
        hoy = parsed.items;
        hoyDay = parsed.day;
        hoySections = parsed.sections;
        if (db) idbSet(IDB_KEY_HOY, snap.val()).catch(() => {});
        clearError();
        hoyReady = true;
        resetHoyIfNewDay(); // resetea "done" si ha cambiado el día
        renderHoy();
      },
      (err) =>
        showError("Al leer la nube: " + (err && err.message ? err.message : err))
    );

    // Listeners de App lactancia (solo lectura salvo cuando el usuario actúa).
    // No hacen "first empty upload": esos nodos no son nuestros.
    LACT_NODES.forEach((node) => {
      fdb.ref(LACT_ROOT + "/" + node).on(
        "value",
        (snap) => {
          const raw = snap.val();
          lactRaw[node] = Array.isArray(raw)
            ? raw
            : raw
            ? Object.values(raw)
            : [];
          clearError();
          renderRutinas(); // las tareas de lactancia viven en Rutinas
        },
        (err) =>
          showError(
            "Al leer lactancia: " + (err && err.message ? err.message : err)
          )
      );
    });

    // Listener de App tareas (raíz `tasks`): sus tareas de Cristina van a Rutinas.
    fdb.ref(AT_ROOT).on(
      "value",
      (snap) => {
        const raw = snap.val();
        atRaw = Array.isArray(raw) ? raw : raw ? Object.values(raw) : [];
        clearError();
        renderRutinas();
      },
      (err) =>
        showError(
          "Al leer App tareas: " + (err && err.message ? err.message : err)
        )
    );
  }

  async function startApp() {
    if (appStarted) return;
    appStarted = true;
    await initLocal(); // respaldo local → pinta ya
    startFirebaseSync(); // engancha la nube
    // Reseteo diario de "Hoy": comprueba cada minuto por si cruza la medianoche
    setInterval(() => {
      if (resetHoyIfNewDay()) renderHoy();
    }, 60000);
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

  // Vista inicial según el hash de la URL (#hoy, #tareas, …). Va al final, con
  // todas las constantes ya inicializadas (evita el error de TDZ al pintar Hoy).
  activateView(viewFromHash());
})();
