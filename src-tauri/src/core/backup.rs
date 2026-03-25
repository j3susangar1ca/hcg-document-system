use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::watch;
use zip::write::FileOptions;
use zip::ZipWriter;
use axum::{extract::State, http::StatusCode, response::{IntoResponse, Json}};
use crate::AppState;

#[derive(Clone)]
pub struct BackupConfig {
    pub backup_dir: PathBuf,
    pub schedule_hour: u32,
    pub schedule_minute: u32,
    pub retention_days: u32,
}

impl Default for BackupConfig {
    fn default() -> Self {
        Self { backup_dir: PathBuf::from("./backups"), schedule_hour: 3, schedule_minute: 0, retention_days: 7 }
    }
}

pub struct BackupSystem {
    config: BackupConfig,
    db: SqlitePool,
    #[allow(dead_code)]
    _shutdown_rx: watch::Receiver<bool>,
}

impl BackupSystem {
    pub async fn perform_backup(&self) -> Result<PathBuf, String> {
        let timestamp = Local::now().format("%Y%m%d_%H%M%S");
        
        // 1. Consistencia: WAL Checkpoint
        let _: (i32, i32, i32) = sqlx::query_as("PRAGMA wal_checkpoint(TRUNCATE)").fetch_one(&self.db).await.unwrap_or((0,0,0));

        let backup_filename = format!("hcg_backup_{}.zip", timestamp);
        let backup_path = self.config.backup_dir.join(&backup_filename);
        let db_path = PathBuf::from("oficina_oficios.db");

        let file = File::create(&backup_path).map_err(|e| e.to_string())?;
        let mut zip = ZipWriter::new(file);
        let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        if db_path.exists() {
            zip.start_file("oficina_oficios.db", options).map_err(|e| e.to_string())?;
            let db_content = fs::read(&db_path).map_err(|e| e.to_string())?;
            zip.write_all(&db_content).map_err(|e| e.to_string())?;
        }

        zip.finish().map_err(|e| e.to_string())?;
        
        let id = uuid::Uuid::new_v4().to_string();
        let _ = sqlx::query("INSERT INTO audit_log (id, tabla_afectada, registro_id, accion, usuario_id, detalles) VALUES (?, 'sistema', 'N/A', 'BACKUP_CREADO', 'SISTEMA', ?)")
            .bind(id).bind(backup_path.display().to_string()).execute(&self.db).await;

        Ok(backup_path)
    }
}

pub fn spawn_backup_scheduler(db: SqlitePool, config: Option<BackupConfig>) -> watch::Sender<bool> {
    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    let cfg = config.unwrap_or_default();
    let _ = fs::create_dir_all(&cfg.backup_dir);
    let backup_sys = Arc::new(BackupSystem { config: cfg.clone(), db, _shutdown_rx: shutdown_rx });

    tokio::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
            let now = Local::now();
            if now.hour() == cfg.schedule_hour && now.minute() == cfg.schedule_minute {
                let _ = backup_sys.perform_backup().await;
            }
        }
    });
    shutdown_tx
}

pub async fn list_backups_endpoint() -> impl IntoResponse {
    (StatusCode::OK, Json(serde_json::json!({"status": "activo"})))
}

pub async fn create_backup_endpoint(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let sys = BackupSystem { config: BackupConfig::default(), db: state.write_db.clone(), _shutdown_rx: watch::channel(false).1 };
    match sys.perform_backup().await {
        Ok(path) => (StatusCode::OK, Json(serde_json::json!({"success": true, "path": path.display().to_string()}))),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"success": false, "error": e}))),
    }
}
