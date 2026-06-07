# Persona 3 - Sistema destino

## Objetivo

Construir el segundo sistema web donde el agente registra la informacion despues de observar el sistema origen. Este sistema debe ser visible para el jurado y debe mostrar dos evidencias: el formulario destino y la tabla de campos aprendidos.

## Que ya incluye la demo

- Formulario HTML de registro interno de ordenes con 11 campos.
- Nombres de campos distintos a los del origen para demostrar que no es hardcoding.
- Tabla "Campos aprendidos" con origen observado, destino aprendido y confianza.
- Tabla "Ordenes registradas" para mostrar el resultado final de la automatizacion.
- Botones para cargar datos de ejemplo, simular mapeo IA, limpiar formulario y borrar registros.
- Atributos `data-testid` y `data-field-key` para que Persona 1 pueda automatizarlo con Playwright.

## Campos destino recomendados

| Campo origen observado | Campo destino en la demo |
|---|---|
| PO Number | Numero de orden interno |
| Retail Chain | Cliente / cadena |
| Ship To Location | Centro de entrega |
| Requested Delivery | Fecha requerida |
| Vendor Item | SKU interno |
| Item Description | Producto |
| Ordered Qty | Unidades solicitadas |
| Pack Type | Unidad logistica |
| Net Price | Precio unitario acordado |
| Buyer Email | Contacto comprador |
| Special Instructions | Observaciones de surtido |

## Como defenderlo ante jurado

"Mi parte es el sistema destino. Lo construimos como un portal interno de registro de ordenes. La parte importante no es solo capturar datos, sino hacer visible lo que el agente aprendio: aqui se ve el mapeo entre los campos del sistema origen y los campos del destino. Como los nombres no son iguales, el agente necesita inferir correspondencias, por ejemplo `Ordered Qty` con `Unidades solicitadas` o `Vendor Item` con `SKU interno`. Despues, cuando corremos una orden nueva, la tabla de ordenes registradas demuestra que la automatizacion completo el flujo."

## Checklist para el demo

- Abrir `index.html` o levantar localhost.
- Dar clic en "Simular mapeo IA" para explicar la evidencia de aprendizaje.
- Ejecutar el agente de Persona 1 para llenar el formulario con datos nuevos.
- Guardar el registro y mostrar la tabla "Ordenes registradas".
- Cambiar datos de la orden y repetir para probar replicabilidad.
