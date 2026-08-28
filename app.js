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

  // Vista Proyectos: no son tareas (no se completan). Título + enlace a Notion.
  const proyectosListEl = document.getElementById("proyectos-list");
  const proyectosEmpty = document.getElementById("proyectos-empty");
  const proyectosAddBtn = document.getElementById("proyectos-add-btn");
  // Página de un proyecto (sus tareas), dentro de la misma pestaña
  const proyectosIndexEl = document.getElementById("proyectos-index");
  const proyectosDetailEl = document.getElementById("proyectos-detail");
  const proyectoTasksBack = document.getElementById("proyecto-tasks-back");
  const proyectoSettingsBtn = document.getElementById("proyecto-settings-btn");
  const proyectoTasksTitle = document.getElementById("proyecto-tasks-title");
  const proyectoTasksList = document.getElementById("proyecto-tasks-list");
  const proyectoTasksTabs = document.getElementById("proyecto-tasks-tabs");
  const proyectoTaskForm = document.getElementById("proyecto-task-form");
  const proyectoTaskInput = document.getElementById("proyecto-task-input");
  const proyectoTaskListSel = document.getElementById("proyecto-task-list");
  const proyectoTaskOverlay = document.getElementById("proyecto-task-overlay");
  const proyectoTaskAddBtn = document.getElementById("proyecto-task-add-btn");
  const proyectoTaskModalTitle = document.getElementById(
    "proyecto-task-modal-title"
  );
  const proyectoTaskCancel = document.getElementById("proyecto-task-cancel");
  const proyectoTasksCanvas = document.getElementById("proyecto-tasks-canvas");
  let proyectoOpenId = null; // proyecto cuya página de tareas está abierta
  let proyectoTasksTab = "grafo"; // "grafo" | "lista" (no se persiste)

  // Vista Rutinas: tareas automáticas (planificadas + lactancia)
  const rutinasList = document.getElementById("rutinas-list");
  const rutinasEmpty = document.getElementById("rutinas-empty");
  const rutinasDoneSection = document.getElementById("rutinas-done-section");
  const rutinasDoneList = document.getElementById("rutinas-done-list");
  const rutinasToggleDone = document.getElementById("rutinas-toggle-done");
  const rutinasClearDone = document.getElementById("rutinas-clear-done");
  const rutinasSummary = document.getElementById("rutinas-summary");

  // Vista Rutinas (interna: repeticiones): las copias que generan las
  // planificadas, sin las destacadas que acompañan a "Mis tareas".
  const repeticionesList = document.getElementById("repeticiones-list");
  const repeticionesEmpty = document.getElementById("repeticiones-empty");
  const repeticionesDoneSection = document.getElementById(
    "repeticiones-done-section"
  );
  const repeticionesDoneList = document.getElementById("repeticiones-done-list");
  const repeticionesToggleDone = document.getElementById(
    "repeticiones-toggle-done"
  );
  const repeticionesClearDone = document.getElementById(
    "repeticiones-clear-done"
  );
  const repeticionesSummary = document.getElementById("repeticiones-summary");

  // Etiqueta de procedencia que acompaña a una tarea en su 2ª línea (el
  // byline): va en singular, porque nombra a esa tarea y no a la lista entera.
  const ORIGEN = {
    tareas: "Tarea",
    recados: "Recado",
    pendientes: "Pendiente",
    rutinas: "Rutina",
  };

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
    filter: (t) => !t.sourcePlannedId && !isTaskOnHold(t),
    listEl: list,
    doneListEl: doneList,
    emptyEl: emptyState,
    doneSectionEl: doneSection,
    toggleBtn: toggleDoneBtn,
    summaryEl: summary,
    doneVisible: false,
    plannedRank: false,
  };
  const ctxRutinas = {
    noun: "tarea",
    items: () => tasks,
    setItems: (v) => (tasks = v),
    save: () => save(),
    // "Cuanto antes" reúne: copias de rutinas + las tareas destacadas (★).
    // Las completadas pierden el destacado, así que salen solas de aquí.
    // "Añadir a Hoy" no las saca: se siguen viendo aquí y además en "Durante
    // el día", igual que una tarea normal fijada sigue en su lista.
    // Las bloqueadas por otra tarea de su proyecto sí: aún no tocan.
    filter: (t) => !isTaskOnHold(t) && (!!t.sourcePlannedId || !!t.starred),
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
      return recados.indexOf(t) !== -1 ? ORIGEN.recados : ORIGEN.tareas;
    },
    // Tabs por procedencia: "all" | "rutinas" | "tareas" | "recados"
    tabsEl: document.getElementById("rutinas-tabs"),
    tabFilter: "all",
    tabMatch: (t, v) => {
      const grupo =
        t.sourcePlannedId || t._lact || t._at
          ? "rutinas"
          : recados.indexOf(t) !== -1
          ? "recados"
          : "tareas";
      return grupo === v;
    },
    emptyTexts: {
      all: "No hay nada ahora mismo.",
      rutinas: "No hay rutinas ahora mismo.",
      tareas: "No hay tareas destacadas.",
      recados: "No hay recados destacados.",
    },
  };
  // Vista Rutinas: solo las repeticiones, las mismas que en "Mis tareas" con el
  // filtro Rutinas (copias de planificadas + tareas automáticas de otras apps).
  // Comparte el array `tasks` con Tareas y con "Mis tareas"; lo que cambia es
  // el filtro. Sin destacadas ni recados: aquí no pintan nada.
  const ctxRepeticiones = {
    noun: "tarea",
    items: () => tasks,
    setItems: (v) => (tasks = v),
    save: () => save(),
    // Igual que en "Mis tareas": "Añadir a Hoy" no saca la repetición de aquí
    // (se ve en las dos partes), y las bloqueadas por su proyecto aún no tocan.
    filter: (t) => !isTaskOnHold(t) && !!t.sourcePlannedId,
    listEl: repeticionesList,
    doneListEl: repeticionesDoneList,
    emptyEl: repeticionesEmpty,
    doneSectionEl: repeticionesDoneSection,
    toggleBtn: repeticionesToggleDone,
    summaryEl: repeticionesSummary,
    doneVisible: false,
    plannedRank: true,
    externalPending: () => lactPending().concat(atareasPending()),
    externalDone: () => lactDone().concat(atareasDone()),
  };
  const ctxRecados = {
    noun: "recado",
    items: () => recados,
    setItems: (v) => (recados = v),
    save: () => saveRecados(),
    filter: (t) => !isTaskOnHold(t),
    listEl: recadosList,
    doneListEl: recadosDoneList,
    emptyEl: recadosEmpty,
    doneSectionEl: recadosDoneSection,
    toggleBtn: recadosToggleDone,
    summaryEl: recadosSummary,
    doneVisible: false,
    plannedRank: false,
  };
  const ctxPendientes = {
    noun: "tarea",
    items: () => pendientes,
    setItems: (v) => (pendientes = v),
    save: () => savePendientes(),
    filter: (t) => !isTaskOnHold(t),
    listEl: pendientesList,
    doneListEl: pendientesDoneList,
    emptyEl: pendientesEmpty,
    doneSectionEl: pendientesDoneSection,
    toggleBtn: pendientesToggleDone,
    summaryEl: pendientesSummary,
    doneVisible: false,
    plannedRank: false,
  };

  // Tareas sin tipo: existen solo dentro de su proyecto. Al no pintarse en
  // ninguna vista, su contexto no tiene DOM; solo sirve para leerlas, guardarlas
  // y moverlas de sitio (el resto de la app las trata como a cualquier tarea).
  const ctxSinTipo = {
    noun: "tarea",
    items: () => sinTipo,
    setItems: (v) => (sinTipo = v),
    save: () => saveSinTipo(),
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
    item = sinTipo.find((t) => t.id === id);
    if (item) return { item: item, ctx: ctxSinTipo };
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
  // recordatorios/sinTipo = tareas sin tipo (solo dentro de su proyecto)
  const FB_KEY_SIN_TIPO = "sinTipo";
  const FB_KEY_PROYECTOS = "proyectos"; // recordatorios/proyectos = proyectos (título + enlace)
  // recordatorios/proyectoSecciones = secciones en las que se agrupa el índice
  // de Proyectos. El proyecto guarda su sección en `sectionId`.
  const FB_KEY_PRO_SECCIONES = "proyectoSecciones";
  const FB_KEY_HOY = "hoy"; // recordatorios/hoy = tareas del día (mañana/tarde)
  // recordatorios/hoyFijadas = tareas de otras apps (lactancia / App tareas)
  // fijadas a "Durante el día". Las nuestras no lo necesitan: llevan `hoyDia`
  // encima. Las externas se reconstruyen en cada render, así que la marca no
  // puede vivir en ellas y la guardamos aquí, sin tocar los datos de esas apps.
  const FB_KEY_HOY_FIJADAS = "hoyFijadas";
  const FB_KEY_AGENDA = "agenda"; // recordatorios/agenda = tareas por día de la semana
  // recordatorios/dayOrder = orden manual de cada día de la semana (1-7),
  // común a la sección "Durante el día" de Hoy y a la pestaña Agenda.
  const FB_KEY_DAY_ORDER = "dayOrder";

  /* ---------- Integración con App lactancia (misma base de datos) ----------
     Mostramos en la lista "Tareas" las tareas de App lactancia (Mamá › Tareas),
     que viven en la raíz "lactancia". No son nuestras: solo las leemos y, al
     completar/borrar, reescribimos su nodo. lactancia ya escucha esos nodos y
     refleja el cambio solo. Esquema de cada tarea allí:
     { id, texto, hecha, creada, completada?, auto?, fecha?, desde?, banoFecha?, extra? } */
  const LACT_ROOT = "lactancia";
  // La plantilla de "Durante el día" de lactancia se lee (no se escribe) por su
  // toggle "Añadir a Hoy": ver LACT_NODE_PLANTILLA.
  const LACT_NODES = [
    "tareas-mama",
    "tareas-antes-extraccion",
    "tareas-extraccion",
  ];
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
  const IDB_KEY_SIN_TIPO = "sinTipo";
  const IDB_KEY_PROYECTOS = "proyectos";
  const IDB_KEY_PRO_SECCIONES = "proyectoSecciones";
  const IDB_KEY_HOY = "hoy";
  const IDB_KEY_HOY_FIJADAS = "hoyFijadas";
  const IDB_KEY_AGENDA = "agenda";
  const IDB_KEY_DAY_ORDER = "dayOrder";
  // Registro local de lo borrado en este dispositivo (ver "Borrados definitivos")
  const IDB_KEY_DELETED = "deletedIds";
  let db = null;
  let fbReady = false; // true cuando Firebase está autenticado y escuchando
  let appStarted = false; // evita arrancar la app dos veces

  let tasks = [];
  let recados = []; // segunda lista (misma funcionalidad, sin planificadas auto)
  let pendientes = []; // tercera lista (igual que recados)
  // Tareas sin tipo: solo viven en su proyecto, fuera de las listas de tareas
  let sinTipo = [];
  // Proyectos: {id, text, url, category, sectionId}. No se completan. El orden
  // del array es el orden del índice; `sectionId` dice en qué sección van (sin
  // sección, o si esa sección ya no existe, van al bloque "Sin sección").
  let proyectos = [];
  // Secciones del índice de Proyectos: {id, name}, en el orden en que se pintan
  let proyectoSecciones = [];
  // Agenda: tareas fijas por día de la semana {id, text, day: 1-7, done}
  let agenda = [];
  // Orden manual de cada día: { "1": [id, id, …], … 1=Lunes … 7=Domingo }.
  // Mezcla ids de Agenda y de tareas/recados con fecha exacta, de modo que la
  // sección "Durante el día" (Hoy) y el día correspondiente de Agenda comparten
  // el mismo orden. Los ids que no estén aquí van al final (orden por defecto).
  let dayOrder = {};
  const AGENDA_DAYS = [
    { day: 1, name: "Lunes" },
    { day: 2, name: "Martes" },
    { day: 3, name: "Miércoles" },
    { day: 4, name: "Jueves" },
    { day: 5, name: "Viernes" },
    { day: 6, name: "Sábado" },
    { day: 7, name: "Domingo" },
  ];
  // Ids borrados en este dispositivo: [{id, at}] (ver "Borrados definitivos")
  let deletedIds = [];
  let hoy = []; // tareas del día {id, text, section: <id sección>, done}
  // Secciones de Hoy. Las por defecto usan ids "manana"/"tarde" para no perder
  // los datos actuales (las tareas ya guardan esos ids en `section`).
  // Secciones automáticas: se rellenan solas (no se renombran ni se les añaden
  // tareas). Viven en `hoySections` solo para poder colocarlas donde se quiera.
  //  - "Durante el día": Agenda de hoy + tareas/recados con fecha de hoy.
  //  - "Antes de la próxima extracción": las tareas que App lactancia genera al
  //    registrar una extracción (el resto de lactancia sigue en Cuanto antes).
  const HOY_AUTO_ID = "auto-dia";
  const HOY_AUTO_NAME = "Durante el día";
  const HOY_LACT_ID = "auto-extraccion";
  const HOY_LACT_NAME = "Antes de la próxima extracción";
  const HOY_AUTO_IDS = [HOY_AUTO_ID, HOY_LACT_ID];
  // Inicio del registro de "veces completada por semana": lo anterior queda
  // fuera de las estadísticas (es un lunes, así que corta por semana entera).
  const HOY_STATS_START = "2026-08-10";
  const HOY_DEFAULT_SECTIONS = [
    { id: "manana", name: "Mañana" },
    { id: "tarde", name: "Tarde" },
    { id: HOY_AUTO_ID, name: HOY_AUTO_NAME, auto: true },
    { id: HOY_LACT_ID, name: HOY_LACT_NAME, auto: true },
  ];
  const hoyDefaultSections = () =>
    HOY_DEFAULT_SECTIONS.map((s) =>
      s.auto ? { id: s.id, name: s.name, auto: true } : { id: s.id, name: s.name }
    );
  // Las configuraciones guardadas antes no las tienen: se añaden al final.
  function withAutoSection(secs) {
    // Normaliza nombre/marca por si vinieron de una versión anterior, pero
    // conservando lo que sí es del usuario (si está colapsada).
    let out = secs.map((s) => {
      const def = HOY_DEFAULT_SECTIONS.find((d) => d.auto && d.id === s.id);
      if (!def) return s;
      const auto = { id: def.id, name: def.name, auto: true };
      if (s.collapsed) auto.collapsed = true;
      return auto;
    });
    HOY_AUTO_IDS.forEach((id) => {
      if (out.some((s) => s.id === id)) return;
      const def = HOY_DEFAULT_SECTIONS.find((d) => d.id === id);
      out = out.concat([{ id: def.id, name: def.name, auto: true }]);
    });
    return out;
  }
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
  let doneLogsLimpios = false; // la limpieza de `doneLog` corre una vez por carga
  let planned = []; // tareas planificadas (solo texto, sin completar)
  let hoyFijadas = []; // claves de tareas externas fijadas a "Durante el día"

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

  function saveSinTipo() {
    if (db) idbSet(IDB_KEY_SIN_TIPO, sinTipo).catch(() => {});
    if (fbReady) {
      fdb
        .ref(FB_ROOT + "/" + FB_KEY_SIN_TIPO)
        .set(sinTipo && sinTipo.length ? sinTipo : null)
        .catch((e) =>
          showError("Al sincronizar: " + (e && e.message ? e.message : e))
        );
    }
  }

  function saveProyectos() {
    if (db) idbSet(IDB_KEY_PROYECTOS, proyectos).catch(() => {});
    if (fbReady) {
      fdb
        .ref(FB_ROOT + "/" + FB_KEY_PROYECTOS)
        .set(proyectos && proyectos.length ? proyectos : null)
        .catch((e) =>
          showError("Al sincronizar: " + (e && e.message ? e.message : e))
        );
    }
  }

  function saveProyectoSecciones() {
    if (db) idbSet(IDB_KEY_PRO_SECCIONES, proyectoSecciones).catch(() => {});
    if (fbReady) {
      fdb
        .ref(FB_ROOT + "/" + FB_KEY_PRO_SECCIONES)
        .set(proyectoSecciones && proyectoSecciones.length ? proyectoSecciones : null)
        .catch((e) =>
          showError("Al sincronizar: " + (e && e.message ? e.message : e))
        );
    }
  }

  function saveAgenda() {
    if (db) idbSet(IDB_KEY_AGENDA, agenda).catch(() => {});
    if (fbReady) {
      fdb
        .ref(FB_ROOT + "/" + FB_KEY_AGENDA)
        .set(agenda && agenda.length ? agenda : null)
        .catch((e) =>
          showError("Al sincronizar: " + (e && e.message ? e.message : e))
        );
    }
  }

  function saveDayOrder() {
    const payload = Object.keys(dayOrder).length ? dayOrder : null;
    if (db) idbSet(IDB_KEY_DAY_ORDER, payload).catch(() => {});
    if (fbReady) {
      fdb
        .ref(FB_ROOT + "/" + FB_KEY_DAY_ORDER)
        .set(payload)
        .catch((e) =>
          showError("Al sincronizar: " + (e && e.message ? e.message : e))
        );
    }
  }

  // Normaliza el nodo de orden: Firebase puede devolver los arrays como objetos
  // (y el propio nodo como array, porque las claves son 1-7).
  function parseDayOrder(raw) {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    Object.keys(raw).forEach((k) => {
      const v = raw[k];
      const arr = Array.isArray(v)
        ? v
        : v && typeof v === "object"
        ? Object.values(v)
        : [];
      const ids = arr.filter((id) => typeof id === "string" && id);
      if (ids.length) out[String(k)] = ids;
    });
    return out;
  }

  /* ---------- Borrados definitivos ----------
     Al borrar algo se guarda su id aquí, en IndexedDB (no en la nube: hay que
     poder apuntarlo sin conexión). Cuando llega una lista de la nube, se quita
     de ella todo lo que este dispositivo ya borró y se vuelve a subir limpia.

     Hace falta porque el SDK web de Firebase encola las escrituras pendientes
     solo en memoria: si se borra una tarea sin conexión (o el móvil suspende la
     app antes de que la escritura salga) y luego se cierra la pestaña, esa
     escritura se pierde. La tarea desaparece en el momento —el respaldo local sí
     se guardó—, pero en la siguiente carga la nube la manda de vuelta y
     reaparece. Con el id apuntado, el borrado se reaplica y esta vez sí sube.

     Solo ids, sin textos: no reviven ni ocupan. Se podan a los 90 días, cuando
     ya no hay ninguna copia sin sincronizar que pueda resucitar nada. */
  const DELETED_TTL_DAYS = 90;

  function saveDeleted() {
    if (db) idbSet(IDB_KEY_DELETED, deletedIds).catch(() => {});
  }

  function pushDeleted(id) {
    if (!id || typeof id !== "string") return false;
    if (deletedIds.some((d) => d && d.id === id)) return false;
    deletedIds.push({ id: id, at: todayISO() });
    return true;
  }

  // Apunta un borrado. Los ids son únicos en toda la app, así que vale para
  // cualquier lista (tareas, recados, rutinas, agenda, proyectos…).
  function rememberDeleted(id) {
    if (pushDeleted(id)) saveDeleted();
  }

  // Varios de golpe (p. ej. "Vaciar completadas"), con un solo guardado.
  function rememberDeletedMany(ids) {
    let nuevos = false;
    ids.forEach((id) => {
      if (pushDeleted(id)) nuevos = true;
    });
    if (nuevos) saveDeleted();
  }

  // Quita de una lista recién llegada de la nube lo que ya se borró aquí.
  // Devuelve la MISMA lista si no sobraba nada (así quien llama sabe, comparando
  // con `!==`, si tiene que volver a subirla).
  function applyDeleted(list) {
    if (!deletedIds.length || !list.length) return list;
    const clean = list.filter(
      (item) => !(item && deletedIds.some((d) => d && d.id === item.id))
    );
    return clean.length === list.length ? list : clean;
  }

  // Poda las tumbas viejas. Devuelve si ha cambiado algo.
  function pruneDeleted() {
    const limite = addDaysISO(todayISO(), -DELETED_TTL_DAYS);
    const kept = deletedIds.filter(
      (d) => d && typeof d.id === "string" && (d.at || "") >= limite
    );
    if (kept.length === deletedIds.length) return false;
    deletedIds = kept;
    return true;
  }

  // ¿Hoy está "vacío"? (sin tareas y con las secciones por defecto). Sirve para
  // no persistir un objeto vacío y para el "first upload".
  function hoyIsEmpty() {
    if (hoy.length > 0) return false;
    if (hoySections.length !== HOY_DEFAULT_SECTIONS.length) return false;
    return hoySections.every(
      (s, i) =>
        s.id === HOY_DEFAULT_SECTIONS[i].id &&
        s.name === HOY_DEFAULT_SECTIONS[i].name &&
        !s.collapsed // colapsar una sección ya es un ajuste que hay que guardar
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

  function saveHoyFijadas() {
    if (db) idbSet(IDB_KEY_HOY_FIJADAS, hoyFijadas).catch(() => {});
    if (fbReady) {
      fdb
        .ref(FB_ROOT + "/" + FB_KEY_HOY_FIJADAS)
        .set(hoyFijadas && hoyFijadas.length ? hoyFijadas : null)
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
        sections: secs.length ? withAutoSection(secs) : hoyDefaultSections(),
      };
    }
    return { items: [], day: null, sections: hoyDefaultSections() };
  }

  // Resetea al cambiar de día los estados "done" y las secciones colapsadas
  // (idempotente, sincronizado por `hoyDay` para no pisar los checks hechos hoy
  // en otro dispositivo). Devuelve si el día ha cambiado: al cruzar la
  // medianoche siempre hay que repintar, aunque no hubiera nada marcado ni
  // colapsado (cambian las listas del día, la de extracción y los bylines).
  function resetHoyIfNewDay() {
    if (!hoyReady) return false;
    const today = todayISO();
    if (hoyDay === today) return false;
    hoy.forEach((h) => {
      // `lastDoneAt` NO se toca: es el histórico de la última compleción.
      delete h.prevDoneAt;
      h.done = false;
    });
    // Día nuevo: todas las secciones vuelven a verse desplegadas
    hoySections.forEach((s) => delete s.collapsed);
    hoyDay = today;
    saveHoy();
    return true;
  }

  // Limpieza única del registro guardado: una versión anterior apuntaba dos
  // veces la primera compleción de cada tarea (escribía `lastDoneAt` antes de
  // leer el registro, así que el respaldo de `hoyDoneLog` devolvía la fecha de
  // hoy y el `concat` la repetía). El filtro de `hoyDoneLog` lo tapa al leer,
  // pero el dato viaja por la nube a dispositivos que aún no lo tienen, así
  // que se sanea en origen. Devuelve si ha cambiado algo.
  function limpiarDoneLogs() {
    let cambios = false;
    hoy.forEach((item) => {
      // Sin registro no hay nada que limpiar: escribir aquí inventaría un
      // `doneLog` a partir del respaldo `lastDoneAt` de `hoyDoneLog`.
      if (!item.doneLog) return;
      const original = Array.isArray(item.doneLog)
        ? item.doneLog
        : Object.values(item.doneLog);
      // `hoyDoneLog` conserva el orden y solo quita elementos: si la longitud
      // baja es que había fechas repetidas (o basura).
      const limpio = hoyDoneLog(item);
      if (limpio.length === original.length) return;
      item.doneLog = limpio;
      cambios = true;
    });
    return cambios;
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
    // `category: ""` de entrada: sin él, la migración a "Personal" adoptaría
    // la rutina recién creada en la siguiente sincronización.
    planned.unshift({
      id: newId(),
      text: trimmed,
      createdAt: todayISO(),
      category: "",
    });
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
    rememberDeleted(id); // que no vuelva si la nube aún no se enteró
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
      const isMonthly = p.repeat === "monthly" && p.repeatDom;
      const isYearly = p.repeat === "yearly" && p.repeatMonth && p.repeatDom;
      const isBiennial = p.repeat === "biennial" && p.repeatStart;
      const isQuarterly = p.repeat === "quarterly" && p.repeatStart;
      if (!isWeekly && !isMonthly && !isYearly && !isBiennial && !isQuarterly)
        return;

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
        // Instantánea también del destino: esta copia va a "Durante el día"
        // (Hoy) en vez de a Cuanto antes.
        if (p.addToHoy) inst.hoyDia = true;
        tasks.unshift(inst);
        p.currentInstanceId = inst.id;
        tasksChanged = true;
        plannedChanged = true;
      }
    });

    if (plannedChanged) savePlanned();
    if (tasksChanged) {
      save();
      renderTasksViews(); // las copias creadas viven en Cuanto antes…
      renderHoyView(); // …o en "Durante el día", si la rutina va a Hoy
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

  // Rutina de la que salió esta copia (null si no lo es, o si ya no existe)
  function plannedOf(task) {
    if (!task || !task.sourcePlannedId) return null;
    return planned.find((p) => p.id === task.sourcePlannedId) || null;
  }

  function deleteTask(id) {
    const e = findTaskEntry(id);
    if (!e) return;
    const task = e.item;
    // Si es una copia de una planificada, registra el despeje por eliminación
    if (task.sourcePlannedId) {
      const p = plannedOf(task);
      if (p && p.currentInstanceId === id) {
        p.lastClearedAt = todayISO();
        p.currentInstanceId = null;
        savePlanned();
      }
    }
    rememberDeleted(id); // que no vuelva si la nube aún no se enteró
    e.ctx.setItems(e.ctx.items().filter((t) => t.id !== id));
    e.ctx.save();
    renderAllLists();
  }

  function clearDoneIn(ctx) {
    // Solo borra las completadas que pertenecen a esta vista (respeta el filtro,
    // ya que Tareas y Rutinas comparten el array `tasks`).
    const belongs = ctx.filter || (() => true);
    const fuera = (t) => t.done && belongs(t);
    rememberDeletedMany(ctx.items().filter(fuera).map((t) => t.id));
    ctx.setItems(ctx.items().filter((t) => !fuera(t)));
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
  // Milisegundos → fecha ISO en hora local. `toISOString()` no vale aquí: da
  // UTC y de madrugada (la extracción 1 es a las 3:00) caería en el día
  // anterior.
  function msToISO(ms) {
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }
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
      auto: !!x.auto, // copia diaria de la plantilla, no una tarea suelta
      _lact: { node: node, id: x.id }, // marca de origen + enrutado de escritura
    };
  }
  /* ---------- "Añadir a Hoy" de App lactancia ----------
     Su modal de tareas tiene un toggle "Añadir a Hoy" en el grupo "Durante el
     día". Es el equivalente al `addToHoy` de una rutina nuestra: no marca una
     tarea suelta, marca la PLANTILLA, y así cada copia diaria nace en Hoy.
     El dato (`hoy`) vive en la plantilla (`tareas-extraccion`, `extra === 0`) y
     la copia diaria que lactancia deja en `tareas-mama` no lo arrastra: solo
     lleva el texto y `auto: true`. Por eso se casa por texto contra la
     plantilla, y solo sobre las copias automáticas. */
  const LACT_NODE_PLANTILLA = "tareas-extraccion";
  function lactPlantillaHoyTextos() {
    const set = {};
    (lactRaw[LACT_NODE_PLANTILLA] || []).forEach((x) => {
      if (x && x.extra === 0 && x.hoy && x.texto) set[String(x.texto).trim()] = true;
    });
    return set;
  }
  // ¿Esta tarea de lactancia va a Hoy porque lo dice su plantilla? Solo aplica a
  // las copias diarias de "Durante el día" (`tareas-mama` + `auto`).
  function lactAutoHoy(task) {
    if (!task || !task._lact || task._lact.node !== "tareas-mama") return false;
    if (!task.auto) return false;
    return !!lactPlantillaHoyTextos()[(task.text || "").trim()];
  }

  // Tareas que lactancia genera al registrar una extracción. No salen en Cuanto
  // antes: tienen su propia sección automática en Hoy, completadas incluidas
  // (como el resto de secciones de Hoy, que no las ocultan).
  // Solo las de las extracciones de hoy: lactancia nunca borra las de días
  // anteriores, y `creada` (ms del registro) es su única marca de tiempo.
  const LACT_NODE_EXTRA = "tareas-antes-extraccion";
  function lactAntesExtraccion() {
    return (lactRaw[LACT_NODE_EXTRA] || [])
      .filter((x) => x.creada && msToISO(x.creada) === todayISO())
      .map((x) => lactToItem(x, LACT_NODE_EXTRA));
  }
  // Pendientes de lactancia para Cuanto antes: "durante el día" (tareas-mama),
  // con el mismo criterio de visibilidad que la propia app lactancia.
  function lactPending() {
    const hoy = todayISO();
    return (lactRaw["tareas-mama"] || [])
      .filter((x) => !x.hecha && (!x.desde || x.desde <= hoy))
      .map((x) => lactToItem(x, "tareas-mama"));
  }
  // Completadas de lactancia (para la sección Completadas de Cuanto antes).
  function lactDone() {
    return (lactRaw["tareas-mama"] || [])
      .filter((x) => x.hecha)
      .map((x) => lactToItem(x, "tareas-mama"));
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
    renderHoyView(); // la sección de la extracción también las muestra
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
    return {
      id: "at:" + index,
      text: t.text,
      done: !!t.done,
      subtitle: atSubtitle(t), // 2ª línea (byline): su fecha en App tareas
      // `date` es la fecha sin formatear: `subtitle` la pinta como "Hoy" o
      // "Ayer" y cambia sola de un día para otro, así que no sirve de clave.
      _at: { index: index, date: (t && t.addedDate) || "" },
    };
  }
  // Fecha que la tarea tiene puesta en App tareas (`addedDate`, ISO). Se pinta
  // con nuestro formato: hoy / mañana / ayer / 5 sept 2026. Sin fecha, nada.
  function atSubtitle(t) {
    const iso = t && typeof t.addedDate === "string" ? t.addedDate : "";
    if (!iso) return "";
    const rel = formatDateRel(iso);
    return rel.charAt(0).toUpperCase() + rel.slice(1);
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
    renderHoyView(); // una fijada con "Añadir a Hoy" también se pinta ahí
  }
  function toggleAtDone(ref) {
    const t = atRaw[ref.index];
    if (!t) return;
    t.done = !t.done;
    // App tareas no guarda cuándo se completó, así que la fecha la apuntamos
    // aquí: es lo que mantiene la tarea tachada en Hoy hasta el cambio de día.
    setFijadaDone(atToItem(t, ref.index), t.done ? todayISO() : null);
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
  const detailTypeWrap = document.getElementById("detail-type-wrap");
  const detailType = document.getElementById("detail-type");
  const detailProjectWrap = document.getElementById("detail-project-wrap");
  const detailProject = document.getElementById("detail-project");
  const detailStateWrap = document.getElementById("detail-state-wrap");
  const detailState = document.getElementById("detail-state");
  const detailStateHint = document.getElementById("detail-state-hint");
  const detailCatWrap = document.getElementById("detail-cat-wrap");
  const detailCat = document.getElementById("detail-cat");
  const detailAddHoyWrap = document.getElementById("detail-addhoy-wrap");
  const detailAddHoy = document.getElementById("detail-addhoy");
  // Selector de categoría: el mismo juego en Hoy, en las rutinas y en los
  // proyectos (el color de cada una va en el CSS, por su id)
  function fillCategorySelect(select) {
    if (!select) return;
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "Sin categoría";
    select.appendChild(none);
    HOY_CATEGORIES.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      select.appendChild(opt);
    });
  }
  fillCategorySelect(detailCat); // categoría de las rutinas
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
  const repeatDomWrap = document.getElementById("repeat-dom-wrap");
  const repeatMonth = document.getElementById("detail-repeat-month");
  const repeatDom = document.getElementById("detail-repeat-dom");
  const repeatBiennialWrap = document.getElementById("repeat-biennial-wrap");
  const repeatStart = document.getElementById("detail-repeat-start");
  let openTaskId = null;
  let openLactRef = null; // {node,id} si el modal muestra una tarea de lactancia
  let openAtRef = null; // {index} si el modal muestra una tarea de App tareas
  // La externa abierta, entera: `hoyExternKey` necesita su texto, no solo el ref
  let openExternTask = null;

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
    // La fecha "En fecha" coloca la tarea en un día de la Agenda y, si es hoy,
    // en la sección "Durante el día" de Hoy.
    renderAgenda();
    renderHoyView();
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

  // Ocurrencias mensuales en el día `dom` (1-31), recortado al máximo del mes
  // (día 31 en abril → 30; en febrero → 28/29).
  function monthlyOccurrenceOnOrAfter(iso, dom) {
    const p = iso.split("-").map(Number);
    const cand = yearlyDateISO(p[0], p[1], dom);
    if (cand >= iso) return cand;
    const y = p[1] === 12 ? p[0] + 1 : p[0];
    const m = p[1] === 12 ? 1 : p[1] + 1;
    return yearlyDateISO(y, m, dom);
  }
  function monthlyOccurrenceAfter(iso, dom) {
    return monthlyOccurrenceOnOrAfter(addDaysISO(iso, 1), dom);
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

  // Siguiente ocurrencia de una planificada según su frecuencia
  function plannedNextOccurrence(p, boundary, after) {
    if (p.repeat === "weekly") {
      return after
        ? firstOccurrenceAfter(boundary, p.repeatDay)
        : firstOccurrenceOnOrAfter(boundary, p.repeatDay);
    }
    if (p.repeat === "monthly") {
      return after
        ? monthlyOccurrenceAfter(boundary, p.repeatDom)
        : monthlyOccurrenceOnOrAfter(boundary, p.repeatDom);
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

  // Migración puntual: las rutinas anteriores a las categorías pasan a
  // "Personal". Idempotente: solo afecta a las que no tienen el campo, así que
  // dejar una en "Sin categoría" (que guarda "") no la reasigna.
  function backfillPlannedCategory() {
    let changed = false;
    planned.forEach((p) => {
      if (typeof p.category !== "string") {
        p.category = "personal";
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
    // Mensual: el día no depende de un mes concreto, así que se ofrecen los 31
    // (se recorta al vuelo en los meses cortos). Anual: los del mes elegido.
    populateDomOptions(mode === "monthly" ? 1 : repeatMonth.value, entity.repeatDom || 1);
    repeatStart.value = entity.repeatStart || "";
    repeatDayWrap.hidden = mode !== "weekly"; // día de la semana → solo semanal
    repeatYearWrap.hidden = mode !== "yearly"; // mes → solo anual
    // Día del mes: compartido por anual (con mes) y mensual (solo el día)
    repeatDomWrap.hidden = !(mode === "yearly" || mode === "monthly");
    // Fecha de inicio: compartida por "cada dos años" y "trimestralmente"
    repeatBiennialWrap.hidden = !(mode === "biennial" || mode === "quarterly");
  }

  // Categoría de la rutina abierta. Se guarda siempre como texto ("" = sin
  // categoría) para que la migración distinga "nunca asignada" de "quitada".
  detailCat.addEventListener("change", () => {
    const entity = getOpenEntity();
    if (!entity) return;
    entity.category = detailCat.value;
    saveOpen();
    renderPlanned();
  });

  // "Añadir a Hoy". En una rutina (`addToHoy`) dice dónde nacen sus
  // repeticiones: en la sección "Durante el día" de Hoy en vez de en Cuanto
  // antes. Como el resto de su configuración, solo afecta a las ocurrencias
  // futuras: la copia que ya exista se queda donde nació.
  // En una tarea (`hoyDia`) la fija a ella misma en "Durante el día" hasta que
  // se complete, tenga la fecha que tenga o no tenga ninguna. Sobre la copia de
  // una rutina afecta solo a esa repetición: la siguiente nace de nuevo según
  // el `addToHoy` de la rutina, no según lo que se hiciera con la anterior.
  detailAddHoy.addEventListener("change", () => {
    // Tarea de otra app: la marca no cabe en ella, va a nuestro `hoyFijadas`.
    if (openExternTask) {
      setHoyFijada(openExternTask, detailAddHoy.checked);
      renderHoyView(); // sigue en Mis tareas: solo cambia si sale en Hoy
      return;
    }
    const entity = getOpenEntity();
    if (!entity) return;
    const esRutina = openPlannedId !== null;
    const campo = esRutina ? "addToHoy" : "hoyDia";
    if (detailAddHoy.checked) entity[campo] = true;
    else delete entity[campo];
    saveOpen();
    // Una tarea fijada sale de "Cuanto antes" y entra en Hoy, así que hay que
    // repintar todas las listas, no solo la suya.
    if (esRutina) renderPlanned();
    else renderAllLists();
  });

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
    } else if (entity.repeat === "monthly") {
      entity.repeatDom = Number(repeatDom.value) || 1;
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
    openExternTask = null;
    detailTitle.readOnly = false; // restaura edición del título
    detailNote.hidden = false; // restaura la nota
    if (detailNoteLabel) detailNoteLabel.hidden = false;
    detailCheck.hidden = true; // las planificadas no se completan
    detailTaskFields.hidden = true; // oculta fecha y subtareas (título sí se ve)
    detailDelete.hidden = false; // eliminar desde el modal
    detailTitle.value = item.text;
    detailTitle.classList.remove("is-done");
    renderRepeat(item);
    renderDetailType();
    detailRepeatSection.hidden = false; // "Repetir" solo en planificadas
    detailProjectWrap.hidden = true; // "Proyecto" solo en tareas
    detailCatWrap.hidden = false; // "Categoría" solo en planificadas
    detailCat.value = item.category || "";
    detailAddHoyWrap.hidden = false; // "Añadir a Hoy" solo en planificadas
    detailAddHoy.checked = !!item.addToHoy;
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
    openExternTask = task;
    detailCheck.hidden = false;
    detailCheck.checked = task.done;
    detailTitle.value = task.text;
    detailTitle.classList.toggle("is-done", task.done);
    detailTitle.readOnly = true; // el texto se edita en App lactancia
    detailTaskFields.hidden = true; // sin fecha ni subtareas
    detailRepeatSection.hidden = true;
    detailProjectWrap.hidden = true;
    detailStateWrap.hidden = true;
    detailCatWrap.hidden = true;
    // "Añadir a Hoy": también en las de otras apps. Se oculta donde no aplica
    // (las de "antes de la extracción", que ya tienen su sección en Hoy) y
    // donde ya lo manda la plantilla de lactancia, igual que en la copia de una
    // rutina que lleva el ajuste puesto: ahí se decide en la otra app.
    detailAddHoyWrap.hidden = !hoyExternKey(task) || lactAutoHoy(task);
    detailAddHoy.checked = isHoyFijada(task) || lactAutoHoy(task);
    detailTypeWrap.hidden = true; // no se puede mover de lista
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
    openExternTask = task;
    detailCheck.hidden = false;
    detailCheck.checked = task.done;
    detailTitle.value = task.text;
    detailTitle.classList.toggle("is-done", task.done);
    detailTitle.readOnly = true; // el texto se edita en App tareas
    detailTaskFields.hidden = true; // sin fecha ni subtareas
    detailRepeatSection.hidden = true;
    detailProjectWrap.hidden = true;
    detailStateWrap.hidden = true;
    detailCatWrap.hidden = true;
    // "Añadir a Hoy": también en las de otras apps. Se oculta donde no aplica
    // (las de "antes de la extracción", que ya tienen su sección en Hoy).
    detailAddHoyWrap.hidden = !hoyExternKey(task);
    detailAddHoy.checked = isHoyFijada(task);
    detailTypeWrap.hidden = true; // no se puede mover de lista
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
    openExternTask = null;
    detailCheck.hidden = false;
    detailTitle.readOnly = false; // restaura edición del título
    detailNote.hidden = false; // restaura la nota
    if (detailNoteLabel) detailNoteLabel.hidden = false;
    detailTaskFields.hidden = false; // restaura los campos de tarea
    detailRepeatSection.hidden = true; // "Repetir" y "Categoría" solo en rutinas
    detailProjectWrap.hidden = true;
    detailStateWrap.hidden = true;
    detailCatWrap.hidden = true;
    // "Añadir a Hoy": fija esta tarea en "Durante el día". En la copia de una
    // rutina que ya lo lleva puesto no se ofrece: ahí lo manda la rutina y
    // todas sus repeticiones nacen en Hoy, así que el interruptor solo
    // confundiría.
    const rutinaDeTask = plannedOf(task);
    detailAddHoyWrap.hidden = !!(rutinaDeTask && rutinaDeTask.addToHoy);
    detailAddHoy.checked = !!task.hoyDia;
    detailDelete.hidden = false;
    openTaskId = id;
    detailTitle.value = task.text;
    detailTitle.classList.toggle("is-done", task.done);
    detailNote.value = task.note || "";
    detailCheck.checked = task.done;
    renderDate(task);
    renderSubtasks(task);
    renderDetailType();
    renderDetailProject(task);
    renderDetailState(task);
    subtaskInput.value = "";
    overlay.hidden = false;
    document.body.classList.add("no-scroll");
    // Ajusta la altura del título ya con el modal visible (si no, scrollHeight es 0)
    autoGrow(detailTitle);
  }

  /* ---------- "Tipo": mover la tarea de lista ----------
     Tareas / Recados / Pendientes comparten formato: se mueve el objeto de un
     array a otro. Rutinas (planificadas) es otro modelo: al convertir se crea
     la entrada nueva con el texto y la nota, y se borra la de origen. */
  const CTX_BY_TYPE = {
    tareas: () => ctxTareas,
    recados: () => ctxRecados,
    pendientes: () => ctxPendientes,
    sinTipo: () => ctxSinTipo,
  };

  // Tipo actual de lo que hay abierto en el panel (null = no aplica)
  function detailTypeOf() {
    if (openPlannedId !== null) return "rutinas";
    if (openTaskId === null) return null;
    const e = findTaskEntry(openTaskId);
    if (!e || e.item.sourcePlannedId) return null; // copia de una rutina
    if (e.ctx === ctxRecados) return "recados";
    if (e.ctx === ctxPendientes) return "pendientes";
    if (e.ctx === ctxTareas) return "tareas";
    if (e.ctx === ctxSinTipo) return "sinTipo";
    return null;
  }

  // Muestra el selector con el valor actual (o lo oculta si no aplica).
  // "Sin tipo" solo se ofrece con un proyecto asignado: sin él la tarea no se
  // vería en ninguna parte.
  function renderDetailType() {
    const type = detailTypeOf();
    detailTypeWrap.hidden = !type;
    const task = getOpenTask();
    const optSinTipo = detailType.querySelector('option[value="sinTipo"]');
    if (optSinTipo)
      optSinTipo.hidden = !(task && task.projectId) && type !== "sinTipo";
    if (type) detailType.value = type;
  }

  function moveTaskToList(target) {
    const e = findTaskEntry(openTaskId);
    if (!e) return;
    const task = e.item;
    e.ctx.setItems(e.ctx.items().filter((t) => t.id !== task.id));
    e.ctx.save();
    const ctx = CTX_BY_TYPE[target]();
    ctx.items().unshift(task);
    ctx.save();
    renderAllLists();
    renderDetailType();
  }

  // Tarea → rutina: la fecha y las subtareas no existen en una rutina
  function taskToPlanned() {
    const e = findTaskEntry(openTaskId);
    if (!e) return false;
    const task = e.item;
    const pierde =
      (task.subtasks && task.subtasks.length) ||
      (task.dateMode && task.dateMode !== "none");
    if (
      pierde &&
      !confirm(
        "Al convertirla en rutina se pierden la fecha y las subtareas. ¿Continuar?"
      )
    )
      return false;
    const p = {
      id: newId(),
      text: task.text,
      createdAt: todayISO(),
      category: "",
    };
    if (task.note && task.note.trim()) p.note = task.note;
    planned.unshift(p);
    savePlanned();
    e.ctx.setItems(e.ctx.items().filter((t) => t.id !== task.id));
    e.ctx.save();
    renderAllLists();
    renderPlanned();
    openPlannedNote(p.id); // el panel pasa a los campos de rutina
    return true;
  }

  // Rutina → tarea: se descarta la repetición y la copia pendiente que hubiera
  function plannedToTask(target) {
    const p = planned.find((x) => x.id === openPlannedId);
    if (!p) return;
    const task = { id: newId(), text: p.text, done: false, starred: false };
    if (p.note && p.note.trim()) task.note = p.note;
    const ctx = CTX_BY_TYPE[target]();
    ctx.items().unshift(task);
    ctx.save();
    // La copia de esta rutina que estuviera pendiente deja de tener sentido
    if (p.currentInstanceId) {
      rememberDeleted(p.currentInstanceId);
      tasks = tasks.filter((t) => t.id !== p.currentInstanceId);
      save();
    }
    rememberDeleted(p.id);
    planned = planned.filter((x) => x.id !== p.id);
    savePlanned();
    renderAllLists();
    renderPlanned();
    openDetail(task.id); // el panel pasa a los campos de tarea
  }

  /* ---------- "Proyecto": a qué proyecto pertenece la tarea ----------
     Solo para las tareas de Tareas / Recados / Pendientes. Si el proyecto se
     elimina, la referencia deja de resolver y el byline no muestra nada. */
  function taskProjectOf(task) {
    if (!task || !task.projectId) return null;
    return proyectos.find((x) => x.id === task.projectId) || null;
  }

  function taskProjectName(task) {
    const p = taskProjectOf(task);
    return p ? p.text : "";
  }

  // Color de la categoría del proyecto (el color vive en el CSS: .cat-<id>)
  function proyectoCatClass(item) {
    return item && item.category ? " cat-" + item.category : "";
  }

  // Rellena el selector (los proyectos cambian) y marca el de la tarea abierta
  function renderDetailProject(task) {
    // Las copias de rutinas se regeneran cada ciclo: no se les asigna proyecto
    const show = !!task && !task.sourcePlannedId && !task._lact && !task._at;
    detailProjectWrap.hidden = !show;
    if (!show) return;
    detailProject.innerHTML = "";
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "Sin proyecto";
    detailProject.appendChild(none);
    proyectos.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.text;
      detailProject.appendChild(opt);
    });
    detailProject.value = taskProjectName(task) ? task.projectId : "";
  }

  /* ---------- Estado de una tarea dentro de su proyecto ----------
     Cinco estados. "Completada" es el `done` de siempre (el mismo que la
     casilla), "Bloqueada" sale sola de las flechas del grafo, y los otros tres
     se eligen a mano. Orden de mando: completada > bloqueada > lo elegido.
     "En espera" y "Bloqueada" comparten efecto fuera del proyecto: la tarea no
     se ve en ninguna lista (la diferencia es quién lo decide, el diagrama o
     tú). Se guarda en `projectState`, igual que "En proceso". */
  const TASK_STATES = [
    { id: "proceso", name: "En proceso" },
    { id: "sin-empezar", name: "Sin empezar" },
    { id: "espera", name: "En espera" },
    { id: "bloqueada", name: "Bloqueadas" },
    { id: "completada", name: "Completadas" },
  ];

  // ¿El proyecto usa la vista de diagrama? Es lo normal: solo está apagada si
  // se ha desactivado a mano en sus ajustes. Sin diagrama no hay flechas, y por
  // tanto tampoco tareas bloqueadas.
  function proyectoConDiagrama(proyecto) {
    return !!proyecto && proyecto.diagram !== false;
  }

  // Tareas del proyecto a las que apunta alguna flecha desde otra que sigue
  // pendiente. Una tarea completada ya no bloquea a la que va después: si no,
  // lo bloqueado no se desbloquearía nunca.
  function proyectoBlockedIds(proyecto) {
    if (!proyecto || !proyectoConDiagrama(proyecto)) return new Set();
    const bloquea = (id) => {
      const e = findTaskEntry(id);
      return !!e && e.item.projectId === proyecto.id && !e.item.done;
    };
    return new Set(
      proyectoLinks(proyecto)
        .filter((l) => bloquea(l.from))
        .map((l) => l.to)
    );
  }

  // ¿La tarea está bloqueada por otra de su proyecto? Se usa para esconderla
  // de Tareas, Recados, Pendientes y Mis tareas: todavía no toca hacerla.
  // La comprobación cara solo corre para las tareas que tienen proyecto.
  function isTaskBlocked(task) {
    if (!task || !task.projectId || task.done) return false;
    const proyecto = proyectos.find((p) => p.id === task.projectId);
    if (!proyecto) return false;
    return proyectoBlockedIds(proyecto).has(task.id);
  }

  // ¿Está "En espera" dentro de su proyecto? Es la versión a mano de lo mismo:
  // la tarea existe, pero ahora no toca.
  function isTaskWaiting(task) {
    return (
      !!task && !!task.projectId && !task.done && task.projectState === "espera"
    );
  }

  // Tareas que no salen de su proyecto: bloqueadas por el diagrama o en espera.
  // Es el filtro que usan todas las listas de tareas.
  function isTaskOnHold(task) {
    return isTaskWaiting(task) || isTaskBlocked(task);
  }

  function taskStateOf(task, bloqueadas) {
    if (task.done) return "completada";
    if (bloqueadas && bloqueadas.has(task.id)) return "bloqueada";
    if (task.projectState === "espera") return "espera";
    return task.projectState === "proceso" ? "proceso" : "sin-empezar";
  }

  function taskStateName(id) {
    const s = TASK_STATES.find((x) => x.id === id);
    if (!s) return "";
    // En singular para la etiqueta de una tarea
    if (id === "bloqueada") return "Bloqueada";
    if (id === "completada") return "Completada";
    return s.name;
  }

  function renderDetailState(task) {
    const proyecto = taskProjectOf(task);
    detailStateWrap.hidden = !proyecto;
    if (!proyecto) {
      detailState.disabled = false; // sin proyecto no hay bloqueo que arrastrar
      return;
    }
    detailState.value = task.done
      ? "completada"
      : task.projectState === "proceso" || task.projectState === "espera"
      ? task.projectState
      : "sin-empezar";
    const bloqueada =
      !task.done && proyectoBlockedIds(proyecto).has(task.id);
    // Bloqueada: el estado se ve, pero no se toca. Lo manda el grafo, igual
    // que en el board, donde su columna tampoco se arrastra.
    detailState.disabled = bloqueada;
    detailStateHint.hidden = !bloqueada;
  }

  detailState.addEventListener("change", () => {
    const task = getOpenTask();
    if (!task) return;
    const valor = detailState.value;
    if (valor === "completada") {
      if (!task.done) {
        task.done = true;
        task.completedAt = todayISO();
        task.starred = false; // al completar, deja de estar destacada
      }
    } else {
      if (task.done) {
        task.done = false;
        delete task.completedAt;
      }
      if (valor === "proceso" || valor === "espera") task.projectState = valor;
      else delete task.projectState;
    }
    saveOpenTask();
    detailCheck.checked = task.done; // la casilla del panel, al día
    detailTitle.classList.toggle("is-done", task.done);
    renderDetailState(task);
    renderAllLists();
  });

  detailProject.addEventListener("change", () => {
    const task = getOpenTask();
    if (!task) return;
    if (detailProject.value) task.projectId = detailProject.value;
    else delete task.projectId;
    saveOpenTask();
    // Una tarea sin tipo solo se ve dentro de su proyecto: si se queda sin él,
    // vuelve a Tareas para no desaparecer de la app.
    if (!task.projectId && detailTypeOf() === "sinTipo") {
      moveTaskToList("tareas");
      alert(
        "La tarea no tenía tipo y ya no está en ningún proyecto: se ha movido a Tareas."
      );
    }
    renderDetailType();
    renderAllLists();
  });

  detailType.addEventListener("change", () => {
    const from = detailTypeOf();
    const target = detailType.value;
    if (!from || from === target) return;
    // Sin tipo, la tarea solo se ve en su proyecto: sin proyecto no vale (el
    // selector ya lo esconde, pero no todos los navegadores lo respetan).
    const abierta = getOpenTask();
    if (target === "sinTipo" && !(abierta && abierta.projectId)) {
      alert(
        "Para dejar una tarea sin tipo hay que asignarle antes un proyecto: si no, no se vería en ninguna parte."
      );
      renderDetailType(); // vuelve al valor que tenía
      return;
    }
    if (from === "rutinas") plannedToTask(target);
    else if (target === "rutinas") {
      if (!taskToPlanned()) renderDetailType(); // cancelado: vuelve al valor
    } else moveTaskToList(target);
  });

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
    openExternTask = null;
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
    if (task) renderDetailState(task); // "Completada" es el mismo `done`
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

  // Asa de arrastre de las listas por día (Agenda y "Durante el día"): la
  // comparten las tareas de Agenda y las de Tareas/Recados con fecha.
  function dayHandleEl() {
    const handle = document.createElement("span");
    handle.className = "day-handle";
    handle.textContent = "⠿";
    handle.setAttribute("aria-label", "Reordenar tarea");
    handle.title = "Arrastra para reordenar";
    return handle;
  }

  // Construye el <li> de una tarea (se usa en la lista de pendientes y en la
  // de completadas). `origin` (opcional): etiqueta de procedencia, p. ej.
  // "Tarea" o "Recado" (ver ORIGEN), para las destacadas que se agrupan en
  // Cuanto antes.
  // `opts` (opcional): { hideDate, hideStar, hideProject, hideCheck, dragHandle } — en la
  // Agenda la fecha y el destacado sobran, porque la tarea ya está colocada en
  // su día; `hideCheck` quita la casilla (el board de un proyecto, donde el
  // estado lo dice la columna), y `dragHandle` añade el asa para reordenarla
  // dentro del día.
  function createTaskItem(task, origin, opts) {
    const o = opts || {};
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
    if (task._lact || task._at) {
      // Tarea de otra app: su propio byline. Lactancia trae el suyo (p. ej.
      // "Extracción 2 · 12:40") y App tareas, la fecha que tenga asignada allí.
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

    // Control de estado: checkbox, salvo donde sobre (board del proyecto)
    let control = null;
    if (!o.hideCheck) {
      control = document.createElement("input");
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
    }

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

    // 2ª línea: procedencia (Tareas / Recados), proyecto asignado y fecha,
    // separados por " · ".
    const dateText =
      dateLabel && !o.hideDate ? (showClock ? "🕑 " : "") + dateLabel : "";
    // Dentro de la página del proyecto, su nombre sobra en cada tarea
    const project = o.hideProject ? null : taskProjectOf(task);
    if (origin || project || dateText) {
      const dateLine = document.createElement("span");
      dateLine.className = "task-date";
      let first = true;
      const addSep = () => {
        if (!first) dateLine.appendChild(document.createTextNode(" · "));
        first = false;
      };
      if (origin) {
        // La procedencia va en el color de acento
        addSep();
        const originEl = document.createElement("span");
        originEl.className = "task-origin";
        originEl.textContent = origin;
        dateLine.appendChild(originEl);
      }
      if (project) {
        // Va en el color de su categoría (o en el color suave, si no tiene)
        addSep();
        const projectEl = document.createElement("span");
        projectEl.className = "task-project" + proyectoCatClass(project);
        projectEl.textContent = project.text;
        dateLine.appendChild(projectEl);
      }
      if (dateText) {
        addSep();
        dateLine.appendChild(document.createTextNode(dateText));
      }
      main.appendChild(dateLine);
    }

    // Las tareas automáticas (copias de rutinas y las que vienen de App
    // lactancia o App tareas) no se destacan y no llevan nada a la derecha: se
    // reconocen por su color de fondo y por lo que dice su 2ª línea.
    const esAutomatica = !!(task._lact || task._at || task.sourcePlannedId);
    let trailing;
    if (!esAutomatica && !o.hideStar) {
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

    // En las listas por día se arrastra desde el asa (como las de Agenda)
    if (o.dragHandle) li.appendChild(dayHandleEl());
    if (control) li.appendChild(control);
    li.appendChild(main);
    if (trailing) li.appendChild(trailing);
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
      li.className =
        "planned-item" + (item.category ? " cat-" + item.category : "");
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
      } else if (item.repeat === "monthly" && item.repeatDom) {
        repeatLine = "Todos los " + item.repeatDom + " de cada mes";
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
    updateNavCounts();
  }

  function renderList(ctx) {
    if (!ctx.listEl) return; // contexto sin vista propia (tareas sin tipo)
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
    // Tabs: filtran la lista de pendientes. El resumen y las completadas
    // siguen contando la lista entera.
    const tabValue = ctx.tabFilter || "all";
    const pending =
      ctx.tabMatch && tabValue !== "all"
        ? pendingAll.filter((t) => ctx.tabMatch(t, tabValue))
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
    if (ctx.emptyTexts && ctx.emptyTexts[tabValue])
      ctx.emptyEl.textContent = ctx.emptyTexts[tabValue];

    // Estado y contador de cada tab (sobre las pendientes, sin filtrar)
    if (ctx.tabsEl) {
      ctx.tabsEl.querySelectorAll(".task-tab").forEach((tab) => {
        const v = tab.dataset.tab;
        const n =
          v === "all" || !ctx.tabMatch
            ? pendingAll.length
            : pendingAll.filter((t) => ctx.tabMatch(t, v)).length;
        tab.textContent = tab.dataset.label + (n ? " (" + n + ")" : "");
        const active = v === tabValue;
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

    updateNavCounts();
  }

  /* ---------- Contadores de la navegación ----------
     Número de pendientes de cada lista, junto a su entrada del menú (barra
     lateral en escritorio y menú "Más" en móvil). */
  function navCounts() {
    const pend = (arr) =>
      arr.filter((t) => !t.done && !isTaskOnHold(t)).length;
    return {
      tareas: tasks.filter(
        (t) => !t.sourcePlannedId && !t.done && !isTaskOnHold(t)
      ).length,
      recados: pend(recados),
      // Rutinas: las mismas pendientes que pinta su lista (repeticiones
      // propias + tareas automáticas de otras apps), por eso reusa su contexto.
      repeticiones:
        tasks.filter((t) => !t.done && ctxRepeticiones.filter(t)).length +
        ctxRepeticiones.externalPending().length,
      pendientes: pend(pendientes),
      proyectos: proyectos.length, // los proyectos no se completan
      planificadas: planned.length, // las rutinas no se completan
    };
  }

  function updateNavCounts() {
    const counts = navCounts();
    document
      .querySelectorAll(".app-nav-item[data-view], .menu-item[data-view]")
      .forEach((el) => {
        const n = counts[el.dataset.view];
        if (n === undefined) return;
        let badge = el.querySelector(".nav-count");
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "nav-count";
          el.appendChild(badge);
        }
        badge.textContent = n ? String(n) : "";
        badge.hidden = !n;
      });
  }

  function render() {
    renderList(ctxTareas);
  }
  // Una misma tarea puede verse en dos vistas (una destacada sale en Tareas o
  // Recados y también en Cuanto antes), así que las acciones repintan todas.
  function renderAllLists() {
    renderList(ctxTareas);
    renderList(ctxRutinas);
    renderList(ctxRepeticiones);
    renderList(ctxRecados);
    renderList(ctxPendientes);
    // Ambas muestran tareas/recados con fecha: la Agenda los de la semana y
    // Hoy los del día.
    renderAgenda();
    renderHoyView();
    renderProyectos(); // cada proyecto lleva su número de tareas
  }
  // "Mis tareas" y Rutinas se nutren de lo mismo (copias de planificadas y
  // tareas automáticas de otras apps): lo que repinta una, repinta la otra.
  function renderRutinas() {
    renderList(ctxRutinas);
    renderList(ctxRepeticiones);
  }
  function renderRepeticiones() {
    renderList(ctxRepeticiones);
  }
  // `tasks` alimenta a Tareas, "Mis tareas" y Rutinas: repinta las tres.
  function renderTasksViews() {
    renderList(ctxTareas);
    renderList(ctxRutinas);
    renderList(ctxRepeticiones);
  }
  function renderRecados() {
    renderList(ctxRecados);
  }
  function renderPendientes() {
    renderList(ctxPendientes);
  }

  /* ---------- Eventos ---------- */
  // Tabs de filtro (solo "Mis tareas": por procedencia)
  [ctxRutinas].forEach((ctx) => {
    if (!ctx.tabsEl) return;
    ctx.tabsEl.addEventListener("click", (e) => {
      const tab = e.target.closest(".task-tab");
      if (!tab) return;
      ctx.tabFilter = tab.dataset.tab;
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
  repeticionesToggleDone.addEventListener("click", () => {
    ctxRepeticiones.doneVisible = !ctxRepeticiones.doneVisible;
    renderList(ctxRepeticiones);
  });

  clearDoneBtn.addEventListener("click", () => clearDoneIn(ctxTareas));
  recadosClearDone.addEventListener("click", () => clearDoneIn(ctxRecados));
  pendientesClearDone.addEventListener("click", () => clearDoneIn(ctxPendientes));
  rutinasClearDone.addEventListener("click", () => clearDoneIn(ctxRutinas));
  repeticionesClearDone.addEventListener("click", () =>
    clearDoneIn(ctxRepeticiones)
  );

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
  // onCommit (opcional): recibe los ids en el orden del DOM y se encarga de
  // persistir. Para listas mixtas, que no salen de un único array (getItems y
  // saveFn se ignoran en ese caso).
  function enableReorder(
    container,
    itemClass,
    getItems,
    saveFn,
    handleClass,
    onCommit
  ) {
    let pressTimer = null;
    let dragEl = null;
    let dragging = false;
    let moved = false; // el arrastre ha cambiado el orden (si no, no se guarda)
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
      moved = false;
      reorderDragging = true;
      dragEl.classList.add("dragging");
      try {
        if (pointerId != null) dragEl.setPointerCapture(pointerId);
      } catch (e) {
        /* algunos navegadores no lo permiten; no es crítico */
      }
    }

    function commitOrder() {
      const allIds = [...container.querySelectorAll("." + itemClass)].map(
        (li) => li.dataset.id
      );
      if (onCommit) {
        onCommit(allIds);
        return;
      }
      // Reordena el array real según el orden del DOM (solo elementos visibles),
      // dejando en su sitio los que no estén en el DOM (por filtro).
      const items = getItems();
      const byId = {};
      items.forEach((t) => (byId[t.id] = t));
      const domIds = allIds.filter((id) => byId[id]); // ignora tareas externas (no están en el array real)
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
        if (moved) commitOrder(); // un toque en el asa no reescribe nada
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
      // Las tareas externas (App lactancia / App tareas) no están en ningún
      // array nuestro, así que no se pueden colocar donde el orden ES el del
      // array. Donde el orden es una lista de ids aparte (`onCommit`: el día de
      // Hoy y de Agenda, que guardan en `dayOrder`) sí se mezclan con el resto.
      if (
        !onCommit &&
        li.dataset.id &&
        (li.dataset.id.indexOf("lact:") === 0 || li.dataset.id.indexOf("at:") === 0)
      )
        return;
      dragEl = li;
      startX = e.clientX;
      startY = e.clientY;
      cancelPress();
      if (handleClass) {
        // Desde un asa el arrastre empieza al momento: el asa ya distingue el
        // gesto del scroll o del toque en la tarea. Esperar al long-press lo
        // cancelaba, porque al agarrar el asa ya se mueve el dedo.
        e.preventDefault();
        startDrag(e.pointerId);
      } else {
        pressTimer = setTimeout(() => startDrag(e.pointerId), LONG_PRESS_MS);
      }
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
        if (container.lastElementChild !== dragEl) {
          container.appendChild(dragEl);
          moved = true;
        }
      } else if (after !== dragEl && dragEl.nextElementSibling !== after) {
        container.insertBefore(dragEl, after);
        moved = true;
      }
    });

    container.addEventListener("pointerup", endDrag);
    container.addEventListener("pointercancel", endDrag);
  }

  enableReorder(list, "task-item", () => tasks, save);
  enableReorder(rutinasList, "task-item", () => tasks, save);
  enableReorder(repeticionesList, "task-item", () => tasks, save);
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
    "repeticiones",
    "pendientes",
    "planificadas",
    "proyectos",
  ];

  let currentView = "tareas";

  // `proyectoId` (opcional) solo cuenta en la vista Proyectos: entra directa a
  // ese proyecto, que es como se vuelve al mismo sitio al recargar la página.
  function activateView(view, proyectoId) {
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
    // Proyectos ocupa todo el ancho; el resto de vistas van en columna estrecha
    const main = document.querySelector(".app-main");
    if (main) main.classList.toggle("is-wide", view === "proyectos");
    if (view === "hoy") renderHoy();
    else if (view === "agenda") renderAgenda();
    else if (view === "tareas") render();
    else if (view === "rutinas") renderRutinas();
    else if (view === "repeticiones") renderRepeticiones();
    else if (view === "recados") renderRecados();
    else if (view === "pendientes") renderPendientes();
    else if (view === "proyectos") {
      // Sin id en el hash se entra por el índice; con él, al proyecto
      proyectoOpenId = proyectoId || null;
      clearProyectoSel();
      renderProyectos();
    }
    else if (view === "planificadas") renderPlanned();
  }

  // El hash es "#vista" o, dentro de un proyecto, "#proyectos/<id>"
  function routeFromHash() {
    const raw = (location.hash || "").replace(/^#/, "");
    const corte = raw.indexOf("/");
    if (corte === -1) return { view: raw, id: "" };
    return { view: raw.slice(0, corte), id: raw.slice(corte + 1) };
  }

  function applyHash() {
    const r = routeFromHash();
    activateView(r.view, r.id);
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

  window.addEventListener("hashchange", applyHash);

  /* ---------- Navegación móvil: barra inferior + menú "Más" + botón ＋ ----------
     La barra tiene Hoy / Agenda / Mis tareas y un "Más" con el resto de vistas
     (Ajustes incluido). El botón "Mis tareas" abre la vista interna `rutinas`;
     la lista completa de Tareas queda en "Más". */
  const mobileTabbar = document.getElementById("mobile-tabbar");
  const moreMenu = document.getElementById("more-menu");
  const moreClose = document.getElementById("more-close");
  // Vistas que tienen botón propio en la barra ("Mis tareas" = `rutinas`)
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

  /* ---------- Botón ＋: creación en dos pasos ----------
     Paso 1: qué crear. Paso 2: sus datos (nombre, destacada, fecha, según el
     tipo). Crea en el sitio, sin salir de la vista actual. Las rutinas no
     tienen fecha ni destacado: su repetición se configura al abrirlas. */
  const fabBtn = document.getElementById("fab-btn");
  const fabOverlay = document.getElementById("fab-overlay");
  const fabTitle = document.getElementById("fab-title");
  const fabStepType = document.getElementById("fab-step-type");
  const fabBack = document.getElementById("fab-back");
  const fabForm = document.getElementById("fab-form");
  const fabText = document.getElementById("fab-text");
  const fabTaskFields = document.getElementById("fab-task-fields");
  const fabDateMode = document.getElementById("fab-date-mode");
  const fabDateFields = document.getElementById("fab-date-fields");
  const fabDateStart = document.getElementById("fab-date-start");
  const fabDateEnd = document.getElementById("fab-date-end");
  const fabDateSep = document.getElementById("fab-date-sep");
  const fabStar = document.getElementById("fab-star");
  const fabHint = document.getElementById("fab-hint");

  const FAB_TITLES = {
    tareas: "Nueva tarea",
    recados: "Nuevo recado",
    rutinas: "Nueva rutina",
    pendientes: "Nuevo pendiente",
    proyectos: "Nuevo proyecto",
  };
  // Lo que no es una tarea se crea solo con el nombre; el resto se configura
  // después, al abrirlo.
  const FAB_HINTS = {
    rutinas: "La repetición se configura al abrir la rutina.",
    proyectos: "El enlace se añade al abrir el proyecto.",
  };
  let fabTypeValue = "tareas"; // elegido en el paso 1

  // Campos visibles según el tipo y el modo de fecha elegidos
  function renderFabFields() {
    const hint = FAB_HINTS[fabTypeValue] || "";
    fabTaskFields.hidden = !!hint; // destacada y fecha: solo en tareas
    fabHint.hidden = !hint;
    if (hint) fabHint.textContent = hint;
    const mode = fabDateMode.value;
    fabDateFields.hidden = mode === "none";
    fabDateEnd.hidden = mode !== "between";
    fabDateSep.hidden = mode !== "between";
  }

  // Paso 1: elegir tipo
  function fabShowTypeStep() {
    fabTitle.textContent = "¿Qué quieres crear?";
    fabStepType.hidden = false;
    fabForm.hidden = true;
  }

  // Paso 2: datos del tipo elegido
  function fabShowFormStep(type) {
    fabTypeValue = type;
    fabTitle.textContent = FAB_TITLES[type] || "Crear";
    fabForm.reset();
    fabDateMode.value = "none";
    renderFabFields();
    fabStepType.hidden = true;
    fabForm.hidden = false;
    fabText.focus();
  }

  function openFab() {
    fabShowTypeStep();
    fabOverlay.hidden = false;
  }
  function closeFab() {
    fabOverlay.hidden = true;
  }

  if (fabBtn) {
    fabBtn.addEventListener("click", openFab);
    fabBack.addEventListener("click", fabShowTypeStep);
    fabDateMode.addEventListener("change", renderFabFields);
    fabStepType.addEventListener("click", (e) => {
      const choice = e.target.closest(".fab-choice");
      if (choice) fabShowFormStep(choice.dataset.create);
    });
    fabOverlay.addEventListener("click", (e) => {
      if (e.target === fabOverlay) closeFab();
    });

    fabForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = fabText.value.trim();
      if (!text) {
        fabText.focus();
        return;
      }
      if (fabTypeValue === "rutinas") {
        planned.unshift({
          id: newId(),
          text: text,
          createdAt: todayISO(),
          category: "",
        });
        savePlanned();
        renderPlanned();
      } else if (fabTypeValue === "proyectos") {
        addProyecto(text);
      } else {
        const task = {
          id: newId(),
          text: text,
          done: false,
          starred: fabStar.checked,
        };
        const mode = fabDateMode.value;
        if (mode !== "none" && fabDateStart.value) {
          task.dateMode = mode;
          task.dateStart = fabDateStart.value;
          if (mode === "between" && fabDateEnd.value)
            task.dateEnd = fabDateEnd.value;
        }
        const ctx = CTX_BY_TYPE[fabTypeValue]();
        ctx.items().unshift(task);
        ctx.save();
        renderAllLists();
      }
      closeFab();
      closeMoreMenu();
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
    const payload = {
      tasks,
      recados,
      pendientes,
      sinTipo,
      proyectos,
      proyectoSecciones,
      planned,
    };
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
        let inSinTipo = null;
        let inProyectos = null;
        let inProSecciones = null;
        let inPlanned = null;
        if (Array.isArray(parsed)) {
          inTasks = parsed;
        } else if (parsed && typeof parsed === "object") {
          inTasks = Array.isArray(parsed.tasks) ? parsed.tasks : null;
          inRecados = Array.isArray(parsed.recados) ? parsed.recados : null;
          inPendientes = Array.isArray(parsed.pendientes)
            ? parsed.pendientes
            : null;
          inSinTipo = Array.isArray(parsed.sinTipo) ? parsed.sinTipo : null;
          inProyectos = Array.isArray(parsed.proyectos)
            ? parsed.proyectos
            : null;
          inProSecciones = Array.isArray(parsed.proyectoSecciones)
            ? parsed.proyectoSecciones
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
        if (inSinTipo) {
          sinTipo = inSinTipo.map(ensureId);
          saveSinTipo();
        }
        if (inProSecciones) {
          proyectoSecciones = inProSecciones.map(ensureId);
          saveProyectoSecciones();
          renderProyectos();
        }
        if (inProyectos) {
          proyectos = inProyectos.map(ensureId);
          saveProyectos();
          renderProyectos();
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

  /* ---------- Vista de Hoy (secciones dinámicas, edición en la propia vista) ---------- */
  const hoyAddSectionBtn = document.getElementById("hoy-add-section");
  const hoyViewSectionsEl = document.getElementById("hoy-view-sections");

  // Clase de color según la categoría (solo si la tarea es temporal)
  function hoyCatClass(item) {
    return item.temporal && item.category ? " cat-" + item.category : "";
  }

  /* ---------- Modo edición ---------- */
  // No se persiste: al recargar, la vista vuelve al modo normal.
  let hoyEditMode = false;

  // Recuerda/restaura el foco al repintar (al añadir una tarea se reconstruyen
  // los campos y se perdería).
  function hoyCaptureFocus() {
    const a = document.activeElement;
    if (!a || !hoyViewSectionsEl.contains(a)) return null;
    const caret = typeof a.selectionStart === "number" ? a.selectionStart : null;
    if (a.classList.contains("hoy-section-name"))
      return { type: "name", section: a.dataset.section, caret: caret };
    if (a.classList.contains("hoy-add-input"))
      return { type: "add", section: a.dataset.section, caret: caret };
    return null;
  }

  function hoyRestoreFocus(key) {
    if (!key) return;
    const sel =
      key.type === "name"
        ? '.hoy-section-name[data-section="' + key.section + '"]'
        : '.hoy-add-input[data-section="' + key.section + '"]';
    const el = hoyViewSectionsEl.querySelector(sel);
    if (!el) return;
    el.focus();
    if (key.caret != null) {
      try {
        el.setSelectionRange(key.caret, key.caret);
      } catch (e) {
        /* algunos inputs no lo soportan */
      }
    }
  }

  // Cabecera de sección (modo edición): asa + nombre editable + eliminar
  function hoySectionHead(sec, addInput) {
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
    // Al escribir solo se toca la memoria (repintar aquí perdería el foco);
    // se persiste al salir del campo.
    name.addEventListener("input", () => {
      const v = name.value.trim();
      if (!v) return;
      sec.name = v;
      if (addInput) addInput.placeholder = "Añadir a " + v + "…";
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

    const del = document.createElement("button");
    del.type = "button";
    del.className = "hoy-section-del";
    del.textContent = "🗑";
    del.setAttribute("aria-label", "Eliminar sección");
    del.addEventListener("click", () => deleteSection(sec.id));

    head.append(handle, name, del);
    return head;
  }

  // Cabecera de la sección automática: en edición lleva asa (para colocarla
  // donde se quiera) pero no se renombra ni se elimina.
  function hoyAutoHead(sec) {
    if (!hoyEditMode) {
      const title = document.createElement("h2");
      title.className = "hoy-view-title";
      title.textContent = sec.name;
      return title;
    }
    const head = document.createElement("div");
    head.className = "hoy-section-head";

    const handle = document.createElement("span");
    handle.className = "hoy-section-handle";
    handle.textContent = "⠿";
    handle.setAttribute("aria-label", "Reordenar sección");
    handle.title = "Arrastra para reordenar";

    const name = document.createElement("span");
    name.className = "hoy-section-name is-auto";
    name.textContent = sec.name;

    head.append(handle, name);
    return head;
  }

  // Formulario para añadir tareas a una sección (solo en modo edición)
  function hoyAddForm(sec) {
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
      const value = addInput.value;
      addInput.value = "";
      addHoy(sec.id, value);
      // El repintado recrea el campo: hay que volver a enfocar el nuevo
      const fresh = hoyViewSectionsEl.querySelector(
        '.hoy-add-input[data-section="' + sec.id + '"]'
      );
      if (fresh) fresh.focus();
    });
    return form;
  }

  // Byline "Hace N días" a partir de la última fecha de completado.
  function hoyLastDoneLabel(iso) {
    if (!iso) return "Sin completar todavía";
    const d = diffDiasLact(iso, todayISO());
    if (d <= 0) return "Hoy";
    return d === 1 ? "Hace 1 día" : "Hace " + d + " días";
  }

  // Registro de compleciones (fechas ISO, una por cada vez que se ha marcado).
  // Las tareas anteriores al registro solo guardaban la última compleción: esa
  // fecha se toma como la única entrada conocida.
  function hoyDoneLog(item) {
    const raw = item.doneLog;
    const arr = Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object"
      ? Object.values(raw)
      : [];
    // Una fecha como mucho por día: completar dos veces el mismo día no es
    // posible (el reseteo diario desmarca una vez, y marcar/desmarcar/marcar
    // apila y desapila). Las repetidas son restos de un error anterior.
    const vistas = {};
    const log = arr.filter((d) => {
      if (typeof d !== "string" || !d || vistas[d]) return false;
      vistas[d] = true;
      return true;
    });
    if (!log.length && item.lastDoneAt) return [item.lastDoneAt];
    return log;
  }

  // Compleciones agrupadas por semana (de lunes a domingo), de la más reciente
  // a la más antigua. Solo salen las semanas con datos y desde HOY_STATS_START.
  function hoyDoneByWeek(item) {
    const counts = {};
    hoyDoneLog(item).forEach((iso) => {
      if (iso < HOY_STATS_START) return; // anterior al inicio del registro
      const monday = addDaysISO(iso, -(dowOf(iso) - 1));
      counts[monday] = (counts[monday] || 0) + 1;
    });
    return Object.keys(counts)
      .sort()
      .reverse()
      .map((monday) => ({ monday: monday, count: counts[monday] }));
  }

  // "4 – 10 ago" (o "28 jul – 3 ago"), con el año si no es el actual
  function hoyWeekLabel(monday) {
    const sunday = addDaysISO(monday, 6);
    const p = monday.split("-").map(Number);
    const q = sunday.split("-").map(Number);
    const from = new Date(p[0], p[1] - 1, p[2]);
    const to = new Date(q[0], q[1] - 1, q[2]);
    const long = { day: "numeric", month: "short" };
    const start = from.toLocaleDateString(
      "es-ES",
      p[1] === q[1] ? { day: "numeric" } : long
    );
    const end = to.toLocaleDateString("es-ES", long);
    const year = q[0] !== new Date().getFullYear() ? " " + q[0] : "";
    return start + " – " + end + year;
  }

  // <li> de una tarea de Hoy. En modo normal lleva checkbox; en modo edición,
  // el asa de arrastre, y al tocarla se abren sus ajustes en el panel lateral.
  function hoyViewItem(item) {
    const li = document.createElement("li");
    li.className =
      "hoy-view-item" +
      // En edición no se distingue lo completado de lo pendiente
      (item.done && !hoyEditMode ? " is-done" : "") +
      (hoyEditMode ? " is-editing" : "") +
      hoyCatClass(item);
    li.dataset.id = item.id;

    let lead;
    if (hoyEditMode) {
      lead = document.createElement("span");
      lead.className = "hoy-item-handle";
      lead.textContent = "⠿";
      lead.setAttribute("aria-label", "Reordenar tarea");
      lead.title = "Arrastra para reordenar";
    } else {
      lead = document.createElement("input");
      lead.type = "checkbox";
      lead.className = "task-check";
      lead.checked = !!item.done;
      lead.setAttribute("aria-label", "Marcar como completada");
      lead.addEventListener("change", () => toggleHoy(item.id));
    }

    const main = document.createElement("div");
    main.className = "hoy-view-main";

    const text = document.createElement("span");
    text.className = "hoy-view-text";
    text.textContent = item.text;
    main.appendChild(text);

    // 2ª línea opcional: "Hace N días" desde la última compleción (en edición
    // no se muestra: ahí no se distingue lo completado de lo pendiente)
    if (item.showLastDone && !hoyEditMode) {
      const last = document.createElement("span");
      last.className = "hoy-view-date";
      last.textContent = hoyLastDoneLabel(item.lastDoneAt);
      // Icono de información: abre el resumen de veces completada por semana
      const info = document.createElement("button");
      info.type = "button";
      info.className = "hoy-info-btn";
      info.textContent = "ⓘ";
      info.setAttribute("aria-label", "Ver veces completada por semana");
      info.title = "Veces completada por semana";
      info.addEventListener("click", (e) => {
        e.stopPropagation();
        openHoyStats(item.id);
      });
      last.appendChild(info);
      main.appendChild(last);
    }

    li.append(lead, main);

    if (hoyEditMode) {
      main.addEventListener("click", () => openHoyDetail(item.id));
      const more = document.createElement("span");
      more.className = "hoy-item-more";
      more.textContent = "›";
      more.setAttribute("aria-hidden", "true");
      li.appendChild(more);
    }
    return li;
  }

  // Vista "Hoy": una sección por cada `hoySections`. Las completadas NO se
  // ocultan. En modo edición aparecen las cabeceras de sección editables y el
  // formulario de creación.
  function renderHoyView() {
    if (!hoyViewSectionsEl) return;
    const focusKey = hoyEditMode ? hoyCaptureFocus() : null;
    hoyViewSectionsEl.innerHTML = "";
    hoySections.forEach((sec) => {
      const wrap = document.createElement("section");
      wrap.className = "hoy-view-section" + (hoyEditMode ? " is-editing" : "");
      wrap.dataset.id = sec.id;

      // Secciones automáticas: se rellenan solas. No se editan, pero sí se
      // pueden colocar donde se quiera.
      if (sec.auto) {
        // "Durante el día": Agenda de hoy + tareas/recados con fecha exacta de
        // hoy + las de "Añadir a Hoy", en el orden manual compartido con la
        // pestaña Agenda.
        // "Antes de la próxima extracción": las tareas de App lactancia.
        const isDia = sec.id === HOY_AUTO_ID;
        const dow = dowOf(todayISO());
        // Las de "Añadir a Hoy" entran como una entrada más del día: se
        // ordenan y se arrastran igual que el resto.
        const entries = isDia
          ? dayEntries(dow, todayISO(), hoyPinnedEntries())
          : lactAntesExtraccion();
        const total = entries.length;
        if (!hoyEditMode && total === 0) return; // vacía: no se muestra

        if (hoyEditMode) {
          wrap.appendChild(hoyAutoHead(sec));
          const hint = document.createElement("p");
          hint.className = "hoy-view-empty";
          hint.textContent = isDia
            ? "Automática: Agenda de hoy, tareas y recados con fecha de hoy y los de “Añadir a Hoy”."
            : "Automática: las tareas de App lactancia de las extracciones de hoy.";
          wrap.appendChild(hint);
        } else {
          // Cabecera con progreso y colapsable (igual que las manuales)
          const doneCount = entries.filter((e) =>
            isDia ? dayEntryDone(e) : !!e.done
          ).length;
          const head = document.createElement("div");
          head.className =
            "hoy-view-head" + (sec.collapsed ? " is-collapsed" : "");
          const title = document.createElement("h2");
          title.className = "hoy-view-title";
          title.textContent = sec.name;
          const count = document.createElement("span");
          count.className = "hoy-view-count";
          count.textContent = doneCount + "/" + total;
          const chevron = document.createElement("span");
          chevron.className = "hoy-view-chevron";
          chevron.textContent = sec.collapsed ? "▸" : "▾";
          head.append(title, count, chevron);
          head.addEventListener("click", () => toggleSectionCollapse(sec.id));
          wrap.appendChild(head);

          if (!sec.collapsed) {
            const ul = document.createElement("ul");
            ul.className = "task-list";
            wrap.appendChild(ul);
            if (isDia) {
              // Reordenar desde el asa; el orden se comparte con Agenda
              renderDayList(ul, dow, entries, "hoy");
            } else {
              // Las de lactancia mantienen el orden que les da su app
              entries.forEach((t) =>
                ul.appendChild(createTaskItem(t, null, { hideStar: true }))
              );
            }
          }
        }
        hoyViewSectionsEl.appendChild(wrap);
        return;
      }

      const secItems = hoy.filter((it) => it.section === sec.id);
      const doneCount = secItems.filter((it) => it.done).length;

      // En visualización, la sección puede estar colapsada (estado persistente)
      const showBody = hoyEditMode || !sec.collapsed;

      if (hoyEditMode) {
        const form = hoyAddForm(sec);
        wrap.appendChild(hoySectionHead(sec, form.querySelector("input")));
        wrap.appendChild(form);
      } else {
        const head = document.createElement("div");
        head.className = "hoy-view-head" + (sec.collapsed ? " is-collapsed" : "");
        const chevron = document.createElement("span");
        chevron.className = "hoy-view-chevron";
        chevron.textContent = sec.collapsed ? "▸" : "▾";
        const title = document.createElement("h2");
        title.className = "hoy-view-title";
        title.textContent = sec.name;
        const count = document.createElement("span");
        count.className = "hoy-view-count";
        count.textContent = doneCount + "/" + secItems.length;
        head.append(title, count, chevron);
        head.addEventListener("click", () => toggleSectionCollapse(sec.id));
        wrap.appendChild(head);
      }

      if (showBody) {
        const ul = document.createElement("ul");
        ul.className = "task-list";
        secItems.forEach((item) => ul.appendChild(hoyViewItem(item)));
        wrap.appendChild(ul);

        if (secItems.length === 0) {
          const empty = document.createElement("p");
          empty.className = "hoy-view-empty";
          empty.textContent = "Nada por ahora.";
          wrap.appendChild(empty);
        }

        // Reordenar las tareas de la sección desde su asa (solo sus ítems)
        if (hoyEditMode)
          enableReorder(
            ul,
            "hoy-view-item",
            () => hoy,
            saveHoy,
            "hoy-item-handle"
          );
      }
      hoyViewSectionsEl.appendChild(wrap);
    });
    if (hoyAddSectionBtn) hoyAddSectionBtn.hidden = !hoyEditMode;
    hoyRestoreFocus(focusKey);
  }

  function renderHoy() {
    renderHoyView();
  }

  function toggleSectionCollapse(id) {
    const sec = hoySections.find((s) => s.id === id);
    if (!sec) return;
    sec.collapsed = !sec.collapsed;
    saveHoy(); // el estado colapsado persiste (y se sincroniza)
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
    rememberDeleted(id); // que no vuelva si la nube aún no se enteró
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
      // El registro se lee ANTES de pisar `lastDoneAt`: si no, el respaldo de
      // `hoyDoneLog` devolvería la fecha de hoy y se apuntaría dos veces.
      const previo = hoyDoneLog(item);
      if (item.lastDoneAt) item.prevDoneAt = item.lastDoneAt;
      else delete item.prevDoneAt;
      item.lastDoneAt = todayISO();
      // Registro completo, para el resumen por semanas
      item.doneLog = previo.concat([item.lastDoneAt]);
    } else {
      if (item.prevDoneAt) item.lastDoneAt = item.prevDoneAt;
      else delete item.lastDoneAt;
      delete item.prevDoneAt;
      const log = hoyDoneLog(item);
      log.pop(); // deshace el último check, igual que con `lastDoneAt`
      if (log.length) item.doneLog = log;
      else delete item.doneLog;
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

  /* ---------- Modo edición y ajustes de una tarea de Hoy ---------- */
  const hoyEditBtn = document.getElementById("hoy-edit-btn");
  const hoyDetailOverlay = document.getElementById("hoy-detail-overlay");
  const hoyDetailClose = document.getElementById("hoy-detail-close");
  const hoyDetailTitle = document.getElementById("hoy-detail-title");
  const hoyDetailTemporal = document.getElementById("hoy-detail-temporal");
  const hoyDetailCatWrap = document.getElementById("hoy-detail-cat-wrap");
  const hoyDetailCat = document.getElementById("hoy-detail-cat");
  const hoyDetailLastDone = document.getElementById("hoy-detail-lastdone");
  const hoyDetailDelete = document.getElementById("hoy-detail-delete");
  let hoyDetailId = null; // tarea abierta en el panel lateral

  // Opciones del selector de categoría (fijas)
  (function fillHoyCategories() {
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "Sin categoría";
    hoyDetailCat.appendChild(none);
    HOY_CATEGORIES.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      hoyDetailCat.appendChild(opt);
    });
  })();

  function getHoyDetailItem() {
    return hoyDetailId ? hoy.find((h) => h.id === hoyDetailId) : null;
  }

  function setHoyEditMode(on) {
    hoyEditMode = on;
    hoyEditBtn.textContent = on ? "✓ Listo" : "✏️ Editar";
    hoyEditBtn.classList.toggle("is-active", on);
    hoyEditBtn.setAttribute("aria-pressed", on ? "true" : "false");
    if (!on) closeHoyDetail();
    renderHoyView();
  }

  function openHoyDetail(id) {
    const item = hoy.find((h) => h.id === id);
    if (!item) return;
    hoyDetailId = id;
    hoyDetailTitle.value = item.text;
    hoyDetailTemporal.checked = !!item.temporal;
    hoyDetailCat.value = item.category || "";
    hoyDetailCatWrap.hidden = !item.temporal;
    hoyDetailLastDone.checked = !!item.showLastDone;
    hoyDetailOverlay.hidden = false;
    document.body.classList.add("no-scroll");
    // Con el panel ya visible (si no, scrollHeight es 0)
    autoGrow(hoyDetailTitle);
  }

  function closeHoyDetail() {
    if (hoyDetailOverlay.hidden) return;
    hoyDetailOverlay.hidden = true;
    hoyDetailId = null;
    document.body.classList.remove("no-scroll");
  }

  hoyEditBtn.addEventListener("click", () => setHoyEditMode(!hoyEditMode));
  hoyDetailClose.addEventListener("click", closeHoyDetail);
  hoyDetailOverlay.addEventListener("click", (e) => {
    if (e.target === hoyDetailOverlay) closeHoyDetail();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !hoyDetailOverlay.hidden) closeHoyDetail();
  });

  // Texto: mientras se escribe solo memoria + la línea de la lista (repintar
  // entero perdería el foco); se persiste al salir del campo.
  hoyDetailTitle.addEventListener("input", () => {
    autoGrow(hoyDetailTitle);
    const item = getHoyDetailItem();
    const v = hoyDetailTitle.value.trim();
    if (!item || !v) return;
    item.text = v;
    const el = hoyViewSectionsEl.querySelector(
      '.hoy-view-item[data-id="' + item.id + '"] .hoy-view-text'
    );
    if (el) el.textContent = v;
  });
  hoyDetailTitle.addEventListener("blur", () => {
    const item = getHoyDetailItem();
    if (!item) return;
    const v = hoyDetailTitle.value.trim();
    if (v) {
      item.text = v;
      saveHoy();
    } else {
      hoyDetailTitle.value = item.text;
    }
  });

  hoyDetailTemporal.addEventListener("change", () => {
    const item = getHoyDetailItem();
    if (!item) return;
    item.temporal = hoyDetailTemporal.checked;
    hoyDetailCatWrap.hidden = !item.temporal;
    saveHoy();
    renderHoyView();
  });

  hoyDetailCat.addEventListener("change", () => {
    const item = getHoyDetailItem();
    if (!item) return;
    if (hoyDetailCat.value) item.category = hoyDetailCat.value;
    else delete item.category;
    saveHoy();
    renderHoyView();
  });

  hoyDetailLastDone.addEventListener("change", () => {
    const item = getHoyDetailItem();
    if (!item) return;
    item.showLastDone = hoyDetailLastDone.checked;
    saveHoy();
    renderHoyView();
  });

  hoyDetailDelete.addEventListener("click", () => {
    const item = getHoyDetailItem();
    if (!item) return;
    const id = item.id;
    closeHoyDetail();
    deleteHoy(id);
  });

  /* ---------- Veces completada por semana (icono ⓘ del byline) ---------- */
  const hoyStatsOverlay = document.getElementById("hoy-stats-overlay");
  const hoyStatsClose = document.getElementById("hoy-stats-close");
  const hoyStatsTitle = document.getElementById("hoy-stats-title");
  const hoyStatsList = document.getElementById("hoy-stats-list");
  const hoyStatsEmpty = document.getElementById("hoy-stats-empty");

  function openHoyStats(id) {
    const item = hoy.find((h) => h.id === id);
    if (!item) return;
    hoyStatsTitle.textContent = item.text;
    hoyStatsList.innerHTML = "";
    const weeks = hoyDoneByWeek(item);
    const thisMonday = addDaysISO(todayISO(), -(dowOf(todayISO()) - 1));
    hoyStatsEmpty.hidden = weeks.length > 0;
    weeks.forEach((w) => {
      const li = document.createElement("li");
      li.className =
        "hoy-stats-row" + (w.monday === thisMonday ? " is-current" : "");
      const label = document.createElement("span");
      label.className = "hoy-stats-week";
      label.textContent = hoyWeekLabel(w.monday);
      if (w.monday === thisMonday) {
        const badge = document.createElement("span");
        badge.className = "hoy-stats-badge";
        badge.textContent = "Esta semana";
        label.appendChild(badge);
      }
      const count = document.createElement("span");
      count.className = "hoy-stats-count";
      count.textContent = w.count === 1 ? "1 vez" : w.count + " veces";
      li.append(label, count);
      hoyStatsList.appendChild(li);
    });
    hoyStatsOverlay.hidden = false;
    document.body.classList.add("no-scroll");
  }

  function closeHoyStats() {
    if (hoyStatsOverlay.hidden) return;
    hoyStatsOverlay.hidden = true;
    document.body.classList.remove("no-scroll");
  }

  hoyStatsClose.addEventListener("click", closeHoyStats);
  hoyStatsOverlay.addEventListener("click", (e) => {
    if (e.target === hoyStatsOverlay) closeHoyStats();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !hoyStatsOverlay.hidden) closeHoyStats();
  });

  hoyAddSectionBtn.addEventListener("click", addSection);

  // Reordenar las secciones desde su asa (solo existe en modo edición). El
  // contenedor es estable → se engancha una vez.
  enableReorder(
    hoyViewSectionsEl,
    "hoy-view-section",
    () => hoySections,
    saveHoy,
    "hoy-section-handle"
  );

  /* ---------- Agenda (una sección por día de la semana en curso) ---------- */
  const agendaSectionsEl = document.getElementById("agenda-sections");

  // Lunes de la semana actual: la Agenda siempre muestra la semana en curso.
  function agendaWeekStart() {
    const today = todayISO();
    return addDaysISO(today, -(dowOf(today) - 1));
  }

  // Tareas de Tareas/Recados con fecha exacta ("En fecha") en ese día
  function agendaDatedFor(iso) {
    const out = [];
    tasks.forEach((t) => {
      if (!t.sourcePlannedId && t.dateMode === "on" && t.dateStart === iso)
        out.push({ task: t, origin: ORIGEN.tareas });
    });
    recados.forEach((t) => {
      if (t.dateMode === "on" && t.dateStart === iso)
        out.push({ task: t, origin: ORIGEN.recados });
    });
    return out;
  }

  /* ---------- Lista combinada de un día (Agenda + tareas con fecha) ----------
     La misma lista se pinta en la pestaña Agenda (un día por sección) y en la
     sección automática "Durante el día" de Hoy (el día de hoy). El orden manual
     vive en `dayOrder[dow]` (ids mezclados), así que arrastrar en cualquiera de
     las dos pestañas mueve la tarea también en la otra. */

  // Entradas de ese día ya ordenadas: {id, agenda} o {id, task, origin}.
  // Lo que no esté en `dayOrder` va al final, en el orden por defecto.
  // `extra` (opcional): entradas que llegan por otra vía —las fijadas con
  // "Añadir a Hoy", que salen sin depender de la fecha—. Se mezclan con el
  // resto antes de ordenar, así que comparten orden manual y arrastre. Una
  // fijada que además tenga la fecha del día ya viene arriba: no se repite.
  function dayEntries(dow, iso, extra) {
    const entries = agenda
      .filter((a) => a.day === dow)
      .map((a) => ({ id: a.id, agenda: a }));
    agendaDatedFor(iso).forEach((e) =>
      entries.push({ id: e.task.id, task: e.task, origin: e.origin })
    );
    (extra || []).forEach((e) => {
      if (!entries.some((x) => x.id === e.id)) entries.push(e);
    });
    const order = dayOrder[String(dow)] || [];
    const pos = {};
    order.forEach((id, i) => (pos[id] = i));
    return entries
      .map((e, i) => ({ e: e, i: i }))
      .sort((a, b) => {
        const pa = pos[a.e.id] === undefined ? Infinity : pos[a.e.id];
        const pb = pos[b.e.id] === undefined ? Infinity : pos[b.e.id];
        return pa === pb ? a.i - b.i : pa - pb;
      })
      .map((x) => x.e);
  }

  function dayEntryDone(e) {
    return e.agenda ? !!e.agenda.done : !!e.task.done;
  }

  // Tareas con "Añadir a Hoy" (`hoyDia`): las copias de rutinas que nacen ahí
  // y las que se fijan a mano desde su formulario. Van arriba de "Durante el
  // día" y no se reordenan, y salen tengan la fecha que tengan o ninguna. Las
  // completadas solo se ven el día en que se marcaron, para que la lista
  // amanezca limpia.
  function hoyPinnedTasks() {
    const out = [];
    [tasks, recados, pendientes].forEach((lista) => {
      lista.forEach((t) => {
        if (t.hoyDia && (!t.done || t.completedAt === todayISO())) out.push(t);
      });
    });
    // Las de otras apps, con el mismo criterio: pendientes, y las completadas
    // hoy se quedan tachadas hasta que cambie el día. Lactancia trae su propia
    // fecha de completado; la de App tareas la apuntamos nosotros al marcarla.
    lactPending()
      .concat(atareasPending())
      .forEach((t) => {
        if (isHoyFijada(t) || lactAutoHoy(t)) out.push(t);
      });
    lactDone().forEach((t) => {
      if (!isHoyFijada(t) && !lactAutoHoy(t)) return;
      if (t.completedAt === todayISO()) out.push(t);
    });
    atareasDone().forEach((t) => {
      if (isHoyFijada(t) && fijadaDoneOf(t) === todayISO()) out.push(t);
    });
    return out;
  }

  // Procedencia de una tarea fijada, para su 2ª línea. Las copias de rutinas y
  // las de otras apps no llevan etiqueta: ya se anuncian como tales.
  function hoyPinnedOrigin(t) {
    if (t.sourcePlannedId || t._lact || t._at) return null;
    if (recados.indexOf(t) !== -1) return ORIGEN.recados;
    if (pendientes.indexOf(t) !== -1) return ORIGEN.pendientes;
    return ORIGEN.tareas;
  }

  /* ---------- "Añadir a Hoy" en tareas de otras apps ----------
     Las de lactancia y App tareas no son objetos nuestros: se reconstruyen en
     cada render a partir del nodo de la otra app, así que no se les puede
     colgar un `hoyDia` como a las nuestras. El fijado vive en `hoyFijadas`,
     en nuestro propio nodo: no escribimos nada en los datos de esas apps. */

  // Clave con la que se recuerda una tarea externa. Ojo: no vale su `id` de
  // pantalla. El de App tareas es la posición en el array (`at:3`), porque esa
  // app no da ids; en cuanto añade, borra o reordena algo, esa posición pasa a
  // ser de otra tarea y el fijado señalaría a la equivocada. Su texto es lo que
  // la identifica de verdad, y si lo cambian allí el fijado se pierde sin más
  // (fallo seguro: nunca acaba fijada otra tarea). Lactancia sí tiene id propio.
  // Las de "antes de la extracción" quedan fuera: ya tienen su sección en Hoy.
  function hoyExternKey(task) {
    if (!task) return null;
    if (task._lact) {
      if (task._lact.node === LACT_NODE_EXTRA) return null;
      return "lact:" + task._lact.node + ":" + task._lact.id;
    }
    if (task._at) {
      const texto = (task.text || "").trim();
      if (!texto) return null;
      // Con el texto solo no basta: una rutina de App tareas son varias tareas
      // con el MISMO texto y distinta fecha, así que una clave por texto las
      // fijaba todas a la vez (y sacaba a Hoy las repeticiones ya completadas).
      // Con la fecha delante, la clave señala una ocurrencia concreta. El
      // prefijo es "atd:" y no "at:" para que distinguir el formato viejo del
      // nuevo sea mirar el prefijo, sin depender de cómo venga la fecha.
      return "atd:" + (task._at.date || "") + ":" + texto;
    }
    return null;
  }

  /* Cada registro de `hoyFijadas` es la clave sola ("lact:…", "at:…") o bien
     {k, d}: la clave más el día en que se completó. La fecha solo hace falta
     para App tareas, que no guarda cuándo se completa algo; sin ella no habría
     forma de saber si la marcamos hoy y de dejarla tachada en "Durante el día"
     hasta que cambie el día. Lactancia sí trae la suya. Se admite la forma
     antigua (solo texto) para no migrar nada. */
  function fijadaKey(x) {
    if (typeof x === "string") return x || null;
    return x && typeof x === "object" && x.k ? x.k : null;
  }
  function fijadaDoneAt(x) {
    return x && typeof x === "object" && x.d ? x.d : null;
  }
  // Normaliza el registro que llega de la nube o de IndexedDB y tira las
  // claves de App tareas del formato viejo ("at:<texto>", sin fecha): fijaban
  // todas las ocurrencias de una rutina a la vez. Lo que se hubiera fijado así
  // hay que volver a marcarlo, que es una casilla.
  function normalizeFijadas(arr) {
    return (Array.isArray(arr) ? arr : []).filter((x) => {
      const k = fijadaKey(x);
      if (!k) return false;
      return k.indexOf("at:") !== 0; // "at:" = formato viejo; "atd:"/"lact:" no
    });
  }

  function fijadaIndex(key) {
    for (let i = 0; i < hoyFijadas.length; i++) {
      if (fijadaKey(hoyFijadas[i]) === key) return i;
    }
    return -1;
  }

  function isHoyFijada(task) {
    const key = hoyExternKey(task);
    return !!key && fijadaIndex(key) !== -1;
  }

  function setHoyFijada(task, on) {
    const key = hoyExternKey(task);
    if (!key) return;
    const i = fijadaIndex(key);
    if (on && i === -1) hoyFijadas.push(key);
    else if (!on && i !== -1) hoyFijadas.splice(i, 1);
    else return; // ya estaba como toca
    saveHoyFijadas();
  }

  // Apunta (o borra) el día en que se completó una fijada de App tareas, para
  // que se quede tachada en Hoy hasta que cambie el día.
  function setFijadaDone(task, iso) {
    const key = hoyExternKey(task);
    if (!key) return;
    const i = fijadaIndex(key);
    if (i === -1) return; // no está fijada: no hay nada que recordar
    hoyFijadas[i] = iso ? { k: key, d: iso } : key;
    saveHoyFijadas();
  }
  // El día en que se completó, si lo tenemos apuntado
  function fijadaDoneOf(task) {
    const key = hoyExternKey(task);
    if (!key) return null;
    const i = fijadaIndex(key);
    return i === -1 ? null : fijadaDoneAt(hoyFijadas[i]);
  }

  /* Mantiene el apunte de "completada" de las fijadas de App tareas al día:
     `d` puesto equivale a "está completada", y su valor es el día en que la
     vimos así por primera vez. Hace falta porque esa app no guarda cuándo se
     completa nada y se puede marcar (o desmarcar) desde ella, sin pasar por
     `toggleAtDone`. Sin esto, una fijada que ya estaba hecha al fijarla no
     tenía fecha y desaparecía de Hoy en vez de quedarse tachada. */
  function reconcileFijadasDone() {
    let cambios = false;
    atareasDone().forEach((t) => {
      const key = hoyExternKey(t);
      const i = key ? fijadaIndex(key) : -1;
      if (i === -1 || fijadaDoneAt(hoyFijadas[i])) return;
      hoyFijadas[i] = { k: key, d: todayISO() }; // completada: se apunta hoy
      cambios = true;
    });
    atareasPending().forEach((t) => {
      const key = hoyExternKey(t);
      const i = key ? fijadaIndex(key) : -1;
      if (i === -1 || !fijadaDoneAt(hoyFijadas[i])) return;
      hoyFijadas[i] = key; // vuelve a estar pendiente: se borra el apunte
      cambios = true;
    });
    if (cambios) saveHoyFijadas();
    return cambios;
  }

  // Las fijadas con el formato de entrada de día, para mezclarlas con el resto
  // de "Durante el día". `pinned` las distingue al pintarlas: a diferencia de
  // las demás, su fecha (si tiene) no es la del día, así que se sigue viendo.
  function hoyPinnedEntries() {
    return hoyPinnedTasks().map((t) => ({
      id: t.id,
      task: t,
      origin: hoyPinnedOrigin(t),
      pinned: true,
    }));
  }

  // En Hoy conviven las tres procedencias, así que cada tarea lleva la suya en
  // la 2ª línea. En la Agenda la procedencia "Agenda" sería redundante.
  function dayEntryEl(e, from) {
    const li = e.agenda
      ? agendaItem(e.agenda, from === "hoy" ? "Agenda" : null)
      : createTaskItem(e.task, e.origin, {
          // La fecha sobra cuando es la que coloca la tarea en este día; en
          // una fijada no lo es, así que ahí sí se muestra.
          hideDate: !e.pinned,
          hideStar: true,
          dragHandle: true,
        });
    li.classList.add("day-item"); // clase común: el arrastre las mezcla
    return li;
  }

  // Pinta la lista de un día y habilita el arrastre. `from` es la pestaña que
  // la pinta ("hoy" / "agenda"), para refrescar solo la otra al soltar.
  function renderDayList(ul, dow, entries, from) {
    entries.forEach((e) => ul.appendChild(dayEntryEl(e, from)));
    enableReorder(ul, "day-item", null, null, "day-handle", (ids) =>
      setDayOrder(dow, ids, from)
    );
  }

  function setDayOrder(dow, ids, from) {
    if (ids.length) dayOrder[String(dow)] = ids;
    else delete dayOrder[String(dow)];
    saveDayOrder();
    // La pestaña desde la que se arrastra ya tiene el DOM en su sitio; se
    // repinta solo la otra (repintar la de origen se cargaría el "click" que
    // se anula tras soltar y abriría el detalle de la tarea).
    if (from === "hoy") renderAgenda();
    else renderHoyView();
  }

  // "4 ago" para la cabecera de cada día
  function agendaShortDate(iso) {
    const p = iso.split("-").map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  }

  function addAgenda(day, text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    agenda.push({ id: newId(), text: trimmed, day: day, done: false });
    saveAgenda();
    renderAgenda();
  }

  function deleteAgenda(id) {
    rememberDeleted(id); // que no vuelva si la nube aún no se enteró
    agenda = agenda.filter((a) => a.id !== id);
    saveAgenda();
    renderAgenda();
  }

  function toggleAgenda(id) {
    const item = agenda.find((a) => a.id === id);
    if (!item) return;
    item.done = !item.done;
    saveAgenda();
    renderAgenda();
    renderHoy(); // "Durante el día" muestra estas tareas
  }

  // Fila de una tarea: asa + checkbox + texto (abre sus ajustes al tocarlo).
  // `origin` (opcional): procedencia en la 2ª línea. En Hoy se pasa "Agenda",
  // para distinguirlas de las de Tareas/Recados; en la propia Agenda sobra.
  function agendaItem(item, origin) {
    const li = document.createElement("li");
    li.className = "agenda-item" + (item.done ? " is-done" : "");
    li.dataset.id = item.id;

    const handle = dayHandleEl();

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "task-check";
    check.checked = !!item.done;
    check.setAttribute("aria-label", "Marcar como completada");
    check.addEventListener("change", () => toggleAgenda(item.id));

    const main = document.createElement("div");
    main.className = "agenda-item-main";
    main.addEventListener("click", () => openAgendaDetail(item.id));

    const text = document.createElement("span");
    text.className = "agenda-item-text";
    text.textContent = item.text;
    main.appendChild(text);

    if (origin) {
      const dateLine = document.createElement("span");
      dateLine.className = "task-date";
      const originEl = document.createElement("span");
      originEl.className = "task-origin";
      originEl.textContent = origin;
      dateLine.appendChild(originEl);
      main.appendChild(dateLine);
    }

    const more = document.createElement("span");
    more.className = "hoy-item-more";
    more.textContent = "›";
    more.setAttribute("aria-hidden", "true");

    li.append(handle, check, main, more);
    return li;
  }

  function renderAgenda() {
    if (!agendaSectionsEl) return;
    // Al repintar (p. ej. tras añadir) se recrea el DOM: hay que devolver el
    // foco al campo de añadir del día en el que se estaba escribiendo.
    const active = document.activeElement;
    const focusDay =
      active && active.classList.contains("agenda-add-input")
        ? active.dataset.day
        : null;
    const today = dowOf(todayISO());
    const monday = agendaWeekStart();

    agendaSectionsEl.innerHTML = "";
    AGENDA_DAYS.forEach((d, i) => {
      const iso = addDaysISO(monday, i); // fecha real de ese día esta semana
      const wrap = document.createElement("section");
      wrap.className = "agenda-section" + (d.day === today ? " is-today" : "");

      const title = document.createElement("h2");
      title.className = "agenda-title";
      title.textContent = d.name;
      const date = document.createElement("span");
      date.className = "agenda-date";
      date.textContent = agendaShortDate(iso);
      title.appendChild(date);
      if (d.day === today) {
        const badge = document.createElement("span");
        badge.className = "agenda-today-badge";
        badge.textContent = "Hoy";
        title.appendChild(badge);
      }
      wrap.appendChild(title);

      // Tareas de Agenda de ese día + tareas y recados con fecha exacta en ese
      // día de la semana en curso, en el orden manual común con Hoy.
      const ul = document.createElement("ul");
      ul.className = "task-list";
      wrap.appendChild(ul);
      renderDayList(ul, d.day, dayEntries(d.day, iso), "agenda");

      const form = document.createElement("form");
      form.className = "new-task agenda-add-form";
      form.autocomplete = "off";
      const addInput = document.createElement("input");
      addInput.type = "text";
      addInput.className = "task-input agenda-add-input";
      addInput.dataset.day = d.day;
      addInput.maxLength = 200;
      addInput.placeholder = "Añadir a " + d.name + "…";
      addInput.setAttribute("aria-label", "Nueva tarea de " + d.name);
      const addBtn = document.createElement("button");
      addBtn.type = "submit";
      addBtn.className = "add-btn";
      addBtn.textContent = "+";
      addBtn.setAttribute("aria-label", "Añadir");
      form.append(addInput, addBtn);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const value = addInput.value;
        addInput.value = "";
        addAgenda(d.day, value);
        const fresh = agendaSectionsEl.querySelector(
          '.agenda-add-input[data-day="' + d.day + '"]'
        );
        if (fresh) fresh.focus();
      });
      wrap.appendChild(form);

      agendaSectionsEl.appendChild(wrap);
    });

    if (focusDay) {
      const el = agendaSectionsEl.querySelector(
        '.agenda-add-input[data-day="' + focusDay + '"]'
      );
      if (el) el.focus();
    }
  }

  /* ---------- Ajustes de una tarea de la Agenda ---------- */
  const agendaDetailOverlay = document.getElementById("agenda-detail-overlay");
  const agendaDetailClose = document.getElementById("agenda-detail-close");
  const agendaDetailTitle = document.getElementById("agenda-detail-title");
  const agendaDetailDate = document.getElementById("agenda-detail-date");
  const agendaDetailDelete = document.getElementById("agenda-detail-delete");
  let agendaDetailId = null;

  function getAgendaDetailItem() {
    return agendaDetailId ? agenda.find((a) => a.id === agendaDetailId) : null;
  }

  // Fecha de esta semana que corresponde al día de la tarea
  function agendaDateOf(item) {
    const idx = AGENDA_DAYS.findIndex((d) => d.day === item.day);
    return addDaysISO(agendaWeekStart(), idx === -1 ? 0 : idx);
  }

  function openAgendaDetail(id) {
    const item = agenda.find((a) => a.id === id);
    if (!item) return;
    agendaDetailId = id;
    agendaDetailTitle.value = item.text;
    // Prerellenada con la fecha del día de la semana en curso
    agendaDetailDate.value = agendaDateOf(item);
    agendaDetailOverlay.hidden = false;
    document.body.classList.add("no-scroll");
    autoGrow(agendaDetailTitle);
  }

  function closeAgendaDetail() {
    if (agendaDetailOverlay.hidden) return;
    agendaDetailOverlay.hidden = true;
    agendaDetailId = null;
    document.body.classList.remove("no-scroll");
  }

  agendaDetailClose.addEventListener("click", closeAgendaDetail);
  agendaDetailOverlay.addEventListener("click", (e) => {
    if (e.target === agendaDetailOverlay) closeAgendaDetail();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !agendaDetailOverlay.hidden) closeAgendaDetail();
  });

  // Texto: en memoria mientras se escribe; se persiste al salir del campo.
  agendaDetailTitle.addEventListener("input", () => {
    autoGrow(agendaDetailTitle);
    const item = getAgendaDetailItem();
    const v = agendaDetailTitle.value.trim();
    if (!item || !v) return;
    item.text = v;
    const el = agendaSectionsEl.querySelector(
      '.agenda-item[data-id="' + item.id + '"] .agenda-item-text'
    );
    if (el) el.textContent = v;
  });
  agendaDetailTitle.addEventListener("blur", () => {
    const item = getAgendaDetailItem();
    if (!item) return;
    const v = agendaDetailTitle.value.trim();
    if (v) {
      item.text = v;
      saveAgenda();
    } else {
      agendaDetailTitle.value = item.text;
    }
  });

  // Cambiar la fecha mueve la tarea al día de la semana correspondiente
  agendaDetailDate.addEventListener("change", () => {
    const item = getAgendaDetailItem();
    if (!item) return;
    const v = agendaDetailDate.value;
    if (!v) {
      agendaDetailDate.value = agendaDateOf(item);
      return;
    }
    item.day = dowOf(v);
    saveAgenda();
    renderAgenda();
    agendaDetailDate.value = agendaDateOf(item);
  });

  agendaDetailDelete.addEventListener("click", () => {
    const item = getAgendaDetailItem();
    if (!item) return;
    const id = item.id;
    closeAgendaDetail();
    deleteAgenda(id);
  });

  /* ---------- Proyectos (título + enlace, sin completar) ---------- */
  // Marca de Notion (el cubo con la "N"). Va en línea y en `currentColor` para
  // que funcione sin conexión y siga el color del tema.
  const NOTION_ICON =
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.054-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.083.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.727l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.446-1.632z"/>' +
    "</svg>";

  // Enlace utilizable: completa el esquema si falta y descarta lo que no sea
  // http(s) (un href "javascript:" sería ejecutable al pulsarlo).
  function proyectoUrl(item) {
    const raw = (item.url || "").trim();
    if (!raw) return "";
    const full = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : "https://" + raw;
    return /^https?:\/\//i.test(full) ? full : "";
  }

  // Progreso del proyecto: {done, total, ready} sobre todas sus tareas (las de
  // las tres listas que admiten proyecto y las que no tienen tipo). `ready` son
  // las ejecutables: pendientes, sin flecha del grafo que las bloquee y sin
  // dejar a mano en espera.
  function proyectoProgreso(id) {
    let done = 0;
    let total = 0;
    let ready = 0;
    const bloqueadas = proyectoBlockedIds(proyectos.find((p) => p.id === id));
    [tasks, recados, pendientes, sinTipo].forEach((arr) =>
      arr.forEach((t) => {
        if (t.projectId !== id) return;
        total++;
        if (t.done) done++;
        else if (!bloqueadas.has(t.id) && t.projectState !== "espera") ready++;
      })
    );
    return { done: done, total: total, ready: ready };
  }

  function addProyecto(text, url, category) {
    const trimmed = text.trim();
    if (!trimmed) return;
    proyectos.push({
      id: newId(),
      text: trimmed,
      url: (url || "").trim(),
      category: category || "",
    });
    saveProyectos();
    renderProyectos();
  }

  function deleteProyecto(id) {
    rememberDeleted(id); // que no vuelva si la nube aún no se enteró
    proyectos = proyectos.filter((p) => p.id !== id);
    saveProyectos();
    // Si era el que estaba abierto, se vuelve al índice (y la URL, con él).
    // El repintado va al final, con todo lo demás ya recolocado.
    if (proyectoOpenId === id) {
      proyectoOpenId = null;
      clearProyectoSel();
      if (location.hash.indexOf("#proyectos/") === 0)
        location.hash = "#proyectos";
    }
    // Las tareas sin tipo de ese proyecto se quedarían sin ninguna vista donde
    // aparecer: pasan a Tareas antes de soltar la referencia al proyecto.
    const huerfanas = sinTipo.filter((t) => t.projectId === id);
    if (huerfanas.length) {
      sinTipo = sinTipo.filter((t) => t.projectId !== id);
      tasks = tasks.concat(huerfanas);
      saveSinTipo();
      save();
    }
    // Las tareas que lo tenían asignado se quedan sin proyecto (si no, la
    // referencia quedaría colgando en los datos)
    [
      { list: tasks, save: save },
      { list: recados, save: saveRecados },
      { list: pendientes, save: savePendientes },
    ].forEach((l) => {
      let changed = false;
      l.list.forEach((t) => {
        if (t.projectId === id) {
          delete t.projectId;
          changed = true;
        }
      });
      if (changed) l.save();
    });
    renderProyectos();
    renderAllLists();
  }

  // Pinta lo que toque: el índice y, si hay un proyecto abierto, su página.
  // Todas las llamadas existentes siguen valiendo (se repinta lo visible).
  function renderProyectos() {
    // Primero se decide qué página se ve: el lienzo del grafo necesita estar
    // visible para poder medir su ancho y repartir los post-it.
    const open = !!getProyectoOpen();
    if (proyectosIndexEl) proyectosIndexEl.hidden = open;
    if (proyectosDetailEl) proyectosDetailEl.hidden = !open;
    renderProyectosIndex();
    renderProyectoTasks();
    updateNavCounts();
  }

  // Proyecto abierto, si sigue existiendo (si se elimina, se vuelve al índice).
  // Mientras la lista esté vacía no se descarta el id: al recargar sobre un
  // proyecto, el hash se lee antes de que lleguen los datos, y ese id tiene que
  // sobrevivir hasta el primer repintado con los proyectos ya cargados.
  function getProyectoOpen() {
    if (!proyectoOpenId) return null;
    const item = proyectos.find((p) => p.id === proyectoOpenId);
    if (!item && proyectos.length) proyectoOpenId = null;
    return item || null;
  }

  function openProyectoTasks(id) {
    proyectoOpenId = id;
    // Cada proyecto se abre por su diagrama; si lo tiene apagado, por su lista
    const item = proyectos.find((p) => p.id === id);
    proyectoTasksTab = proyectoConDiagrama(item) ? "grafo" : "lista";
    clearProyectoSel();
    // El proyecto abierto queda en la URL: al recargar se vuelve a él
    const target = "#proyectos/" + id;
    if (location.hash !== target) location.hash = target;
    renderProyectos();
    window.scrollTo(0, 0);
  }

  function closeProyectoTasks() {
    proyectoOpenId = null;
    clearProyectoSel();
    if (location.hash.indexOf("#proyectos/") === 0) location.hash = "#proyectos";
    renderProyectos();
  }

  // Tareas asignadas al proyecto: las de las tres listas más las que no tienen
  // tipo (estas van sin etiqueta de procedencia). Pendientes primero.
  function proyectoTasks(id) {
    const out = [];
    const add = (arr, origin) =>
      arr.forEach((t) => {
        if (t.projectId === id) out.push({ task: t, origin: origin });
      });
    add(sinTipo, "");
    add(tasks, ORIGEN.tareas);
    add(recados, ORIGEN.recados);
    add(pendientes, ORIGEN.pendientes);
    return out
      .filter((e) => !e.task.done)
      .concat(out.filter((e) => e.task.done));
  }

  function renderProyectoTasks() {
    const item = getProyectoOpen();
    if (!item || !proyectoTasksList) return;
    proyectoTasksTitle.textContent = item.text;
    const entries = proyectoTasks(item.id);
    // Con el diagrama apagado solo hay lista: ni pestañas que elegir
    const conDiagrama = proyectoConDiagrama(item);
    if (!conDiagrama && proyectoTasksTab === "grafo") proyectoTasksTab = "lista";
    proyectoTasksTabs.hidden = !conDiagrama;
    const esGrafo = proyectoTasksTab === "grafo";

    proyectoTasksTabs.querySelectorAll(".task-tab").forEach((b) => {
      const on = b.dataset.tab === proyectoTasksTab;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });

    proyectoTasksList.hidden = esGrafo;
    proyectoTasksCanvas.hidden = !esGrafo;
    if (esGrafo) renderProyectoGrafo(item, entries);
    else renderProyectoLista(item, entries);
  }

  /* ---------- Vista lista: ejecutables y bloqueadas ----------
     Una tarea está bloqueada si en el grafo es destino de alguna flecha: hay
     otra tarea que apunta a ella y, por tanto, va antes. */

  // Orden de las secciones en la vista lista. En escritorio son las columnas
  // del board, de izquierda a derecha (el CSS las coloca en rejilla).
  const LISTA_ESTADOS = [
    "bloqueada",
    "espera",
    "sin-empezar",
    "proceso",
    "completada",
  ];

  function renderProyectoLista(proyecto, entries) {
    proyectoTasksList.innerHTML = "";
    // Sin diagrama no hay flechas: la columna "Bloqueadas" sobra
    const estados = proyectoConDiagrama(proyecto)
      ? LISTA_ESTADOS
      : LISTA_ESTADOS.filter((id) => id !== "bloqueada");
    // En escritorio, el board reparte una columna por estado
    proyectoTasksList.style.setProperty("--board-cols", estados.length);
    const bloqueadas = proyectoBlockedIds(proyecto);
    const grupos = estados.map((id) => {
      const estado = TASK_STATES.find((s) => s.id === id);
      return {
        nombre: estado.name,
        id: id,
        items: entries.filter((e) => taskStateOf(e.task, bloqueadas) === id),
      };
    });
    grupos.forEach((grupo) => {
      // Los grupos vacíos se pintan igual, marcados: en móvil el CSS los
      // esconde y en escritorio se quedan como columna vacía, para que las
      // demás no cambien de sitio.
      const wrap = document.createElement("section");
      wrap.className =
        "proyecto-group estado-" +
        grupo.id +
        (grupo.items.length ? "" : " is-empty");
      wrap.dataset.state = grupo.id; // lo lee el arrastre entre columnas
      const titulo = document.createElement("h2");
      titulo.className = "proyecto-group-title estado-" + grupo.id;
      titulo.textContent = grupo.nombre;
      const count = document.createElement("span");
      count.className = "proyecto-group-count";
      count.textContent = grupo.items.length;
      titulo.appendChild(count);
      // Crear una tarea que nazca ya en este estado. "Bloqueada" no se elige a
      // mano: ese lo decide el diagrama.
      if (grupo.id !== "bloqueada") {
        const add = document.createElement("button");
        add.type = "button";
        add.className = "proyecto-group-add";
        add.textContent = "+";
        const etiqueta = "Nueva tarea en " + taskStateName(grupo.id);
        add.title = etiqueta;
        add.setAttribute("aria-label", etiqueta);
        add.addEventListener("click", () => openProyectoTaskNew(grupo.id));
        titulo.appendChild(add);
      }
      const ul = document.createElement("ul");
      ul.className = "task-list";
      // Destacar y el nombre del proyecto se quedan en su lista de origen
      grupo.items.forEach((e) =>
        ul.appendChild(
          createTaskItem(e.task, e.origin, {
            hideStar: true,
            hideProject: true,
            // El estado ya lo dice la columna; se cambia desde la tarea
            hideCheck: true,
          })
        )
      );
      wrap.append(titulo, ul);
      proyectoTasksList.appendChild(wrap);
    });
  }

  /* ---------- Arrastrar una tarea de una columna a otra ----------
     Soltarla en otra columna le pone ese estado, igual que el selector del
     panel de la tarea. "Bloqueadas" queda fuera del juego (ni se arrastra ni
     se suelta ahí): ese estado lo decide el grafo, no la mano. */
  const BOARD_MOVE_PX = 8; // con ratón, se arrastra al pasar de este margen

  // Aplica el estado de la columna de destino. Misma lógica que el selector
  // "Estado" del panel: completada es el `done` de siempre.
  function boardApplyState(taskId, estado) {
    const e = findTaskEntry(taskId);
    if (!e) return;
    const task = e.item;
    if (estado === "completada") {
      if (task.done) return;
      task.done = true;
      task.completedAt = todayISO();
      task.starred = false; // al completar, deja de estar destacada
    } else {
      if (task.done) {
        task.done = false;
        delete task.completedAt;
      }
      if (estado === "proceso" || estado === "espera")
        task.projectState = estado;
      else delete task.projectState;
    }
    e.ctx.save();
    renderAllLists(); // repinta su lista de origen y este board
  }

  function enableBoardDrag(container) {
    let dragEl = null;
    let dragging = false;
    let pressTimer = null;
    let startX = 0;
    let startY = 0;
    let fromState = "";

    function cancelPress() {
      clearTimeout(pressTimer);
      pressTimer = null;
    }

    // Columna bajo el puntero, de las que admiten tareas. En escritorio manda
    // la x (todas ocupan la misma franja de alto); en móvil, apiladas, la x
    // vale para todas y desempata la distancia vertical.
    function columnAt(x, y) {
      let best = null;
      let bestDist = Infinity;
      container.querySelectorAll(".proyecto-group").forEach((col) => {
        if (col.dataset.state === "bloqueada") return;
        const r = col.getBoundingClientRect();
        if (!r.width || x < r.left || x > r.right) return;
        const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
        if (dy < bestDist) {
          bestDist = dy;
          best = col;
        }
      });
      return best;
    }

    // Tarea de esa columna ante la que hay que soltar (la primera cuyo centro
    // queda por debajo del puntero), o null para dejarla la última.
    function itemAfter(ul, y) {
      const items = [...ul.querySelectorAll(".task-item:not(.dragging)")];
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
      if (!dragEl || dragging) return;
      dragging = true;
      reorderDragging = true;
      dragEl.classList.add("dragging");
      container.classList.add("is-dragging");
      try {
        if (pointerId != null) dragEl.setPointerCapture(pointerId);
      } catch (e) {
        /* algunos navegadores no lo permiten; no es crítico */
      }
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
        const col = dragEl && dragEl.closest(".proyecto-group");
        const toState = col ? col.dataset.state : fromState;
        dragEl.classList.remove("dragging");
        container.classList.remove("is-dragging");
        // Anula el "click" que el navegador dispara al soltar (abriría la
        // tarea). Se auto-elimina al primer click o tras un breve margen.
        container.addEventListener("click", consumeClick, {
          capture: true,
          once: true,
        });
        setTimeout(() => {
          container.removeEventListener("click", consumeClick, true);
        }, 350);
        const id = dragEl.dataset.id;
        dragEl = null;
        // Dentro de la misma columna no hay nada que guardar: se repinta para
        // devolverla a su sitio (el orden lo manda su lista de origen).
        if (toState && toState !== fromState) boardApplyState(id, toState);
        else renderProyectoTasks();
        return;
      }
      dragEl = null;
    }

    container.addEventListener("pointerdown", (e) => {
      if (e.button && e.button !== 0) return; // solo botón principal
      const li = e.target.closest(".task-item");
      if (!li) return;
      const col = li.closest(".proyecto-group");
      // Las bloqueadas no se mueven, y las externas (lactancia / App tareas)
      // no son nuestras para cambiarles el estado.
      if (!col || col.dataset.state === "bloqueada") return;
      if (
        li.dataset.id &&
        (li.dataset.id.indexOf("lact:") === 0 ||
          li.dataset.id.indexOf("at:") === 0)
      )
        return;
      dragEl = li;
      fromState = col.dataset.state;
      startX = e.clientX;
      startY = e.clientY;
      cancelPress();
      // Con el dedo hace falta mantener pulsado, porque mover es scroll. Con
      // ratón basta con arrastrar un poco (lo natural en un board).
      if (e.pointerType === "touch") {
        pressTimer = setTimeout(() => startDrag(e.pointerId), LONG_PRESS_MS);
      }
    });

    container.addEventListener("pointermove", (e) => {
      if (!dragEl) return;
      if (!dragging) {
        // Se soltó fuera del board: ese pointerdown ya no cuenta
        if (!e.buttons) {
          cancelPress();
          dragEl = null;
          return;
        }
        const lejos =
          Math.abs(e.clientY - startY) > BOARD_MOVE_PX ||
          Math.abs(e.clientX - startX) > BOARD_MOVE_PX;
        if (!lejos) return;
        // Con el dedo, moverse antes del long-press es scroll, no arrastre
        if (e.pointerType === "touch") {
          cancelPress();
          dragEl = null;
          return;
        }
        startDrag(e.pointerId);
      }
      e.preventDefault();
      const col = columnAt(e.clientX, e.clientY);
      if (!col) return; // fuera del board (o sobre Bloqueadas): se queda donde está
      const ul = col.querySelector(".task-list");
      if (!ul) return;
      const after = itemAfter(ul, e.clientY);
      if (after == null) {
        if (ul.lastElementChild !== dragEl) ul.appendChild(dragEl);
      } else if (after !== dragEl && dragEl.nextElementSibling !== after) {
        ul.insertBefore(dragEl, after);
      }
    });

    container.addEventListener("pointerup", endDrag);
    container.addEventListener("pointercancel", endDrag);
  }

  enableBoardDrag(proyectoTasksList);

  /* ---------- Vista grafo: un post-it por tarea ---------- */
  const POSTIT_SIZE = 150; // lado del post-it (cuadrado), en px
  const POSTIT_GAP = 16;
  // Estados que colorean la tarjeta entera: en la esquina va solo su icono
  const POSTIT_STATE_ICONS = { completada: "✅", proceso: "🔄", espera: "🕑" };
  // En móvil el grafo es de solo lectura: se consulta, pero no se recolocan
  // los post-it ni se tocan las flechas (mismo corte que el CSS: 768px).
  const movilQuery = window.matchMedia("(max-width: 767px)");
  function grafoSoloLectura() {
    return movilQuery.matches;
  }

  // Posición guardada de la tarea dentro del proyecto, o una por defecto en
  // rejilla (no se persiste hasta que se arrastra).
  function postitPos(proyecto, taskId, index, columnas) {
    const saved = proyecto.graph && proyecto.graph[taskId];
    if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
      return { x: saved.x, y: saved.y };
    }
    const paso = POSTIT_SIZE + POSTIT_GAP;
    return {
      x: (index % columnas) * paso,
      y: Math.floor(index / columnas) * paso,
    };
  }

  // Apunta la posición sin guardar (para mover varios de una vez y guardar
  // una sola). `savePostitPos` es lo mismo, pero para uno solo.
  function setPostitPos(proyecto, taskId, x, y) {
    if (!proyecto.graph) proyecto.graph = {};
    proyecto.graph[taskId] = { x: Math.round(x), y: Math.round(y) };
  }

  function savePostitPos(proyecto, taskId, x, y) {
    setPostitPos(proyecto, taskId, x, y);
    saveProyectos();
  }

  /* ---------- Selección múltiple en el diagrama ----------
     Ctrl/Cmd (o Mayús) + clic va marcando post-it, y arrastrando cualquiera de
     los marcados se mueven todos juntos. También se puede encerrar un grupo
     dibujando un rectángulo sobre el fondo del lienzo. En móvil no aplica: el
     grafo es de solo lectura. */
  let proyectoSel = new Set(); // ids de las tareas marcadas en el diagrama
  let marqueeMoved = false; // el último gesto en el fondo fue un rectángulo

  function updateProyectoSel() {
    proyectoTasksCanvas.querySelectorAll(".postit").forEach((n) => {
      n.classList.toggle("is-selected", proyectoSel.has(n.dataset.id));
    });
  }

  function clearProyectoSel() {
    if (!proyectoSel.size) return;
    proyectoSel.clear();
    updateProyectoSel();
  }

  function toggleProyectoSel(id) {
    if (proyectoSel.has(id)) proyectoSel.delete(id);
    else proyectoSel.add(id);
    updateProyectoSel();
  }

  function renderProyectoGrafo(proyecto, entries) {
    proyectoTasksCanvas.innerHTML = "";
    proyectoTasksCanvas.classList.toggle("is-readonly", grafoSoloLectura());
    const bloqueadas = proyectoBlockedIds(proyecto);
    const ancho = proyectoTasksCanvas.clientWidth || POSTIT_SIZE;
    const columnas = Math.max(
      1,
      Math.floor((ancho + POSTIT_GAP) / (POSTIT_SIZE + POSTIT_GAP))
    );
    let maxY = 0;

    // Capa de las flechas, por debajo de los post-it
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "proyecto-links");
    proyectoTasksCanvas.appendChild(svg);

    entries.forEach((e, i) => {
      const pos = postitPos(proyecto, e.task.id, i, columnas);
      const estadoId = taskStateOf(e.task, bloqueadas);
      const nota = document.createElement("div");
      nota.className =
        "postit estado-" + estadoId + (e.task.done ? " is-done" : "");
      nota.dataset.id = e.task.id;
      nota.style.left = pos.x + "px";
      nota.style.top = pos.y + "px";
      nota.title = e.task.text;

      const texto = document.createElement("span");
      texto.className = "postit-text";
      texto.textContent = e.task.text;
      // Pie: lista de origen a la izquierda y estado a la derecha. El estado
      // aquí solo se consulta; se cambia en el panel de la tarea. Las tareas
      // sin tipo no vienen de ninguna lista: van sin etiqueta.
      const pie = document.createElement("div");
      pie.className = "postit-foot";
      const origen = document.createElement("span");
      origen.className = "postit-origin";
      origen.textContent = e.origin || "";
      pie.appendChild(origen);
      // El estado se lee de la propia tarjeta: Completada y En proceso la
      // tiñen y ponen su icono en la esquina; Sin empezar (blanca) y
      // Bloqueada (apagada) no llevan nada.
      const icono = POSTIT_STATE_ICONS[estadoId];
      if (icono) {
        const estado = document.createElement("span");
        estado.className = "postit-check";
        estado.textContent = icono;
        estado.title = taskStateName(estadoId);
        estado.setAttribute("aria-label", taskStateName(estadoId));
        pie.appendChild(estado);
      }
      nota.append(texto, pie);

      // Botón para empezar una flecha hacia otra tarea (no en solo lectura)
      if (!grafoSoloLectura()) {
        const enlazar = document.createElement("button");
        enlazar.type = "button";
        enlazar.className = "postit-link";
        enlazar.textContent = "↗";
        enlazar.title = "Unir con otra tarea";
        enlazar.setAttribute("aria-label", "Unir con otra tarea");
        enlazar.addEventListener("pointerdown", (ev) => ev.stopPropagation());
        enlazar.addEventListener("click", (ev) => {
          ev.stopPropagation();
          toggleLinkFrom(e.task.id);
        });
        nota.appendChild(enlazar);
      }

      enablePostitDrag(nota, proyecto, e.task);
      proyectoTasksCanvas.appendChild(nota);
      maxY = Math.max(maxY, pos.y + POSTIT_SIZE);
    });

    // La selección sobrevive al repintado, menos lo que ya no existe
    const vivos = new Set(entries.map((en) => en.task.id));
    proyectoSel.forEach((id) => {
      if (!vivos.has(id)) proyectoSel.delete(id);
    });
    updateProyectoSel();
    updateLinkMode();
    drawProyectoLinks(proyecto);
    fitProyectoCanvas(maxY);
  }

  /* ---------- Flechas entre post-it ---------- */
  const SVG_NS = "http://www.w3.org/2000/svg";
  let proyectoLinkFrom = null; // tarea desde la que se está trazando la flecha

  function proyectoLinks(proyecto) {
    const raw = proyecto.links;
    const arr = Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object"
      ? Object.values(raw)
      : [];
    return arr.filter((l) => l && l.from && l.to);
  }

  // Marca/desmarca el origen. Con un origen activo, tocar otro post-it une.
  function toggleLinkFrom(id) {
    proyectoLinkFrom = proyectoLinkFrom === id ? null : id;
    updateLinkMode();
  }

  function updateLinkMode() {
    proyectoTasksCanvas.classList.toggle("is-linking", !!proyectoLinkFrom);
    proyectoTasksCanvas.querySelectorAll(".postit").forEach((n) => {
      n.classList.toggle("is-link-source", n.dataset.id === proyectoLinkFrom);
    });
  }

  function addProyectoLink(proyecto, from, to) {
    if (!from || !to || from === to) return;
    const links = proyectoLinks(proyecto);
    // Ya existe esa misma flecha (mismo sentido)
    if (links.some((l) => l.from === from && l.to === to)) return;
    links.push({ from: from, to: to });
    proyecto.links = links;
    saveProyectos();
  }

  function removeProyectoLink(proyecto, from, to) {
    proyecto.links = proyectoLinks(proyecto).filter(
      (l) => !(l.from === from && l.to === to)
    );
    saveProyectos();
  }

  /* ---------- Por qué lado sale y entra cada flecha ----------
     Los cuatro lados de una tarjeta, siempre anclados a su centro: "l"
     izquierda, "r" derecha, "t" arriba, "b" abajo. Cada uno con su normal
     (hacia dónde sale la flecha). Una flecha puede fijar los suyos en
     `fromSide` / `toSide`; el que no esté fijado se calcula solo, como antes. */
  const LADOS = {
    l: { fx: 0, fy: 0.5, nx: -1, ny: 0 },
    r: { fx: 1, fy: 0.5, nx: 1, ny: 0 },
    t: { fx: 0.5, fy: 0, nx: 0, ny: -1 },
    b: { fx: 0.5, fy: 1, nx: 0, ny: 1 },
  };
  const LADO_NOMBRE = {
    l: "izquierda",
    r: "derecha",
    t: "arriba",
    b: "abajo",
  };
  const LINK_STUB = 18; // tramo recto al salir de la tarjeta y al entrar

  // Punto de enganche (centro del lado) de la tarjeta colocada en `p`
  function anclaLado(p, lado) {
    const s = LADOS[lado] || LADOS.r;
    return { x: p.x + POSTIT_SIZE * s.fx, y: p.y + POSTIT_SIZE * s.fy };
  }

  // Punto donde acaba el tramo recto: ahí va el mango para reengancharla
  function mangoLado(p, lado) {
    const s = LADOS[lado] || LADOS.r;
    const a = anclaLado(p, lado);
    return { x: a.x + s.nx * LINK_STUB, y: a.y + s.ny * LINK_STUB };
  }

  // Lados por defecto: los que se miran entre sí (el comportamiento de siempre)
  function ladosAuto(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) >= Math.abs(dy))
      return dx >= 0 ? { from: "r", to: "l" } : { from: "l", to: "r" };
    return dy >= 0 ? { from: "b", to: "t" } : { from: "t", to: "b" };
  }

  function ladosLink(l, a, b) {
    const auto = ladosAuto(a, b);
    return {
      from: LADOS[l.fromSide] ? l.fromSide : auto.from,
      to: LADOS[l.toSide] ? l.toSide : auto.to,
    };
  }

  // Lado de la tarjeta colocada en `p` más cercano a un punto del lienzo
  function ladoMasCercano(p, x, y) {
    let mejor = "r";
    let dist = Infinity;
    Object.keys(LADOS).forEach((k) => {
      const a = anclaLado(p, k);
      const d = (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y);
      if (d < dist) {
        dist = d;
        mejor = k;
      }
    });
    return mejor;
  }

  // Eje del tramo central, que es el que desplaza `bend`: "h" si la flecha sale
  // y entra en horizontal, "v" si en vertical, null si hace un codo (ahí no hay
  // tramo central que mover).
  function ejeLink(l, a, b) {
    if (!a || !b) return null;
    const lados = ladosLink(l, a, b);
    const hA = LADOS[lados.from].nx !== 0;
    const hB = LADOS[lados.to].nx !== 0;
    if (hA && hB) return "h";
    if (!hA && !hB) return "v";
    return null;
  }

  // Ruta quebrada entre dos post-it: solo tramos horizontales y verticales.
  // Sale perpendicular al lado elegido, hace su recorrido y entra perpendicular
  // al lado de destino.
  // `bend` (opcional): {axis, off} desplaza el tramo central respecto a su
  // sitio por defecto. Solo cuenta si su eje es el de la ruta actual; si los
  // post-it se recolocan y la ruta cambia de eje, se ignora.
  function rutaOrtogonal(a, b, ladoA, ladoB, bend) {
    const sa = LADOS[ladoA] || LADOS.r;
    const sb = LADOS[ladoB] || LADOS.l;
    const s1 = anclaLado(a, ladoA);
    const e1 = anclaLado(b, ladoB);
    const s2 = mangoLado(a, ladoA);
    const e2 = mangoLado(b, ladoB);
    const hA = sa.nx !== 0;
    const hB = sb.nx !== 0;
    let medio;
    if (hA && hB) {
      // Las dos en horizontal: el tramo central es vertical, a media distancia
      const off = bend && bend.axis === "h" ? bend.off || 0 : 0;
      const mx = (s2.x + e2.x) / 2 + off;
      medio = [
        [mx, s2.y],
        [mx, e2.y],
      ];
    } else if (!hA && !hB) {
      // Las dos en vertical: el tramo central es horizontal
      const off = bend && bend.axis === "v" ? bend.off || 0 : 0;
      const my = (s2.y + e2.y) / 2 + off;
      medio = [
        [s2.x, my],
        [e2.x, my],
      ];
    } else if (hA) {
      medio = [[e2.x, s2.y]]; // codo: primero en horizontal, luego en vertical
    } else {
      medio = [[s2.x, e2.y]]; // codo al revés
    }
    const puntos = [[s1.x, s1.y], [s2.x, s2.y]]
      .concat(medio)
      .concat([
        [e2.x, e2.y],
        [e1.x, e1.y],
      ]);
    // Sin repetidos (cuando van alineados, el giro no existe)
    return puntos.filter(
      (p, i, arr) => i === 0 || p[0] !== arr[i - 1][0] || p[1] !== arr[i - 1][1]
    );
  }

  // Posición actual de cada post-it, leída del DOM (vale también mientras se
  // arrastra uno, porque su style ya está actualizado).
  function postitPositions() {
    const pos = {};
    proyectoTasksCanvas.querySelectorAll(".postit").forEach((n) => {
      pos[n.dataset.id] = {
        x: parseFloat(n.style.left) || 0,
        y: parseFloat(n.style.top) || 0,
      };
    });
    return pos;
  }

  // Geometría de una flecha: los puntos del trazo y dónde van sus dos mangos.
  // null si alguna de las dos tareas ya no está en el proyecto.
  function geoLink(l, pos) {
    const a = pos[l.from];
    const b = pos[l.to];
    if (!a || !b) return null;
    const lados = ladosLink(l, a, b);
    return {
      puntos: rutaOrtogonal(a, b, lados.from, lados.to, l.bend)
        .map((p) => p[0] + "," + p[1])
        .join(" "),
      lados: lados,
      m1: mangoLado(a, lados.from),
      m2: mangoLado(b, lados.to),
    };
  }

  // Arrastrar una flecha desplaza su tramo central (el recorrido sigue siendo
  // en ángulo recto). Si se pulsa sin arrastrar, se ofrece eliminarla.
  // `refrescar` vuelve a pintar esta flecha con la geometría al día.
  function enableLinkDrag(g, hit, proyecto, l, refrescar) {
    let dragging = false;
    let moved = false;
    let eje = "h";
    let startX = 0;
    let startY = 0;
    let startOff = 0;

    hit.addEventListener("pointerdown", (e) => {
      if (e.button && e.button !== 0) return;
      const pos = postitPositions();
      // En codo no hay tramo central: la flecha solo se pulsa para eliminarla
      eje = ejeLink(l, pos[l.from], pos[l.to]);
      startOff = eje && l.bend && l.bend.axis === eje ? l.bend.off || 0 : 0;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      g.classList.add("is-dragging");
      try {
        hit.setPointerCapture(e.pointerId);
      } catch (err) {
        /* algunos navegadores no lo permiten; no es crítico */
      }
      e.preventDefault();
      e.stopPropagation();
    });

    hit.addEventListener("pointermove", (e) => {
      if (!dragging || !eje) return;
      const d = eje === "h" ? e.clientX - startX : e.clientY - startY;
      if (!moved && Math.abs(d) <= 2) return; // todavía es una pulsación
      moved = true;
      l.bend = { axis: eje, off: Math.round(startOff + d) };
      refrescar();
    });

    function soltar() {
      if (!dragging) return;
      dragging = false;
      g.classList.remove("is-dragging");
      if (moved) {
        saveProyectos(); // el desvío ya está en el objeto guardado
        return;
      }
      if (confirm("¿Eliminar esta flecha?")) {
        removeProyectoLink(proyecto, l.from, l.to);
        renderProyectoTasks();
      }
    }

    hit.addEventListener("pointerup", soltar);
    hit.addEventListener("pointercancel", soltar);
  }

  // Arrastrar el mango de un extremo lo engancha al lado más cercano de su
  // tarjeta: derecha, izquierda, arriba o abajo, siempre por el centro.
  // `extremo` es "from" o "to" (que son también los campos con el id de la tarea).
  function enableLinkEndDrag(mango, g, proyecto, l, extremo, refrescar) {
    const campo = extremo === "from" ? "fromSide" : "toSide";
    let dragging = false;
    let inicial = null;

    mango.addEventListener("pointerdown", (e) => {
      if (e.button && e.button !== 0) return;
      dragging = true;
      inicial = l[campo];
      g.classList.add("is-dragging");
      try {
        mango.setPointerCapture(e.pointerId);
      } catch (err) {
        /* algunos navegadores no lo permiten; no es crítico */
      }
      e.preventDefault();
      e.stopPropagation(); // ni bend, ni rectángulo de selección
    });

    mango.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const p = postitPositions()[l[extremo]];
      if (!p) return;
      const r = proyectoTasksCanvas.getBoundingClientRect();
      const lado = ladoMasCercano(p, e.clientX - r.left, e.clientY - r.top);
      if (l[campo] === lado) return;
      l[campo] = lado;
      refrescar();
    });

    function soltar() {
      if (!dragging) return;
      dragging = false;
      g.classList.remove("is-dragging");
      if (l[campo] !== inicial) saveProyectos();
    }

    mango.addEventListener("pointerup", soltar);
    mango.addEventListener("pointercancel", soltar);
  }

  function drawProyectoLinks(proyecto) {
    const svg = proyectoTasksCanvas.querySelector(".proyecto-links");
    if (!svg) return;
    const pos = postitPositions();

    svg.innerHTML =
      '<defs><marker id="postit-arrow" viewBox="0 0 10 10" refX="9" refY="5" ' +
      'markerWidth="6" markerHeight="6" markerUnits="strokeWidth" orient="auto">' +
      '<path d="M0 0 L10 5 L0 10 z" fill="currentColor"/></marker></defs>';

    // Se normaliza para que los objetos que se pasan al arrastre sean los
    // mismos que están guardados (ajustar el recorrido los modifica).
    proyecto.links = proyectoLinks(proyecto);
    proyecto.links.forEach((l) => {
      const geo = geoLink(l, pos);
      if (!geo) return;

      const g = document.createElementNS(SVG_NS, "g");
      g.setAttribute("class", "proyecto-link");
      // Trazo ancho invisible: da área para poder pulsar la flecha
      const hit = document.createElementNS(SVG_NS, "polyline");
      hit.setAttribute("class", "proyecto-link-hit");
      const linea = document.createElementNS(SVG_NS, "polyline");
      linea.setAttribute("class", "proyecto-link-line");
      linea.setAttribute("marker-end", "url(#postit-arrow)");
      [hit, linea].forEach((el) => {
        el.setAttribute("points", geo.puntos);
        el.setAttribute("fill", "none"); // si no, el polígono se rellena
        g.appendChild(el);
      });

      if (grafoSoloLectura()) {
        svg.appendChild(g);
        return;
      }

      // Un mango en cada extremo, en la punta del tramo recto (fuera de la
      // tarjeta, para que no lo tape). Arrastrarlo cambia de lado.
      const mangos = [0, 1].map(() => {
        const c = document.createElementNS(SVG_NS, "circle");
        c.setAttribute("class", "proyecto-link-end");
        c.setAttribute("r", "5");
        g.appendChild(c);
        return c;
      });

      // Repinta esta flecha con la geometría al día (posiciones y lados)
      const refrescar = () => {
        const ahora = geoLink(l, postitPositions());
        if (!ahora) return;
        hit.setAttribute("points", ahora.puntos);
        linea.setAttribute("points", ahora.puntos);
        [ahora.m1, ahora.m2].forEach((m, i) => {
          mangos[i].setAttribute("cx", m.x);
          mangos[i].setAttribute("cy", m.y);
        });
        mangos[0].setAttribute(
          "aria-label",
          "Sale por la " + LADO_NOMBRE[ahora.lados.from]
        );
        mangos[1].setAttribute(
          "aria-label",
          "Entra por la " + LADO_NOMBRE[ahora.lados.to]
        );
      };
      refrescar();

      enableLinkDrag(g, hit, proyecto, l, refrescar);
      enableLinkEndDrag(mangos[0], g, proyecto, l, "from", refrescar);
      enableLinkEndDrag(mangos[1], g, proyecto, l, "to", refrescar);
      svg.appendChild(g);
    });
  }

  // El lienzo llega hasta el final de la pantalla (respetando el hueco de la
  // barra de navegación) y, si algún post-it queda más abajo, crece con él.
  function fitProyectoCanvas(maxY) {
    if (!proyectoTasksCanvas || proyectoTasksCanvas.hidden) return;
    const top =
      proyectoTasksCanvas.getBoundingClientRect().top + window.scrollY;
    const main = document.querySelector(".app-main");
    const hueco = main
      ? parseFloat(getComputedStyle(main).paddingBottom) || 24
      : 24;
    const disponible = Math.max(240, window.innerHeight - top - hueco);
    proyectoTasksCanvas.style.minHeight =
      Math.max(disponible, maxY + POSTIT_GAP) + "px";
  }

  // Al cambiar el tamaño de la ventana se recolocan las columnas por defecto
  window.addEventListener("resize", () => {
    if (proyectoTasksCanvas && !proyectoTasksCanvas.hidden) renderProyectoTasks();
  });

  // Arrastre libre por el lienzo. Empieza al momento (no hay scroll que
  // competir: el post-it tiene `touch-action: none`) y, si no se ha movido,
  // el toque abre los ajustes de la tarea.
  function enablePostitDrag(nota, proyecto, task) {
    // Solo lectura: el post-it sigue abriendo su tarea, pero no se mueve
    if (grafoSoloLectura()) {
      nota.addEventListener("click", () => openDetail(task.id));
      return;
    }
    let dragging = false;
    let moved = false;
    let offX = 0;
    let offY = 0;
    let startX = 0;
    let startY = 0;
    // Cuando se arrastra una selección: posición de salida de cada post-it
    let grupo = null;

    nota.addEventListener("pointerdown", (e) => {
      if (e.button && e.button !== 0) return;
      // Con Ctrl/Cmd/Mayús el clic solo marca o desmarca: ni mueve ni abre
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        toggleProyectoSel(task.id);
        return;
      }
      // Agarrar algo que no está marcado deshace la selección anterior
      if (!proyectoSel.has(task.id)) clearProyectoSel();
      dragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      const caja = nota.getBoundingClientRect();
      offX = e.clientX - caja.left;
      offY = e.clientY - caja.top;
      // Con varios marcados se mueven todos: se anotan sus posiciones de salida
      grupo =
        proyectoSel.size > 1 && proyectoSel.has(task.id)
          ? [...proyectoTasksCanvas.querySelectorAll(".postit")]
              .filter((n) => proyectoSel.has(n.dataset.id))
              .map((n) => ({
                nota: n,
                x0: parseFloat(n.style.left) || 0,
                y0: parseFloat(n.style.top) || 0,
              }))
          : null;
      nota.classList.add("is-dragging");
      try {
        nota.setPointerCapture(e.pointerId);
      } catch (err) {
        /* algunos navegadores no lo permiten; no es crítico */
      }
      e.preventDefault();
    });

    nota.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      moved = true;
      if (grupo) {
        // El grupo se mueve rígido: el desplazamiento se recorta para que
        // ninguno se salga por arriba o por la izquierda del lienzo.
        let dx = e.clientX - startX;
        let dy = e.clientY - startY;
        grupo.forEach((g) => {
          dx = Math.max(dx, -g.x0);
          dy = Math.max(dy, -g.y0);
        });
        grupo.forEach((g) => {
          g.nota.style.left = g.x0 + dx + "px";
          g.nota.style.top = g.y0 + dy + "px";
        });
      } else {
        const caja = proyectoTasksCanvas.getBoundingClientRect();
        nota.style.left = Math.max(0, e.clientX - caja.left - offX) + "px";
        nota.style.top = Math.max(0, e.clientY - caja.top - offY) + "px";
      }
      drawProyectoLinks(proyecto); // las flechas siguen a los post-it
    });

    function soltar() {
      if (!dragging) return;
      dragging = false;
      nota.classList.remove("is-dragging");
      const g = grupo;
      grupo = null;
      if (!moved) {
        // Con una flecha empezada, el toque la remata en esta tarea
        if (proyectoLinkFrom) {
          const desde = proyectoLinkFrom;
          proyectoLinkFrom = null;
          if (desde !== task.id) {
            addProyectoLink(proyecto, desde, task.id);
            renderProyectoTasks();
          } else {
            updateLinkMode(); // tocar el propio origen cancela
          }
          return;
        }
        clearProyectoSel();
        openDetail(task.id); // un toque limpio abre la tarea
        return;
      }
      // Movimiento en grupo: se apuntan todas las posiciones y se guarda una vez
      if (g) {
        let maxY = 0;
        g.forEach((it) => {
          const gx = parseFloat(it.nota.style.left);
          const gy = parseFloat(it.nota.style.top);
          setPostitPos(proyecto, it.nota.dataset.id, gx, gy);
          maxY = Math.max(maxY, gy + POSTIT_SIZE);
        });
        saveProyectos();
        fitProyectoCanvas(maxY);
        return;
      }
      const x = parseFloat(nota.style.left);
      const y = parseFloat(nota.style.top);
      savePostitPos(proyecto, task.id, x, y);
      fitProyectoCanvas(y + POSTIT_SIZE); // que siga dando de sí hacia abajo
    }

    nota.addEventListener("pointerup", soltar);
    nota.addEventListener("pointercancel", soltar);
  }

  /* ---------- Rectángulo de selección sobre el fondo del lienzo ---------- */
  function enableProyectoMarquee(canvas) {
    let caja = null; // el <div> del rectángulo, mientras se dibuja
    let base = null; // lo que ya estaba marcado al empezar (Ctrl/Cmd suma)
    let arrastrando = false;
    let x0 = 0;
    let y0 = 0;

    canvas.addEventListener("pointerdown", (e) => {
      if (e.button && e.button !== 0) return;
      if (grafoSoloLectura()) return;
      if (e.target !== canvas) return; // solo desde el fondo, no desde un post-it
      const r = canvas.getBoundingClientRect();
      x0 = e.clientX - r.left;
      y0 = e.clientY - r.top;
      arrastrando = true;
      marqueeMoved = false; // gesto nuevo: lo del anterior ya no cuenta
      // Sin Ctrl/Cmd/Mayús se empieza una selección nueva
      if (!(e.ctrlKey || e.metaKey || e.shiftKey)) clearProyectoSel();
      base = new Set(proyectoSel);
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (err) {
        /* algunos navegadores no lo permiten; no es crítico */
      }
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!arrastrando) return;
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (!caja) {
        // Hasta que no se mueve de verdad, sigue siendo un clic
        if (Math.abs(x - x0) < 4 && Math.abs(y - y0) < 4) return;
        caja = document.createElement("div");
        caja.className = "proyecto-marquee";
        canvas.appendChild(caja);
      }
      const izq = Math.min(x, x0);
      const arriba = Math.min(y, y0);
      const ancho = Math.abs(x - x0);
      const alto = Math.abs(y - y0);
      caja.style.left = izq + "px";
      caja.style.top = arriba + "px";
      caja.style.width = ancho + "px";
      caja.style.height = alto + "px";
      // Se marca en vivo todo lo que toca el rectángulo (y se desmarca al
      // encogerlo: se parte siempre de lo que había al empezar).
      proyectoSel = new Set(base);
      canvas.querySelectorAll(".postit").forEach((n) => {
        const nx = parseFloat(n.style.left) || 0;
        const ny = parseFloat(n.style.top) || 0;
        const toca =
          nx < izq + ancho &&
          nx + POSTIT_SIZE > izq &&
          ny < arriba + alto &&
          ny + POSTIT_SIZE > arriba;
        if (toca) proyectoSel.add(n.dataset.id);
      });
      updateProyectoSel();
    });

    function fin() {
      if (!arrastrando) return;
      arrastrando = false;
      base = null;
      if (caja) {
        caja.remove();
        caja = null;
        // Tras dibujar el rectángulo llega un "click" en el fondo: que no
        // cancele de paso la flecha que estuviera a medias.
        marqueeMoved = true;
      }
    }

    canvas.addEventListener("pointerup", fin);
    canvas.addEventListener("pointercancel", fin);
  }

  enableProyectoMarquee(proyectoTasksCanvas);

  /* ---------- Nueva tarea dentro de un proyecto ----------
     Desde la cabecera nace "Sin empezar"; desde el "+" de una columna de la
     vista Listas, ya en el estado de esa columna. */
  let proyectoTaskEstado = "sin-empezar";

  function openProyectoTaskNew(estado) {
    if (!getProyectoOpen()) return;
    const valido =
      estado &&
      estado !== "bloqueada" && // ese lo decide el diagrama, no se elige
      TASK_STATES.some((s) => s.id === estado);
    proyectoTaskEstado = valido ? estado : "sin-empezar";
    proyectoTaskInput.value = "";
    proyectoTaskListSel.value = "sinTipo"; // por defecto, solo en el proyecto
    proyectoTaskModalTitle.textContent =
      proyectoTaskEstado === "sin-empezar"
        ? "Nueva tarea"
        : "Nueva tarea · " + taskStateName(proyectoTaskEstado);
    proyectoTaskOverlay.hidden = false;
    proyectoTaskInput.focus();
  }

  function closeProyectoTaskNew() {
    if (proyectoTaskOverlay.hidden) return;
    proyectoTaskOverlay.hidden = true;
  }

  proyectoTaskAddBtn.addEventListener("click", () => openProyectoTaskNew());
  proyectoTaskCancel.addEventListener("click", closeProyectoTaskNew);
  proyectoTaskOverlay.addEventListener("click", (e) => {
    if (e.target === proyectoTaskOverlay) closeProyectoTaskNew();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !proyectoTaskOverlay.hidden)
      closeProyectoTaskNew();
  });

  // Crear una tarea ya asignada al proyecto, en la lista y el estado elegidos
  proyectoTaskForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const item = getProyectoOpen();
    const text = proyectoTaskInput.value.trim();
    if (!item || !text) return;
    const nueva = {
      id: newId(),
      text: text,
      done: false,
      starred: false,
      projectId: item.id,
    };
    // Mismo criterio que el selector "Estado" del panel de la tarea
    if (proyectoTaskEstado === "completada") {
      nueva.done = true;
      nueva.completedAt = todayISO();
    } else if (
      proyectoTaskEstado === "proceso" ||
      proyectoTaskEstado === "espera"
    ) {
      nueva.projectState = proyectoTaskEstado;
    }
    const ctx = CTX_BY_TYPE[proyectoTaskListSel.value]();
    ctx.items().unshift(nueva);
    ctx.save();
    closeProyectoTaskNew();
    renderAllLists(); // repinta su lista de origen y esta página
  });

  proyectoTasksTabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".task-tab");
    if (!btn) return;
    proyectoTasksTab = btn.dataset.tab;
    proyectoLinkFrom = null; // no queda una flecha a medias al cambiar de vista
    clearProyectoSel();
    renderProyectoTasks();
  });

  // Escape, o tocar el fondo del lienzo, cancela la flecha a medias y deshace
  // la selección de post-it
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (proyectoLinkFrom) {
      proyectoLinkFrom = null;
      updateLinkMode();
    }
    clearProyectoSel();
  });
  proyectoTasksCanvas.addEventListener("click", (e) => {
    // Si el gesto fue dibujar un rectángulo de selección, este clic no cuenta
    if (marqueeMoved) {
      marqueeMoved = false;
      return;
    }
    if (e.target !== proyectoTasksCanvas) return;
    if (proyectoLinkFrom) {
      proyectoLinkFrom = null;
      updateLinkMode();
    }
    clearProyectoSel();
  });

  // ¿La sección existe todavía? Un proyecto con una sección borrada (o sin
  // sección) cae en el bloque "Sin sección".
  function proyectoSeccionOf(item) {
    const id = (item && item.sectionId) || "";
    return proyectoSecciones.some((s) => s.id === id) ? id : "";
  }

  function proyectoItemEl(item) {
    const li = document.createElement("li");
    li.className = "proyecto-item";
    li.dataset.id = item.id;

    // Enlace a Notion, a modo avatar al principio de la fila (si lo tiene)
    const url = proyectoUrl(item);
    if (url) {
      const link = document.createElement("a");
      link.className = "proyecto-link";
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.title = "Abrir en Notion";
      link.setAttribute("aria-label", "Abrir " + item.text + " en Notion");
      link.innerHTML = NOTION_ICON;
      li.appendChild(link);
    }

    // La fila entera abre la lista de tareas del proyecto
    const main = document.createElement("div");
    main.className = "proyecto-main";
    main.addEventListener("click", () => openProyectoTasks(item.id));
    const text = document.createElement("span");
    text.className = "proyecto-text";
    text.textContent = item.text;
    main.appendChild(text);
    // 2ª línea: su categoría, en el color que le toca
    const cat = HOY_CATEGORIES.find((c) => c.id === item.category);
    if (cat) {
      const catEl = document.createElement("span");
      catEl.className = "proyecto-cat cat-" + cat.id;
      catEl.textContent = cat.name;
      main.appendChild(catEl);
    }
    li.appendChild(main);

    // Ejecutables: pendientes que ya se pueden hacer. Solo si hay alguna.
    const prog = proyectoProgreso(item.id);
    if (prog.ready) {
      const ready = document.createElement("span");
      ready.className = "proyecto-ready";
      ready.textContent = prog.ready;
      ready.title = "Tareas ejecutables ahora";
      li.appendChild(ready);
    }

    // Progreso: completadas / total
    const count = document.createElement("span");
    count.className = "proyecto-count";
    count.textContent = prog.done + "/" + prog.total;
    count.title = "Tareas completadas del total";
    li.appendChild(count);

    return li;
  }

  // Índice de proyectos. Sin secciones creadas es una sola lista, como siempre.
  // Con secciones, un bloque por sección y, al final, "Sin sección" (que se
  // mantiene aunque esté vacío: es donde se sueltan los que salen de una).
  function renderProyectosIndex() {
    if (!proyectosListEl) return;
    proyectosListEl.innerHTML = "";
    const conSecciones = proyectoSecciones.length > 0;

    // Bloques a pintar: las secciones en orden y, al final, "Sin sección"
    const bloques = proyectoSecciones
      .map((s) => ({ id: s.id, name: s.name }))
      .concat([{ id: "", name: "Sin sección" }]);

    bloques.forEach((bloque) => {
      const items = proyectos.filter(
        (p) => proyectoSeccionOf(p) === bloque.id
      );
      // Sin secciones no hay cabeceras ni bloques vacíos que enseñar
      if (!conSecciones && !items.length) return;

      const wrap = document.createElement("section");
      wrap.className = "proyecto-sec";
      wrap.dataset.section = bloque.id;

      // "Sin sección" vacío no lleva cabecera: se queda al final como un
      // destino discreto donde volver a soltar lo que salga de una sección.
      const conCabecera = conSecciones && (bloque.id !== "" || items.length > 0);

      if (conCabecera) {
        const head = document.createElement("div");
        head.className = "proyecto-sec-head";
        const title = document.createElement("h2");
        title.className = "proyecto-sec-title";
        title.textContent = bloque.name;
        const n = document.createElement("span");
        n.className = "proyecto-sec-count";
        n.textContent = items.length;
        head.append(title, n);
        wrap.appendChild(head);
      }

      const ul = document.createElement("ul");
      ul.className = "proyecto-list";
      items.forEach((item) => ul.appendChild(proyectoItemEl(item)));
      wrap.appendChild(ul);

      if (conSecciones && !items.length) {
        const hint = document.createElement("p");
        hint.className = "proyecto-sec-empty";
        hint.textContent = conCabecera
          ? "Arrastra proyectos aquí."
          : "Arrastra aquí los proyectos sin sección.";
        wrap.appendChild(hint);
      }

      proyectosListEl.appendChild(wrap);
    });

    if (proyectosEmpty) proyectosEmpty.hidden = proyectos.length !== 0;
  }

  proyectoTasksBack.addEventListener("click", closeProyectoTasks);
  proyectoSettingsBtn.addEventListener("click", () => {
    const item = getProyectoOpen();
    if (item) openProyectoDetail(item.id);
  });

  /* ---------- Arrastrar proyectos: entre secciones y dentro de una ----------
     Mismo gesto que el board de tareas: con el dedo hay que mantener pulsado
     (mover sería scroll) y con ratón basta con arrastrar un poco. Al soltar se
     reescribe el array `proyectos` con el orden del DOM y cada uno se queda con
     la sección del bloque en el que ha caído. */
  const PRO_MOVE_PX = 8; // con ratón, se arrastra al pasar de este margen

  function enableProyectoDrag(container) {
    let dragEl = null;
    let dragging = false;
    let moved = false; // sin movimiento no hay nada que guardar
    let pressTimer = null;
    let startX = 0;
    let startY = 0;

    function cancelPress() {
      clearTimeout(pressTimer);
      pressTimer = null;
    }

    // Bloque bajo el puntero. Los bloques están siempre apilados, así que
    // manda la y: el que lo contiene o, fuera de todos, el más cercano.
    function sectionAt(y) {
      let best = null;
      let bestDist = Infinity;
      container.querySelectorAll(".proyecto-sec").forEach((sec) => {
        const r = sec.getBoundingClientRect();
        if (!r.height) return;
        const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
        if (dy < bestDist) {
          bestDist = dy;
          best = sec;
        }
      });
      return best;
    }

    // Proyecto de ese bloque ante el que hay que soltar (el primero cuyo centro
    // queda por debajo del puntero), o null para dejarlo el último.
    function itemAfter(ul, y) {
      const items = [...ul.querySelectorAll(".proyecto-item:not(.dragging)")];
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
      if (!dragEl || dragging) return;
      dragging = true;
      moved = false;
      reorderDragging = true;
      dragEl.classList.add("dragging");
      container.classList.add("is-dragging");
      try {
        if (pointerId != null) dragEl.setPointerCapture(pointerId);
      } catch (e) {
        /* algunos navegadores no lo permiten; no es crítico */
      }
    }

    function consumeClick(e) {
      e.stopPropagation();
      e.preventDefault();
    }

    // Reescribe `proyectos` con lo que se ve: recorre los bloques en orden y,
    // dentro de cada uno, sus filas. Cada proyecto se queda con la sección del
    // bloque donde ha caído ("" = sin sección, que no se guarda).
    function commitOrder() {
      const orden = [];
      container.querySelectorAll(".proyecto-sec").forEach((sec) => {
        const secId = sec.dataset.section || "";
        sec.querySelectorAll(".proyecto-item").forEach((li) => {
          const item = proyectos.find((p) => p.id === li.dataset.id);
          if (!item) return;
          if (secId) item.sectionId = secId;
          else delete item.sectionId;
          orden.push(item);
        });
      });
      // Por si algún proyecto no estuviera en el DOM: no se pierde
      proyectos.forEach((p) => {
        if (orden.indexOf(p) === -1) orden.push(p);
      });
      proyectos = orden;
      saveProyectos();
    }

    function endDrag() {
      cancelPress();
      if (dragging) {
        dragging = false;
        reorderDragging = false;
        if (dragEl) dragEl.classList.remove("dragging");
        container.classList.remove("is-dragging");
        // Anula el "click" que el navegador dispara al soltar (abriría el
        // proyecto). Se auto-elimina al primer click o tras un breve margen.
        container.addEventListener("click", consumeClick, {
          capture: true,
          once: true,
        });
        setTimeout(() => {
          container.removeEventListener("click", consumeClick, true);
        }, 350);
        dragEl = null;
        if (moved) {
          commitOrder();
          renderProyectosIndex(); // repinta contadores y bloques vacíos
        }
        return;
      }
      dragEl = null;
    }

    container.addEventListener("pointerdown", (e) => {
      if (e.button && e.button !== 0) return; // solo botón principal
      if (e.target.closest(".proyecto-link")) return; // el avatar es un enlace
      const li = e.target.closest(".proyecto-item");
      if (!li) return;
      dragEl = li;
      startX = e.clientX;
      startY = e.clientY;
      cancelPress();
      if (e.pointerType === "touch") {
        pressTimer = setTimeout(() => startDrag(e.pointerId), LONG_PRESS_MS);
      }
    });

    container.addEventListener("pointermove", (e) => {
      if (!dragEl) return;
      if (!dragging) {
        // Se soltó fuera de la lista: ese pointerdown ya no cuenta
        if (!e.buttons) {
          cancelPress();
          dragEl = null;
          return;
        }
        const lejos =
          Math.abs(e.clientY - startY) > PRO_MOVE_PX ||
          Math.abs(e.clientX - startX) > PRO_MOVE_PX;
        if (!lejos) return;
        // Con el dedo, moverse antes del long-press es scroll, no arrastre
        if (e.pointerType === "touch") {
          cancelPress();
          dragEl = null;
          return;
        }
        startDrag(e.pointerId);
      }
      e.preventDefault();
      const sec = sectionAt(e.clientY);
      if (!sec) return;
      const ul = sec.querySelector(".proyecto-list");
      if (!ul) return;
      const after = itemAfter(ul, e.clientY);
      if (after == null) {
        if (ul.lastElementChild !== dragEl) {
          ul.appendChild(dragEl);
          moved = true;
        }
      } else if (after !== dragEl && dragEl.nextElementSibling !== after) {
        ul.insertBefore(dragEl, after);
        moved = true;
      }
    });

    container.addEventListener("pointerup", endDrag);
    container.addEventListener("pointercancel", endDrag);
  }

  enableProyectoDrag(proyectosListEl);

  /* ---------- Secciones de Proyectos (modal de ajustes) ---------- */
  const proyectosSeccionesBtn = document.getElementById(
    "proyectos-secciones-btn"
  );
  const proSeccionesOverlay = document.getElementById(
    "proyecto-secciones-overlay"
  );
  const proSeccionesClose = document.getElementById("proyecto-secciones-close");
  const proSeccionForm = document.getElementById("proyecto-seccion-form");
  const proSeccionName = document.getElementById("proyecto-seccion-name");
  const proSeccionList = document.getElementById("proyecto-seccion-list");
  const proSeccionEmpty = document.getElementById("proyecto-seccion-empty");

  // Lista de secciones del modal: nombre editable + eliminar
  function renderProyectoSeccionesModal() {
    if (!proSeccionList) return;
    proSeccionList.innerHTML = "";
    proyectoSecciones.forEach((sec) => {
      const li = document.createElement("li");
      li.className = "seccion-item";
      li.dataset.id = sec.id;

      const input = document.createElement("input");
      input.type = "text";
      input.className = "seccion-name";
      input.maxLength = 80;
      input.value = sec.name;
      input.setAttribute("aria-label", "Nombre de la sección");
      // El nombre se guarda al salir del campo; en blanco, se recupera
      input.addEventListener("blur", () => {
        const v = input.value.trim();
        if (!v) {
          input.value = sec.name;
          return;
        }
        if (v === sec.name) return;
        sec.name = v;
        saveProyectoSecciones();
        renderProyectosIndex();
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          input.blur();
        }
      });

      const del = document.createElement("button");
      del.type = "button";
      del.className = "seccion-del";
      del.textContent = "🗑";
      del.title = "Eliminar sección";
      del.setAttribute("aria-label", "Eliminar la sección " + sec.name);
      del.addEventListener("click", () => deleteProyectoSeccion(sec.id));

      li.append(input, del);
      proSeccionList.appendChild(li);
    });
    if (proSeccionEmpty) proSeccionEmpty.hidden = proyectoSecciones.length !== 0;
  }

  function addProyectoSeccion(name) {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    proyectoSecciones.push({ id: newId(), name: trimmed });
    saveProyectoSecciones();
    renderProyectoSeccionesModal();
    renderProyectosIndex();
  }

  // Eliminar una sección no borra sus proyectos: vuelven a "Sin sección".
  function deleteProyectoSeccion(id) {
    const sec = proyectoSecciones.find((s) => s.id === id);
    if (!sec) return;
    const n = proyectos.filter((p) => proyectoSeccionOf(p) === id).length;
    const msg = n
      ? 'Eliminar la sección "' +
        sec.name +
        '"? Sus ' +
        n +
        " proyecto(s) pasan a Sin sección (no se borran)."
      : 'Eliminar la sección "' + sec.name + '"?';
    if (!confirm(msg)) return;
    proyectoSecciones = proyectoSecciones.filter((s) => s.id !== id);
    proyectos.forEach((p) => {
      if (p.sectionId === id) delete p.sectionId;
    });
    saveProyectoSecciones();
    saveProyectos();
    renderProyectoSeccionesModal();
    renderProyectosIndex();
  }

  function openProyectoSecciones() {
    renderProyectoSeccionesModal();
    proSeccionName.value = "";
    proSeccionesOverlay.hidden = false;
    proSeccionName.focus();
  }

  function closeProyectoSecciones() {
    if (proSeccionesOverlay.hidden) return;
    proSeccionesOverlay.hidden = true;
  }

  proyectosSeccionesBtn.addEventListener("click", openProyectoSecciones);
  proSeccionesClose.addEventListener("click", closeProyectoSecciones);
  proSeccionesOverlay.addEventListener("click", (e) => {
    if (e.target === proSeccionesOverlay) closeProyectoSecciones();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !proSeccionesOverlay.hidden)
      closeProyectoSecciones();
  });
  proSeccionForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addProyectoSeccion(proSeccionName.value);
    proSeccionName.value = "";
    proSeccionName.focus();
  });

  /* ---------- Nuevo proyecto (botón + de la cabecera) ---------- */
  const proyectoNewOverlay = document.getElementById("proyecto-new-overlay");
  const proyectoNewForm = document.getElementById("proyecto-new-form");
  const proyectoNewName = document.getElementById("proyecto-new-name");
  const proyectoNewUrl = document.getElementById("proyecto-new-url");
  const proyectoNewCancel = document.getElementById("proyecto-new-cancel");
  const proyectoNewCat = document.getElementById("proyecto-new-cat");
  fillCategorySelect(proyectoNewCat);

  function openProyectoNew() {
    proyectoNewForm.reset();
    proyectoNewOverlay.hidden = false;
    proyectoNewName.focus();
  }

  function closeProyectoNew() {
    if (proyectoNewOverlay.hidden) return;
    proyectoNewOverlay.hidden = true;
  }

  proyectosAddBtn.addEventListener("click", openProyectoNew);
  proyectoNewCancel.addEventListener("click", closeProyectoNew);
  proyectoNewOverlay.addEventListener("click", (e) => {
    if (e.target === proyectoNewOverlay) closeProyectoNew();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !proyectoNewOverlay.hidden) closeProyectoNew();
  });

  proyectoNewForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = proyectoNewName.value.trim();
    if (!name) {
      proyectoNewName.focus();
      return;
    }
    addProyecto(name, proyectoNewUrl.value, proyectoNewCat.value);
    closeProyectoNew();
  });

  /* ---------- Ajustes de un proyecto ---------- */
  const proyectoDetailOverlay = document.getElementById(
    "proyecto-detail-overlay"
  );
  const proyectoDetailClose = document.getElementById("proyecto-detail-close");
  const proyectoDetailTitle = document.getElementById("proyecto-detail-title");
  const proyectoDetailUrl = document.getElementById("proyecto-detail-url");
  const proyectoDetailDelete = document.getElementById(
    "proyecto-detail-delete"
  );
  const proyectoDetailCat = document.getElementById("proyecto-detail-cat");
  const proyectoDetailDiagram = document.getElementById(
    "proyecto-detail-diagram"
  );
  fillCategorySelect(proyectoDetailCat);
  let proyectoDetailId = null;

  function getProyectoDetailItem() {
    return proyectoDetailId
      ? proyectos.find((p) => p.id === proyectoDetailId)
      : null;
  }

  function openProyectoDetail(id) {
    const item = proyectos.find((p) => p.id === id);
    if (!item) return;
    proyectoDetailId = id;
    proyectoDetailTitle.value = item.text;
    proyectoDetailUrl.value = item.url || "";
    proyectoDetailCat.value = item.category || "";
    proyectoDetailDiagram.checked = proyectoConDiagrama(item);
    proyectoDetailOverlay.hidden = false;
    document.body.classList.add("no-scroll");
    autoGrow(proyectoDetailTitle); // con el panel visible (si no, scrollHeight es 0)
  }

  function closeProyectoDetail() {
    if (proyectoDetailOverlay.hidden) return;
    proyectoDetailOverlay.hidden = true;
    proyectoDetailId = null;
    document.body.classList.remove("no-scroll");
  }

  proyectoDetailClose.addEventListener("click", closeProyectoDetail);
  proyectoDetailOverlay.addEventListener("click", (e) => {
    if (e.target === proyectoDetailOverlay) closeProyectoDetail();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !proyectoDetailOverlay.hidden)
      closeProyectoDetail();
  });

  // Título: en memoria mientras se escribe; se persiste al salir del campo.
  proyectoDetailTitle.addEventListener("input", () => {
    autoGrow(proyectoDetailTitle);
    const item = getProyectoDetailItem();
    const v = proyectoDetailTitle.value.trim();
    if (!item || !v) return;
    item.text = v;
    const el = proyectosListEl.querySelector(
      '.proyecto-item[data-id="' + item.id + '"] .proyecto-text'
    );
    if (el) el.textContent = v;
  });
  proyectoDetailTitle.addEventListener("blur", () => {
    const item = getProyectoDetailItem();
    if (!item) return;
    const v = proyectoDetailTitle.value.trim();
    if (v) {
      item.text = v;
      saveProyectos();
      renderProyectos();
      renderAllLists(); // el nombre sale en el byline de sus tareas
    } else {
      proyectoDetailTitle.value = item.text; // sin título no se guarda
    }
  });

  proyectoDetailUrl.addEventListener("blur", () => {
    const item = getProyectoDetailItem();
    if (!item) return;
    item.url = proyectoDetailUrl.value.trim();
    saveProyectos();
    renderProyectos();
  });

  proyectoDetailCat.addEventListener("change", () => {
    const item = getProyectoDetailItem();
    if (!item) return;
    item.category = proyectoDetailCat.value;
    saveProyectos();
    renderProyectos();
    renderAllLists(); // el color va en el byline de sus tareas
  });

  // Apagar el diagrama deja el proyecto como si nunca lo hubiera tenido: se
  // borran las flechas (y con ellas el estado "Bloqueada": esas tareas pasan a
  // "Sin empezar") y también la colocación de los post-it. Volver a encenderlo
  // es empezar de cero, con las tarjetas otra vez en rejilla.
  proyectoDetailDiagram.addEventListener("change", () => {
    const item = getProyectoDetailItem();
    if (!item) {
      proyectoDetailDiagram.checked = true;
      return;
    }
    if (proyectoDetailDiagram.checked) {
      delete item.diagram; // encendido es lo normal: no hace falta guardarlo
    } else {
      const n = proyectoLinks(item).length;
      const aviso = n
        ? "Al desactivar el diagrama se borran sus " +
          n +
          " flecha(s) y la colocación de las tarjetas. Las tareas bloqueadas" +
          " pasarán a Sin empezar. ¿Continuar?"
        : "Al desactivar el diagrama se borra la colocación de las tarjetas." +
          " ¿Continuar?";
      if (!confirm(aviso)) {
        proyectoDetailDiagram.checked = true; // se deja como estaba
        return;
      }
      item.diagram = false;
      delete item.links;
      delete item.graph; // las posiciones de los post-it
    }
    saveProyectos();
    clearProyectoSel();
    renderProyectos();
    renderAllLists(); // las que estaban bloqueadas vuelven a sus listas
  });

  proyectoDetailDelete.addEventListener("click", () => {
    const item = getProyectoDetailItem();
    if (!item) return;
    const id = item.id;
    closeProyectoDetail();
    deleteProyecto(id);
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

    let localRecados = [];
    if (db) localRecados = await idbGet(IDB_KEY_RECADOS);
    recados = Array.isArray(localRecados) ? localRecados : [];

    let localPendientes = [];
    if (db) localPendientes = await idbGet(IDB_KEY_PENDIENTES);
    pendientes = Array.isArray(localPendientes) ? localPendientes : [];

    let localSinTipo = [];
    if (db) localSinTipo = await idbGet(IDB_KEY_SIN_TIPO);
    sinTipo = Array.isArray(localSinTipo) ? localSinTipo : [];

    let localProyectos = [];
    if (db) localProyectos = await idbGet(IDB_KEY_PROYECTOS);
    proyectos = Array.isArray(localProyectos) ? localProyectos : [];

    let localProSecciones = [];
    if (db) localProSecciones = await idbGet(IDB_KEY_PRO_SECCIONES);
    proyectoSecciones = Array.isArray(localProSecciones) ? localProSecciones : [];

    let localFijadas = [];
    if (db) localFijadas = await idbGet(IDB_KEY_HOY_FIJADAS);
    hoyFijadas = normalizeFijadas(localFijadas);

    let rawHoy;
    if (db) rawHoy = await idbGet(IDB_KEY_HOY);
    const parsedHoy = parseHoy(rawHoy);
    hoy = parsedHoy.items;
    hoyDay = parsedHoy.day;
    hoySections = parsedHoy.sections;

    let localAgenda = [];
    if (db) localAgenda = await idbGet(IDB_KEY_AGENDA);
    agenda = Array.isArray(localAgenda) ? localAgenda : [];

    let localDayOrder;
    if (db) localDayOrder = await idbGet(IDB_KEY_DAY_ORDER);
    dayOrder = parseDayOrder(localDayOrder);

    // El registro de borrados va antes de los listeners de la nube: en cuanto
    // llegue la primera lista hay que poder limpiarla.
    let localDeleted = [];
    if (db) localDeleted = await idbGet(IDB_KEY_DELETED);
    deletedIds = Array.isArray(localDeleted) ? localDeleted : [];
    if (pruneDeleted()) saveDeleted();

    let localPlanned = [];
    if (db) localPlanned = await idbGet(IDB_KEY_PLANNED);
    planned = Array.isArray(localPlanned) ? localPlanned : [];
    if (backfillPlannedCategory() && db)
      idbSet(IDB_KEY_PLANNED, planned).catch(() => {});

    renderTasksViews(); // pinta Tareas + Rutinas con el respaldo local
    renderRecados();
    renderPendientes();
    renderProyectos();
    renderHoy();
    renderAgenda();
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
        const llegan = Array.isArray(raw)
          ? raw
          : raw
          ? Object.values(raw)
          : [];
        // La nube puede traer de vuelta algo que ya se borró en este
        // dispositivo (ver "Borrados definitivos"): se quita antes de nada.
        const remote = applyDeleted(llegan);
        const revividas = remote !== llegan;
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
        // Sube la migración y, si la nube traía borrados, la lista ya limpia
        if (migrated || revividas) save();
        clearError();
        renderTasksViews();
        // Agenda y "Durante el día" también pintan tareas (con fecha de hoy o
        // de rutinas con "Añadir a Hoy"): hay que repintarlas.
        renderAgenda();
        renderHoyView();
        renderProyectos(); // cambia el número de tareas por proyecto
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
        const llegan = Array.isArray(raw) ? raw : raw ? Object.values(raw) : [];
        const remote = applyDeleted(llegan); // ver "Borrados definitivos"
        const revividas = remote !== llegan;
        if (firstP && remote.length === 0 && planned.length > 0) {
          firstP = false;
          refP.set(planned).catch(() => {});
          return;
        }
        firstP = false;
        planned = remote;
        const migratedP = backfillPlannedCategory();
        if (db) idbSet(IDB_KEY_PLANNED, planned).catch(() => {});
        // Sube la migración y, si la nube traía borrados, la lista ya limpia
        if (migratedP || revividas) savePlanned();
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
        const llegan = Array.isArray(raw) ? raw : raw ? Object.values(raw) : [];
        const remote = applyDeleted(llegan); // ver "Borrados definitivos"
        if (firstR && remote.length === 0 && recados.length > 0) {
          firstR = false;
          refR.set(recados).catch(() => {});
          return;
        }
        firstR = false;
        recados = remote;
        if (db) idbSet(IDB_KEY_RECADOS, recados).catch(() => {});
        if (remote !== llegan) saveRecados(); // sube la lista ya sin lo borrado
        clearError();
        renderRecados();
        renderProyectos(); // cambia el número de tareas por proyecto
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
        const llegan = Array.isArray(raw) ? raw : raw ? Object.values(raw) : [];
        const remote = applyDeleted(llegan); // ver "Borrados definitivos"
        if (firstPen && remote.length === 0 && pendientes.length > 0) {
          firstPen = false;
          refPen.set(pendientes).catch(() => {});
          return;
        }
        firstPen = false;
        pendientes = remote;
        if (db) idbSet(IDB_KEY_PENDIENTES, pendientes).catch(() => {});
        if (remote !== llegan) savePendientes(); // ya sin lo borrado
        clearError();
        renderPendientes();
        renderProyectos(); // cambia el número de tareas por proyecto
      },
      (err) =>
        showError("Al leer la nube: " + (err && err.message ? err.message : err))
    );

    // Listener: tareas sin tipo (solo se ven dentro de su proyecto)
    let firstSt = true;
    const refSt = fdb.ref(FB_ROOT + "/" + FB_KEY_SIN_TIPO);
    refSt.on(
      "value",
      (snap) => {
        const raw = snap.val();
        const llegan = Array.isArray(raw) ? raw : raw ? Object.values(raw) : [];
        const remote = applyDeleted(llegan); // ver "Borrados definitivos"
        if (firstSt && remote.length === 0 && sinTipo.length > 0) {
          firstSt = false;
          refSt.set(sinTipo).catch(() => {});
          return;
        }
        firstSt = false;
        sinTipo = remote;
        if (db) idbSet(IDB_KEY_SIN_TIPO, sinTipo).catch(() => {});
        if (remote !== llegan) saveSinTipo(); // ya sin lo borrado
        clearError();
        renderProyectos(); // su única vista es la página del proyecto
      },
      (err) =>
        showError("Al leer la nube: " + (err && err.message ? err.message : err))
    );

    // Listener: proyectos (título + enlace)
    let firstPro = true;
    const refPro = fdb.ref(FB_ROOT + "/" + FB_KEY_PROYECTOS);
    refPro.on(
      "value",
      (snap) => {
        const raw = snap.val();
        const llegan = Array.isArray(raw) ? raw : raw ? Object.values(raw) : [];
        const remote = applyDeleted(llegan); // ver "Borrados definitivos"
        if (firstPro && remote.length === 0 && proyectos.length > 0) {
          firstPro = false;
          refPro.set(proyectos).catch(() => {});
          return;
        }
        firstPro = false;
        proyectos = remote;
        if (db) idbSet(IDB_KEY_PROYECTOS, proyectos).catch(() => {});
        if (remote !== llegan) saveProyectos(); // ya sin lo borrado
        clearError();
        renderProyectos();
        renderAllLists(); // sus nombres salen en el byline de las tareas
      },
      (err) =>
        showError("Al leer la nube: " + (err && err.message ? err.message : err))
    );

    // Listener: secciones del índice de Proyectos
    let firstProSec = true;
    const refProSec = fdb.ref(FB_ROOT + "/" + FB_KEY_PRO_SECCIONES);
    refProSec.on(
      "value",
      (snap) => {
        const raw = snap.val();
        const remote = Array.isArray(raw) ? raw : raw ? Object.values(raw) : [];
        if (firstProSec && remote.length === 0 && proyectoSecciones.length > 0) {
          firstProSec = false;
          refProSec.set(proyectoSecciones).catch(() => {});
          return;
        }
        firstProSec = false;
        proyectoSecciones = remote;
        if (db) idbSet(IDB_KEY_PRO_SECCIONES, proyectoSecciones).catch(() => {});
        clearError();
        renderProyectos();
        renderProyectoSeccionesModal();
      },
      (err) =>
        showError("Al leer la nube: " + (err && err.message ? err.message : err))
    );

    // Listener: agenda (tareas por día de la semana)
    let firstAg = true;
    const refAg = fdb.ref(FB_ROOT + "/" + FB_KEY_AGENDA);
    refAg.on(
      "value",
      (snap) => {
        const raw = snap.val();
        const llegan = Array.isArray(raw) ? raw : raw ? Object.values(raw) : [];
        const remote = applyDeleted(llegan); // ver "Borrados definitivos"
        if (firstAg && remote.length === 0 && agenda.length > 0) {
          firstAg = false;
          refAg.set(agenda).catch(() => {});
          return;
        }
        firstAg = false;
        agenda = remote;
        if (db) idbSet(IDB_KEY_AGENDA, agenda).catch(() => {});
        if (remote !== llegan) saveAgenda(); // sube la lista ya sin lo borrado
        clearError();
        renderAgenda();
        renderHoyView(); // "Durante el día" muestra estas tareas
      },
      (err) =>
        showError("Al leer la nube: " + (err && err.message ? err.message : err))
    );

    // Listener: orden manual de cada día (común a Agenda y "Durante el día")
    let firstDo = true;
    const refDo = fdb.ref(FB_ROOT + "/" + FB_KEY_DAY_ORDER);
    refDo.on(
      "value",
      (snap) => {
        const remote = parseDayOrder(snap.val());
        if (
          firstDo &&
          !Object.keys(remote).length &&
          Object.keys(dayOrder).length
        ) {
          firstDo = false;
          refDo.set(dayOrder).catch(() => {});
          return;
        }
        firstDo = false;
        dayOrder = remote;
        if (db) idbSet(IDB_KEY_DAY_ORDER, dayOrder).catch(() => {});
        clearError();
        renderAgenda();
        renderHoyView();
      },
      (err) =>
        showError("Al leer la nube: " + (err && err.message ? err.message : err))
    );

    // Listener: tareas de otras apps fijadas a "Durante el día"
    let firstFij = true;
    const refFij = fdb.ref(FB_ROOT + "/" + FB_KEY_HOY_FIJADAS);
    refFij.on(
      "value",
      (snap) => {
        const raw = snap.val();
        const remote = Array.isArray(raw) ? raw : raw ? Object.values(raw) : [];
        if (firstFij && remote.length === 0 && hoyFijadas.length > 0) {
          firstFij = false;
          refFij.set(hoyFijadas).catch(() => {});
          return;
        }
        firstFij = false;
        hoyFijadas = normalizeFijadas(remote); // texto o {k,d}
        // Si la normalización tiró claves del formato viejo, sube la lista ya
        // limpia: si no, cada carga volvería a recibirlas y a filtrarlas.
        if (hoyFijadas.length !== remote.length) saveHoyFijadas();
        if (db) idbSet(IDB_KEY_HOY_FIJADAS, hoyFijadas).catch(() => {});
        clearError();
        renderHoyView(); // lo único que depende del fijado
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
        hoy = applyDeleted(parsed.items); // ver "Borrados definitivos"
        const revividasHoy = hoy !== parsed.items;
        hoyDay = parsed.day;
        hoySections = parsed.sections;
        if (db) idbSet(IDB_KEY_HOY, snap.val()).catch(() => {});
        clearError();
        hoyReady = true;
        if (revividasHoy) saveHoy(); // sube el nodo ya sin lo borrado
        // Una sola vez por carga y ya con los datos de la nube delante, para
        // no escribir sobre un estado a medio sincronizar.
        if (!doneLogsLimpios) {
          doneLogsLimpios = true;
          if (limpiarDoneLogs()) saveHoy();
        }
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
          renderRutinas(); // "durante el día" de lactancia vive en Cuanto antes
          renderHoyView(); // las de la extracción, en su sección de Hoy
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
        reconcileFijadasDone(); // pone al día el "completada" de las fijadas
        renderRutinas();
        // También Hoy: sus tareas fijadas se pintan en "Durante el día", y
        // hasta que llega este snapshot `atareasPending()` está vacío.
        renderHoyView();
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
  applyHash();
})();
