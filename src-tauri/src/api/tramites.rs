use axum::{extract::{State, Path}, Json, http::StatusCode, response::IntoResponse};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;
use crate::AppState;

#[derive(Deserialize, Serialize)]
pub struct UpdateTramitePayload {
    pub status: Option<String>,
    pub responsable_id: Option<String>,
    pub expediente_relacionado_id: Option<String>,
    pub nota_cierre: Option<String>,
}

#[derive(Serialize)]
pub struct ApiResponse {
    pub message: String,
}

// GET /api/v1/tramites — Lista todos los trámites (lectura)
pub async fn get_tramites_handler(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiResponse>)> {
    let rows = sqlx::query_as::<_, TramiteRow>(
        "SELECT id, folio, status, remitente, asunto, fecha_ingreso FROM documentos ORDER BY fecha_ingreso DESC"
    )
    .fetch_all(&state.read_db)
    .await
    .map_err(|_| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse { message: "Error consultando trámites".into() }))
    })?;

    Ok(Json(serde_json::json!({ "data": rows })))
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
    Json(payload): Json<UpdateTramitePayload>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiResponse>)> {
    // Usuario dummy para el ejemplo. Debería venir del Token JWT.
    let user_id = "00000000-0000-0000-0000-000000000001".to_string();

    // Iniciamos una transacción en el pool de ESCRITURA
    let mut tx = state.write_db.begin().await.map_err(|_| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse { message: "Error al iniciar transacción".into() }))
    })?;

    // 1. Construir actualización dinámica
    if let Some(ref status) = payload.status {
        sqlx::query("UPDATE documentos SET status = ? WHERE id = ?")
            .bind(status)
            .bind(&tramite_id)
            .execute(&mut *tx).await.map_err(|_| {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse { message: "Error actualizando estado".into() }))
            })?;
    }

    if let Some(ref resp_id) = payload.responsable_id {
        sqlx::query("UPDATE documentos SET responsable_id = ? WHERE id = ?")
            .bind(resp_id)
            .bind(&tramite_id)
            .execute(&mut *tx).await.map_err(|_| {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse { message: "Error asignando responsable".into() }))
            })?;
    }

    if let Some(ref exp_id) = payload.expediente_relacionado_id {
        sqlx::query("UPDATE documentos SET expediente_padre_id = ? WHERE id = ?")
            .bind(exp_id)
            .bind(&tramite_id)
            .execute(&mut *tx).await.map_err(|_| {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse { message: "Error vinculando expediente".into() }))
            })?;
    }

    // 2. Registro Obligatorio en Audit Log
    let audit_id = Uuid::new_v4().to_string();
    let detalles = serde_json::to_string(&payload).unwrap_or_else(|_| "{}".into());

    sqlx::query(
        "INSERT INTO audit_log (id, tabla_afectada, registro_id, accion, usuario_id, detalles) 
         VALUES (?, 'documentos', ?, 'UPDATE', ?, ?)"
    )
    .bind(audit_id)
    .bind(&tramite_id)
    .bind(&user_id)
    .bind(detalles)
    .execute(&mut *tx).await.map_err(|_| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse { message: "Fallo al registrar auditoría".into() }))
    })?;

    // 3. Confirmar transacción
    tx.commit().await.map_err(|_| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiResponse { message: "Error consolidando cambios".into() }))
    })?;

    Ok((StatusCode::OK, Json(ApiResponse { message: "Trámite actualizado y auditado correctamente".into() })))
}
