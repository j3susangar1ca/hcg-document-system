#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use axum::{routing::{get, post}, Router, middleware};
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::services::ServeDir;

mod api;
mod core;
mod db;
mod hardware;
mod workers;

use crate::hardware::capturar_documento;

// Estado compartido de la aplicación
pub struct AppState {
    pub read_db: SqlitePool,  // Pool para consultas (SELECT)
    pub write_db: SqlitePool, // Pool para mutaciones (INSERT/UPDATE) - max_connections(1)
}

// 1. Definición del Comando Tauri
#[tauri::command]
async fn iniciar_ingesta(
    app_state: tauri::State<'_, Arc<AppState>>,
    handle: tauri::AppHandle,
    file_path: String,
) -> Result<String, String> {
    use uuid::Uuid;
    use std::path::PathBuf;

    let job_id = Uuid::new_v4().to_string();
    let path = PathBuf::from(file_path);

    // Verificación básica de existencia del archivo
    if !path.exists() {
        return Err("El archivo especificado no existe en el Nodo Maestro.".into());
    }

    // 2. Despacho Asíncrono al Worker
    let db_pool = app_state.write_db.clone();
    let app = handle.clone();
    let document_id = job_id.clone();

    // Iniciamos el proceso sin esperar a que termine (Fire-and-Forget)
    tokio::spawn(async move {
        workers::ai_worker::iniciar_proceso_ingesta(
            app,
            db_pool,
            path,
            document_id,
        ).await;
    });

    // Retornamos el job_id inmediatamente para que la UI no se congele
    Ok(job_id)
}

#[tauri::command]
async fn escanear_y_procesar(
    app_state: tauri::State<'_, Arc<AppState>>,
    handle: tauri::AppHandle,
) -> Result<String, String> {
    // 1. Llamada física al hardware (SANE/Fedora)
    let path = capturar_documento().await?; 
    
    // 2. Disparar el proceso de ingesta automáticamente tras el escaneo
    let job_id = iniciar_ingesta(app_state, handle, path.to_string_lossy().to_string()).await?;
    
    Ok(job_id)
}

#[tokio::main]
async fn main() {
    // 1. Configuración de SQLite con separación de lectura/escritura
    let db_path = "oficina_oficios.db";
    
    // Asegurarse de que el archivo existe o crearlo si es necesario (sqlx connect lo hará)
    let read_pool = SqlitePoolOptions::new()
        .max_connections(8)
        .connect(&format!("sqlite:{}?mode=ro", db_path)).await.expect("Failed to connect to read pool");

    let write_pool = SqlitePoolOptions::new()
        .max_connections(1) // Evita SQLITE_BUSY al serializar escrituras
        .connect(db_path).await.expect("Failed to connect to write pool");

    let shared_state = Arc::new(AppState {
        read_db: read_pool,
        write_db: write_pool,
    });

    let server_state = shared_state.clone();

    // 2. Definición de rutas y Middleware
    let app = Router::new()
        .nest_service("/", ServeDir::new("../src/out")) // Servir el frontend compilado (Next.js out)
        .route("/api/v1/auth/login", post(api::auth::login_handler))
        .route("/api/v1/tramites", get(api::tramites::get_tramites_handler))
        .route("/api/v1/pdfs/:id", get(api::documents::stream_pdf_handler))
        // Ejemplo de aplicación de middleware de autenticación a rutas protegidas
        .layer(middleware::from_fn(api::auth::auth_middleware))
        .with_state(server_state);

    // 3. Inicio del servidor Axum en la interfaz deseada
    tokio::spawn(async move {
        let addr = "192.168.1.100:8080";
        let listener = TcpListener::bind(addr).await.expect("Failed to bind to address");
        println!("🚀 Servidor Axum escuchando en http://{}", addr);
        axum::serve(listener, app).await.unwrap();
    });

    // 4. Inicio de Tauri
    tauri::Builder::default()
        .manage(shared_state)
        .invoke_handler(tauri::generate_handler![
            iniciar_ingesta,
            escanear_y_procesar
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
