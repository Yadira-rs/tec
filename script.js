const learnedMappings = [
  ["CustomerName", "cliente", "99%"],
  ["PurchaseOrder", "folio_orden", "99%"],
  ["SKUDescription", "nombre_articulo", "98%"],
  ["UnitPrice", "precio_venta", "97%"],
  ["RequestedQty", "cant_solicitada", "97%"],
  ["DeliveryDate", "fecha_entrega", "96%"],
  ["Notes", "detalle_producto", "94%"],
];

const sampleOrder = {
  cliente: "OXXO Region Norte",
  folio_orden: "PO-AC-2026-1847",
  nombre_articulo: "Coca-Cola Original 600 ml caja 24 pzas",
  precio_venta: "318.50",
  cant_solicitada: "42",
  fecha_entrega: "2026-06-10",
  detalle_producto: "Orden recibida en portal externo. Requiere entrega en CEDIS Monterrey antes de las 10:00.",
};

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

function renderMappings(rows = []) {
  mappingBody.innerHTML = rows
    .map(
      ([source, destination, confidence]) => `
        <tr>
          <td>${source}</td>
          <td>${destination}</td>
          <td>${confidence}</td>
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
  addLog("El agente relaciono campos del portal cliente con campos internos de Arca Continental.");
});

document.querySelector("#loadSample").addEventListener("click", () => {
  setFormValues(sampleOrder);
  addLog("Orden de compra cargada desde el portal externo del cliente.");
});

document.querySelector("#clearForm").addEventListener("click", () => {
  form.reset();
  addLog("Formulario interno listo para procesar otra orden.");
});

document.querySelector("#clearRecords").addEventListener("click", () => {
  saveRecords([]);
  renderRecords();
  addLog("Historial visual de ordenes limpiado.");
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const record = Object.fromEntries(new FormData(form).entries());
  const records = getRecords();
  records.unshift({ ...record, savedAt: new Date().toISOString() });
  saveRecords(records);
  renderRecords();
  addLog(`Orden ${record.folio_orden || "sin folio"} procesada en sistema interno.`);
  form.reset();
});

renderMappings(learnedMappings.slice(0, 5));
renderRecords();
addLog("Tablero Arca Continental iniciado.");
