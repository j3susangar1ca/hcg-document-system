#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use axum::{routing::{get, post, patch}, Router, http::{Method, header}};
use sqlx::sqlite::SqlitePoolOptions;
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::{services::ServeDir, cors::{CorsLayer, Any}};
use dotenvy::dotenv;
use std::env;

mod api;
mod core;
mod db;
mod hardware;
mod workers;

use crate::hardware::capturar_documento;

// Estado compartido de la aplicación
pub struct AppState {
    pub read_db: sqlx::SqlitePool,  // Pool para consultas (SELECT)
    pub write_db: sqlx::SqlitePool, // Pool para mutaciones (INSERT/UPDATE) - max_connections(1)
    pub jwt_secret: String,
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
    // 1. Cargar configuración de entorno
    dotenv().ok();
    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL debe estar configurada");
    let jwt_secret = env::var("JWT_SECRET").expect("JWT_SECRET debe estar configurada");
    let server_ip = env::var("SERVER_IP").unwrap_or_else(|_| "0.0.0.0:8080".to_string());
    let frontend_path = env::var("FRONTEND_DIST_PATH").unwrap_or_else(|_| "../src/out".to_string());

    // 2. Pools de Base de Datos (Lectura y Escritura)
    let read_pool = SqlitePoolOptions::new()
        .max_connections(8)
        .connect(&format!("{}?mode=ro", db_url)).await.unwrap();

    let write_pool = SqlitePoolOptions::new()
        .max_connections(1) // Evita SQLITE_BUSY al serializar escrituras
        .connect(&db_url).await.unwrap();

    let shared_state = Arc::new(AppState {
        read_db: read_pool,
        write_db: write_pool,
        jwt_secret,
    });

    // 3. Configuración de Seguridad (CORS) para la red LAN
    let cors = CorsLayer::new()
        .allow_origin(Any) // En producción LAN, Any es aceptable
        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::OPTIONS])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE]);

    // 4. Enrutamiento y Servicio Zero-Install
    let app = Router::new()
        // API Pública
        .route("/api/v1/auth/login", post(api::auth::login_handler))
        // Rutas Protegidas (Requieren JWT)
        .route("/api/v1/tramites", get(api::tramites::get_tramites_handler))
        .route("/api/v1/tramites/:id", patch(api::tramites::update_tramite_handler))
        .route("/api/v1/pdfs/:id", get(api::documents::stream_pdf_handler))
        .layer(axum::middleware::from_fn_with_state(shared_state.clone(), api::auth::auth_middleware))
        .layer(cors)
        // Servir el Frontend para los Followers (Fallback a index.html para SPA routing)
        .fallback_service(ServeDir::new(frontend_path).append_index_html_on_directories(true))
        .with_state(shared_state.clone());

    // 5. Iniciar Servidor Axum
    tokio::spawn(async move {
        let listener = TcpListener::bind(&server_ip).await.unwrap();
        println!("🚀 Servidor Axum y Frontend sirviendo en http://{}", server_ip);
        axum::serve(listener, app).await.unwrap();
    });

    // 6. Iniciar UI Nativa (Tauri) para el Nodo Maestro
    tauri::Builder::default()
        .manage(shared_state)
        .invoke_handler(tauri::generate_handler![
            iniciar_ingesta,
            escanear_y_procesar
        ])
        .run(tauri::generate_context!())
        .expect("Error al iniciar Tauri");
}
