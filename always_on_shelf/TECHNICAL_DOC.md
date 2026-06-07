# ARIA — Documento Técnico

**Always on Shelf · Hack4Her 2026**

---

## ¿Qué es ARIA?

ARIA (Automatización con IA para Registro de Órdenes) es un agente inteligente que aprende a automatizar el traspaso de datos entre dos sistemas web observando cómo un usuario lo hace manualmente una sola vez. Elimina la captura manual de órdenes de compra entre portales externos de clientes (Soriana, SauceDemo) y el sistema interno de Arca Continental.

---

## Stack Tecnológico

### Frontend

| Tecnología           | Versión | Uso                                               |
| -------------------- | ------- | ------------------------------------------------- |
| HTML5                | —       | Estructura de la interfaz de 3 paneles            |
| CSS3                 | —       | Sistema de diseño propio con variables CSS        |
| JavaScript           | ES2020+ | Lógica del cliente, máquina de estados de 3 fases |
| Google Fonts (Inter) | —       | Tipografía                                        |

Sin frameworks de frontend (React, Vue, etc.) — decisión intencional para maximizar transparencia del flujo ante el jurado.

### Backend

| Tecnología | Versión | Uso                                           |
| ---------- | ------- | --------------------------------------------- |
| Node.js    | ≥ 20    | Runtime del servidor                          |
| TypeScript | ^5.4.5  | Tipado estático en todo el backend            |
| Express    | ^4.19.2 | Servidor HTTP y API REST                      |
| tsx        | ^4.15.7 | Ejecución directa de TypeScript en desarrollo |

### Base de Datos

| Tecnología               | Versión | Uso                                                    |
| ------------------------ | ------- | ------------------------------------------------------ |
| MongoDB Atlas            | —       | Persistencia de órdenes y mapeos aprendidos en la nube |
| Mongoose                 | ^9.6.3  | ODM para modelado de datos en MongoDB                  |
| JSON local (fs/promises) | —       | Fallback automático cuando MongoDB no está disponible  |

---

## Bibliotecas y Dependencias

```json
{
  "@google/genai": "^2.8.0",
  "openai": "^6.42.0",
  "mongoose": "^9.6.3",
  "express": "^4.19.2",
  "dotenv": "^16.4.5",
  "typescript": "^5.4.5",
  "tsx": "^4.15.7",
  "@playwright/test": "^1.44.0"
}
```

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                        NAVEGADOR                            │
│                                                             │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ Panel Origen │  │  Agente de Mapeo │  │ Panel Destino│  │
│  │  (Soriana /  │  │   (IA Central)   │  │ (Form Arca   │  │
│  │  SauceDemo)  │  │                  │  │ Continental) │  │
│  └──────┬───────┘  └────────┬─────────┘  └──────┬───────┘  │
└─────────┼────────────────── │ ──────────────────┼──────────┘
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   SERVIDOR EXPRESS (Node.js)                 │
│                                                             │
│  GET /api/soriana-order/:po    →  Datos del sistema origen  │
│  POST /api/learn               →  Motor de inferencia + IA  │
│  GET /api/automate/:po         →  Automatización Fase 3     │
│  POST /api/orders              →  Guardar orden procesada   │
│  GET /api/mappings             →  Recuperar mapeo aprendido │
└──────────────┬──────────────────────────┬───────────────────┘
               │                          │
               ▼                          ▼
   ┌───────────────────┐      ┌───────────────────────┐
   │  Gemini 2.5 Flash │      │    MongoDB Atlas       │
   │  (Azure OpenAI)   │      │  · Colección orders    │
   │                   │      │  · Colección mappings  │
   │  Inferencia       │      │  · Colección audit     │
   │  semántica de     │      └───────────────────────┘
   │  campos           │
   └───────────────────┘
```

---

## Cómo Funciona el Motor de IA

El sistema de aprendizaje opera en dos capas sin reglas hardcodeadas:

### Capa 1 — Aprendizaje por observación de valores

```
Origen:  CustomerName = "Soriana Cumbres"
                              ↓
         El agente detecta que el usuario escribió
         "Soriana Cumbres" en el campo nombre_empresa
                              ↓
         Aprende: CustomerName → nombre_empresa
         Confianza: 97%  |  Método: 👁 Observación
