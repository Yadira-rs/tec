import "dotenv/config";
import readline from "node:readline";
import { chromium } from "@playwright/test";
import { inferMappingsByValues } from "./inference-service.js";
import { appendAudit, saveLearnedMapping, saveOrder } from "./storage.js";
import { attachObserver, collectObserved } from "./observer.js";
import type { FieldDescriptor, LearnedMapping, PurchaseOrder } from "./types.js";

const SOURCE_URL = process.env.SOURCE_URL ?? "http://localhost:3000/soriana/soriana.html";
const DEST_URL = process.env.DESTINATION_URL ?? "http://localhost:3000";

const DEST_FIELDS: FieldDescriptor[] = [
  { id: "destination-cliente", label: "Cliente", name: "cliente" },
  { id: "destination-folio_orden", label: "Folio de Orden", name: "folio_orden" },
  { id: "destination-nombre_articulo", label: "Nombre del Artículo", name: "nombre_articulo" },
  { id: "destination-precio_venta", label: "Precio de Venta", name: "precio_venta" },
  { id: "destination-cant_solicitada", label: "Cantidad Solicitada", name: "cant_solicitada" },
  { id: "destination-fecha_entrega", label: "Fecha de Entrega", name: "fecha_entrega" },
  { id: "destination-detalle_producto", label: "Detalle del Producto", name: "detalle_producto" },
];

function waitForEnter(prompt: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

// Reads order data from the currently VISIBLE Soriana order card.
// Data is stored in data-field / data-value attributes added to each .detail-item.
async function extractSorianaData(page: import("@playwright/test").Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const data: Record<string, string> = {};

    // Find the visible order card (the others have display:none)
    const visibleCard = Array.from(document.querySelectorAll<HTMLElement>(".order-card"))
      .find((el) => el.style.display !== "none") ?? document.querySelector<HTMLElement>(".order-card");

    if (!visibleCard) return data;

    // Read labeled detail items
    visibleCard.querySelectorAll<HTMLElement>("[data-field][data-value]").forEach((el) => {
      const field = el.getAttribute("data-field") ?? "";
      const value = el.getAttribute("data-value") ?? "";
      if (field && value) data[field] = value;
    });

    return data;
  });
}

async function fillDestByMapping(
  page: import("@playwright/test").Page,
  mappings: LearnedMapping[],
  sourceValues: Record<string, string>,
) {
  const filled: Record<string, string> = {};

  for (const m of mappings) {
    const srcKey = m.sourceField.name ?? m.sourceField.id ?? "";
    const value = sourceValues[srcKey] ?? "";
    const destName = m.destinationField.name ?? m.destinationField.fieldKey ?? "";
    if (!value || !destName) continue;

    const el = page.locator(`[name="${destName}"]`);
    if (!(await el.count())) continue;

    const tag = await el.evaluate((n) => n.tagName.toLowerCase());
    if (tag === "select") continue;

    await el.fill(value);
    filled[destName] = value;
    console.log(
      `     "${m.sourceField.label}" → "${m.destinationField.label}" = "${value}" (${Math.round(m.confidence * 100)}%)`,
    );
  }

  if (Object.keys(filled).length > 0) {
    await saveOrder({ ...emptyOrder(), ...filled } as PurchaseOrder);
  }
}

