import "dotenv/config";
import express from "express";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { clearOrders, getAuditLog, getLearnedMapping, getOrders, saveLearnedMapping, saveOrder } from "./storage.js";
import { inferMappingsByValues } from "./inference-service.js";
import { sorianaOrders } from "./soriana-orders.js";
import { saucedemoProducts } from "./saucedemo-products.js";
import type { PurchaseOrder } from "./types.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const publicRoot = path.resolve(".");
const sorianaRoot = path.resolve("../soriana");

app.use(express.json());
app.use(express.static(publicRoot, { extensions: ["html"] }));
app.use("/soriana", express.static(sorianaRoot));

// ── Soriana orders (source system data) ──────────────────────────────────────

app.get("/api/soriana-order/:po", (req, res) => {
  const po = req.params.po.toUpperCase();
  const order = sorianaOrders[po];
  if (!order) {
    res.status(404).json({ error: `Orden ${po} no encontrada en el portal Soriana.` });
    return;
  }
  res.json(order);
});

app.get("/api/soriana-orders", (_req, res) => {
  res.json(Object.values(sorianaOrders));
});

// ── SauceDemo products (alternative source system) ────────────────────────────

app.get("/api/saucedemo-product/:id", (req, res) => {
  const id = req.params.id.toUpperCase();
  const product = saucedemoProducts[id];
  if (!product) {
    res.status(404).json({ error: `Producto ${id} no encontrado en SauceDemo.` });
    return;
  }
  res.json(product);
});

app.get("/api/saucedemo-products", (_req, res) => {
  res.json(Object.values(saucedemoProducts));
});

app.get("/api/saucedemo-automate/:id", async (req, res) => {
  const id = req.params.id.toUpperCase();
  const product = saucedemoProducts[id];

  if (!product) {
    res.status(404).json({ error: `Producto ${id} no encontrado en SauceDemo.` });
    return;
  }

  const mapping = await getLearnedMapping();
  if (!mapping.length) {
    res.status(400).json({ error: "No hay mapeo aprendido. Realiza la Fase 2 primero." });
    return;
  }

  const values: Record<string, string> = {};
  const appliedMappings: Array<{ source: string; sourceLabel: string; dest: string; destLabel: string; value: string; confidence: number; rationale: string; method: string }> = [];

  for (const m of mapping) {
    const sourceKey = m.sourceField.name ?? m.sourceField.id.replace("source-", "");
    const destKey = m.destinationField.name ?? m.destinationField.id.replace("dest-", "");
    const value = product[sourceKey as keyof typeof product];
    if (value !== undefined && destKey) {
      values[destKey] = String(value);
      appliedMappings.push({
        source: sourceKey,
        sourceLabel: m.sourceField.label,
        dest: destKey,
        destLabel: m.destinationField.label,
        value: String(value),
        confidence: m.confidence,
        rationale: m.rationale,
        method: m.rationale.includes("observación") ? "observation" : "ai-semantic",
      });
    }
  }

  console.log(`  ✓ Fase 3 (SauceDemo): automatizando ${id} con ${Object.keys(values).length} campos mapeados`);
  res.json({ ok: true, id, values, mappings: appliedMappings });
});

// ── Phase 2: learn mapping from manual observation ────────────────────────────

