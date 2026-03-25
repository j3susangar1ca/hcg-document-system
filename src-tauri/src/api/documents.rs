use axum::{
    body::Body,
    extract::{Path, State},
    http::StatusCode,
    response::Response,
};
use tokio_util::io::ReaderStream;
use tokio::fs::File;
use std::sync::Arc;
use crate::AppState;
use sqlx::Row;

pub async fn stream_pdf_handler(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Response<Body>, StatusCode> {
    // 1. Buscar la ruta en la base de datos (Lectura)
    let doc = sqlx::query("SELECT ruta_blob FROM documentos WHERE id = ?")
        .bind(id)
        .fetch_one(&state.read_db).await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let ruta_blob: String = doc.get("ruta_blob");

    // 2. Abrir archivo y crear stream asíncrono
    let file = File::open(&ruta_blob).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    Ok(Response::builder()
        .header("Content-Type", "application/pdf")
        .body(body)
        .unwrap())
}
