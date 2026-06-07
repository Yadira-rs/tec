/* ═══════════════════════════════════════════════════════
   Always on Shelf — script.js
   Máquina de estados de 3 fases + UX mejorada
   ═══════════════════════════════════════════════════════ */

// ── Soriana orders data (mirrored from server for immediate UX) ───────────────
const SORIANA_ORDERS = {
  "OC-SOR-2024-001": { CustomerName:"Soriana Cumbres",     PurchaseOrder:"OC-SOR-2024-001", DeliveryDate:"2026-06-15", SKUDescription:"Coca-Cola 600ml",    UnitPrice:"14.50", RequestedQty:"200", OrderDetail:"Entrega en CEDIS Monterrey Norte" },
  "OC-SOR-2024-002": { CustomerName:"Soriana Satélite",    PurchaseOrder:"OC-SOR-2024-002", DeliveryDate:"2026-06-20", SKUDescription:"Coca-Cola 355ml",    UnitPrice:"11.00", RequestedQty:"150", OrderDetail:"Entrega en CEDIS Sur"            },
  "OC-SOR-2024-003": { CustomerName:"Soriana Vallejo",     PurchaseOrder:"OC-SOR-2024-003", DeliveryDate:"2026-06-25", SKUDescription:"Coca-Cola 2L",        UnitPrice:"28.00", RequestedQty:"100", OrderDetail:"Entrega en CEDIS Vallejo CDMX"   },
  "OC-SOR-2024-004": { CustomerName:"Soriana Tlalnepantla",PurchaseOrder:"OC-SOR-2024-004", DeliveryDate:"2026-06-28", SKUDescription:"Fanta Naranja 600ml", UnitPrice:"12.50", RequestedQty:"300", OrderDetail:"Entrega en CEDIS Tlalnepantla"   },
  "OC-SOR-2024-005": { CustomerName:"Soriana Monterrey Centro",PurchaseOrder:"OC-SOR-2024-005",DeliveryDate:"2026-07-02",SKUDescription:"Sprite 600ml",     UnitPrice:"13.00", RequestedQty:"250", OrderDetail:"Entrega en CEDIS Monterrey Centro"}
};

// ── State ─────────────────────────────────────────────────────────────────────
let currentPhase   = 1;         // 1 | 2 | 3
let selectedPO     = "OC-SOR-2024-001";
let isMappingReady = false;
let logEventCount  = 0;
let processingAuto = false;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const form            = document.getElementById("orderForm");
const mappingBody     = document.getElementById("mappingBody");
const mappingTable    = document.getElementById("mappingTable");
const mappingEmpty    = document.getElementById("mappingEmpty");
const automationLog   = document.getElementById("automationLog");
const logCount        = document.getElementById("logCount");
const aiStatusBadge   = document.getElementById("aiStatusBadge");
const aiStatusText    = document.getElementById("aiStatusText");
const aiWatching      = document.getElementById("aiWatching");
const recordsBody     = document.getElementById("recordsBody");
const recordsCount    = document.getElementById("recordsCount");
const sourceIndicator = document.getElementById("sourceIndicator");
const sourceStatus    = document.getElementById("sourceStatus");
const sourceSummary   = document.getElementById("sourceSummary");
const iframePlaceholder = document.getElementById("iframePlaceholder");
const sorianaFrame    = document.getElementById("sorianaFrame");
const phaseBanner     = document.getElementById("phaseBanner");
const bannerTitle     = document.getElementById("bannerTitle");
const bannerDesc      = document.getElementById("bannerDesc");
const bannerIcon      = document.getElementById("bannerIcon");
const bannerActionBtn = document.getElementById("bannerActionBtn");
const phase2Panel     = document.getElementById("phase2Panel");
const phase3Panel     = document.getElementById("phase3Panel");
const autoOrderList   = document.getElementById("autoOrderList");
const formInstruction = document.getElementById("formInstruction");
const instructionText = document.getElementById("instructionText");
const autoProgress    = document.getElementById("autoProgress");
const autoProgressFill= document.getElementById("autoProgressFill");
const autoProgressLabel=document.getElementById("autoProgressLabel");