app.post("/api/learn", async (req, res) => {
  const { sorianaData, arcaData } = req.body as {
    sorianaData: Record<string, string>;
    arcaData: Record<string, string>;
  };

  const sourceFields = Object.keys(sorianaData).map((k) => ({ id: `source-${k}`, label: k, name: k }));
  const destFields = Object.keys(arcaData).map((k) => ({ id: `dest-${k}`, label: k, name: k }));

  const mappings = await inferMappingsByValues(sorianaData, arcaData, sourceFields, destFields);
  await saveLearnedMapping(mappings);

  const learnedByObservation = mappings.filter((m) => m.rationale.includes("observación")).length;
  const learnedByAI = mappings.length - learnedByObservation;
  console.log(
    `  ✓ Fase 2: agente aprendió ${mappings.length} mapeos — ` +
    `${learnedByObservation} por observación de valores, ${learnedByAI} por IA semántica`,
  );

  res.json({
    ok: true,
    learnedByObservation,
    learnedByAI,
    mappings: mappings.map((m) => ({
      source: m.sourceField.name ?? m.sourceField.label,
      sourceLabel: m.sourceField.label,
      dest: m.destinationField.name ?? m.destinationField.label,
      destLabel: m.destinationField.label,
      confidence: m.confidence,
      rationale: m.rationale,
      method: m.rationale.includes("observación") ? "observation" : "ai-semantic",
    })),
  });
});

// ── Reset learned mapping for fresh demo runs ─────────────────────────────────

app.delete("/api/mappings", async (_req, res) => {
  await saveLearnedMapping([]);
  console.log("  ✓ Mapeo aprendido reiniciado.");
  res.json({ ok: true });
});

// ── Phase 3: automate any new order using learned mapping ─────────────────────

app.get("/api/automate/:po", async (req, res) => {
  try {
    const po = req.params.po.toUpperCase();
    const sorianaOrder = sorianaOrders[po];

    if (!sorianaOrder) {
      res.status(404).json({ error: `Orden ${po} no encontrada en el portal Soriana.` });
      return;
    }

    const mapping = await getLearnedMapping();
    if (!mapping.length) {
      res.status(400).json({ error: "No hay mapeo aprendido. Realiza la Fase 2 primero: llena una orden manualmente y presiona 'Procesar orden'." });
      return;
    }

    const values: Record<string, string> = {};
    const appliedMappings: Array<{ source: string; sourceLabel: string; dest: string; destLabel: string; value: string; confidence: number; rationale: string; method: string }> = [];

    for (const m of mapping) {
      const sourceKey = m.sourceField.name ?? m.sourceField.id.replace("source-", "");
      const destKey = m.destinationField.name ?? m.destinationField.id.replace("dest-", "");
      const value = sorianaOrder[sourceKey as keyof typeof sorianaOrder];
      if (value && destKey) {
        values[destKey] = value;
        appliedMappings.push({
          source: sourceKey,
          sourceLabel: m.sourceField.label,
          dest: destKey,
          destLabel: m.destinationField.label,
          value,
          confidence: m.confidence,
          rationale: m.rationale,
          method: m.rationale.includes("observación") ? "observation" : "ai-semantic",
        });
      }
    }

    console.log(`  ✓ Fase 3: automatizando ${po} con ${Object.keys(values).length} campos mapeados`);

    res.json({ ok: true, po, values, mappings: appliedMappings });
  } catch (err) {
    console.error("Error en /api/automate:", err);
    res.status(500).json({ error: "Error interno del servidor. Revisa la consola." });
  }
});

// ── Standard CRUD endpoints ───────────────────────────────────────────────────

app.get("/api/mappings", async (_req, res) => {
  res.json(await getLearnedMapping());
});

app.get("/api/orders", async (_req, res) => {
  res.json(await getOrders());
});

app.post("/api/orders", async (req, res) => {
  const order = req.body as PurchaseOrder;
  await saveOrder(order);
  res.status(201).json({ ok: true, order });
});

app.delete("/api/orders", async (_req, res) => {
  await clearOrders();
  res.json({ ok: true });
});

app.get("/api/audit", async (_req, res) => {
  res.json(await getAuditLog());
});

app.get("/api/test-ai", async (_req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.json({ ok: false, error: "GEMINI_API_KEY no configurada en .env" });
    return;
  }
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Responde solo con: OK",
    });
    res.json({ ok: true, provider: "gemini", respuesta: response.text?.trim() ?? "" });
  } catch (err) {
    res.json({ ok: false, error: (err as Error).message });
  }
});

app.listen(port, () => {
  console.log(`Always on Shelf destino listo: http://localhost:${port}`);
});