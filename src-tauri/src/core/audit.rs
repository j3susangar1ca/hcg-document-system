use axum::{extract::{Query, State}, http::StatusCode, response::{IntoResponse, Json}};
use chrono::Local;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::sync::Arc;
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct AuditFilter {
    pub limit: Option<u32>,
}

#[derive(Serialize)]
pub struct AuditEntry {
    pub id: String,
    pub accion: String,
    pub descripcion: String,
    pub fecha_creacion: String,
}

pub async fn log_ai_document_processed(
    pool: &SqlitePool,
    documento_id: &str,
    filename: &str,
    paginas: u32,
    tiempo_ms: u64,
    exitoso: bool,
) -> Result<(), sqlx::Error> {
    let id = uuid::Uuid::new_v4().to_string();
    let desc = format!("IA procesó '{}' ({} págs) en {}ms. Éxito: {}", filename, paginas, tiempo_ms, exitoso);
    
    sqlx::query("INSERT INTO audit_log (id, tabla_afectada, registro_id, accion, usuario_id, detalles) VALUES (?, 'documentos', ?, 'PROCESO_IA', 'SISTEMA', ?)")
        .bind(id)
        .bind(documento_id)
        .bind(desc)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn log_search_query(pool: &SqlitePool, query: &str, results: u32, time_ms: u64) -> Result<(), sqlx::Error> {
    let id = uuid::Uuid::new_v4().to_string();
    let desc = format!("Búsqueda FTS5: '{}' ({} res, {}ms)", query, results, time_ms);
    sqlx::query("INSERT INTO audit_log (id, tabla_afectada, registro_id, accion, usuario_id, detalles) VALUES (?, 'sistema', 'N/A', 'BUSQUEDA', 'SISTEMA', ?)")
        .bind(id).bind(desc).execute(pool).await?;
    Ok(())
}

pub async fn get_audit_log(
    State(state): State<Arc<AppState>>,
    Query(filter): Query<AuditFilter>,
) -> impl IntoResponse {
    let limit = filter.limit.unwrap_or(50).min(100);
    let rows = sqlx::query!("SELECT id, accion, detalles as descripcion, fecha_creacion FROM audit_log ORDER BY fecha_creacion DESC LIMIT ?", limit)
        .fetch_all(&state.read_db).await.unwrap_or_default();
    
    let entries: Vec<AuditEntry> = rows.into_iter().map(|r| AuditEntry {
        id: r.id, accion: r.accion, descripcion: r.descripcion.unwrap_or_default(), fecha_creacion: r.fecha_creacion.unwrap_or_default(),
    }).collect();

    (StatusCode::OK, Json(serde_json::json!({ "auditoria": entries })))
}

pub fn router() -> axum::Router<Arc<AppState>> {
    axum::Router::new().route("/api/v1/audit", axum::routing::get(get_audit_log))
}
