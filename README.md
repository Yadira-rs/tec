# Always on Shelf - Integracion de las 4 personas

Stack base: TypeScript + Node.js + Playwright.

Esta carpeta contiene el sistema destino visible de Persona 3 y un esqueleto integrador para conectar las 4 partes del reto.

## Como correr

1. Instalar dependencias:

```bash
npm install
```

2. Levantar el sistema destino:

```bash
npm run dev
```

3. Abrir:

```txt
http://localhost:3000/index.html
```

4. En otra terminal, correr el flujo automatizado:

```bash
npm run demo
```

## Responsabilidades por persona

### Persona 1 - Agente / Browser automation

Archivo principal:

```txt
src/demo-runner.ts
src/field-extractor.ts
```

Que conecta:

- Abre el sistema destino con Playwright.
- Extrae campos reales del DOM.
- Llena el formulario destino con datos nuevos.
- Guarda evidencia en `data/audit-log.json`.

Siguiente paso para Persona 1:

- Reemplazar `observedSourceFields` por campos extraidos de un sistema origen real.
- Agregar navegacion al portal origen antes de llenar destino.

### Persona 2 - IA / Mapeo

Archivo principal:

```txt
src/inference-service.ts
```

Que conecta:

- Recibe campos origen y campos destino.
- Devuelve correspondencias con confianza y explicacion.
- Hoy corre en modo `mock` para demo sin API key.

Siguiente paso para Persona 2:

- Implementar `inferWithLlmPlaceholder` con Azure OpenAI, OpenAI, Claude o Gemini.
- Mantener la misma salida `LearnedMapping[]` para no romper a Persona 1 ni Persona 3.

### Persona 3 - Sistema destino

Archivos principales:

```txt
index.html
styles.css
script.js
src/server.ts
```

Que conecta:

- Formulario HTML en localhost.
- Tabla visible de campos aprendidos.
- Tabla de ordenes registradas.
- API minima en `/api/orders`, `/api/mappings` y `/api/audit`.

Siguiente paso para Persona 3:

- Mantener los atributos `name`, `data-field-key` y `data-testid`.
- Ajustar textos visuales si quieren que se vea mas alineado a su pitch.

### Persona 4 - Demo / QA

Archivos principales:

```txt
persona3-guion.md
README.md
data/audit-log.json
data/learned-mapping.json
```

Que conecta:

- Guion para explicar aprendizaje, no hardcoding.
- Evidencia generada por el flujo.
- Datos nuevos para probar replicabilidad.

Siguiente paso para Persona 4:

- Ensayar ciclo completo: observar, mapear, ejecutar, mostrar tabla final.
- Tener capturas o video por si falla el demo en vivo.

## Arquitectura productiva propuesta

Para hackathon, esta version usa archivos JSON locales en `data/`.

Para produccion:

- Orquestador: Redis o RabbitMQ.
- Workers: contenedores Node.js con Playwright.
- Servicio de inferencia: microservicio con LLM y cache.
- Persistencia: PostgreSQL para mapeos, ejecuciones y auditoria.
- Secrets: Azure Key Vault, AWS Secrets Manager o Vault.
- Observabilidad: Prometheus + Grafana.

## Variables de entorno

Copia `.env.example` a `.env` cuando quieran conectar proveedor real.

```txt
PORT=3000
LLM_PROVIDER=mock
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```
