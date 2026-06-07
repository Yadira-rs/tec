const learnedMappings = [
  ["CustomerName", "cliente", "99%"],
  ["PurchaseOrder", "folio_orden", "99%"],
  ["SKUDescription", "nombre_articulo", "98%"],
  ["UnitPrice", "precio_venta", "97%"],
  ["RequestedQty", "cant_solicitada", "97%"],
  ["DeliveryDate", "fecha_entrega", "96%"],
  ["OrderDetail", "detalle_producto", "94%"],
];

// Fase 2: orden que el usuario captura manualmente (Soriana OC-SOR-2024-001)
const sampleOrder = {
  cliente: "Soriana Cumbres",
  folio_orden: "OC-SOR-2024-001",
  nombre_articulo: "Coca-Cola 600ml",
  precio_venta: "14.50",
  cant_solicitada: "200",
  fecha_entrega: "2026-06-15",
  detalle_producto: "Entrega en CEDIS Monterrey Norte",
};

// Fase 3: orden NUEVA que el agente procesa automáticamente (Soriana OC-SOR-2024-002)
const autoOrder = {
  cliente: "Soriana Satélite",
  folio_orden: "OC-SOR-2024-002",
  nombre_articulo: "Coca-Cola 355ml",
  precio_venta: "11.00",
  cant_solicitada: "150",
  fecha_entrega: "2026-06-20",
  detalle_producto: "Entrega en CEDIS Sur",
};

const sauceDemoProducts = [
  {
    nombre_articulo: "Sauce Labs Backpack",
    precio_venta: "29.99",
    cant_solicitada: "8",
    detalle_producto: "Producto importado desde saucedemo.com: mochila Sauce Labs Backpack.",
  },
  {
    nombre_articulo: "Sauce Labs Bike Light",
    precio_venta: "9.99",
    cant_solicitada: "15",
    detalle_producto: "Producto importado desde saucedemo.com: luz Sauce Labs Bike Light.",
  },
  {
    nombre_articulo: "Sauce Labs Bolt T-Shirt",
    precio_venta: "15.99",
    cant_solicitada: "12",
    detalle_producto: "Producto importado desde saucedemo.com: playera Sauce Labs Bolt T-Shirt.",
  },
  {
    nombre_articulo: "Sauce Labs Fleece Jacket",
    precio_venta: "49.99",
    cant_solicitada: "5",
    detalle_producto: "Producto importado desde saucedemo.com: chamarra Sauce Labs Fleece Jacket.",
  },
];

const mappingBody = document.querySelector("#mappingBody");
const recordsBody = document.querySelector("#recordsBody");
const automationLog = document.querySelector("#automationLog");
const form = document.querySelector("#orderForm");

function money(value) {
  return Number(value || 0).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
  });
}

function getDeliveryDate(daysToAdd = 3) {
  const date = new Date();
  date.setDate(date.getDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}

function getNextFolioNumber() {
  return Number(localStorage.getItem("aosNextFolio") || "1");
}

function getFolioPreview() {
  const year = new Date().getFullYear();
  return `OC-${year}-${String(getNextFolioNumber()).padStart(3, "0")}`;
}

function reserveFolio() {
  const folio = getFolioPreview();
  localStorage.setItem("aosNextFolio", String(getNextFolioNumber() + 1));
  return folio;
}

function setAutomaticOrderFields({ reserve = false } = {}) {
  setFormValues({
    cliente: "saucedemo",
    folio_orden: reserve ? reserveFolio() : getFolioPreview(),
    fecha_entrega: getDeliveryDate(),
  });
}

function renderMappings(rows = []) {
  mappingBody.innerHTML = rows
    .map(
      ([source, destination, confidence]) => `
        <tr>
          <td>${source}</td>
          <td>${destination}</td>
          <td style="color:#1a7a1a;font-weight:700;">${confidence}</td>
        </tr>
      `,
    )
    .join("");
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

// Fills the form field by field with a delay to simulate the AI agent typing
async function autoFillWithAnimation(values) {
  const btn = document.querySelector("#autoProcess");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Agente procesando...";
  }

  renderMappings(learnedMappings);
  addLog("Agente leyó OC-SOR-2024-002 del Portal Soriana.");
  addLog("Aplicando mapeo aprendido al sistema Arca Continental...");

  const entries = Object.entries(values);
  for (const [name, value] of entries) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const field = form.elements[name];
    if (!field) continue;

    field.style.transition = "background 0.3s";
    field.style.background = "#fffbe6";
    field.value = value;
    field.style.background = "#e6ffe6";

    const mapping = learnedMappings.find(([, dest]) => dest === name);
    const sourceLabel = mapping ? mapping[0] : name;
    addLog(`✓ ${sourceLabel} → ${name}: "${value}"`);

    await new Promise((resolve) => setTimeout(resolve, 300));
    field.style.background = "";
  }

  await new Promise((resolve) => setTimeout(resolve, 600));

  const record = Object.fromEntries(new FormData(form).entries());
  const records = getRecords();
  records.unshift({ ...record, savedAt: new Date().toISOString() });
  saveRecords(records);
  renderRecords();
  addLog(`✅ Orden ${record.folio_orden} procesada automáticamente por el agente.`);
  form.reset();

  if (btn) {
    btn.disabled = false;
    btn.textContent = "🤖 Automatizar con IA (OC-SOR-2024-002)";
  }
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

  recordsBody.innerHTML = records
    .map((record) => {
      const total = Number(record.cant_solicitada || 0) * Number(record.precio_venta || 0);
      return `
        <tr>
          <td>${record.folio_orden || "-"}</td>
          <td>${record.cliente || "-"}</td>
          <td>${record.nombre_articulo || "-"}</td>
          <td>${record.cant_solicitada || "-"}</td>
          <td>${record.fecha_entrega || "-"}</td>
          <td>${money(total)}</td>
          <td><span class="state-pill">Procesada</span></td>
        </tr>
      `;
    })
    .join("");
}

document.querySelector("#simulateLearning").addEventListener("click", () => {
  renderMappings(learnedMappings);
  addLog("El agente relacionó campos del Portal Soriana con campos internos de Arca Continental.");
  addLog("Mapeo aprendido por observación — sin reglas programadas.");
});

// Fase 2: carga Soriana OC-SOR-2024-001 para demostrar la observación manual
document.querySelector("#loadSample").addEventListener("click", () => {
  setFormValues(sampleOrder);
  addLog("Fase 2 — Captura manual: OC-SOR-2024-001 cargada para demostración.");
});

document.querySelector("#clearForm").addEventListener("click", () => {
  form.reset();
  setAutomaticOrderFields();
  addLog("Formulario interno listo para otra orden.");
});

document.querySelector("#clearRecords").addEventListener("click", () => {
  saveRecords([]);
  renderRecords();
  addLog("Historial de órdenes limpiado.");
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  setAutomaticOrderFields({ reserve: true });
  const record = Object.fromEntries(new FormData(form).entries());
  const records = getRecords();
  records.unshift({ ...record, savedAt: new Date().toISOString() });
  saveRecords(records);
  renderRecords();
  addLog(`Orden ${record.folio_orden || "sin folio"} procesada en sistema interno.`);
  form.reset();
  setAutomaticOrderFields();
});

// Fase 3: el agente llena OC-SOR-2024-002 usando el mapeo aprendido
const autoBtn = document.querySelector("#autoProcess");
if (autoBtn) {
  autoBtn.addEventListener("click", () => {
    autoFillWithAnimation(autoOrder);
  });
}

renderMappings(learnedMappings);
renderRecords();
setAutomaticOrderFields();
addLog("Tablero Arca Continental iniciado.");