```

No usa nombres de campos — solo compara valores. Si el campo destino se renombra, el mapeo sigue funcionando.

### Capa 2 — Inferencia semántica con IA

Para campos donde los valores no son idénticos (ej. fechas en formatos distintos), el sistema envía los descriptores de ambos sistemas a Gemini:

```
Prompt a Gemini:
  ORIGEN: DeliveryDate, RequestedQty, OrderDetail ...
  DESTINO: fecha_entrega, cant_solicitada, detalle_producto ...
  → Empareja por significado semántico, no por nombre literal.

Respuesta:
  DeliveryDate    → fecha_entrega    (95% confianza)
  RequestedQty    → cant_solicitada  (93% confianza)
  OrderDetail     → detalle_producto (91% confianza)
```

### Fallback léxico

Si ninguna API de IA está disponible, activa un algoritmo de similitud de tokens entre etiquetas como último recurso.

---

## Flujo de las 3 Fases

```
FASE 1 — CONEXIÓN
  Usuario selecciona una orden → Sistema se conecta al portal origen
  Estado: iframe del portal visible + indicador "Conectado"

FASE 2 — OBSERVACIÓN (ocurre UNA vez por cliente)
  Usuario llena el formulario destino manualmente
  El agente:
    1. Compara valores origen vs. destino → Capa 1
    2. Infiere campos faltantes con Gemini → Capa 2
    3. Persiste el mapeo en MongoDB
  Resultado: tabla de mapeos con confianza por campo

FASE 3 — AUTOMATIZACIÓN (todas las órdenes siguientes)
  Usuario selecciona cualquier orden nueva
  El agente:
    1. Lee datos del portal origen
    2. Aplica el mapeo aprendido
    3. Llena el formulario destino animadamente (visible al usuario)
    4. Guarda la orden automáticamente
  Sin intervención humana.
```

---

## Sistemas Origen Soportados

| Sistema        | Campos                                                                                                        | Idioma              |
| -------------- | ------------------------------------------------------------------------------------------------------------- | ------------------- |
| Portal Soriana | `CustomerName`, `PurchaseOrder`, `SKUDescription`, `UnitPrice`, `RequestedQty`, `DeliveryDate`, `OrderDetail` | Inglés (PascalCase) |
| SauceDemo.com  | `customer`, `order_ref`, `product_name`, `price`, `quantity`, `delivery_date`, `description`, `category`      | Inglés (snake_case) |

El motor de inferencia aprende cualquiera de los dos sin modificación de código.

---

## Modelos de Datos (MongoDB)

### Colección `orders`

```typescript
{
  nombre_empresa: String,   // campo destino (antes: cliente)
  folio_orden: String,
  nombre_articulo: String,
  precio_venta: String,
  cant_solicitada: String,
  fecha_entrega: String,
  detalle_producto: String,
  savedAt: String,          // ISO timestamp
  method: "manual" | "automated"
}
```

### Colección `mappings`

```typescript
{
  mappings: [{
    sourceField: { id, label, name },
    destinationField: { id, label, name },
    confidence: Number,       // 0.0 – 1.0
    rationale: String         // explicación del mapeo
  }],
  updatedAt: String
}
```

---

## Variables de Entorno Requeridas

```env
PORT=3000
GEMINI_API_KEY=...          # Google AI Studio
AZURE_OPENAI_API_KEY=...    # Azure OpenAI (opcional, proveedor primario)
AZURE_OPENAI_ENDPOINT=...
MONGODB_URI=...             # MongoDB Atlas connection string
```

---

## Comandos de Desarrollo

```bash
npm run dev      # Servidor en modo desarrollo (tsx, hot reload)
npm run build    # Compilar TypeScript → dist/
npm start        # Servidor en producción (dist/server.js)
```

---

## Prueba de No Hardcoding

El campo `nombre_empresa` en el formulario destino y el campo `CustomerName` en el sistema origen tienen nombres completamente distintos en idiomas distintos. El agente los mapea correctamente porque compara **valores**, no nombres de campos.

Para verificarlo en vivo: cambiar el `name` del campo en el HTML a cualquier otro string arbitrario — el agente lo sigue mapeando en la siguiente observación.

---

_Desarrollado para Hack4Her 2026 · Arca Continental · Reto Always on Shelf_
