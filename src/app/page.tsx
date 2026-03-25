"use client";

import { useEffect, useState } from 'react';
import { EnhancedSidebar } from '@/components/layout/Sidebar';
import { useIngesta } from '@/hooks/useIngesta';
import { EnhancedProgressValidation } from '@/components/features/ProgressValidation';
import dynamic from 'next/dynamic';
import { EnhancedCommandBar } from '@/components/layout/CommandBar';
import { ConnectivityGuard } from '@/components/feedback/ConnectivityGuard';

const DocumentViewerEnhanced = dynamic(
  () => import('@/components/features/DocumentViewer').then(mod => mod.DocumentViewerEnhanced),
  { ssr: false, loading: () => <div className="flex-1 bg-gray-100 animate-pulse flex items-center justify-center">Cargando visor...</div> }
);

export default function Dashboard() {
  const { isAnalyzing, progreso, result: aiResult } = useIngesta();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <main className="flex h-screen overflow-hidden bg-surface-base">
      <ConnectivityGuard />
      <EnhancedCommandBar />
      <EnhancedSidebar />
      
      <section className="flex-1 relative flex flex-col bg-gray-50/50 overflow-hidden">
        {isAnalyzing && (
          <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center p-8">
            <EnhancedProgressValidation 
              current={progreso.pagina}
              total={progreso.total || 10}
              message={progreso.mensaje || "Inicializando motor de IA..."}
              stage={progreso.etapa as any}
            />
          </div>
        )}
        
        <DocumentViewerEnhanced />
      </section>
    </main>
  );
}