// ── Utilities ─────────────────────────────────────────────────────────────────
function money(v) {
  return Number(v || 0).toLocaleString("es-MX", { style:"currency", currency:"MXN" });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getRecords() { return JSON.parse(localStorage.getItem("aosOrders") || "[]"); }
function saveRecords(r) { localStorage.setItem("aosOrders", JSON.stringify(r)); }
function isDuplicate(folio) { return getRecords().some(r => r.folio_orden === folio); }

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type = "info", duration = 4000) {
  const container = document.getElementById("toastContainer");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  const icons = { success:"✅", error:"❌", info:"💬", warning:"⚠️" };
  el.innerHTML = `<span>${icons[type] || ""}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add("dismissing");
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ── Activity Log ──────────────────────────────────────────────────────────────
function addLog(text, type = "info") {
  logEventCount++;
  const icons = { success:"✅", error:"❌", working:"⚙️", info:"🔵" };
  const item = document.createElement("li");
  item.className = `log-item ${type}`;
  item.innerHTML = `<span class="log-icon">${icons[type] || "·"}</span><span>${text}</span>`;
  automationLog.prepend(item);
  logCount.textContent = `${logEventCount} eventos`;
}

// ── Phase stepper UI ──────────────────────────────────────────────────────────
function setPhaseUI(phase) {
  currentPhase = phase;
  const steps = [1, 2, 3];
  steps.forEach(n => {
    const el = document.getElementById(`step${n}`);
    el.classList.remove("active", "done");
    if (n < phase) el.classList.add("done");
    else if (n === phase) el.classList.add("active");
  });
  [1, 2].forEach(n => {
    const conn = document.getElementById(`conn${n}`);
    conn.classList.toggle("done", n < phase);
  });

  // Banner config per phase
  const bannerConfig = {
    1: {
      cls: "",
      icon: "🔗",
      title: "Fase 1 — Conexión",
      desc: "Selecciona una orden de Soriana para conectar los dos sistemas.",
      btn: "Conectar sistema origen →"
    },
    2: {
      cls: "phase2",
      icon: "👁",
      title: "Fase 2 — Observación",
      desc: "Llena el formulario manualmente UNA vez. La IA observa y aprende el mapeo de campos.",
      btn: "IA lista para observar"
    },
    3: {
      cls: "phase3",
      icon: "🤖",
      title: "Fase 3 — Automatización activa",
      desc: "El agente conoce el mapeo. Selecciona cualquier orden nueva y se procesará sola.",
      btn: "Ver órdenes disponibles →"
    }
  };

  const cfg = bannerConfig[phase];
  phaseBanner.className = `phase-banner ${cfg.cls}`;
  bannerIcon.textContent = cfg.icon;
  bannerTitle.textContent = cfg.title;
  bannerDesc.textContent  = cfg.desc;
  bannerActionBtn.textContent = cfg.btn;
  bannerActionBtn.disabled = (phase === 2);
}

function handlePhaseAction() {
  if (currentPhase === 1) connectSource();
  else if (currentPhase === 3) {
    showPhase3();
    document.getElementById("phase3Panel").scrollIntoView({ behavior:"smooth" });
  }
}

// ── AI Status badge ───────────────────────────────────────────────────────────
function setAIStatus(state, text) {
  aiStatusBadge.className = `ai-status-badge ${state}`;
  aiStatusText.textContent = text;
}

// ── Source indicator ──────────────────────────────────────────────────────────
function setSourceConnected(connected) {
  const dot = sourceIndicator.querySelector(".conn-dot");
  dot.className = `conn-dot ${connected ? "online" : "offline"}`;
  sourceStatus.textContent = connected ? "Conectado" : "Desconectado";
}

// ── Order pill selector ───────────────────────────────────────────────────────
function selectOrder(btn) {
  document.querySelectorAll(".order-pill").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  selectedPO = btn.dataset.po;
  // If already connected, update the iframe URL
  if (currentPhase >= 1 && sorianaFrame.src) {
    loadSorianaFrame(selectedPO);
  }
}

// ── FASE 1: Connect source system ─────────────────────────────────────────────
async function connectSource() {
  bannerActionBtn.disabled = true;
  bannerActionBtn.textContent = "Conectando...";

  const dot = sourceIndicator.querySelector(".conn-dot");
  dot.className = "conn-dot connecting";
  sourceStatus.textContent = "Conectando...";

  setAIStatus("working", "Detectando sistemas...");
  addLog(`Fase 1 — Iniciando conexión con Portal Soriana...`, "working");

  await sleep(800);

  // Check server has the order
  try {
    const res = await fetch(`/api/soriana-order/${selectedPO}`);
    if (!res.ok) throw new Error("Servidor no disponible");
  } catch (_) {
    // Server offline — still show the iframe (standalone HTML)
  }

  // Load iframe
  loadSorianaFrame(selectedPO);
  setSourceConnected(true);

  // Fill source summary
  updateSourceSummary(SORIANA_ORDERS[selectedPO]);

  // Update form instruction
  formInstruction.className = "form-instruction ready";
  instructionText.textContent = "Llena el formulario con los datos de la orden. La IA te observa.";

  setAIStatus("", "Sistemas conectados");
  addLog(`✓ Portal Soriana detectado — orden ${selectedPO} cargada`, "success");
  addLog(`ℹ️  Llena el formulario manualmente. El agente aprenderá el mapeo observándote.`, "info");

  toast("Sistema origen conectado correctamente", "success");
  setPhaseUI(2);
  bannerActionBtn.disabled = false;
}

function loadSorianaFrame(po) {
  iframePlaceholder.style.display = "none";
  sorianaFrame.style.display = "block";
  // Build the Soriana URL with the PO pre-queried
  sorianaFrame.src = `/soriana/soriana.html`;
  // After load, inject the PO query
  sorianaFrame.onload = () => {
    try {
      const doc = sorianaFrame.contentDocument || sorianaFrame.contentWindow.document;
      const poInput = doc.getElementById("poInput");
      if (poInput) {
        poInput.value = po;
        if (typeof doc.defaultView.consultarOrden === "function") {
          doc.defaultView.consultarOrden();
        }
      }
    } catch (_) {
      // Cross-origin — the iframe shows the Soriana portal regardless
    }
  };
}

function updateSourceSummary(order) {
  if (!order) return;
  sourceSummary.style.display = "grid";
  document.getElementById("sumPO").textContent      = order.PurchaseOrder;
  document.getElementById("sumCustomer").textContent= order.CustomerName;
  document.getElementById("sumProduct").textContent = order.SKUDescription;
  document.getElementById("sumQty").textContent     = `${order.RequestedQty} pzs`;
  document.getElementById("sumPrice").textContent   = `$${order.UnitPrice} MXN`;
  document.getElementById("sumDate").textContent    = order.DeliveryDate;
}

// ── Field observe effect ──────────────────────────────────────────────────────
const fieldInputs = form ? form.querySelectorAll("input, textarea") : [];
if (currentPhase <= 2) {
  fieldInputs.forEach(input => {
    input.addEventListener("focus", () => {
      if (currentPhase !== 2 || !isMappingReady === false) return;
      const badge = document.getElementById(`obs-${input.name}`);
      if (badge) { badge.textContent = "👁"; badge.classList.add("visible"); }
      input.classList.add("field-observing");
      aiWatching.style.display = "flex";
      setAIStatus("working", `Observando: ${input.name}`);
    });
    input.addEventListener("blur", () => {
      const badge = document.getElementById(`obs-${input.name}`);
      if (badge) { badge.textContent = ""; badge.classList.remove("visible"); }
      input.classList.remove("field-observing");
      setAIStatus("", "Agente observando...");
    });
  });
}

// ── FASE 2: Manual form submission → agent learns ─────────────────────────────
form && form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (currentPhase < 2) {
    toast("Conecta el sistema origen primero (Fase 1)", "warning");
    return;
  }

  const arcaData = Object.fromEntries(new FormData(form).entries());
  const po = String(arcaData.folio_orden || "").toUpperCase();

  if (!po) { toast("Ingresa el folio de orden antes de procesar", "warning"); return; }
  if (isDuplicate(po)) { toast(`La orden ${po} ya fue procesada`, "warning"); return; }

  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Procesando...";

  aiWatching.style.display = "none";
  setAIStatus("working", "Aprendiendo mapeo...");
  addLog(`Agente observó el llenado de ${po} — comparando con Portal Soriana...`, "working");

  // Agent learns
  if (po.startsWith("OC-SOR")) {
    try {
      const sRes = await fetch(`/api/soriana-order/${po}`);
      if (sRes.ok) {
        const sorianaData = await sRes.json();
        const lRes = await fetch("/api/learn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sorianaData, arcaData })
        });
        const learned = await lRes.json();
        if (learned.mappings?.length) {
          renderMappings(learned.mappings);
          isMappingReady = true;
          const obs = learned.learnedByObservation ?? 0;
          const ai  = learned.learnedByAI ?? 0;
          addLog(`Agente aprendió ${learned.mappings.length} mapeos — 👁 ${obs} por observación · 🤖 ${ai} por IA`, "success");
          toast(`¡Aprendizaje completo! ${learned.mappings.length} campos mapeados`, "success", 5000);
          await sleep(600);
          enablePhase3();
        }
      }
    } catch (_) {
      addLog("Servidor offline — guardando sin aprender mapeo", "error");
    }
  }

  // Save locally
  const records = getRecords();
  records.unshift({ ...arcaData, savedAt: new Date().toISOString(), method: "manual" });
  saveRecords(records);
  renderRecords();

  // Save to backend
  try {
    await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(arcaData)
    });
  } catch (_) {}

  addLog(`Orden ${po} registrada en Sistema Arca Continental`, "success");
  formInstruction.className = "form-instruction done";
  instructionText.textContent = "¡Orden procesada! El agente aprendió el mapeo. Fase 3 desbloqueada.";
  setAIStatus("learned", "Mapeo aprendido ✓");
  form.reset();

  submitBtn.disabled = false;
  submitBtn.textContent = "Procesar orden";
  submitBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Procesar orden`;
});

