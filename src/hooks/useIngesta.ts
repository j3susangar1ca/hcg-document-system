import { useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

export interface ProgressPayload {
  pagina: number;
  total: number;
  mensaje: string;
  etapa?: 'rasterizing' | 'ocr' | 'vlm' | 'indexing';
}

export function useIngesta() {
  const [progreso, setProgreso] = useState<ProgressPayload>({ pagina: 0, total: 0, mensaje: '' });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const iniciarIngesta = async (filePath: string) => {
    setIsAnalyzing(true);
    try {
      // Disparo asíncrono al backend de Rust (Tauri v2 invoke)
      const jobId = await invoke<string>('iniciar_ingesta', { filePath });
      console.log(`Job started with ID: ${jobId}`);
      
      // Escucha de eventos emitida por el Worker de IA
      const unlisten = await listen<ProgressPayload>('ingesta:progreso', (event) => {
        setProgreso(event.payload);
      });

      // También podríamos escuchar 'ingesta:completa' e 'ingesta:error'
      const unlistenComplete = await listen<string>('ingesta:completa', (event) => {
        console.log(`Job ${event.payload} completed`);
        setIsAnalyzing(false);
      });

      return () => {
        unlisten();
        unlistenComplete();
      };
    } catch (err) {
      console.error("Error en IPC:", err);
      setIsAnalyzing(false);
    }
  };

  return { iniciarIngesta, progreso, isAnalyzing, setIsAnalyzing };
}
