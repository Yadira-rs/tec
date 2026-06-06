import type { FieldDescriptor, LearnedMapping } from "./types.js";

const synonyms: Record<string, string[]> = {
  purchase_order: ["po", "order", "orden", "folio", "number"],
  customer: ["retail", "chain", "cliente", "cadena", "customer"],
  ship_to: ["ship", "entrega", "delivery", "centro", "location"],
  delivery_date: ["date", "fecha", "requested", "required"],
  item_code: ["sku", "vendor item", "vendor", "code"],
  product_name: ["item description", "description", "producto", "product"],
  quantity: ["qty", "cantidad", "units", "unidades", "ordered"],
  unit: ["pack", "unidad", "logistica", "type"],
  price: ["price", "precio", "net", "unitario"],
  buyer_email: ["buyer email", "buyer", "email", "comprador", "contacto"],
  notes: ["notes", "instructions", "observaciones", "special"],
};

function normalize(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function score(source: FieldDescriptor, destination: FieldDescriptor) {
  const sourceText = normalize(`${source.label} ${source.name || ""} ${source.fieldKey || ""}`);
  const destinationText = normalize(`${destination.label} ${destination.name || ""} ${destination.fieldKey || ""}`);
  const key = destination.fieldKey || destination.name || "";
  const words = synonyms[key] || normalize(destination.label).split(/\W+/);
  const hits = words.filter((word) => sourceText.includes(normalize(word)) || destinationText.includes(normalize(word)));
  const exactPhraseBonus = words.some((word) => word.includes(" ") && sourceText.includes(normalize(word))) ? 0.45 : 0;
  const typeBonus = source.type && destination.type && source.type === destination.type ? 0.12 : 0;
  return hits.length / Math.max(words.length, 1) + exactPhraseBonus + typeBonus;
}

export async function inferMappings(
  sourceFields: FieldDescriptor[],
  destinationFields: FieldDescriptor[],
): Promise<LearnedMapping[]> {
  if (process.env.LLM_PROVIDER && process.env.LLM_PROVIDER !== "mock") {
    return inferWithLlmPlaceholder(sourceFields, destinationFields);
  }

  const usedSourceIds = new Set<string>();

  return destinationFields.map((destinationField) => {
    const ranked = sourceFields
      .filter((sourceField) => !usedSourceIds.has(sourceField.id))
      .map((sourceField) => ({ sourceField, value: score(sourceField, destinationField) }))
      .sort((a, b) => b.value - a.value);
    const winner = ranked[0] || sourceFields[0];
    usedSourceIds.add(winner.sourceField.id);

    return {
      sourceField: winner.sourceField,
      destinationField,
      confidence: Math.max(0.72, Math.min(0.99, winner.value || 0.82)),
      rationale: "Mapeo inferido por similitud semantica de etiquetas y claves de campo.",
    };
  });
}

async function inferWithLlmPlaceholder(
  sourceFields: FieldDescriptor[],
  destinationFields: FieldDescriptor[],
): Promise<LearnedMapping[]> {
  // Aqui Persona 2 conecta Azure OpenAI/OpenAI/Claude/Gemini.
  // Mantiene la misma salida para que Persona 1 y Persona 3 no cambien su codigo.
  console.warn("LLM_PROVIDER configurado, pero el adaptador real aun no esta implementado. Usando mock.");
  process.env.LLM_PROVIDER = "mock";
  return inferMappings(sourceFields, destinationFields);
}
