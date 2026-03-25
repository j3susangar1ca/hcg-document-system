Esta especificación define cómo la interfaz de **Next.js + Fluent UI v9** debe reaccionar ante la lógica del backend y el hardware del Nodo Maestro. Dado que el procesamiento de IA en un **i7-9700** es lento, la UI debe ser "honesta" con el usuario, proporcionando feedback constante para evitar la sensación de congelamiento.

---

## 1. Guía de Estilos y Tokens Visuales (Fluent Design)

Utilizaremos la paleta semántica de Microsoft para mantener la coherencia con Windows 11 y una estética profesional en Fedora.

| Estado | Color (Hex) | Token Fluent UI | Significado |
| :--- | :--- | :--- | :--- |
| **Principal** | `#0078D4` | `colorCompoundBrandStroke` | Acciones primarias y acentos. |
| **Urgente** | `#C42B1C` | `colorPaletteRedBackground3` | Trámites vencidos o errores críticos. |
| **En Proceso** | `#0067C0` | `colorNeutralForeground2BrandSelected` | IA procesando o trámite activo. |
| **Completado** | `#107C10` | `colorPaletteGreenForeground1` | Oficio respondido y archivado. |
| **Fondo (Mica)** | `#F3F3F3` | `colorNeutralBackground2` | Transparencia con desenfoque (80% opacidad). |

---

## 2. Máquina de Estados de la Interfaz (UX States)

### 2.1. Estado de Ingesta (El Pipeline de Espera)
Debido a la latencia de **olmOCR** en CPU (~40s por página), el componente de registro debe implementar un **Progress Stepper** dinámico.

* **Estado: Idle:** Botón de "Subir" activo. Zona de *Drag & Drop* con borde punteado sutil.
* **Estado: Rasterizing:** Spinner de carga con el texto: *"Dividiendo PDF en páginas..."*.
* **Estado: Processing (Loop):** Barra de progreso realimentada por eventos IPC/Websocket.
    * *Visual:* Se muestra una miniatura borrosa de la página actual siendo analizada.
    * *Texto:* "Analizando página 2 de 5 (Inferencia VLM)..."
* **Estado: Success:** Sonido sutil de sistema y despliegue del formulario con animación *Slide-down*.

### 2.2. Estado de Conectividad (Nodos Followers)
Como los seguidores dependen de la IP del Maestro, la UI debe manejar la pérdida de red.
* **Heartbeat Fail:** Si el `fetch()` falla o el socket se cierra, la app muestra un `Overlay` traslúcido sobre toda la pantalla.
* **Mensaje:** *"Sin conexión con el Nodo Maestro (192.168.1.XX). Reintentando..."*.
* **Acción:** Bloqueo de botones de edición para evitar desincronización.

---

## 3. Componentes UI Críticos

### 3.1. El Visor de Documentos (Canvas-Based)
Para no saturar los **64 GB de RAM** con imágenes pesadas en el navegador:
* **Virtualización:** Solo se renderiza en el DOM la página que el usuario está viendo.
* **Lazy Loading:** Las páginas no visibles se cargan como miniaturas de baja resolución hasta que el usuario hace scroll hacia ellas.

### 3.2. Tarjetas del Dashboard (Kanban Cards)
Componentes de alta densidad informativa.
* **Header:** Folio del oficio + Etiqueta de Prioridad.
* **Body:** Resumen de 2 líneas generado por la IA (truncado con elipses).
* **Footer:** Avatar del responsable + Fecha de vencimiento relativa (ej. "Vence en 2h").

### 3.3. Buscador Global (Command Bar)
Ubicado en la parte superior, estilo Spotlight.
* **Interacción:** `Ctrl + K` para abrir.
* **Resultados FTS5:** Muestra el "Snippet" (fragmento de texto) donde hubo coincidencia, resaltando las palabras en negrita.

---

## 4. Gestión de Errores y Fallbacks

| Escenario | Componente Visual | Acción de Usuario |
| :--- | :--- | :--- |
| **Error OCR/IA** | `MessageBar` tipo Error | "Reintentar solo esta página" o "Cargar texto manual". |
| **Búsqueda sin resultados** | `EmptyState` con ilustración sutil | "Intentar con menos palabras clave". |
| **Sesión Expirada (JWT)** | `Dialog` (Modal) de Re-autenticación | Seleccionar usuario para renovar token. |
| **PDF no encontrado** | `Skeleton` de carga infinito | "Verificar que el Nodo Maestro esté encendido". |

---

## 5. Diseño de Navegación (App Shell)

* **Sidebar (Izquierda):** Colapsable. Iconos para: Dashboard, Registro, Biblioteca, SII, Configuración.
* **Main Content (Centro):** Área con *Padding* generoso (24px) para evitar fatiga visual.
* **Right Panel (Contextual):** Solo aparece al seleccionar un trámite. Contiene el historial de auditoría y el botón de "Cerrar Trámite".

---
