use std::sync::Arc;
use crate::AppState;
use uuid::Uuid;
use std::path::PathBuf;

pub mod ai_worker;

#[tauri::command]
pub async fn iniciar_ingesta(
    app_state: tauri::State<'_, Arc<AppState>>,
    handle: tauri::AppHandle,
    file_path: String,
) -> Result<String, String> {
    let job_id = Uuid::new_v4().to_string();
    let path = PathBuf::from(file_path);

    // Verificación básica de existencia del archivo
    if !path.exists() {
        return Err("El archivo especificado no existe en el Nodo Maestro.".into());
    }

    // Despacho Asíncrono al Worker
    let db_pool = app_state.write_db.clone();
    let app = handle.clone();
    let document_id = job_id.clone();

    // Iniciamos el proceso sin esperar a que termine (Fire-and-Forget)
    tokio::spawn(async move {
        ai_worker::iniciar_proceso_ingesta(
            app,
            db_pool,
            path,
            document_id,
        ).await;
    });

    // Retornamos el job_id inmediatamente para que la UI no se congele
    Ok(job_id)
}
