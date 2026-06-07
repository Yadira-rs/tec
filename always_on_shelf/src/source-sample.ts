import type { FieldDescriptor, PurchaseOrder } from "./types.js";

export const observedSourceFields: FieldDescriptor[] = [
  { id: "source-po-number", label: "PO Number", name: "poNumber", fieldKey: "po" },
  { id: "source-retail-chain", label: "Retail Chain", name: "retailChain" },
  { id: "source-ship-to", label: "Ship To Location", name: "shipToLocation" },
  { id: "source-requested-delivery", label: "Requested Delivery", name: "requestedDelivery", type: "date" },
  { id: "source-vendor-item", label: "Vendor Item", name: "vendorItem" },
  { id: "source-item-description", label: "Item Description", name: "itemDescription" },
  { id: "source-ordered-qty", label: "Ordered Qty", name: "orderedQty", type: "number" },
  { id: "source-pack-type", label: "Pack Type", name: "packType" },
  { id: "source-net-price", label: "Net Price", name: "netPrice", type: "number" },
  { id: "source-buyer-email", label: "Buyer Email", name: "buyerEmail", type: "email" },
  { id: "source-special-instructions", label: "Special Instructions", name: "specialInstructions" },
];

export const newSourceOrder: Record<string, string> = {
  poNumber: "PO-991827",
  retailChain: "Walmart",
  shipToLocation: "CEDIS Santa Catarina",
  requestedDelivery: "2026-06-12",
  vendorItem: "AC-SPR355-12",
  itemDescription: "Sprite 355 ml lata paquete 12",
  orderedQty: "240",
  packType: "Caja",
  netPrice: "118.90",
  buyerEmail: "buyer.walmart@example.com",
  specialInstructions: "Recibo nocturno. Adjuntar cita de entrega.",
};

export function mapSourceOrderToDestination(
  sourceOrder: Record<string, string>,
  fieldNameByDestination: Record<keyof PurchaseOrder, string>,
): PurchaseOrder {
  return {
    internalOrderId: sourceOrder[fieldNameByDestination.internalOrderId] || "",
    retailerName: sourceOrder[fieldNameByDestination.retailerName] || "",
    deliveryCenter: sourceOrder[fieldNameByDestination.deliveryCenter] || "",
    requiredDate: sourceOrder[fieldNameByDestination.requiredDate] || "",
    internalSku: sourceOrder[fieldNameByDestination.internalSku] || "",
    productDescription: sourceOrder[fieldNameByDestination.productDescription] || "",
    requestedUnits: sourceOrder[fieldNameByDestination.requestedUnits] || "",
    logisticUnit: sourceOrder[fieldNameByDestination.logisticUnit] || "",
    unitPrice: sourceOrder[fieldNameByDestination.unitPrice] || "",
    buyerContact: sourceOrder[fieldNameByDestination.buyerContact] || "",
    fulfillmentNotes: sourceOrder[fieldNameByDestination.fulfillmentNotes] || "",
  };
}
