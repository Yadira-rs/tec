import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AuditEvent, LearnedMapping, PurchaseOrder } from "./types.js";
import { connectDB } from "./db.js";
import { AuditModel, MappingModel, OrderModel } from "./models.js";

const dataDir = path.resolve("data");
const mappingPath = path.join(dataDir, "learned-mapping.json");
const ordersPath = path.join(dataDir, "orders.json");
const auditPath = path.join(dataDir, "audit-log.json");

async function ensureDataDir() {
  await mkdir(dataDir, { recursive: true });
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(filePath: string, value: unknown) {
  await ensureDataDir();
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

// ── Learned Mapping ──────────────────────────────────────────────────────────

export async function getLearnedMapping(): Promise<LearnedMapping[]> {
  if (await connectDB()) {
    const doc = await MappingModel.findOne().sort({ _id: -1 }).lean();
    return (doc?.mappings as LearnedMapping[]) ?? [];
  }
  return readJson<LearnedMapping[]>(mappingPath, []);
}

export async function saveLearnedMapping(mapping: LearnedMapping[]) {
  if (await connectDB()) {
    await MappingModel.deleteMany({});
    await MappingModel.create({ mappings: mapping, updatedAt: new Date().toISOString() });
    return;
  }
  await writeJson(mappingPath, mapping);
}

// ── Orders ───────────────────────────────────────────────────────────────────

export async function getOrders(): Promise<PurchaseOrder[]> {
  if (await connectDB()) {
    const docs = await OrderModel.find().sort({ _id: -1 }).limit(100).lean();
    return docs as unknown as PurchaseOrder[];
  }
  return readJson<PurchaseOrder[]>(ordersPath, []);
}

export async function saveOrder(order: PurchaseOrder) {
  if (await connectDB()) {
    await OrderModel.create({ ...order, savedAt: new Date().toISOString() });
    return;
  }
  const orders = await readJson<PurchaseOrder[]>(ordersPath, []);
  orders.unshift(order);
  await writeJson(ordersPath, orders);
}

export async function clearOrders() {
  if (await connectDB()) {
    await OrderModel.deleteMany({});
    return;
  }
  await writeJson(ordersPath, []);
}

// ── Audit Log ────────────────────────────────────────────────────────────────

export async function appendAudit(event: Omit<AuditEvent, "at">) {
  const full: AuditEvent = { ...event, at: new Date().toISOString() };
  if (await connectDB()) {
    await AuditModel.create(full);
    return;
  }
  const events = await readJson<AuditEvent[]>(auditPath, []);
  events.unshift(full);
  await writeJson(auditPath, events);
}

export async function getAuditLog(): Promise<AuditEvent[]> {
  if (await connectDB()) {
    const docs = await AuditModel.find().sort({ _id: -1 }).limit(200).lean();
    return docs as unknown as AuditEvent[];
  }
  return readJson<AuditEvent[]>(auditPath, []);
}