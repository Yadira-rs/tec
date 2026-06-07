import { mongoose } from "./db.js";

const { Schema, model, models } = mongoose;

const orderSchema = new Schema({
  internalOrderId: String,
  retailerName: String,
  deliveryCenter: String,
  requiredDate: String,
  internalSku: String,
  productDescription: String,
  requestedUnits: String,
  logisticUnit: String,
  unitPrice: String,
  buyerContact: String,
  fulfillmentNotes: String,
  // Arca form fields
  cliente: String,
  folio_orden: String,
  nombre_articulo: String,
  precio_venta: String,
  cant_solicitada: String,
  fecha_entrega: String,
  detalle_producto: String,
  savedAt: { type: String, default: () => new Date().toISOString() },
}, { strict: false }); // strict:false allows any extra fields

const mappingSchema = new Schema({
  mappings: { type: Schema.Types.Mixed, default: [] },
  updatedAt: { type: String, default: () => new Date().toISOString() },
});

const auditSchema = new Schema({
  at: String,
  actor: String,
  action: String,
  details: { type: Schema.Types.Mixed },
});

export const OrderModel = models.Order ?? model("Order", orderSchema);
export const MappingModel = models.Mapping ?? model("Mapping", mappingSchema);
export const AuditModel = models.Audit ?? model("Audit", auditSchema);