function emptyOrder(): PurchaseOrder {
  return {
    internalOrderId: "", retailerName: "", deliveryCenter: "", requiredDate: "",
    internalSku: "", productDescription: "", requestedUnits: "", logisticUnit: "",
    unitPrice: "", buyerContact: "", fulfillmentNotes: "",
  };
}

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const ctx = await browser.newContext();

  // ═══════════════════════════════════════════════
  //  FASE 1: CONEXIÓN
  // ═══════════════════════════════════════════════
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  FASE 1 — Conexión a ambos sistemas");
  console.log("═══════════════════════════════════════════════════════════\n");

  const sourcePage = await ctx.newPage();
  await sourcePage.goto(SOURCE_URL);
  await sourcePage.waitForSelector(".order-card", { timeout: 10_000 });
  await appendAudit({ actor: "browser-worker", action: "connected_to_source", details: { url: SOURCE_URL } });
  console.log("  ✓ Origen listo:  Portal Soriana — Orden OC-SOR-2024-001 visible (Tab 1)");

  const destPage = await ctx.newPage();
  await destPage.goto(DEST_URL);
  await destPage.waitForSelector('[name="cliente"]');
  await appendAudit({ actor: "browser-worker", action: "connected_to_destination", details: { url: DEST_URL } });
  console.log("  ✓ Destino listo: Sistema Arca Continental — formulario listo (Tab 2)\n");

  // ═══════════════════════════════════════════════
  //  FASE 2: OBSERVACIÓN
  // ═══════════════════════════════════════════════
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  FASE 2 — El agente observa el proceso manual (una vez)");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Agent reads source data automatically — no user action on source needed
  const sourceData = await extractSorianaData(sourcePage);

  const sourceFields: FieldDescriptor[] = Object.keys(sourceData).map((key) => ({
    id: `source-${key}`,
    label: key,
    name: key,
  }));

  console.log("  ✓ Agente leyó la orden de Soriana automáticamente:");
  console.log("  ┌──────────────────────┬─────────────────────────────────────┐");
  console.log("  │ Campo Soriana        │ Valor                               │");
  console.log("  ├──────────────────────┼─────────────────────────────────────┤");
  for (const [k, v] of Object.entries(sourceData)) {
    console.log(`  │ ${k.padEnd(20)} │ ${v.padEnd(35)} │`);
  }
  console.log("  └──────────────────────┴─────────────────────────────────────┘");

  // Now watch the user fill the Arca destination form manually
  await attachObserver(destPage);

  // Inject a visible banner so the user knows what to do in the browser window
  await destPage.evaluate(() => {
    const banner = document.createElement("div");
    banner.style.cssText = [
      "position:fixed", "top:0", "left:0", "right:0", "z-index:99999",
      "background:#E31837", "color:#fff", "padding:14px 20px",
      "font-size:15px", "font-weight:700", "text-align:center",
      "box-shadow:0 3px 10px rgba(0,0,0,0.4)", "letter-spacing:.3px",
    ].join(";");
    banner.textContent =
      "🤖 AGENTE OBSERVANDO — Llena este formulario con los datos de Soriana y luego presiona ENTER en la terminal";
    document.body.insertBefore(banner, document.body.firstChild);
  });

  console.log("\n  Ahora realiza el proceso manualmente UNA VEZ:");
  console.log("  📋  Ve al Tab 2 (Sistema Arca) y llena el formulario con los datos de Soriana:");
  console.log("      cliente          →  Soriana Cumbres");
  console.log("      folio_orden      →  OC-SOR-2024-001");
  console.log("      nombre_articulo  →  Coca-Cola 600ml");
  console.log("      precio_venta     →  14.50");
  console.log("      cant_solicitada  →  200");
  console.log("      fecha_entrega    →  2026-06-15");
  console.log("      detalle_producto →  Entrega en CEDIS Monterrey Norte");
  console.log();

  await waitForEnter("  ⏎  Presiona ENTER cuando hayas terminado de llenar el formulario Arca...\n");

  const destObserved = await collectObserved(destPage);

  console.log(`\n  ✓ Capturado en formulario Arca: ${JSON.stringify(destObserved)}`);

  if (Object.keys(destObserved).length === 0) {
    console.log("  ⚠️  No se capturaron valores. Asegúrate de escribir en el formulario Arca");
    console.log("     en la ventana de Chrome que abrió el agente, luego presionar ENTER aquí.");
    await browser.close();
    return;
  }

  // Learn mappings by matching source values to destination values
  const mappings = await inferMappingsByValues(sourceData, destObserved, sourceFields, DEST_FIELDS);
  await saveLearnedMapping(mappings);

  if (mappings.length === 0) {
    console.log("\n  ⚠️  El agente no pudo inferir correspondencias.");
    console.log("     Asegúrate de usar los MISMOS valores de Soriana al llenar el formulario Arca.");
    await browser.close();
    return;
  }

  console.log("\n  ✓ Tabla de mapeo aprendido por observación:");
  console.log("  ┌──────────────────────┬──────────────────────┬──────────────┐");
  console.log("  │ Campo Soriana        │ Campo Arca           │ Confianza    │");
  console.log("  ├──────────────────────┼──────────────────────┼──────────────┤");
  for (const m of mappings) {
    const src = m.sourceField.label.padEnd(20);
    const dst = m.destinationField.label.padEnd(20);
    const conf = `${Math.round(m.confidence * 100)}%`.padEnd(12);
    console.log(`  │ ${src} │ ${dst} │ ${conf} │`);
  }
  console.log("  └──────────────────────┴──────────────────────┴──────────────┘");
  console.log();
  console.log("  Este mapeo fue aprendido por coincidencia de valores observados,");
  console.log("  no por reglas programadas. 'CustomerName' ≠ 'cliente': el agente lo infirió.");

  await appendAudit({ actor: "inference-service", action: "mapping_learned", details: { count: mappings.length } });

  // ═══════════════════════════════════════════════
  //  FASE 3: AUTOMATIZACIÓN CON NUEVA ORDEN
  // ═══════════════════════════════════════════════
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  FASE 3 — Automatización con nueva orden (sin intervención humana)");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Navigate to the second Soriana order
  await sourcePage.fill("#poInput", "OC-SOR-2024-002");
  await sourcePage.click("button:has-text('Consultar')");
  await sourcePage.waitForTimeout(800);

  const newSourceData = await extractSorianaData(sourcePage);

  console.log(`  ✓ Datos extraídos de OC-SOR-2024-002: ${JSON.stringify(newSourceData)}`);
  console.log("  ✓ Agente detectó nueva orden en Portal Soriana (OC-SOR-2024-002):");
  for (const [k, v] of Object.entries(newSourceData)) {
    console.log(`     ${k.padEnd(20)} = ${v}`);
  }
  console.log("\n  Aplicando mapeo aprendido al formulario Arca...\n");

  const autoDestPage = await ctx.newPage();
  await autoDestPage.goto(DEST_URL);
  await autoDestPage.waitForSelector('[name="cliente"]');

  await autoDestPage.evaluate(() => {
    const banner = document.createElement("div");
    banner.style.cssText = [
      "position:fixed", "top:0", "left:0", "right:0", "z-index:99999",
      "background:#1a7a1a", "color:#fff", "padding:14px 20px",
      "font-size:15px", "font-weight:700", "text-align:center",
      "box-shadow:0 3px 10px rgba(0,0,0,0.4)", "letter-spacing:.3px",
    ].join(";");
    banner.textContent =
      "🤖 AGENTE AUTOMATIZANDO — Llenando el formulario con OC-SOR-2024-002 usando el mapeo aprendido...";
    document.body.insertBefore(banner, document.body.firstChild);
  });

  await fillDestByMapping(autoDestPage, mappings, newSourceData);

  const submitBtn = autoDestPage.locator('[data-testid="submit-order"]');
  if (await submitBtn.count()) {
    await submitBtn.click();
    console.log("\n  ✓ Formulario enviado automáticamente.");
  }

  await appendAudit({ actor: "browser-worker", action: "automation_complete", details: newSourceData });

  console.log("\n✅  Demo completa.");
  console.log("    OC-SOR-2024-002 fue procesada por el agente sin intervención humana.");
  console.log("    El agente aprendió el mapeo Soriana→Arca observando el proceso UNA VEZ.");
  console.log("    Revisa http://localhost:3000 para ver la orden registrada.\n");

  await new Promise((r) => setTimeout(r, 8_000));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});