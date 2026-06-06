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
  cliente: "saucedemo",
  folio_orden: "",
  nombre_articulo: "",
  precio_venta: "",
  cant_solicitada: "",
  fecha_entrega: "",
  detalle_producto: "",
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
  const nextProductIndex = Number(localStorage.getItem("aosNextSauceProduct") || "0");
  const product = sauceDemoProducts[nextProductIndex % sauceDemoProducts.length];
  localStorage.setItem("aosNextSauceProduct", String(nextProductIndex + 1));

  setFormValues({ ...sampleOrder, ...product });
  setAutomaticOrderFields();
  addLog("Orden saucedemo cargada con folio OC consecutivo y fecha automatica.");
});

document.querySelector("#clearForm").addEventListener("click", () => {
  form.reset();
  setAutomaticOrderFields();
  addLog("Formulario interno listo para otra orden saucedemo.");
});

document.querySelector("#clearRecords").addEventListener("click", () => {
  saveRecords([]);
  renderRecords();
  addLog("Historial visual de ordenes limpiado.");
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

renderMappings(learnedMappings.slice(0, 5));
renderRecords();
setAutomaticOrderFields();
addLog("Tablero Arca Continental iniciado.");
