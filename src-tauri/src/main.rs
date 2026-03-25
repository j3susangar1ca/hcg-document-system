use axum::{routing::{get, post, patch}, Router, http::{Method, header}};
use sqlx::sqlite::{SqlitePoolOptions, SqliteConnectOptions};
use std::str::FromStr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::{services::ServeDir, cors::{CorsLayer, Any}};
use dotenvy::dotenv;
use std::env;

pub mod api;
pub mod core;
pub mod db;
pub mod hardware;
pub mod workers;

#[derive(Clone)]
pub struct AppState {
    pub read_db: sqlx::SqlitePool,
    pub write_db: sqlx::SqlitePool,
    pub jwt_secret: String,
}


async fn inicializar_base_de_datos(pool: &sqlx::SqlitePool) {
    let schema = r#"
        -- 1. Tabla de Usuarios
        CREATE TABLE IF NOT EXISTS usuarios (
            id TEXT PRIMARY KEY,
            nombre TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            rol TEXT CHECK(rol IN ('ADMIN', 'OPERADOR', 'VISOR')),
            jwt_token_hash TEXT,
            activo INTEGER DEFAULT 1,
            creado_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- 2. Tabla de Documentos Físicos
        CREATE TABLE IF NOT EXISTS documentos (
            id TEXT PRIMARY KEY,
            nombre_original TEXT NOT NULL,
            ruta_blob TEXT,
            hash_sha256 TEXT UNIQUE,
            status TEXT CHECK(status IN ('PENDIENTE', 'INDEXADO', 'ERROR')),
            subido_por TEXT,
            creado_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (subido_por) REFERENCES usuarios(id)
        );

        -- 3. Tabla de Páginas (Extraídas por olmOCR)
        CREATE TABLE IF NOT EXISTS paginas (
            id TEXT PRIMARY KEY,
            documento_id TEXT NOT NULL,
            numero_pagina INTEGER,
            datos_extraidos JSON,
            texto_plano TEXT,
            procesado_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (documento_id) REFERENCES documentos(id) ON DELETE CASCADE
        );

        -- 4. Tabla de Trámites / Expedientes
        CREATE TABLE IF NOT EXISTS tramites (
            id TEXT PRIMARY KEY,
            documento_id TEXT UNIQUE,
            folio TEXT UNIQUE,
            asunto TEXT,
            remitente TEXT,
            prioridad TEXT CHECK(prioridad IN ('BAJA', 'MEDIA', 'ALTA', 'URGENTE')),
            status TEXT CHECK(status IN ('ABIERTO', 'EN_PROCESO', 'CERRADO')),
            asignado_a TEXT,
            fecha_limite DATETIME,
            expediente_padre_id TEXT,
            creado_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            actualizado_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (documento_id) REFERENCES documentos(id),
            FOREIGN KEY (asignado_a) REFERENCES usuarios(id)
        );

        -- 5. Tabla de Auditoría (Audit Log)
        CREATE TABLE IF NOT EXISTS audit_log (
            id TEXT PRIMARY KEY,
            tabla_afectada TEXT,
            registro_id TEXT,
            accion TEXT,
            usuario_id TEXT,
            detalles TEXT,
            fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- 6. Motor de Búsqueda FTS5 (Tabla Virtual)
        CREATE VIRTUAL TABLE IF NOT EXISTS busqueda_paginas_fts USING fts5(
            documento_id UNINDEXED,
            tramite_id UNINDEXED,
            nombre_archivo UNINDEXED,
            tipo_documento UNINDEXED,
            numero_pagina UNINDEXED,
            texto_plano,
            tokenize='unicode61'
        );

        -- 7. Trigger de Auto-Indexación
        CREATE TRIGGER IF NOT EXISTS trg_paginas_ai AFTER INSERT ON paginas
        BEGIN
            INSERT INTO busqueda_paginas_fts(documento_id, tramite_id, nombre_archivo, tipo_documento, numero_pagina, texto_plano)
            VALUES (
                new.documento_id,
                (SELECT id FROM tramites WHERE documento_id = new.documento_id),
                (SELECT nombre_original FROM documentos WHERE id = new.documento_id),
                'PDF',
                new.numero_pagina,
                new.texto_plano
            );
        END;
    "#;

    // Ejecutamos el DDL
    match sqlx::query(schema).execute(pool).await {
        Ok(_) => println!("✅ Esquema de base de datos verificado/creado correctamente."),
        Err(e) => eprintln!("❌ Error al inicializar el esquema: {}", e),
    }
}

#[tokio::main]
async fn main() {
    dotenv().ok();
    
    let db_url = env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:oficina_oficios.db".to_string());
    let jwt_secret = env::var("JWT_SECRET").expect("Falta JWT_SECRET");
    let server_ip = env::var("SERVER_IP").unwrap_or_else(|_| "0.0.0.0:8080".to_string());
    let frontend_path = env::var("FRONTEND_DIST_PATH").unwrap_or_else(|_| "../src/out".to_string());

    // 2. INVERSIÓN: Primero creamos el Pool de Escritura y forzamos la creación del archivo
    let write_options = SqliteConnectOptions::from_str(&db_url)
        .expect("URL de base de datos inválida")
        .create_if_missing(true); // <--- Esto es la magia que evita el crash

    let write_pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(write_options).await.unwrap();

    // 👉 Inicializar Base de Datos
    inicializar_base_de_datos(&write_pool).await;

    // 3. AHORA creamos el Pool de Lectura (el archivo ya existe garantizado)
    let read_pool = SqlitePoolOptions::new()
        .max_connections(8)
        .connect(&format!("{}?mode=ro", db_url)).await.unwrap();

    let shared_state = Arc::new(AppState {
        read_db: read_pool.clone(),
        write_db: write_pool.clone(),
        jwt_secret,
    });

    // Iniciar el programador de Backups Automáticos
    let _backup_shutdown = core::backup::spawn_backup_scheduler(
        write_pool.clone(),
        None,
    );

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::OPTIONS])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE]);

    let app = Router::new()
        .route("/api/v1/auth/login", post(api::auth::login_handler))
        .route("/api/v1/tramites", get(api::tramites::get_tramites_handler))
        .route("/api/v1/tramites/:id", patch(api::tramites::update_tramite_handler))
        .route("/api/v1/pdfs/:id", get(api::documents::stream_pdf_handler))
        .merge(api::search::router())
        .merge(core::audit::router())
        .route("/api/v1/system/backups", get(core::backup::list_backups_endpoint))
        .route("/api/v1/system/backups/create", post(core::backup::create_backup_endpoint))
        .layer(cors)
        .fallback_service(ServeDir::new(frontend_path).append_index_html_on_directories(true))
        .with_state(shared_state.clone());

    tokio::spawn(async move {
        let listener = TcpListener::bind(&server_ip).await.unwrap();
        println!("🚀 Servidor Axum / Zero-Install escuchando en http://{}", server_ip);
        axum::serve(listener, app).await.unwrap();
    });

    tauri::Builder::default()
        .manage(shared_state)
        .invoke_handler(tauri::generate_handler![
            workers::iniciar_ingesta,
            hardware::escanear_y_procesar
        ])
        .run(tauri::generate_context!())
        .expect("Error al iniciar la aplicación Tauri");
}
