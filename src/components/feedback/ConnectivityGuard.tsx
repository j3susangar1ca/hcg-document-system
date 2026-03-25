// src/components/feedback/ConnectivityGuard.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE, getAuthHeader } from '@/lib/api';

export const ConnectivityGuard = () => {
  const [status, setStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  useEffect(() => {
    const checkServer = async () => {
      try {
        // Intentamos un GET al endpoint de backups (que siempre responde 200/405 si el servidor está vivo)
        const res = await fetch(`${API_BASE}/api/v1/system/backups`, { 
          method: 'GET',
          headers: getAuthHeader()
        });
        setStatus(res.ok || res.status === 405 ? 'online' : 'offline');
      } catch {
        setStatus('offline');
      }
    };

    // Check inmediato + intervalo
    checkServer();
    const interval = setInterval(checkServer, 5000); // Verificación cada 5 segundos
    return () => clearInterval(interval);
  }, []);

  return (
    <AnimatePresence>
      {status === 'offline' && (
        <motion.div 
          {...({
            initial: { y: -100 }, 
            animate: { y: 0 }, 
            exit: { y: -100 },
            className: "fixed top-0 left-0 right-0 z-[500] bg-red-600 text-white p-4 flex items-center justify-center gap-4 shadow-xl"
          } as any)}
        >
          <WifiOff size={20} className="animate-pulse" />
          <span className="font-bold tracking-tight">
            Conexión perdida con el Nodo Maestro. Las funciones de guardado están deshabilitadas.
          </span>
          <div className="flex items-center gap-2 text-xs font-medium text-red-200 ml-4">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Reintentando...
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
