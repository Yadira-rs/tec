import { GoogleGenAI } from "@google/genai";
import { AzureOpenAI } from "openai";
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
  first_name: ["first", "firstname", "nombre", "primer"],
  last_name: ["last", "lastname", "apellido", "surname"],
  zipcode: ["zip", "postal", "postalcode", "codigo"],
  address1: ["address", "direccion", "calle"],
  mobile_number: ["mobile", "phone", "telefono", "celular", "movil"],
  city: ["city", "ciudad"],
  state: ["state", "estado"],
  country: ["country", "pais"],
  company: ["company", "empresa"],
  password: ["password", "contrasena", "pass"],
  name: ["name", "nombre", "full", "fullname"],
};

function normalize(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
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

// Mapeo semántico con Azure OpenAI (GPT-4o / GPT-3.5 Turbo para estudiantes).
async function inferWithAzureOpenAI(
  sourceFields: FieldDescriptor[],
  destinationFields: FieldDescriptor[],
): Promise<LearnedMapping[]> {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o";
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-05-01-preview";

  if (!apiKey || !endpoint) {
    console.warn("Azure OpenAI no configurado. Usando modo heurístico.");
    return heuristicMappings(sourceFields, destinationFields);
  }

  const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });

  const userPrompt = `Eres un agente experto en RPA Cognitivo. Empareja campos de dos sistemas web.

CAMPOS DEL SISTEMA ORIGEN:
${sourceFields.map((f) => `- id: ${f.id}, label: "${f.label}", name: "${f.name ?? ""}"`).join("\n")}

CAMPOS DEL SISTEMA DESTINO:
${destinationFields.map((f) => `- id: ${f.id}, label: "${f.label}", name: "${f.name ?? ""}"`).join("\n")}

Responde ÚNICAMENTE con un JSON válido con esta estructura:
{
  "mappings": [
    { "sourceId": "id del campo origen", "destinationId": "id del campo destino", "confidence": 0.95, "rationale": "razón breve" }
  ]
}`;

  try {
    const response = await client.chat.completions.create({
      model: deployment,
      messages: [{ role: "user", content: userPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const text = response.choices[0]?.message?.content ?? '{"mappings":[]}';
    const parsed = JSON.parse(text) as {
      mappings: Array<{ sourceId: string; destinationId: string; confidence: number; rationale: string }>;
    };

    console.log(`  ✓ Azure OpenAI respondió con ${parsed.mappings.length} mapeos`);

    return parsed.mappings.flatMap((item) => {
      const sourceField = sourceFields.find((f) => f.id === item.sourceId);
      const destField = destinationFields.find((f) => f.id === item.destinationId);
      if (!sourceField || !destField) return [];
      return [{ sourceField, destinationField: destField, confidence: item.confidence, rationale: item.rationale }];
    });
  } catch (err) {
    console.warn("Error llamando a Azure OpenAI, usando modo heurístico.", (err as Error).message);
    return heuristicMappings(sourceFields, destinationFields);
  }
}

// Mapeo semántico con Gemini 2.5 Flash.
async function inferWithGemini(
  sourceFields: FieldDescriptor[],
  destinationFields: FieldDescriptor[],
): Promise<LearnedMapping[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY no configurada. Usando modo heurístico.");
    return heuristicMappings(sourceFields, destinationFields);
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Eres un agente de Inteligencia Artificial experto en RPA Cognitivo.
Tu objetivo es analizar la estructura de dos sistemas web y emparejar los campos del sistema origen con los del destino.

CAMPOS DEL SISTEMA ORIGEN:
${sourceFields.map((f) => `- id: ${f.id}, label: "${f.label}", name: "${f.name ?? ""}"`).join("\n")}

CAMPOS DEL SISTEMA DESTINO:
${destinationFields.map((f) => `- id: ${f.id}, label: "${f.label}", name: "${f.name ?? ""}"`).join("\n")}

TAREA:
1. Analiza el significado semántico de cada campo (ej. "price" equivale a "precio").
2. Identifica qué campo del origen corresponde a qué campo del destino.

Responde ÚNICAMENTE con un array JSON, sin texto adicional:
[
  {
    "sourceId": "id del campo origen",
    "destinationId": "id del campo destino",
    "confidence": 0.95,
    "rationale": "razón breve del mapeo"
  }
]`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const text = response.text ?? "";
    const parsed = JSON.parse(text) as Array<{
      sourceId: string;
      destinationId: string;
      confidence: number;
      rationale: string;
    }>;

    return parsed.flatMap((item) => {
      const sourceField = sourceFields.find((f) => f.id === item.sourceId);
      const destField = destinationFields.find((f) => f.id === item.destinationId);
      if (!sourceField || !destField) return [];
      return [{ sourceField, destinationField: destField, confidence: item.confidence, rationale: item.rationale }];
    });
  } catch (err) {
    console.warn("Error llamando a Gemini, usando modo heurístico.", err);
    return heuristicMappings(sourceFields, destinationFields);
  }
}

function heuristicMappings(
  sourceFields: FieldDescriptor[],
  destinationFields: FieldDescriptor[],
): LearnedMapping[] {
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

export async function inferMappings(
  sourceFields: FieldDescriptor[],
  destinationFields: FieldDescriptor[],
): Promise<LearnedMapping[]> {
  if (process.env.LLM_PROVIDER === "azure-openai") {
    return inferWithAzureOpenAI(sourceFields, destinationFields);
  }
  if (process.env.LLM_PROVIDER === "gemini") {
    return inferWithGemini(sourceFields, destinationFields);
  }
  return heuristicMappings(sourceFields, destinationFields);
}

// Aprende el mapeo comparando los valores observados en ambos sistemas.
// Si el mismo valor aparece en campo A del origen y campo B del destino → esos campos corresponden.
export async function inferMappingsByValues(
  sourceObserved: Record<string, string>,
  destObserved: Record<string, string>,
  sourceFields: FieldDescriptor[],
  destFields: FieldDescriptor[],
): Promise<LearnedMapping[]> {
  const mappings: LearnedMapping[] = [];
  const usedDestKeys = new Set<string>();

  for (const [sourceKey, sourceValue] of Object.entries(sourceObserved)) {
    if (!sourceValue.trim()) continue;

    const sourceField: FieldDescriptor =
      sourceFields.find((f) => f.name === sourceKey || f.id === `source-${sourceKey}`) ??
      { id: `source-${sourceKey}`, label: sourceKey, name: sourceKey };

    for (const [destKey, destValue] of Object.entries(destObserved)) {
      if (usedDestKeys.has(destKey)) continue;
      if (sourceValue.trim().toLowerCase() === destValue.trim().toLowerCase()) {
        const destField: FieldDescriptor =
          destFields.find((f) => f.name === destKey || f.id === `destination-${destKey}`) ??
          { id: `dest-${destKey}`, label: destKey, name: destKey };

        mappings.push({
          sourceField,
          destinationField: destField,
          confidence: 0.97,
          rationale: `Valor "${sourceValue}" observado en origen[${sourceKey}] coincide con destino[${destKey}]`,
        });
        usedDestKeys.add(destKey);
        break;
      }
    }
  }

  return mappings;
}