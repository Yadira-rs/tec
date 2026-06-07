const mappingBody   = document.querySelector("#mappingBody");
const recordsBody   = document.querySelector("#recordsBody");
const automationLog = document.querySelector("#automationLog");
const form          = document.querySelector("#orderForm");

// ── Status strip ──────────────────────────────────────────────────────────────
// Phases: 0=idle, 1=soriana loaded, 2=agent learning, 3=agent done, 4=order saved

const statusClient   = document.querySelector('[data-status="client"]');
const statusAgent    = document.querySelector('[data-status="agent"]');
const statusInternal = document.querySelector('[data-status="internal"]');

function setStatus(phase) {
  [statusClient, statusAgent, statusInternal].forEach((el) => {
    el.className = "";
  });
  if (phase === 1) {
    statusClient.classList.add("st-client");
  } else if (phase === 2) {
    statusClient.classList.add("st-done");
    statusAgent.classList.add("st-working");
  } else if (phase === 3) {
    statusClient.classList.add("st-done");
    statusAgent.classList.add("st-done");
  } else if (phase === 4) {
    statusClient.classList.add("st-done");
    statusAgent.classList.add("st-done");
    statusInternal.classList.add("st-done");
  }
}

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
    if (field) field.value = value ?? "";
  });
}

function getRecords() {
  return JSON.parse(localStorage.getItem("aosOrders") || "[]");
}

function saveRecords(records) {
  localStorage.setItem("aosOrders", JSON.stringify(records));
}

function isDuplicate(folio) {
  return getRecords().some((r) => r.folio_orden === folio);
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
  if (!rows || !rows.length) return;
  mappingBody.innerHTML = rows.map(([src, dst, conf]) =>
    `<tr><td>${src}</td><td>${dst}</td><td style="color:#1a7a1a;font-weight:700;">${conf}</td></tr>`
  ).join("");
}

// ── Phase 1: load Soriana order for manual fill ───────────────────────────────

document.querySelector("#loadSample").addEventListener("click", async () => {
  const po = "OC-SOR-2024-001";
  addLog(`Fase 1 — Conectando con Portal Soriana para ${po}...`);
  setStatus(2);
  try {
    const res = await fetch(`/api/soriana-order/${po}`);
    if (!res.ok) {
      addLog(`❌ Portal Soriana no disponible para ${po}. No se puede procesar.`);
      setStatus(0);
      return;
    }
    const data = await res.json();
    form.reset();
    setFormValues({
      cliente:          data.CustomerName,
      folio_orden:      data.PurchaseOrder,
      nombre_articulo:  data.SKUDescription,
      precio_venta:     data.UnitPrice,
      cant_solicitada:  data.RequestedQty,
      fecha_entrega:    data.DeliveryDate,
      detalle_producto: data.OrderDetail,
    });
    setStatus(1);
    addLog(`✓ ${po} cargada desde Soriana — revisa los datos y presiona "Procesar orden".`);
  } catch (e) {
    addLog(`❌ Error al conectar con Portal Soriana: ${e.message}`);
    setStatus(0);
  }
});

// ── Phase 2: submit = save order + agent observes and learns ──────────────────

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const arcaData = Object.fromEntries(new FormData(form).entries());
  const po = String(arcaData.folio_orden || "").toUpperCase();

  // Guard: no empty folio
  if (!po) {
    addLog("⚠ Ingresa el folio de orden antes de procesar.");
    return;
  }

  // Guard: no duplicates
  if (isDuplicate(po)) {
    addLog(`⚠ La orden ${po} ya fue procesada. No se duplicará.`);
    return;
  }

  setStatus(2);
  addLog(`Agente observando llenado de ${po}...`);

  // Agent learns by comparing Soriana source vs what user typed
  if (po.startsWith("OC-SOR")) {
    try {
      const sorianaRes = await fetch(`/api/soriana-order/${po}`);
      if (!sorianaRes.ok) {
        addLog(`⚠ Portal Soriana no tiene la orden ${po}. Guardando sin aprender mapeo.`);
      } else {
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
          addLog(`✅ Agente aprendió ${learned.mappings.length} mapeos. Listo para automatizar nuevas órdenes.`);
        }
      }
    } catch (_) { /* server offline — skip learning */ }
  }

  // Save order locally
  const records = getRecords();
  records.unshift({ ...arcaData, savedAt: new Date().toISOString() });
  saveRecords(records);
  renderRecords();

  // Save to backend
  try {
    await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(arcaData),
    });
  } catch (_) { /* offline fallback done */ }

  setStatus(4);
  addLog(`✅ Orden ${po} registrada en Sistema Arca Continental.`);
  form.reset();
});