// ── Enable Phase 3 ────────────────────────────────────────────────────────────
function enablePhase3() {
  setPhaseUI(3);
  buildAutoOrderList();
  toast("¡Fase 3 desbloqueada! El agente puede automatizar ahora.", "success", 5000);
}

function showPhase3() {
  phase2Panel.style.display = "none";
  phase3Panel.style.display = "block";
  buildAutoOrderList();
}

function showPhase2() {
  phase3Panel.style.display = "none";
  phase2Panel.style.display = "block";
}

function buildAutoOrderList() {
  const processed = new Set(getRecords().map(r => r.folio_orden));
  autoOrderList.innerHTML = "";

  Object.entries(SORIANA_ORDERS).forEach(([po, order]) => {
    const done = processed.has(po) || processed.has(po.toUpperCase());
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border:1.5px solid var(--line);border-radius:8px;background:var(--paper);";
    if (done) wrap.style.cssText += "opacity:0.5;";

    wrap.innerHTML = `
      <div>
        <div style="font-size:12px;font-weight:800;color:var(--ink);">${po}</div>
        <div style="font-size:11px;color:var(--muted);">${order.CustomerName} — ${order.SKUDescription}</div>
      </div>
      ${done
        ? `<span class="state-pill processed">✓ Procesada</span>`
        : `<button class="auto-order-action" onclick="automateOrder('${po}', this)">⚡ Automatizar</button>`
      }
    `;
    autoOrderList.appendChild(wrap);
  });

  // Show phase 3 panel
  showPhase3();
}

