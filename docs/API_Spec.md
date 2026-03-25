# 📄 ESPECIFICACIÓN DEL CONTRATO API REST (v1.0)

**Proyecto:** Sistema de Inteligencia Documental (Axum HTTP Server)
**Propósito:** Definir las interfaces de comunicación exacta entre el Frontend (Next.js) y el Backend (Rust/Axum) para los Nodos Followers y el Nodo Maestro.

---

## 1. Convenciones Globales

* **Base URL:** `http://<IP_DEL_MAESTRO>:8080/api/v1`
* **Formato de Intercambio:** `application/json`
* **Autenticación:** Vía header HTTP `Authorization: Bearer <JWT_TOKEN>`. Requerido en todos los endpoints excepto `/auth/login`.
* **Estructura Estándar de Errores (4xx y 5xx):**
```json
{
  "error": true,
  "codigo": "UNAUTHORIZED",
  "mensaje": "Token expirado o inválido",
  "detalles": null
}
```

---

## 2. Autenticación e Identidad

### `POST /auth/login`
Genera el token de sesión para los usuarios de la oficina. No requiere contraseña compleja; asume un modelo de amenaza de confianza interna.

* **Request Body:**
```json
{
  "usuario_id": "uuid-del-usuario-seleccionado"
}
```
* **Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expira_en": 28800, 
  "usuario": {
    "id": "uuid-del-usuario",
    "nombre": "Ana Legal",
    "rol": "OPERADOR"
  }
}
```

---

## 3. Gestión de Trámites y Documentos

*Nota Arquitectónica: La ingesta de nuevos documentos no tiene un endpoint HTTP. Se realiza exclusivamente en el Nodo Maestro vía comandos IPC asíncronos de Tauri, garantizando que solo la PC con el i7 y el escáner pueda inyectar datos pesados.*

### `GET /tramites`
Obtiene la lista del tablero principal (Kanban). Soporta filtros por query string.
* **Query Params:** `?status=PENDIENTE&assignee_id=<uuid>`
* **Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid-del-tramite",
      "folio": "OF-2026-045",
      "status": "PENDIENTE",
      "fecha_ingreso": "2026-03-25T10:30:00Z",
      "remitente": "Secretaría General",
      "asunto": "Revisión de Presupuesto Anual",
      "asignado_a": {
        "id": "uuid-de-ana",
        "nombre": "Ana Legal"
      }
    }
  ],
  "meta": { "total": 1, "page": 1 }
}
```

### `GET /tramites/:id`
Obtiene el detalle completo de un oficio, incluyendo el JSON estructurado extraído por la Inteligencia Artificial (olmOCR) página por página, y su historial de auditoría.

* **Response (200 OK):**
```json
{
  "id": "uuid-del-tramite",
  "folio": "OF-2026-045",
  "status": "PENDIENTE",
  "documento": {
    "id": "uuid-del-documento",
    "paginas": [
      {
        "numero": 1,
        "datos_extraidos": {
           "remitente": "Secretaría General",
           "fecha_oficio": "24/03/2026",
           "instruccion_principal": "Revisar y aprobar los anexos adjuntos."
        }
      }
    ]
  },
  "audit_log": [
    {
      "fecha": "2026-03-25T10:31:00Z",
      "accion": "El sistema asignó el trámite a Ana Legal"
    }
  ]
}
```

### `PATCH /tramites/:id/status`
Avanza el flujo de trabajo del documento. Dispara un insert automático en la tabla `AUDIT_LOG` a nivel de base de datos.

* **Request Body:**
```json
{
  "nuevo_status": "EN_PROCESO",
  "comentario": "Iniciando revisión de anexos."
}
```
* **Response (200 OK):**
```json
{
  "success": true,
  "status_actual": "EN_PROCESO"
}
```

---

## 4. Motor de Búsqueda Semántica (FTS5)

### `GET /documentos/search`
Aprovecha la tabla virtual FTS5 de SQLite para buscar instantáneamente sobre el contenido extraído de todas las páginas de todos los oficios.

* **Query Params:** `?q=presupuesto AND urgencia`
* **Response (200 OK):**
```json
{
  "resultados": [
    {
      "documento_id": "uuid-del-documento",
      "tramite_folio": "OF-2026-045",
      "pagina_match": 1,
      "snippet": "...se solicita la revisión del <b>presupuesto</b> con suma <b>urgencia</b> para el periodo..."
    }
  ],
  "tiempo_ejecucion_ms": 12
}
```

---

## 5. Streaming de Archivos Físicos

### `GET /pdfs/:documento_id`
Sirve el archivo PDF original de forma asíncrona mediante streaming. No requiere JSON en el response; devuelve el buffer binario directo.

* **Headers de Respuesta Esperados:**
    * `Content-Type: application/pdf`
    * `Content-Disposition: inline; filename="OF-2026-045.pdf"`
    * `Transfer-Encoding: chunked` (Asegura que Axum no cargue el archivo completo en la RAM del i7).

---