// ── Phase 3: automate NEW order using learned mapping ─────────────────────────

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

  if (!record.folio_orden) {
    addLog("❌ El agente no pudo obtener el folio de orden. Verifica el mapeo.");
    return;
  }

  if (isDuplicate(record.folio_orden)) {
    addLog(`⚠ La orden ${record.folio_orden} ya existe en el sistema. No se duplicará.`);
    form.reset();
    return;
  }

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

  setStatus(4);
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

  // Guard: no duplicates before even starting
  if (isDuplicate(po)) {
    addLog(`⚠ La orden ${po} ya fue procesada anteriormente. No se duplicará.`);
    return;
  }

  const btn = document.querySelector("#autoProcess");
  btn.disabled = true;
  btn.textContent = "Agente procesando...";
  setStatus(2);
  addLog(`Fase 3 — Verificando disponibilidad de ${po} en Portal Soriana...`);

  try {
    // Step 1: verify Soriana has this order
    const checkRes = await fetch(`/api/soriana-order/${po}`);
    if (!checkRes.ok) {
      addLog(`❌ El Portal Soriana no tiene la orden ${po}. No se puede automatizar.`);
      setStatus(0);
      btn.disabled = false;
      btn.textContent = "🤖 Automatizar con IA";
      return;
    }

    // Step 2: automate using learned mapping
    const res = await fetch(`/api/automate/${po}`);
    const data = await res.json();

    if (!res.ok) {
      addLog(`❌ ${data.error}`);
      setStatus(0);
      btn.disabled = false;
      btn.textContent = "🤖 Automatizar con IA";
      return;
    }

    // Show learned mappings with confidence %
    if (data.mappings?.length) {
      renderMappings(data.mappings.map((m) => [
        m.source, m.dest, `${Math.round(m.confidence * 100)}%`
      ]));
    }

    addLog(`Aplicando ${data.mappings?.length ?? 0} mapeos aprendidos...`);
    setStatus(3);
    await autoFillWithAnimation(data.values, data.mappings);
  } catch (e) {
    addLog(`❌ Error: ${e.message}`);
    setStatus(0);
  }

  btn.disabled = false;
  btn.textContent = "🤖 Automatizar con IA";
});

// ── Other buttons ─────────────────────────────────────────────────────────────

document.querySelector("#clearForm").addEventListener("click", () => {
  form.reset();
  setStatus(0);
  addLog("Formulario limpiado.");
});

document.querySelector("#clearRecords").addEventListener("click", () => {
  saveRecords([]);
  renderRecords();
  setStatus(0);
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
      setStatus(3);
      addLog(`Mostrando ${mappings.length} mapeos aprendidos del servidor.`);
    } else {
      addLog("Aún no hay mapeos aprendidos. Realiza la Fase 2 primero.");
    }
  } catch (_) {
    addLog("Error al cargar mapeos del servidor.");
  }
});

// ── Init: start clean ─────────────────────────────────────────────────────────

form.reset();
setStatus(0);
renderRecords();
addLog("Sistema Arca Continental listo. Empieza con Fase 2: presiona 'Cargar orden'.");