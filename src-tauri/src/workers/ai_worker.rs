use tauri::{AppHandle, Emitter};
use serde::Serialize;
use sqlx::SqlitePool;
use std::path::{Path, PathBuf};
use base64::{Engine as _, engine::general_purpose};
use tokio::fs;
use uuid::Uuid;
use serde_json::json;
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
    tokio::spawn(async move {
        // 1. Aislamiento por documento
        let temp_dir = std::env::temp_dir()
            .join("hcg_ingesta")
            .join(&document_id);

        if let Err(e) = fs::create_dir_all(&temp_dir).await {
            let _ = app_handle.emit("ingesta:error", format!("Fallo al crear directorio temporal: {}", e));
            return;
        }

        let start_time = std::time::Instant::now();
        let process_result: Result<(), String> = async {
            // FASE 1: Rasterización a 300 DPI para alta precisión
            let paginas_paths = rasterizar_pdf(&file_path, &temp_dir).await?;
            let total_paginas = paginas_paths.len();

            if total_paginas == 0 {
                return Err("El documento no generó ninguna página válida".to_string());
            }

            for (i, img_path) in paginas_paths.iter().enumerate() {
                let num_pag = i + 1;

                let _ = app_handle.emit("ingesta:progreso", ProgressPayload {
                    pagina: num_pag,
                    total: total_paginas,
                    mensaje: format!("Procesando página {} de {}", num_pag, total_paginas),
                });

                // FASE 2: OCR Tesseract
                let anchor_text = ejecutar_tesseract(img_path).await;
                let anchor_truncated = anchor_text.chars().take(400).collect::<String>();

                // FASE 3: Inferencia VLM
                let img_base64 = cargar_imagen_base64(img_path).await;
                let prompt = build_olmocr_prompt(&anchor_truncated, &img_base64);
                let vlm_json_str = llamar_vlm_server(prompt).await?;
                
                // Construir objeto JSON unificado para el trigger FTS5
                let vlm_data: serde_json::Value = serde_json::from_str(&vlm_json_str).unwrap_or(json!({}));
                let datos_extraidos = json!({
                    "ia_result": vlm_data,
                    "texto_plano": anchor_text // Requerido por el trigger trg_paginas_ai
                });

                // FASE 4: Guardado en DB con nombres de columnas del DDL
                guardar_pagina_db(&db_pool, &document_id, num_pag, &datos_extraidos)
                    .await
                    .map_err(|e| format!("Error en DB para página {}: {}", num_pag, e))?;
            }

            let execution_time = start_time.elapsed().as_millis() as u64;

            // 1. Marcar documento en base de datos
            marcar_documento_indexado(&db_pool, &document_id).await.map_err(|e| format!("Error actualizando status: {}", e))?;

            // 2. Registrar en la auditoría (FTS5 se llena automáticamente vía Triggers de SQLite)
            if let Err(e) = crate::core::audit::log_ai_document_processed(
                &db_pool, 
                &document_id, 
                &file_path.file_name().unwrap().to_string_lossy(), 
                total_paginas as u32, 
                execution_time, 
                true
            ).await {
                eprintln!("Error registrando auditoría: {}", e);
            }

            let _ = app_handle.emit("ingesta:completa", &document_id);
            Ok(())
        }.await;

        // 3. BLOQUE FINALLY: Limpieza Garantizada
        let _ = fs::remove_dir_all(&temp_dir).await;

        if let Err(err_msg) = process_result {
            let _ = app_handle.emit("ingesta:error", err_msg);
        }
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
async fn rasterizar_pdf(pdf_path: &Path, output_dir: &Path) -> Result<Vec<PathBuf>, String> {
    let output_pattern = output_dir.join("page_%04d.png");
    
    // -r 300 para calidad industrial
    let status = tokio::process::Command::new("mutool")
        .args([
            "draw", "-F", "png", "-r", "300", 
            "-o", output_pattern.to_str().unwrap(),
            pdf_path.to_str().unwrap()
        ])
        .status()
        .await
        .map_err(|e| format!("Fallo al invocar mutool: {}", e))?;

    if !status.success() {
        return Err("mutool terminó con error".to_string());
    }

    let mut images = Vec::new();
    let mut entries = fs::read_dir(output_dir).await.unwrap();
    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        if path.extension().map_or(false, |ext| ext == "png") {
            images.push(path);
        }
    }
    images.sort();
    Ok(images)
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

async fn guardar_pagina_db(
    pool: &SqlitePool,
    doc_id: &str,
    num: usize,
    datos: &serde_json::Value,
) -> Result<(), sqlx::Error> {
    let page_id = Uuid::new_v4().to_string(); // ID obligatorio según DDL
    
    // Columnas ajustadas a DDL.md
    sqlx::query("INSERT INTO paginas (id, documento_id, numero_pagina, datos_extraidos) VALUES (?, ?, ?, ?)")
        .bind(page_id)
        .bind(doc_id)
        .bind(num as i64)
        .bind(datos)
        .execute(pool)
        .await?;
    Ok(())
}

async fn marcar_documento_indexado(pool: &SqlitePool, doc_id: &str) -> Result<(), sqlx::Error> {
    // Columna 'status' según DDL.md
    sqlx::query("UPDATE documentos SET status = 'INDEXADO' WHERE id = ?")
        .bind(doc_id)
        .execute(pool)
        .await?;
    Ok(())
}
