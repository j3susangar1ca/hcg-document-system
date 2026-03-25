use axum::{routing::{get, post, patch}, Router, http::{Method, header}};
use sqlx::sqlite::SqlitePoolOptions;
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

#[tokio::main]
async fn main() {
    dotenv().ok();
    
    let db_url = env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:oficina_oficios.db".to_string());
    let jwt_secret = env::var("JWT_SECRET").expect("Falta JWT_SECRET");
    let server_ip = env::var("SERVER_IP").unwrap_or_else(|_| "0.0.0.0:8080".to_string());
    let frontend_path = env::var("FRONTEND_DIST_PATH").unwrap_or_else(|_| "../src/out".to_string());

    let read_pool = SqlitePoolOptions::new()
        .max_connections(8)
        .connect(&format!("{}?mode=ro", db_url)).await.unwrap();

    let write_pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect(&db_url).await.unwrap();

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