// ── FASE 3: Automate a new order ──────────────────────────────────────────────
async function automateOrder(po, btn) {
  if (processingAuto) return;
  if (isDuplicate(po)) {
    toast(`La orden ${po} ya fue procesada`, "warning");
    return;
  }

  processingAuto = true;
  btn.disabled = true;
  btn.textContent = "Procesando...";

  autoProgress.style.display = "flex";
  autoProgressFill.style.width = "0%";
  autoProgressLabel.textContent = "Verificando orden en Soriana...";
  setAIStatus("working", "Automatizando...");
  addLog(`Fase 3 — Automatizando ${po}...`, "working");

  // Load the selected order into the iframe
  selectOrderInIframe(po);

  // Step 1: verify (10%)
  autoProgressFill.style.width = "10%";
  await sleep(400);

  try {
    const checkRes = await fetch(`/api/soriana-order/${po}`);
    if (!checkRes.ok) {
      toast(`Orden ${po} no encontrada en Soriana`, "error");
      processingAuto = false;
      btn.disabled = false;
      btn.textContent = "⚡ Automatizar";
      autoProgress.style.display = "none";
      return;
    }
    autoProgressFill.style.width = "30%";
    autoProgressLabel.textContent = "Aplicando mapeo aprendido...";
    addLog(`Portal Soriana confirmó ${po} ✓`, "success");

    await sleep(300);
    autoProgressFill.style.width = "50%";

    // Step 2: automate
    const res  = await fetch(`/api/automate/${po}`);
    const data = await res.json();

    if (!res.ok) {
      toast(data.error || "Error al automatizar", "error");
      addLog(`❌ ${data.error}`, "error");
      processingAuto = false;
      btn.disabled = false;
      btn.textContent = "⚡ Automatizar";
      autoProgress.style.display = "none";
      return;
    }

    // Show mappings
    if (data.mappings?.length) {
      renderMappings(data.mappings);
      const obs = data.mappings.filter(m => m.method === "observation").length;
      const ai  = data.mappings.filter(m => m.method === "ai-semantic").length;
      addLog(`Mapeo aplicado: 👁 ${obs} campos por observación · 🤖 ${ai} por IA`, "info");
    }

    autoProgressFill.style.width = "70%";
    autoProgressLabel.textContent = "Llenando formulario destino...";
    addLog(`Aplicando ${data.mappings?.length ?? 0} mapeos al Sistema Arca...`, "working");

    await sleep(400);

    // Animate form fill (visible to user) — switch to Phase 2 view temporarily
    showPhase2();
    await autoFillWithAnimation(data.values, data.mappings);

    autoProgressFill.style.width = "90%";
    autoProgressLabel.textContent = "Guardando orden...";

    // Save
    const record = Object.fromEntries(new FormData(form).entries());
    if (record.folio_orden) {
      const records = getRecords();
      records.unshift({ ...record, savedAt: new Date().toISOString(), method: "automated" });
      saveRecords(records);
      renderRecords();

      try {
        await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(record)
        });
      } catch (_) {}

      addLog(`Orden ${record.folio_orden} procesada automáticamente ✓`, "success");
    }

    autoProgressFill.style.width = "100%";
    autoProgressLabel.textContent = "¡Completado!";
    setAIStatus("learned", "Automatización completa ✓");
    toast(`Orden ${po} procesada automáticamente sin intervención`, "success", 6000);

    await sleep(1200);
    form.reset();
    autoProgress.style.display = "none";

    // Return to Phase 3 view
    showPhase3();
    buildAutoOrderList();

  } catch (err) {
    toast(`Error: ${err.message}`, "error");
    addLog(`❌ Error: ${err.message}`, "error");
    autoProgress.style.display = "none";
  }

  processingAuto = false;
  btn.disabled = false;
  btn.textContent = "⚡ Automatizar";
}

