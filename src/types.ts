export type FieldDescriptor = {
  id: string;
  label: string;
  name?: string;
  fieldKey?: string;
  type?: string;
  required?: boolean;
  sampleValue?: string;
};

export type LearnedMapping = {
  sourceField: FieldDescriptor;
  destinationField: FieldDescriptor;
  confidence: number;
  rationale: string;
};

export type PurchaseOrder = {
  internalOrderId: string;
  retailerName: string;
  deliveryCenter: string;
  requiredDate: string;
  internalSku: string;
  productDescription: string;
  requestedUnits: string;
  logisticUnit: string;
  unitPrice: string;
  buyerContact: string;
  fulfillmentNotes: string;
};

export type AuditEvent = {
  at: string;
  actor: "browser-worker" | "inference-service" | "orchestrator" | "destination-system";
  action: string;
  details: Record<string, unknown>;
};
