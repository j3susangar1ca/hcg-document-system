// src/components/features/ScannerAction.tsx
'use client';

import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ScanLine, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useIngesta } from '@/hooks/useIngesta';

export const ScannerAction = () => {
  const { isAnalyzing, setIsAnalyzing } = useIngesta();
  const [isWarmingUp, setIsWarmingUp] = useState(false);

  const handleScan = async () => {
    try {
      setIsWarmingUp(true);
      // Dispara el comando Tauri que interactúa con SANE
      const jobId = await invoke<string>('escanear_y_procesar');
      
      console.log(`Hardware disparado. Job ID: ${jobId}`);
      // El hardware terminó de escanear, ahora el AI Worker toma el control.
      setIsWarmingUp(false);
      setIsAnalyzing(true); 

    } catch (error) {
      console.error("Fallo de hardware o tiempo de espera agotado:", error);
      setIsWarmingUp(false);
      // Aquí podrías mostrar un Toast de error nativo o de UI
    }
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleScan}
      disabled={isAnalyzing || isWarmingUp}
      className={`
        flex items-center gap-3 px-6 py-4 rounded-2xl font-bold text-white shadow-brand transition-all
        ${isAnalyzing || isWarmingUp 
          ? 'bg-gray-400 cursor-not-allowed' 
          : 'bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700'
        }
      `}
    >
      {isWarmingUp ? (
        <>
          <Loader2 size={22} className="animate-spin" />
          Calentando Escáner...
        </>
      ) : (
        <>
          <ScanLine size={22} />
          {isAnalyzing ? 'Procesando IA...' : 'Escanear Físico'}
        </>
      )}
    </motion.button>
  );
};
