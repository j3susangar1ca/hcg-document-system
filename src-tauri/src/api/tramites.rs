use axum::{
    extract::{State, Path},
    Json,
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;
use crate::AppState;

// 📦 Payload flexible para actualizaciones parciales
#[derive(Deserialize, Debug, Serialize)]
pub struct UpdateTramitePayload {
    pub status: Option<String>,
    pub responsable_id: Option<String>,
    pub expediente_relacionado_id: Option<String>,
    pub notas_cierre: Option<String>,
}

#[derive(Serialize)]
pub struct ApiResponse {
    pub success: bool,
    pub message: String,
}

// GET /api/v1/tramites — Lista todos los trámites (lectura)
pub async fn get_tramites_handler(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let rows = sqlx::query_as::<_, TramiteRow>(
        "SELECT id, folio, status, remitente, asunto, fecha_ingreso FROM documentos ORDER BY fecha_ingreso DESC"
    )
    .fetch_all(&state.read_db)
    .await
    .map_err(|_| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "message": "Error consultando trámites" })))
    })?;

    Ok(Json(serde_json::json!({ "success": true, "data": rows })))
}

#[derive(Serialize, sqlx::FromRow)]
pub struct TramiteRow {
    pub id: String,
    pub folio: String,
    pub status: String,
    pub remitente: String,
    pub asunto: String,
    pub fecha_ingreso: String,
}

// PATCH /api/v1/tramites/:id — Actualiza y audita un trámite (escritura transaccional)
pub async fn update_tramite_handler(
    State(state): State<Arc<AppState>>,
    Path(tramite_id): Path<String>,
    // En producción, extraerías el user_id desde el middleware JWT de Axum
    Json(payload): Json<UpdateTramitePayload>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiResponse>)> {
    
    let user_id = "00000000-0000-0000-0000-000000000001".to_string(); // Placeholder del usuario activo

    // 🛡️ Inicio de Transacción Estricta (Bloquea concurrencia en la tabla)
    let mut tx = state.write_db.begin().await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse { success: false, message: format!("Fallo al iniciar transacción: {}", e) }))
    })?;

    // 🔄 1. Cambio de Estado ("PENDIENTE" -> "FINALIZADO")
    if let Some(ref status) = payload.status {
        sqlx::query("UPDATE documentos SET status = ? WHERE id = ?")
            .bind(status)
            .bind(&tramite_id)
            .execute(&mut *tx).await.map_err(|_| {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse { success: false, message: "Error al actualizar estado".into() }))
            })?;
    }

    // 👤 2. Asignación de Responsable
    if let Some(ref responsable) = payload.responsable_id {
        sqlx::query("UPDATE documentos SET responsable_id = ? WHERE id = ?")
            .bind(responsable)
            .bind(&tramite_id)
            .execute(&mut *tx).await.map_err(|_| {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse { success: false, message: "Error al asignar responsable".into() }))
            })?;
    }

    // 🔗 3. Vinculación de Folios (Trazabilidad Documental)
    if let Some(ref expediente_padre_id) = payload.expediente_relacionado_id {
        // Vincula el documento actual como "hijo" de otro expediente/folio principal
        sqlx::query("UPDATE documentos SET expediente_padre_id = ? WHERE id = ?")
            .bind(expediente_padre_id)
            .bind(&tramite_id)
            .execute(&mut *tx).await.map_err(|_| {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse { success: false, message: "Error al vincular folios".into() }))
            })?;
        
        // Auditoría específica para trazabilidad legal
        let audit_link_id = Uuid::new_v4().to_string();
        sqlx::query("INSERT INTO audit_log (id, tabla_afectada, registro_id, accion, usuario_id, detalles) VALUES (?, 'documentos', ?, 'VINCULACION', ?, ?)")
            .bind(audit_link_id)
            .bind(&tramite_id)
            .bind(&user_id)
            .bind(format!("Vinculado al expediente padre: {}", expediente_padre_id))
            .execute(&mut *tx).await.map_err(|_| {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse { success: false, message: "Error en auditoría de vinculación".into() }))
            })?;
    }

    // 📝 4. Auditoría General del Cambio (Obligatoria)
    let audit_id = Uuid::new_v4().to_string();
    let detalles = serde_json::to_string(&payload).unwrap_or_else(|_| "{}".to_string());
    
    sqlx::query("INSERT INTO audit_log (id, tabla_afectada, registro_id, accion, usuario_id, detalles) VALUES (?, 'documentos', ?, 'UPDATE', ?, ?)")
        .bind(audit_id)
        .bind(&tramite_id)
        .bind(&user_id)
        .bind(detalles)
        .execute(&mut *tx).await.map_err(|_| {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse { success: false, message: "Error al generar registro de auditoría".into() }))
        })?;

    // ✅ 5. Consolidación de Transacción
    tx.commit().await.map_err(|_| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse { success: false, message: "Error en commit de base de datos".into() }))
    })?;

    Ok((StatusCode::OK, Json(ApiResponse { success: true, message: "Trámite procesado y auditado correctamente".into() })))
}
