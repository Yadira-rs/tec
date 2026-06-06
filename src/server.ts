import "dotenv/config";
import express from "express";
import path from "node:path";
import { clearOrders, getAuditLog, getLearnedMapping, getOrders, saveOrder } from "./storage.js";
import type { PurchaseOrder } from "./types.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const publicRoot = path.resolve(".");

app.use(express.json());
app.use(express.static(publicRoot, { extensions: ["html"] }));

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

app.listen(port, () => {
  console.log(`Always on Shelf destino listo: http://localhost:${port}`);
});
