use axum::{extract::{Query, State}, http::StatusCode, response::{IntoResponse, Json}};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
    #[serde(default = "default_page")]
    pub page: u32,
    #[serde(default = "default_limit")]
    pub limit: u32,
}

fn default_page() -> u32 { 1 }
fn default_limit() -> u32 { 20 }

#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub documento_id: String,
    pub tramite_folio: String,
    pub numero_pagina: i32,
    pub snippet: String,
    pub relevancia: f64,
}

pub async fn search_documents(
    State(state): State<Arc<AppState>>,
    Query(query): Query<SearchQuery>,
) -> impl IntoResponse {
    if query.q.trim().is_empty() {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "Búsqueda vacía"})));
    }

    let start_time = std::time::Instant::now();
    let search_term = sanitize_fts_query(&query.q);
    let offset = (query.page.saturating_sub(1)) * query.limit;

    let sql = r#"
        SELECT 
            fts.documento_id,
            d.folio as tramite_folio,
            fts.numero_pagina,
            fts.texto_plano as contenido,
            bm25(busqueda_paginas_fts) as score
        FROM busqueda_paginas_fts fts
        LEFT JOIN documentos d ON d.id = fts.documento_id
        WHERE busqueda_paginas_fts MATCH ?1
        ORDER BY bm25(busqueda_paginas_fts)
        LIMIT ?2 OFFSET ?3
    "#;

    match sqlx::query(sql)
        .bind(&search_term)
        .bind(query.limit as i64)
        .bind(offset as i64)
        .fetch_all(&state.read_db)
        .await
    {
        Ok(rows) => {
            let results: Vec<SearchResult> = rows.iter().map(|row| {
                let contenido: String = row.get("contenido");
                let (snippet, _) = generate_preview_with_highlights(&contenido, &query.q, 150);
                
                SearchResult {
                    documento_id: row.get("documento_id"),
                    tramite_folio: row.get::<String, _>("tramite_folio"),
                    numero_pagina: row.get("numero_pagina"),
                    snippet,
                    relevancia: -(row.get::<f64, _>("score")) / 100.0,
                }
            }).collect();

            let execution_time = start_time.elapsed().as_millis() as u64;
            let _ = crate::core::audit::log_search_query(&state.write_db, &query.q, results.len() as u32, execution_time).await;

            (StatusCode::OK, Json(serde_json::json!({ "resultados": results })))
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": e.to_string()}))),
    }
}

fn sanitize_fts_query(query: &str) -> String {
    let terms: Vec<String> = query.split_whitespace().map(|term| {
        let sanitized = term.replace('"', "\"\"").replace(['(', ')', '{', '}'], "");
        if sanitized.ends_with('*') { sanitized } else { format!("{}*", sanitized) }
    }).collect();
    terms.join(" OR ")
}

fn generate_preview_with_highlights(content: &str, query: &str, max_length: usize) -> (String, Vec<()>) {
    let query_lower = query.to_lowercase();
    let terms: Vec<&str> = query_lower.split_whitespace().collect();
    let content_lower = content.to_lowercase();
    
    let best_pos = terms.iter().find_map(|&term| content_lower.find(term)).unwrap_or(0);
    let start_pos = best_pos.saturating_sub(40);
    let end_pos = std::cmp::min(start_pos + max_length, content.len());
    
    let mut snippet = String::new();
    if start_pos > 0 { snippet.push_str("..."); }
    snippet.push_str(&content[start_pos..end_pos]);
    if end_pos < content.len() { snippet.push_str("..."); }
    
    (snippet, vec![])
}

pub fn router() -> axum::Router<Arc<AppState>> {
    axum::Router::new().route("/api/v1/documentos/search", axum::routing::get(search_documents))
}
