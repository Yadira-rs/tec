import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SorianaOrder } from "./soriana-orders.js";

const SORIANA_HTML_PATH = resolve("../soriana/soriana.html");

function readHTML(): string {
  return readFileSync(SORIANA_HTML_PATH, "utf-8");
}

// Equivalent of: card.querySelector('[data-field="X"]').textContent
function getField(cardHtml: string, field: string): string {
  const re = new RegExp(`data-field="${field}"[^>]*>([^<]*)`, "i");
  return (re.exec(cardHtml)?.[1] ?? "").trim();
}

// Convert DD/MM/YYYY → YYYY-MM-DD
function parseDate(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split("/");
  if (!d || !m || !y) return ddmmyyyy;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// Strip "$", "MXN", spaces  →  "14.50"
function cleanPrice(raw: string): string {
  return raw.replace(/\$|MXN/gi, "").trim();
}

// Strip non-numeric suffix  →  "200"
function cleanQty(raw: string): string {
  return raw.replace(/[^\d.]/g, "").trim();
}

// Split HTML into individual order-card sections (delimited by <!-- /order-NNN -->)
function extractOrderCards(html: string): string[] {
  const cards: string[] = [];
  const re = /(<div class="order-card"[\s\S]*?<!--\s*\/order-\d+\s*-->)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) cards.push(m[1]);
  return cards;
}

// Equivalent of: document.getElementById('order-NNN') → read all data-field elements
function cardToOrder(cardHtml: string): SorianaOrder | null {
  // PO number lives in <div class="po-number">
  const po = (/<div class="po-number">([^<]+)<\/div>/.exec(cardHtml)?.[1] ?? "").trim();
  if (!po) return null;

  return {
    PurchaseOrder:  getField(cardHtml, "PurchaseOrder")  || po,
    CustomerName:   getField(cardHtml, "CustomerName"),
    DeliveryDate:   parseDate(getField(cardHtml, "DeliveryDate")),
    SKUDescription: getField(cardHtml, "SKUDescription"),
    UnitPrice:      cleanPrice(getField(cardHtml, "UnitPrice")),
    RequestedQty:   cleanQty(getField(cardHtml, "RequestedQty")),
    OrderDetail:    getField(cardHtml, "OrderDetail"),
  };
}

export function readSorianaOrder(po: string): SorianaOrder | null {
  try {
    const cards = extractOrderCards(readHTML());
    for (const card of cards) {
      if (card.includes(po)) return cardToOrder(card);
    }
    return null;
  } catch {
    return null;
  }
}

export function readAllSorianaOrders(): SorianaOrder[] {
  try {
    return extractOrderCards(readHTML())
      .map(cardToOrder)
      .filter((o): o is SorianaOrder => o !== null);
  } catch {
    return [];
  }
}
