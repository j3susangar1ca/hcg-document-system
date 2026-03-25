use tauri::{AppHandle, Emitter};
use serde::Serialize;
use sqlx::SqlitePool;
use std::path::{Path, PathBuf};
use base64::{Engine as _, engine::general_purpose};
use tokio::process::Command;

#[derive(Serialize, Clone)]
struct ProgressPayload {
    pagina: usize,
    total: usize,
    mensaje: String,
}

pub async fn iniciar_proceso_ingesta(
    app_handle: AppHandle,
    db_pool: SqlitePool,
    file_path: PathBuf,
    document_id: String,
) {
    // 1. Ejecución en hilo secundario (tokio::spawn)
    tokio::spawn(async move {
        // FASE 1: Rasterización con mupdf (Placeholder)
        let paginas_paths = rasterizar_pdf(&file_path).await; 
        let total_paginas = paginas_paths.len();

        for (i, img_path) in paginas_paths.iter().enumerate() {
            let num_pag = i + 1;
            
            // Emitir evento de progreso al Frontend (V2 uses emit)
            let _ = app_handle.emit("ingesta:progreso", ProgressPayload {
                pagina: num_pag,
                total: total_paginas,
                mensaje: format!("Procesando página {} de {}", num_pag, total_paginas),
            });

            // FASE 2: Tesseract para Anchor Text
            let anchor_text = ejecutar_tesseract(&img_path).await;
            let anchor_truncated = anchor_text.chars().take(400).collect::<String>(); // Truncado a 400

            // FASE 3: Inferencia con olmOCR via LM Studio
            let img_base64 = cargar_imagen_base64(&img_path).await;
            let prompt = build_olmocr_prompt(&anchor_truncated, &img_base64);
            
            match llamar_vlm_server(prompt).await {
                Ok(json_data) => {
                    // FASE 4: Persistencia en la tabla PAGE
                    let _ = guardar_pagina_db(&db_pool, &document_id, num_pag, &json_data).await;
                }
                Err(e) => {
                    let _ = app_handle.emit("ingesta:error", format!("Error en página {}: {}", num_pag, e));
                }
            }
        }

        // Finalización: Actualizar status a INDEXADO
        let _ = marcar_documento_indexado(&db_pool, &document_id).await;
        let _ = app_handle.emit("ingesta:completa", document_id);
    });
}

// 🧠 Generador de Prompt exacto para olmOCR
fn build_olmocr_prompt(anchor_text: &str, img_b64: &str) -> serde_json::Value {
    serde_json::json!({
        "model": "olmOCR-7B",
        "messages": [{
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": { "url": format!("data:image/png;base64,{}", img_b64) }
                },
                {
                    "type": "text",
                    "text": format!("Below is the anchor text from the document:\n{}\n\nExtract all text and structured data from the image. Return a JSON object.", anchor_text)
                }
            ]
        }],
        "temperature": 0, // Determinismo
        "max_tokens": 2048
    })
}

// Funciones auxiliares
// FASE 1: Rasterización REAL con mutool (MuPDF)
async fn rasterizar_pdf(path: &Path) -> Vec<PathBuf> {
    let temp_dir = std::env::temp_dir().join("hcg_ingesta");
    let _ = tokio::fs::create_dir_all(&temp_dir).await;
    let output_pattern = temp_dir.join("page_%d.png");

    // Convierte PDF a PNG a 300 DPI para alta calidad de OCR
    let status = Command::new("mutool")
        .args([
            "draw", 
            "-o", output_pattern.to_str().unwrap(), 
            "-r", "300", 
            path.to_str().unwrap()
        ])
        .status()
        .await;

    if let Ok(s) = status {
        if s.success() {
            let mut paths: Vec<PathBuf> = std::fs::read_dir(&temp_dir)
                .unwrap()
                .filter_map(|e| e.ok().map(|entry| entry.path()))
                .collect();
            paths.sort(); // Asegurar orden de páginas
            return paths;
        }
    }
    vec![]
}

// FASE 2: OCR REAL con Tesseract (Específico para español)
async fn ejecutar_tesseract(path: &Path) -> String {
    let output = Command::new("tesseract")
        .arg(path)
        .arg("-") // Enviar resultado a stdout
        .arg("-l")
        .arg("spa+eng") // Soporte bilingüe para documentos técnicos
        .output()
        .await;

    match output {
        Ok(out) if out.status.success() => {
            String::from_utf8_lossy(&out.stdout).trim().to_string()
        }
        _ => "Error en OCR".to_string(),
    }
}

async fn cargar_imagen_base64(path: &Path) -> String {
    let data = tokio::fs::read(path).await.unwrap_or_default();
    general_purpose::STANDARD.encode(data)
}

async fn llamar_vlm_server(payload: serde_json::Value) -> Result<String, String> {
    let client = reqwest::Client::new();
    let res = client.post("http://localhost:1234/v1/chat/completions")
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(res.text().await.unwrap_or_default())
}

async fn guardar_pagina_db(pool: &SqlitePool, doc_id: &str, num: usize, content: &str) -> Result<(), sqlx::Error> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO paginas (id, documento_id, numero_pagina, datos_extraidos) VALUES (?, ?, ?, ?)")
        .bind(id)
        .bind(doc_id)
        .bind(num as i64)
        .bind(content)
        .execute(pool)
        .await?;
    Ok(())
}

async fn marcar_documento_indexado(pool: &SqlitePool, doc_id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE documentos SET status = 'INDEXADO' WHERE id = ?")
        .bind(doc_id)
        .execute(pool)
        .await?;
    Ok(())
}
