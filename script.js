const learnedMappings = [
  ["Name", "nombre_articulo", "99%"],
  ["Price", "precio_venta", "98%"],
  ["Description", "detalle_producto", "97%"],
  ["Quantity", "cant_solicitada", "96%"],
];

const sampleOrder = {
  nombre_articulo: "Sauce Labs Backpack",
  precio_venta: "29.99",
  detalle_producto: "Carry.allTheThings() with the sleek, streamlined Sly Pack.",
  cant_solicitada: "3",
};

const mappingBody = document.querySelector("#mappingBody");
const recordsBody = document.querySelector("#recordsBody");
const automationLog = document.querySelector("#automationLog");
const form = document.querySelector("#orderForm");

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
    recordsBody.innerHTML = `<tr><td class="empty-row" colspan="5">Aun no hay articulos guardados.</td></tr>`;
    return;
  }

  recordsBody.innerHTML = records
    .map((record) => {
      const total = Number(record.cant_solicitada || 0) * Number(record.precio_venta || 0);
      return `
        <tr>
          <td>${record.nombre_articulo}</td>
          <td>$${Number(record.precio_venta || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
          <td>${record.detalle_producto}</td>
          <td>${record.cant_solicitada}</td>
          <td>$${total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    })
    .join("");
}

document.querySelector("#simulateLearning").addEventListener("click", () => {
  renderMappings(learnedMappings);
  addLog("La IA genero el mapeo origen -> destino con etiquetas distintas.");
});

document.querySelector("#loadSample").addEventListener("click", () => {
  setFormValues(sampleOrder);
  addLog("Se cargo una orden nueva para probar replicabilidad.");
});

document.querySelector("#clearForm").addEventListener("click", () => {
  form.reset();
  addLog("Formulario destino listo para otra ejecucion.");
});

document.querySelector("#clearRecords").addEventListener("click", () => {
  saveRecords([]);
  renderRecords();
  addLog("Tabla de registros limpiada.");
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const record = Object.fromEntries(new FormData(form).entries());
  const records = getRecords();
  records.unshift({ ...record, savedAt: new Date().toISOString() });
  saveRecords(records);
  renderRecords();
  addLog(`Registro guardado automaticamente: ${record.nombre_articulo || "sin articulo"}.`);
  form.reset();
});

renderMappings(learnedMappings.slice(0, 4));
renderRecords();
addLog("Sistema destino iniciado en navegador.");
