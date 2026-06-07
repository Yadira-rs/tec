const mappingBody   = document.querySelector("#mappingBody");
const recordsBody   = document.querySelector("#recordsBody");
const automationLog = document.querySelector("#automationLog");
const form          = document.querySelector("#orderForm");
const autoPoInput   = document.querySelector("#autoPoInput");

// ── Utilities ──────────────────────────────────────────────────────────────────

function money(value) {
  return Number(value || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function addLog(text) {
  const item = document.createElement("li");
  item.textContent = text;
  automationLog.prepend(item);
}

function getRecords() {
  return JSON.parse(localStorage.getItem("aosOrders") || "[]");
}

function saveRecords(records) {
  localStorage.setItem("aosOrders", JSON.stringify(records));
}

function renderRecords() {
  const records = getRecords();
  if (!records.length) {
    recordsBody.innerHTML = `<tr><td class="empty-row" colspan="7">Aun no hay ordenes procesadas.</td></tr>`;
    return;
  }
  recordsBody.innerHTML = records.map((r) => {
    const total = Number(r.cant_solicitada || 0) * Number(r.precio_venta || 0);
    return `<tr>
      <td>${r.folio_orden || "-"}</td>
      <td>${r.cliente || "-"}</td>
      <td>${r.nombre_articulo || "-"}</td>
      <td>${r.cant_solicitada || "-"}</td>
      <td>${r.fecha_entrega || "-"}</td>
      <td>${money(total)}</td>
      <td><span class="state-pill">Procesada</span></td>
    </tr>`;
  }).join("");
}

function renderMappings(rows) {
  mappingBody.innerHTML = rows.map(([src, dst, conf]) =>
    `<tr><td>${src}</td><td>${dst}</td><td style="color:#1a7a1a;font-weight:700;">${conf}</td></tr>`
  ).join("");
}

// ── Soriana HTML reader (client-side, DOMParser — sin CORS) ───────────────────
// El portal Soriana está en el mismo servidor en /soriana/soriana.html.
// Se usa DOMParser para leer los elementos [data-field] igual que lo haría
// document.querySelector('[data-field="CustomerName"]') en el propio portal.

async function readSorianaOrder(po) {
  const res = await fetch("/soriana/soriana.html");
  if (!res.ok) throw new Error(`No se pudo obtener el portal Soriana (HTTP ${res.status})`);
  const html = await res.text();

  const doc = new DOMParser().parseFromString(html, "text/html");

  // Buscar la tarjeta que tenga el PO correcto en su [data-field="PurchaseOrder"]
  let matchCard = null;
  for (const card of doc.querySelectorAll(".order-card")) {
    const poEl = card.querySelector('[data-field="PurchaseOrder"]');
    if (poEl && poEl.textContent.trim() === po) {
      matchCard = card;
      break;
    }
  }
  if (!matchCard) return null;

  // Leer todos los [data-field] de esa tarjeta
  const data = {};
  for (const el of matchCard.querySelectorAll("[data-field]")) {
    data[el.getAttribute("data-field")] = el.textContent.trim();
  }
  return data;   // { CustomerName, PurchaseOrder, DeliveryDate, SKUDescription, UnitPrice, RequestedQty, OrderDetail }
}

// Limpia los valores tal como aparecen en el HTML del portal:
//   "$14.50 MXN" → "14.50"   |   "200 piezas" → "200"   |   "15/06/2026" → "2026-06-15"
function cleanSorianaValue(sorianaField, raw) {
  switch (sorianaField) {
    case "UnitPrice":
      return raw.replace(/\$|MXN/gi, "").trim();
    case "RequestedQty":
      return raw.replace(/[^\d.]/g, "").trim();
    case "DeliveryDate": {
      const parts = raw.split("/");
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      }
      return raw;
    }
    default:
      return raw;
  }
}

// ── Phase 1: "Cargar orden" abre el portal para llenado manual ────────────────
// ARIA aún no conoce los campos — debe observar al usuario primero.

document.querySelector("#loadSample").addEventListener("click", () => {
  const po = autoPoInput.value.trim().toUpperCase() || "OC-SOR-2024-001";
  autoPoInput.value = po;
  form.elements["folio_orden"].value = po;   // solo el folio, nada más
  window.open("/soriana/soriana.html", "soriana-portal", "width=1050,height=720,left=80,top=80");
  addLog(`Fase 1 — Portal Soriana abierto para ${po}. Lee los datos y escríbelos manualmente en el formulario. Cuando termines, presiona "Procesar orden".`);
});

// ── Phase 1: "Procesar orden" → validar → guardar → ARIA aprende el mapeo ────

const REQUIRED_FIELDS = ["cliente", "folio_orden", "nombre_articulo", "precio_venta", "cant_solicitada", "fecha_entrega"];
const FIELD_LABELS = {
  cliente: "Cliente", folio_orden: "Folio de orden", nombre_articulo: "Producto",
  precio_venta: "Precio unitario", cant_solicitada: "Cantidad solicitada", fecha_entrega: "Fecha de entrega",
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const missing = REQUIRED_FIELDS.filter(name => !String(form.elements[name]?.value ?? "").trim());
  if (missing.length) {
    addLog(`❌ Faltan campos obligatorios: ${missing.map(n => FIELD_LABELS[n] ?? n).join(", ")}`);
    return;
  }

  const arcaData = Object.fromEntries(new FormData(form).entries());
  const po = String(arcaData.folio_orden).toUpperCase();

  // Guardar localmente
  const records = getRecords();
  records.unshift({ ...arcaData, savedAt: new Date().toISOString() });
  saveRecords(records);
  renderRecords();
  addLog(`Orden ${po} procesada manualmente.`);

  // Guardar en backend (sin bloquear si falla)
  fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arcaData),
  }).catch(() => {});

  // ARIA aprende el mapeo comparando datos Soriana vs lo que el usuario escribió
  if (po.startsWith("OC-SOR")) {
    addLog("Agente observando — comparando con datos del Portal Soriana para aprender mapeo...");
    try {
      const sorianaRes = await fetch(`/api/soriana-order/${po}`);
      if (!sorianaRes.ok) throw new Error(`HTTP ${sorianaRes.status}`);
      const sorianaData = await sorianaRes.json();

      const learnRes = await fetch("/api/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sorianaData, arcaData }),
      });
      if (!learnRes.ok) throw new Error(`HTTP ${learnRes.status}`);
      const learned = await learnRes.json();

      if (learned.mappings?.length) {
        renderMappings(learned.mappings.map((m) => [m.source, m.dest, `${Math.round(m.confidence * 100)}%`]));
        addLog(`✅ ARIA aprendió ${learned.mappings.length} mapeos. Ya puedes usar "Automatizar con IA" para órdenes nuevas.`);
      }
    } catch (e) {
      const msg = e.message === "Failed to fetch"
        ? "No se pudo conectar al servidor (¿está corriendo 'npm run dev'?)"
        : e.message;
      addLog(`⚠️ No se pudo guardar el mapeo en el servidor: ${msg}. Intenta procesar la orden de nuevo.`);
    }
  }

  form.reset();
});