function selectOrderInIframe(po) {
  // Update iframe to show the new order
  try {
    const doc = sorianaFrame.contentDocument || sorianaFrame.contentWindow.document;
    const poInput = doc.getElementById("poInput");
    if (poInput) {
      poInput.value = po;
      if (typeof doc.defaultView.consultarOrden === "function") {
        doc.defaultView.consultarOrden();
      }
    }
  } catch (_) {}

  // Also update pills
  document.querySelectorAll(".order-pill").forEach(p => {
    p.classList.toggle("active", p.dataset.po === po);
  });
  selectedPO = po;
  updateSourceSummary(SORIANA_ORDERS[po]);
}

// ── Animated field filling ────────────────────────────────────────────────────
async function autoFillWithAnimation(values, mappings) {
  for (const [name, value] of Object.entries(values)) {
    await sleep(450);
    const field = form.elements[name];
    if (!field) continue;

    // Flash amber (about to fill)
    field.classList.add("field-observing");
    await sleep(250);
    field.classList.remove("field-observing");

    // Type value + flash green
    field.value = value;
    field.classList.add("field-filling");
    await sleep(200);
    field.classList.remove("field-filling");

    const m = mappings?.find(x => x.dest === name);
    addLog(`${m?.source ?? name} → ${name}: "${value}"`, "success");
  }
  await sleep(400);
}

