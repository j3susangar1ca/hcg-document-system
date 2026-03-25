import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const ConnectivityGuard = () => {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/v1/auth/login', { method: 'HEAD' });
        setIsOnline(res.ok || res.status === 405); // 405 es OK (el endpoint existe)
      } catch {
        setIsOnline(false);
      }
    };

    const interval = setInterval(checkStatus, 5000); // Polling cada 5s
    return () => clearInterval(interval);
  }, []);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div 
          {...({
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            className: "fixed inset-0 z-[200] bg-white/60 backdrop-blur-xl flex flex-col items-center justify-center p-10 text-center"
          } as any)}
        >
          <div className="w-24 h-24 bg-red-50 text-red-600 rounded-[40px] flex items-center justify-center mb-8 shadow-xl shadow-red-100">
            <WifiOff size={48} />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-4">Conexión Perdida</h1>
          <p className="text-gray-500 max-w-md leading-relaxed">
            No se detecta el Nodo Maestro (192.168.1.100). Las funciones de guardado y búsqueda han sido bloqueadas para proteger la integridad de los datos.
          </p>
          <div className="mt-8 flex gap-2 items-center text-xs font-bold text-blue-600 uppercase tracking-widest animate-pulse">
            <div className="w-2 h-2 bg-blue-600 rounded-full" />
            Reintentando sincronización...
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
