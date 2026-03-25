Este es el **plano de cimentación** del sistema. Aquí definimos no solo las tablas, sino las restricciones de integridad y la configuración específica de SQLite para que el **i7-9700** maneje miles de registros y archivos PDF sin degradación de rendimiento.

Configuraremos el archivo `sqlite.db` con **Tipado Estricto** (introducido en SQLite 3.37+) para garantizar que los datos sean consistentes a nivel de base de datos.

---

### 1. Configuración Inicial del Entorno (Pragmas)
Estos comandos deben ejecutarse cada vez que el backend de Rust (`sqlx`) abre una conexión al archivo para activar las capacidades avanzadas:

```sql
PRAGMA journal_mode = WAL;          -- Write-Ahead Logging para concurrencia.
PRAGMA synchronous = NORMAL;       -- Optimiza escrituras sin riesgo de corrupción.
PRAGMA foreign_keys = ON;          -- Garantiza integridad referencial.
PRAGMA busy_timeout = 5000;        -- Espera 5s si la base está ocupada antes de fallar.
```

---

### 2. Definición de Tablas (DDL - Data Definition Language)

#### 2.1. Gestión de Usuarios y Acceso
```sql
CREATE TABLE usuarios (
    id TEXT PRIMARY KEY NOT NULL, -- UUID v4
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    rol TEXT CHECK(rol IN ('ADMIN', 'OPERADOR', 'VISOR')) NOT NULL,
    jwt_token_hash TEXT, -- Almacena el hash del último token válido
    activo INTEGER DEFAULT 1 NOT NULL, -- Boolean (0 o 1)
    creado_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
) STRICT;
```

#### 2.2. Entidades Documentales (El "Archivo")
```sql
CREATE TABLE documentos (
    id TEXT PRIMARY KEY NOT NULL,
    nombre_original TEXT NOT NULL,
    ruta_blob TEXT NOT NULL, -- Ruta física en el disco del Leader
    hash_sha256 TEXT UNIQUE NOT NULL, -- Evita duplicados exactos
    status TEXT CHECK(status IN ('PENDIENTE', 'INDEXADO', 'ERROR')) NOT NULL,
    subido_por TEXT NOT NULL,
    creado_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (subido_por) REFERENCES usuarios(id)
) STRICT;

CREATE TABLE paginas (
    id TEXT PRIMARY KEY NOT NULL,
    documento_id TEXT NOT NULL,
    numero_pagina INTEGER NOT NULL,
    datos_extraidos JSON, -- Contenido estructurado de olmOCR
    procesado_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (documento_id) REFERENCES documentos(id) ON DELETE CASCADE
) STRICT;
```

#### 2.3. Control de Procesos (BPM / Trámites)
```sql
CREATE TABLE tramites (
    id TEXT PRIMARY KEY NOT NULL,
    documento_id TEXT UNIQUE NOT NULL,
    folio TEXT UNIQUE NOT NULL, -- Ej: OF-2026-001
    asunto TEXT,
    remitente TEXT,
    prioridad TEXT CHECK(prioridad IN ('BAJA', 'MEDIA', 'ALTA', 'URGENTE')) DEFAULT 'MEDIA',
    status TEXT CHECK(status IN ('ABIERTO', 'EN_PROCESO', 'CERRADO')) DEFAULT 'ABIERTO',
    asignado_a TEXT,
    fecha_limite DATETIME,
    creado_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    actualizado_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (documento_id) REFERENCES documentos(id) ON DELETE CASCADE,
    FOREIGN KEY (asignado_a) REFERENCES usuarios(id)
) STRICT;
```

#### 2.4. Auditoría y Logs
```sql
CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- Autoinc para orden cronológico físico
    tramite_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    accion TEXT NOT NULL, -- 'ASIGNO', 'CAMBIO_ESTADO', 'CERRO'
    descripcion TEXT NOT NULL, -- Texto legible: "Ana asignó a Carlos"
    ocurrido_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES usuarios(id)
);

CREATE TABLE backup_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ejecutado_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ruta_destino TEXT NOT NULL,
    exitoso INTEGER NOT NULL, -- 0 o 1
    total_archivos INTEGER NOT NULL
);
```

---

### 3. Motor de Búsqueda (FTS5 Virtual Table)
Esta tabla no guarda datos de forma "tradicional", sino que crea un índice de texto completo del contenido de las páginas para búsquedas instantáneas.

```sql
-- Creamos la tabla virtual de búsqueda
CREATE VIRTUAL TABLE busqueda_paginas_fts USING fts5(
    pagina_id UNINDEXED, -- Referencia a la tabla real 'paginas'
    contenido,            -- El texto plano extraído para indexar
    tokenize = 'unicode61' -- Soporte para acentos y caracteres españoles
);

-- Trigger para mantener el índice actualizado automáticamente
CREATE TRIGGER trg_paginas_ai AFTER INSERT ON paginas BEGIN
    INSERT INTO busqueda_paginas_fts(pagina_id, contenido)
    VALUES (new.id, json_extract(new.datos_extraidos, '$.texto_plano'));
END;
```

---

### 4. Diccionario de Datos (Resumen de Campos Clave)

| Campo | Tipo | Restricción | Descripción Técnica |
| :--- | :--- | :--- | :--- |
| `id` (UUID) | `TEXT` | `PRIMARY KEY` | Identificador único universal para evitar colisiones en red local. |
| `status` | `TEXT` | `CHECK` | Restringe estados válidos a nivel de motor de DB (Seguridad de Datos). |
| `hash_sha256`| `TEXT` | `UNIQUE` | Garantiza que no se procese el mismo archivo PDF dos veces. |
| `json_data` | `JSON` | `NULLABLE` | Almacena el esquema flexible que devuelve olmOCR (extensión JSON1). |
| `fts_content` | `FTS5` | `VIRTUAL` | Permite operadores como `MATCH 'presupuesto'` en milisegundos. |

---

### 5. Consideraciones de Mantenimiento (Backup)
Como definimos en la arquitectura v3.0, el **Nodo Maestro** ejecutará este comando antes de copiar el archivo para el respaldo nocturno:

```sql
-- Comando previo al backup físico
PRAGMA wal_checkpoint(TRUNCATE);
```