// ── Phase 2: "Automatizar con IA" — ARIA lee el HTML de Soriana y llena sola ──
// Usa DOMParser (sin fetch cross-origin, sin CORS) sobre /soriana/soriana.html.

async function autoFillWithAnimation(values, mappings) {
  for (const [name, value] of Object.entries(values)) {
    await new Promise((r) => setTimeout(r, 380));
    const field = form.elements[name];
    if (!field) continue;

    field.style.transition = "background 0.3s";
    field.style.background = "#fffbe6";
    field.value = value;
    await new Promise((r) => setTimeout(r, 180));
    field.style.background = "#e6ffe6";

    const m = mappings.find((x) => x.dest === name);
    addLog(`  ✓ ${m?.source ?? name} → ${name}: "${value}"`);
    await new Promise((r) => setTimeout(r, 180));
    field.style.background = "";
  }

  await new Promise((r) => setTimeout(r, 500));
  const record = Object.fromEntries(new FormData(form).entries());
  const records = getRecords();
  records.unshift({ ...record, savedAt: new Date().toISOString() });
  saveRecords(records);
  renderRecords();

  fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  }).catch(() => {});

  addLog(`✅ Orden ${record.folio_orden} procesada automáticamente por ARIA.`);
  form.reset();
}

document.querySelector("#autoProcess").addEventListener("click", async () => {
  const po = autoPoInput.value.trim().toUpperCase();
  if (!po) {
    addLog("❌ Escribe el número de orden antes de automatizar (ej. OC-SOR-2024-002)");
    autoPoInput.focus();
    return;
  }

  const btn = document.querySelector("#autoProcess");
  btn.disabled = true;
  btn.textContent = "Agente procesando...";

  try {
    // Paso 1: recuperar mapeo aprendido del servidor
    addLog(`Fase 2 — Cargando mapeo aprendido...`);
    const mappingRes = await fetch("/api/mappings");
    if (!mappingRes.ok) throw new Error(`No se pudo cargar el mapeo (HTTP ${mappingRes.status})`);
    const storedMappings = await mappingRes.json();

    if (!storedMappings.length) {
      addLog("❌ ARIA aún no tiene mapeo aprendido. Completa primero la Fase 1: abre el portal Soriana, llena el formulario manualmente y presiona 'Procesar orden'.");
      return;
    }

    // Paso 2: leer el HTML del portal Soriana con DOMParser (mismo origen, sin CORS)
    addLog(`Leyendo Portal Soriana — buscando orden ${po}...`);
    const sorianaData = await readSorianaOrder(po);

    if (!sorianaData) {
      addLog(`❌ Orden ${po} no encontrada en el Portal Soriana. Verifica el número (ej. OC-SOR-2024-002).`);
      return;
    }
    addLog(`✓ Portal Soriana leído — campos encontrados: ${Object.keys(sorianaData).join(", ")}`);

    // Paso 3: aplicar el mapeo aprendido para obtener los valores del formulario Arca
    const values = {};
    const flatMappings = [];

    for (const m of storedMappings) {
      const sorianaKey = m.sourceField?.name ?? (m.sourceField?.id ?? "").replace("source-", "");
      const arcaKey    = m.destinationField?.name ?? (m.destinationField?.id ?? "").replace("dest-", "");
      const raw = sorianaData[sorianaKey];
      if (raw !== undefined && arcaKey) {
        values[arcaKey] = cleanSorianaValue(sorianaKey, raw);
        flatMappings.push({ source: sorianaKey, dest: arcaKey });
      }
    }

    if (!Object.keys(values).length) {
      addLog("❌ El mapeo no produjo ningún valor. ¿Los campos del portal coinciden con los de la Fase 1?");
      return;
    }

    // Paso 4: mostrar mapeo en la tabla y animar el llenado del formulario
    renderMappings(storedMappings.map((m) => [
      m.sourceField?.name ?? "?",
      m.destinationField?.name ?? "?",
      `${Math.round((m.confidence ?? 0.9) * 100)}%`,
    ]));
    addLog(`Aplicando ${flatMappings.length} mapeos al Sistema Arca Continental...`);
    await autoFillWithAnimation(values, flatMappings);

  } catch (e) {
    const msg = e.message === "Failed to fetch"
      ? "No se pudo conectar al servidor. ¿Está corriendo 'npm run dev'?"
      : e.message;
    addLog(`❌ Error: ${msg}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "🤖 Automatizar con IA";
  }
});

// ── Otros botones ─────────────────────────────────────────────────────────────

document.querySelector("#clearForm").addEventListener("click", () => {
  form.reset();
  addLog("Formulario limpiado.");
});

document.querySelector("#clearRecords").addEventListener("click", () => {
  saveRecords([]);
  renderRecords();
  addLog("Historial de órdenes limpiado.");
});

document.querySelector("#simulateLearning").addEventListener("click", async () => {
  try {
    const res = await fetch("/api/mappings");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const mappings = await res.json();
    if (mappings.length) {
      renderMappings(mappings.map((m) => [
        m.sourceField?.name ?? "?",
        m.destinationField?.name ?? "?",
        `${Math.round((m.confidence ?? 0.9) * 100)}%`,
      ]));
      addLog(`Mostrando ${mappings.length} mapeos guardados.`);
    } else {
      addLog("Aún no hay mapeos. Completa la Fase 1 primero.");
    }
  } catch (e) {
    addLog(`❌ Error al cargar mapeos: ${e.message === "Failed to fetch" ? "servidor no disponible" : e.message}`);
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────

renderRecords();
addLog("Sistema listo. FASE 1: presiona 'Cargar orden' → el Portal Soriana se abre → copia los datos manualmente → 'Procesar orden'. Luego FASE 2: escribe otro folio → 'Automatizar con IA'.");
