// src-tauri/src/hardware/mod.rs
use std::path::PathBuf;
use std::time::Duration;
use tokio::process::Command;
use tokio::time::timeout;
use tokio::fs;

const OUTPUT_PATH: &str = "/tmp/scan_hcg.png";
const PNG_MAGIC_NUMBER: [u8; 8] = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

pub async fn capturar_documento() -> Result<PathBuf, String> {
    let output_path = PathBuf::from(OUTPUT_PATH);

    // 1. CLEANUP PREVIO (Resiliencia de Datos)
    // Garantiza que el AI Worker no procese un escaneo anterior si la captura actual falla.
    if output_path.exists() {
        let _ = fs::remove_file(&output_path).await;
    }

    // 2. VALIDACIÓN PREVIA DE HARDWARE CON TIMEOUT
    let check_future = Command::new("scanimage").arg("-L").output();
    
    match timeout(Duration::from_secs(10), check_future).await {
        Ok(Ok(output)) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if !output.status.success() || !stdout.contains("device") {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(format!("Hardware no detectado o ocupado. SANE: {}", stderr.trim()));
            }
        }
        Ok(Err(e)) => return Err(format!("Fallo fatal al comunicar con SANE: {}", e)),
        Err(_) => return Err("Timeout (10s): El bus del escáner no responde al comando de validación.".to_string()),
    }

    // 3. CAPTURA DE DOCUMENTO (Protección estricta de recursos)
    let mut scan_cmd = Command::new("scanimage");
    scan_cmd.args([
        "--format=png",
        "--resolution=300",
        "-o",
        OUTPUT_PATH
    ])
    // CRÍTICO: Si el escáner se cuelga y salta el timeout, Tokio matará el proceso de SO automáticamente.
    .kill_on_drop(true); 

    let scan_future = scan_cmd.output();

    // Otorgamos 120 segundos máximos para escanear físicamente el documento.
    match timeout(Duration::from_secs(120), scan_future).await {
        Ok(Ok(output)) => {
            if !output.status.success() {
                let _ = fs::remove_file(&output_path).await; // Cleanup en caso de error
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(format!("Error en el proceso de digitalización: {}", stderr.trim()));
            }
        }
        Ok(Err(e)) => return Err(format!("Error de ejecución a nivel de SO: {}", e)),
        Err(_) => {
            let _ = fs::remove_file(&output_path).await;
            return Err("Timeout Crítico (120s): El escáner se colgó durante el barrido. Proceso cancelado.".to_string());
        }
    }

    // 4. VALIDACIÓN DE INTEGRIDAD DEL ARCHIVO RESULTANTE
    // Leemos la metadata de forma asíncrona para no bloquear el Event Loop.
    let metadata = fs::metadata(&output_path).await
        .map_err(|e| format!("El archivo de salida no fue encontrado en disco: {}", e))?;

    if metadata.len() < 1024 { // Mínimo 1KB exigido para considerar una imagen válida
        let _ = fs::remove_file(&output_path).await;
        return Err("La imagen generada está corrupta o vacía (< 1KB).".to_string());
    }

    // Validación Quirúrgica (Magic Number de PNG)
    let header = fs::read(&output_path).await.unwrap_or_default();
    if header.len() < 8 || header[0..8] != PNG_MAGIC_NUMBER {
        let _ = fs::remove_file(&output_path).await;
        return Err("El archivo de salida no posee una firma estructural PNG válida.".to_string());
    }

    Ok(output_path)
}
