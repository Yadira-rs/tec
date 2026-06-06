import "dotenv/config";
import { chromium } from "@playwright/test";
import { extractFields } from "./field-extractor.js";
import { inferMappings } from "./inference-service.js";
import { appendAudit, saveLearnedMapping, saveOrder } from "./storage.js";
import { newSourceOrder, observedSourceFields } from "./source-sample.js";
import type { PurchaseOrder } from "./types.js";

const destinationUrl = process.env.DESTINATION_URL || "http://localhost:3000/index.html";

async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto(destinationUrl);
  await appendAudit({
    actor: "browser-worker",
    action: "connected_to_destination",
    details: { destinationUrl },
  });

  const destinationFields = await extractFields(page, "destination");
  const mappings = await inferMappings(observedSourceFields, destinationFields);
  await saveLearnedMapping(mappings);
  await appendAudit({
    actor: "inference-service",
    action: "mapping_inferred",
    details: { fields: mappings.length },
  });

  const destinationValues = buildDestinationValues(mappings);
  await fillDestinationForm(page, destinationValues);
  await page.getByTestId("submit-order").click();
  await saveOrder(destinationValues);
  await appendAudit({
    actor: "browser-worker",
    action: "destination_form_submitted",
    details: { order: destinationValues.internalOrderId },
  });

  console.log("Demo completada. Revisa la tabla de ordenes y data/learned-mapping.json");
  await page.waitForTimeout(2500);
  await browser.close();
}

function buildDestinationValues(mappings: Awaited<ReturnType<typeof inferMappings>>): PurchaseOrder {
  const values: Partial<PurchaseOrder> = {};

  for (const mapping of mappings) {
    const sourceName = mapping.sourceField.name || "";
    const destinationName = mapping.destinationField.name as keyof PurchaseOrder | undefined;
    if (!destinationName) continue;
    values[destinationName] = newSourceOrder[sourceName] || "";
  }

  return {
    internalOrderId: values.internalOrderId || "",
    retailerName: values.retailerName || "",
    deliveryCenter: values.deliveryCenter || "",
    requiredDate: values.requiredDate || "",
    internalSku: values.internalSku || "",
    productDescription: values.productDescription || "",
    requestedUnits: values.requestedUnits || "",
    logisticUnit: values.logisticUnit || "",
    unitPrice: values.unitPrice || "",
    buyerContact: values.buyerContact || "",
    fulfillmentNotes: values.fulfillmentNotes || "",
  };
}

async function fillDestinationForm(page: import("@playwright/test").Page, order: PurchaseOrder) {
  for (const [name, value] of Object.entries(order)) {
    const field = page.locator(`[name="${name}"]`);
    if (!(await field.count())) continue;

    const tagName = await field.evaluate((node) => node.tagName.toLowerCase());
    if (tagName === "select") {
      await field.selectOption({ label: String(value) });
    } else {
      await field.fill(String(value));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