// ── Render mappings ───────────────────────────────────────────────────────────
function renderMappings(rows) {
  if (!rows?.length) return;
  mappingEmpty.style.display = "none";
  mappingTable.style.display = "table";

  mappingBody.innerHTML = rows.map(r => {
    const isTuple = Array.isArray(r);
    const src    = isTuple ? r[0] : (r.sourceLabel || r.source || "?");
    const dst    = isTuple ? r[1] : (r.destLabel   || r.dest   || "?");
    const conf   = isTuple ? r[2] : `${Math.round((r.confidence ?? 0.9) * 100)}%`;
    const method = isTuple ? null  : r.method;
    const rat    = isTuple ? ""    : (r.rationale || "");

    const badge = method === "observation"
      ? `<span class="method-badge obs" title="${rat}">👁 Observado</span>`
      : method === "ai-semantic"
      ? `<span class="method-badge ai" title="${rat}">🤖 IA semántica</span>`
      : "";

    return `<tr>
      <td style="font-weight:600;font-size:11px;">${src}</td>
      <td class="map-arrow">→</td>
      <td style="font-size:11px;">${dst}</td>
      <td class="map-conf">${conf}</td>
      <td>${badge}</td>
    </tr>`;
  }).join("");
}

// ── Render records table ──────────────────────────────────────────────────────
function renderRecords() {
  const records = getRecords();
  recordsCount.textContent = `${records.length} ${records.length === 1 ? "orden" : "órdenes"}`;

  if (!records.length) {
    recordsBody.innerHTML = `<tr class="empty-row"><td colspan="8">Aún no hay órdenes procesadas. Completa el flujo para ver resultados aquí.</td></tr>`;
    return;
  }

  recordsBody.innerHTML = records.map(r => {
    const total  = Number(r.cant_solicitada || 0) * Number(r.precio_venta || 0);
    const pill   = r.method === "automated"
      ? `<span class="state-pill automated">🤖 Automatizada</span>`
      : `<span class="state-pill processed">✓ Manual</span>`;
    return `<tr>
      <td style="font-weight:700;">${r.folio_orden || "—"}</td>
      <td>${r.cliente || "—"}</td>
      <td>${r.nombre_articulo || "—"}</td>
      <td>${r.cant_solicitada || "—"}</td>
      <td>${r.fecha_entrega || "—"}</td>
      <td style="font-weight:700;">${money(total)}</td>
      <td>${pill}</td>
      <td><span class="state-pill processed">✓ Procesada</span></td>
    </tr>`;
  }).join("");
}

// ── Other buttons ─────────────────────────────────────────────────────────────
function clearForm() {
  form.reset();
  addLog("Formulario limpiado", "info");
}

function clearAllRecords() {
  if (!confirm("¿Borrar todo el historial de órdenes?")) return;
  saveRecords([]);
  renderRecords();
  addLog("Historial de órdenes borrado", "info");
}

async function resetMapping() {
  if (!confirm("¿Reiniciar el mapeo aprendido?\nEl agente olvidará todo. Podrás hacer la demostración desde cero.")) return;
  try {
    await fetch("/api/mappings", { method:"DELETE" });
  } catch (_) {}
  mappingBody.innerHTML = "";
  mappingTable.style.display  = "none";
  mappingEmpty.style.display = "flex";
  isMappingReady = false;
  setAIStatus("", "Agente reiniciado");
  setPhaseUI(currentPhase < 3 ? currentPhase : 2);
  showPhase2();
  addLog("Mapeo reiniciado — el agente volvió al estado inicial", "working");
  toast("Agente reiniciado. Listo para aprender de nuevo.", "info");
}

// ── Load existing mappings from server on startup ─────────────────────────────
async function loadExistingMappings() {
  try {
    const res = await fetch("/api/mappings");
    const mappings = await res.json();
    if (mappings.length) {
      renderMappings(mappings.map(m => ({
        sourceLabel: m.sourceField?.label ?? m.sourceField?.name ?? "?",
        source:      m.sourceField?.name  ?? "?",
        destLabel:   m.destinationField?.label ?? m.destinationField?.name ?? "?",
        dest:        m.destinationField?.name  ?? "?",
        confidence:  m.confidence ?? 0.9,
        rationale:   m.rationale ?? "",
        method:      m.rationale?.includes("observación") ? "observation" : "ai-semantic",
      })));
      isMappingReady = true;
      setAIStatus("learned", "Mapeo previo cargado ✓");
      addLog(`Mapeo previo restaurado (${mappings.length} campos)`, "success");
      // If we already have mapping, we can jump to phase 3 UX
      setPhaseUI(3);
      enablePhase3();
    }
  } catch (_) {
    // Server offline or no mappings — stay at phase 1
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  form && form.reset();
  setPhaseUI(1);
  renderRecords();
  addLog("Sistema listo. Conecta el sistema origen para comenzar la Fase 1.", "info");
  await loadExistingMappings();
})();