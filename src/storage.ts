import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AuditEvent, LearnedMapping, PurchaseOrder } from "./types.js";

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

export async function getLearnedMapping() {
  return readJson<LearnedMapping[]>(mappingPath, []);
}

export async function saveLearnedMapping(mapping: LearnedMapping[]) {
  await writeJson(mappingPath, mapping);
}

export async function getOrders() {
  return readJson<PurchaseOrder[]>(ordersPath, []);
}

export async function saveOrder(order: PurchaseOrder) {
  const orders = await getOrders();
  orders.unshift(order);
  await writeJson(ordersPath, orders);
}

export async function clearOrders() {
  await writeJson(ordersPath, []);
}

export async function appendAudit(event: Omit<AuditEvent, "at">) {
  const events = await readJson<AuditEvent[]>(auditPath, []);
  events.unshift({ ...event, at: new Date().toISOString() });
  await writeJson(auditPath, events);
}

export async function getAuditLog() {
  return readJson<AuditEvent[]>(auditPath, []);
}
