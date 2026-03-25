# 🏛️ DOCUMENTO DE DISEÑO DE ARQUITECTURA (ADD)

**Proyecto:** Sistema de Inteligencia Documental y Gestión de Flujos de Trabajo (BPM/ECM) Local-First.
**Clasificación:** Especificación Técnica Maestra / Ingeniería de Sistemas.

---

## 1. Visión Sistémica y Topología de Red

El sistema es una plataforma de digitalización, extracción semántica y gestión de flujos de trabajo diseñada para operar en un entorno de red local (LAN) estrictamente *Air-Gapped* (sin dependencia de la nube). 

La arquitectura adopta un modelo **Híbrido Centralizado (Leader-Zero-Install Followers)** optimizado para una oficina de 5 usuarios.

* **El Nodo Maestro (Leader):** Se ejecuta en una estación de trabajo de alto rendimiento (Intel i7-9700, 64 GiB RAM). Opera como una aplicación de escritorio nativa (Tauri). Es el único nodo con acceso físico al escáner, cámara documental, base de datos SQLite y al motor de Inteligencia Artificial.
* **Los Nodos Secundarios (Followers):** Operan bajo un paradigma **Zero-Install**. Las 4 computadoras restantes de la oficina no requieren instalación de software. Acceden al sistema a través de un navegador web estándar (Chrome/Edge) apuntando a la IP del Nodo Maestro. 
* **El Puente de Red:** El binario de Tauri en el Nodo Maestro embebe un servidor HTTP asíncrono que expone tanto la API REST (para datos) como los archivos estáticos de la interfaz gráfica (para los navegadores de los Followers).

---

## 2. Stack Tecnológico Oficial

| Capa | Tecnología Seleccionada | Justificación Técnica |
| :--- | :--- | :--- |
| **Shell Desktop (Leader)** | **Tauri 2.0 + Rust** | Binario nativo mínimo, acceso directo a hardware (v4l2/DirectShow) y sistema de archivos. |
| **Frontend (UI/UX)** | **Next.js (SSG) + Fluent UI v9** | Interfaz reactiva compilada estáticamente. Estética nativa WinUI 3 y distribución HTTP eficiente. |
| **Servidor Integrado** | **Axum + Tokio (Rust)** | Servidor HTTP embebido en Tauri. Maneja la API REST, el enrutamiento web y validación JWT. |
| **IA - Preprocesamiento** | **mupdf (Rust bindings) + Tesseract** | Rasterización de PDFs multipágina a PNG. Extracción de texto de anclaje geométrico. |
| **IA - Inferencia Visual** | **olmOCR-7B Q8_0 (LM Studio)** | Servidor GGUF local en puerto 1234. Inferencia pura en CPU aprovechando los 64 GiB de RAM. |
| **Persistencia y Búsqueda** | **SQLite (WAL mode) + FTS5** | Base de datos embebida, un único proceso escritor, búsquedas semánticas nativas en texto completo. |

---

## 3. Pipeline de Ingesta Documental (Asíncrono)

El procesamiento de documentos densos mediante modelos de lenguaje visual (VLM) en CPU exige una orquestación estrictamente no bloqueante para evitar el congelamiento de la interfaz de usuario.

### 3.1. Flujo de Ejecución (Fire-and-Forget)
1.  **Disparo:** El usuario (en el Nodo Maestro) escanea o arrastra un PDF. El frontend de Next.js envía un comando IPC asíncrono a Rust: `iniciar_ingesta(file_path)`.
2.  **Respuesta Inmediata:** Rust encola el trabajo, inserta el documento en SQLite en estado `PENDIENTE` y retorna un `job_id` inmediatamente al frontend. La UI muestra una barra de progreso.
3.  **Rasterización:** En un hilo secundario (`tokio::spawn`), Rust utiliza `mupdf` para dividir el PDF en N imágenes independientes (PNG).
4.  **Loop de Inferencia por Página:**
    * Rust envía la imagen a Tesseract (vía subproceso).
    * Se extrae el **Anchor Text** (Texto de Anclaje) y se trunca algorítmicamente a los **primeros 400 caracteres** para evitar desbordar el contexto del modelo.
    * Rust codifica la imagen en Base64.
    * Se construye el *Prompt Template* exacto de `olmOCR` inyectando el Base64 y el Anchor Text.
    * Se realiza un POST HTTP al servidor local de LM Studio.
    * Se inserta el JSON resultante en la tabla `PAGE` de SQLite.
    * Rust emite un evento IPC: `tauri::AppHandle::emit("ingesta:progreso", { pagina: i })`.
