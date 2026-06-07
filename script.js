const mappingBody   = document.querySelector("#mappingBody");
const recordsBody   = document.querySelector("#recordsBody");
const automationLog = document.querySelector("#automationLog");
const form          = document.querySelector("#orderForm");

// ── Utilities ─────────────────────────────────────────────────────────────────

function money(value) {
  return Number(value || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function addLog(text) {
  const item = document.createElement("li");
  item.textContent = text;
  automationLog.prepend(item);
}

function setFormValues(values) {
  Object.entries(values).forEach(([name, value]) => {
    const field = form.elements[name];
    if (field) field.value = value;
  });
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

// ── Phase 2: load Soriana order for manual fill ───────────────────────────────

document.querySelector("#loadSample").addEventListener("click", async () => {
  const po = "OC-SOR-2024-001";
  addLog(`Fase 2 — Cargando ${po} del Portal Soriana...`);
  try {
    const res = await fetch(`/api/soriana-order/${po}`);
    const data = await res.json();
    setFormValues({
      cliente:          data.CustomerName,
      folio_orden:      data.PurchaseOrder,
      nombre_articulo:  data.SKUDescription,
      precio_venta:     data.UnitPrice,
      cant_solicitada:  data.RequestedQty,
      fecha_entrega:    data.DeliveryDate,
      detalle_producto: data.OrderDetail,
    });
    addLog(`✓ Datos de ${po} cargados — revisa, ajusta si quieres, y presiona "Procesar orden".`);
  } catch (e) {
    addLog(`❌ Error al cargar la orden: ${e.message}`);
  }
});

// ── Phase 2: submit = agent observes and learns mapping ───────────────────────

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const arcaData = Object.fromEntries(new FormData(form).entries());
  const po = String(arcaData.folio_orden || "").toUpperCase();

  // Save order locally
  const records = getRecords();
  records.unshift({ ...arcaData, savedAt: new Date().toISOString() });
  saveRecords(records);
  renderRecords();
  addLog(`Orden ${arcaData.folio_orden || "sin folio"} procesada manualmente.`);

  // Agent learns the mapping by comparing Soriana source data vs what user typed
  if (po.startsWith("OC-SOR")) {
    addLog(`Agente observó el llenado — consultando Portal Soriana para aprender mapeo...`);
    try {
      const sorianaRes = await fetch(`/api/soriana-order/${po}`);
      if (sorianaRes.ok) {
        const sorianaData = await sorianaRes.json();
        const learnRes = await fetch("/api/learn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sorianaData, arcaData }),
        });
        const learned = await learnRes.json();
        if (learned.mappings?.length) {
          renderMappings(learned.mappings.map((m) => [
            m.source, m.dest, `${Math.round(m.confidence * 100)}%`
          ]));
          addLog(`✅ Agente aprendió ${learned.mappings.length} mapeos por observación. Listo para automatizar.`);
        }
      }
    } catch (e) {
      addLog(`Mapeo guardado localmente.`);
    }
  }

  // Save to backend
  try {
    await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(arcaData),
    });
  } catch (_) { /* offline fallback already done */ }

  form.reset();
});

// ── Phase 3: automate any NEW order using learned mapping ─────────────────────

async function autoFillWithAnimation(values, mappings) {
  const entries = Object.entries(values);
  for (const [name, value] of entries) {
    await new Promise((r) => setTimeout(r, 400));
    const field = form.elements[name];
    if (!field) continue;
    field.style.transition = "background 0.3s";
    field.style.background = "#fffbe6";
    field.value = value;
    await new Promise((r) => setTimeout(r, 200));
    field.style.background = "#e6ffe6";
    const m = mappings?.find((x) => x.dest === name);
    addLog(`✓ ${m?.source ?? name} → ${name}: "${value}"`);
    await new Promise((r) => setTimeout(r, 200));
    field.style.background = "";
  }

  await new Promise((r) => setTimeout(r, 500));
  const record = Object.fromEntries(new FormData(form).entries());
  const records = getRecords();
  records.unshift({ ...record, savedAt: new Date().toISOString() });
  saveRecords(records);
  renderRecords();

  try {
    await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
  } catch (_) { /* offline fallback */ }

  addLog(`✅ Orden ${record.folio_orden} procesada automáticamente por el agente.`);
  form.reset();
}

document.querySelector("#autoProcess").addEventListener("click", async () => {
  const poInput = document.querySelector("#autoPoInput");
  const po = poInput ? poInput.value.trim().toUpperCase() : "";
  if (!po) {
    alert("Ingresa el número de orden a automatizar (ej. OC-SOR-2024-003)");
    return;
  }

  const btn = document.querySelector("#autoProcess");
  btn.disabled = true;
  btn.textContent = "Agente procesando...";
  addLog(`Fase 3 — Agente leyendo ${po} del Portal Soriana...`);

  try {
    const res = await fetch(`/api/automate/${po}`);
    const data = await res.json();

    if (!res.ok) {
      addLog(`❌ ${data.error}`);
      btn.disabled = false;
      btn.textContent = "🤖 Automatizar con IA";
      return;
    }

    renderMappings(data.mappings.map((m) => [
      m.source, m.dest, `${Math.round(m.confidence * 100)}%`
    ]));
    addLog(`Aplicando ${data.mappings.length} mapeos aprendidos al Sistema Arca Continental...`);
    await autoFillWithAnimation(data.values, data.mappings);
  } catch (e) {
    addLog(`❌ Error: ${e.message}`);
  }

  btn.disabled = false;
  btn.textContent = "🤖 Automatizar con IA";
});

// ── Other buttons ─────────────────────────────────────────────────────────────

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
    const mappings = await res.json();
    if (mappings.length) {
      renderMappings(mappings.map((m) => [
        m.sourceField?.name ?? "?",
        m.destinationField?.name ?? "?",
        `${Math.round((m.confidence ?? 0.9) * 100)}%`,
      ]));
      addLog(`Mostrando ${mappings.length} mapeos aprendidos del servidor.`);
    } else {
      addLog("Aún no hay mapeos aprendidos. Realiza la Fase 2 primero.");
    }
  } catch (e) {
    addLog("Error al cargar mapeos del servidor.");
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────

renderRecords();
addLog("Sistema Arca Continental listo. Fase 2: carga una orden y procésala manualmente.");