5.  **Finalización:** Rust actualiza el documento a estado `INDEXADO` y emite el evento final con la vista previa de los datos, desbloqueando el formulario en la UI.

---

## 4. Modelo Lógico de Datos (Esquema Relacional)

La base de datos SQLite opera en modo WAL (Write-Ahead Logging) y gestiona la relación `Documento -> Páginas` y la búsqueda integral.

* `DOCUMENT`: Almacena metadatos del archivo físico (ID, ruta blob, fecha, usuario subidor).
* `PAGE`: Tabla hija. Almacena el número de página, el JSON estructurado extraído por la IA y una columna de texto plano.
* `PAGES_FTS`: Tabla virtual vinculada a `PAGE`. Implementa **FTS5 (Full-Text Search)**. Permite que la API de búsqueda (ej. `?q=presupuesto AND urgencia`) escanee miles de páginas en milisegundos.
* `TRAMITE`: Entidad central del flujo de trabajo (BPM). Vincula un `DOCUMENT` con un usuario responsable, estatus (`ABIERTO`, `CERRADO`) y fechas límite.
* `USUARIO`: Control de acceso. Almacena roles y el hash de seguridad.
* `AUDIT_LOG`: Registro inmutable de eventos. Almacena cadenas de texto descriptivas claras (ej. *"Usuario A asignó el trámite a Usuario B"*).

---

## 5. Especificaciones Críticas de Ingeniería

Para garantizar la estabilidad en el procesador Intel i7 y prevenir corrupción de datos, el sistema se rige por las siguientes restricciones:

### 5.1. Concurrencia Estricta en SQLite (`sqlx`)
El servidor Axum y el Worker Pool de IA comparten el acceso a SQLite. Para evitar interbloqueos (`SQLITE_BUSY` deadlocks):
* **Pool de Lectura:** Se configura un `SqlitePool` asíncrono con `max_connections(8)` exclusivo para operaciones `SELECT` provenientes de la API REST y el frontend.
* **Canal de Escritura Serializado:** Las mutaciones (`INSERT`, `UPDATE`) se enrutan a través de un canal asíncrono (`mpsc::channel`) o utilizan un pool secundario con `max_connections(1)`. Esto garantiza que las escrituras se procesen en una fila india perfecta a nivel de aplicación.

### 5.2. Streaming I/O Asíncrono para Archivos (Zero-RAM Overhead)
Cuando un Nodo Follower solicita visualizar un PDF pesado (ej. un expediente de 50 MB), el servidor Axum **no** carga el archivo en memoria.
* El endpoint `/api/pdfs/:id` utiliza `tokio::fs::File` combinado con `tokio_util::io::ReaderStream`.
* Esto crea un canal de streaming que bombea el archivo en fragmentos directamente desde el disco duro a la tarjeta de red, manteniendo el consumo de RAM del servidor en niveles mínimos.

### 5.3. Seguridad Perimetral y Autenticación (JWT)
El Nodo Maestro expone el puerto 8080 exclusivamente a la subred local (ej. `192.168.1.X`). 
* Todas las rutas de la API (excepto el inicio de sesión) están protegidas por un middleware de Axum que requiere un token JWT en el header `Authorization: Bearer`.
* El token se emite al seleccionar el perfil de usuario, tiene validez de 8 horas (jornada laboral) y asegura que cada inserción en el `AUDIT_LOG` tenga trazabilidad absoluta.

### 5.4. Gestión de Recursos Computacionales (i7-9700)
El cuello de botella del sistema es la inferencia de red neuronal en CPU.
* **Aislamiento del VLM:** El servidor de LM Studio **debe** ejecutarse pasando el parámetro `--threads 4`. Esto limita el motor de inferencia a la mitad física del procesador.
* Los 4 núcleos restantes quedan libres para garantizar la máxima fluidez del Tokio async runtime (red, base de datos), el sistema operativo base y la UI gráfica (Wayland/Windows DWM).

### 5.5. Estrategia de Disaster Recovery Automatizado
Un proceso cron interno (`tokio-cron-scheduler`) se dispara a las 03:00 AM diariamente:
1.  Ejecuta `PRAGMA wal_checkpoint(TRUNCATE)` para consolidar el archivo WAL en el archivo `.db` principal.
2.  Adquiere un bloqueo exclusivo por lectura.
3.  Comprime el archivo `sqlite.db` y las carpetas de PDFs nuevos en un archivo `.zip`.
4.  Copia el archivo a una ruta de montaje segura (Disco Duro Externo USB o NAS).
