"use client";

import { EnhancedSidebar } from '@/components/layout/Sidebar';
import { useIngesta } from '@/hooks/useIngesta';
import { EnhancedProgressValidation } from '@/components/features/ProgressValidation';
import dynamic from 'next/dynamic';
const DocumentViewerEnhanced = dynamic(
  () => import('@/components/features/DocumentViewer').then(mod => mod.DocumentViewerEnhanced),
  { ssr: false }
);
import { EnhancedIdentityCard, SummaryTable, ActionCard } from '@/components/features/InsightCards';
import { EnhancedCommandBar } from '@/components/layout/CommandBar';
import { ConnectivityGuard } from '@/components/feedback/ConnectivityGuard';
import { useState } from 'react';
import { 
  Copy, 
  Sparkles,
  Search,
  FileText,
  X
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { slideInRight, buttonVariants } from '@/lib/animations';

// Mock types/interfaces
interface AnalysisResult {
  identity: {
    nombre: string;
    cargo: string;
    curp: string;
    email: string;
    fecha: string;
    folio?: string;
  };
  summary: string[];
  action: {
    tipo: string;
    descripcion: string;
  };
}

export default function Dashboard() {
  const { iniciarIngesta, progreso, isAnalyzing } = useIngesta();
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleTestFinish = () => {
    setResult({
      identity: {
        nombre: "Jesus Langarica",
        cargo: "Director de Innovación",
        curp: "LANJ880101HGR",
        email: "jesus@hcg.gob.mx",
        fecha: "25 de Marzo, 2026",
        folio: "HCG-2026-0042"
      },
      summary: [
        "Solicitud de presupuesto para el Nodo Maestro.",
        "Aprobación de la arquitectura de Alta Ingeniería.",
        "Requerimiento de hardware para el i7-9700."
      ],
      action: {
        tipo: "Aprobación Financiera",
        descripcion: "Proceder con la firma digital y el registro en el SII."
      }
    });
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const mockPath = "/home/jesuslangarica/Documentos/oficio_presupuesto.pdf";
    await iniciarIngesta(mockPath);
    setTimeout(handleTestFinish, 5000);
  };

  return (
    <div className="flex h-screen w-screen bg-surface-base overflow-hidden text-text-primary">
      <ConnectivityGuard />
      <EnhancedCommandBar />
      
      {/* 1. Navegación Global */}
      <EnhancedSidebar />

      {/* 2. Visor (Lienzo Inteligente) */}
      <section 
        className="flex-1 relative flex flex-col bg-gray-50/50 overflow-hidden"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
      >
         {isAnalyzing ? (
           <div className="flex-1 flex items-center justify-center">
             <EnhancedProgressValidation 
               current={progreso.pagina} 
               total={progreso.total || 10} 
               message={progreso.mensaje || "Inicializando motor de IA..."}
               stage={progreso.etapa as any}
             />
           </div>
         ) : (
           <DocumentViewerEnhanced documentId={result?.identity.folio || ""} />
         )}

         {/* Info Badge when not analyzing */}
         {!isAnalyzing && !result && (
           <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 bg-white/80 backdrop-blur-md rounded-full border border-gray-100 shadow-sm text-xs text-gray-500 flex items-center gap-2">
             <Search size={14} />
             Presiona <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border font-mono">Ctrl + K</kbd> para buscar
           </div>
         )}
      </section>

      {/* 3. Panel de Inteligencia (Insight) */}
      <AnimatePresence>
        {result && (
          <motion.aside 
            {...({
              variants: slideInRight,
              initial: "hidden",
              animate: "visible",
              exit: "exit",
              className: "w-[420px] lg:w-[480px] bg-gradient-to-b from-white to-gray-50/80 backdrop-blur-2xl border-l border-gray-200/30 shadow-[0_0_60px_rgba(0,0,0,0.08)] flex flex-col z-20"
            } as any)}
          >
            {/* Header con jerarquía */}
            <header className="px-8 py-6 border-b border-gray-100">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-600 rounded-xl shadow-lg shadow-blue-200">
                    <Sparkles className="text-white" size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Análisis VLM</h2>
                    <p className="text-sm text-gray-500">olmOCR-7B • Alta precisión</p>
                  </div>
                </div>
                <button className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 transition-colors">
                  <X size={20} onClick={() => setResult(null)} />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              <EnhancedIdentityCard identity={result.identity} />
              <SummaryTable points={result.summary} />
              <ActionCard action={result.action} />
            </div>
            
            {/* Zócalo de Acción */}
            <div className="p-8 border-t border-gray-100 bg-white/40 backdrop-blur-md flex gap-4">
               <motion.button 
                 {...({
                   variants: buttonVariants,
                   initial: "idle",
                   whileHover: "hover",
                   whileTap: "tap",
                   className: "flex-1 bg-gradient-to-r from-brand-600 to-brand-700 text-white font-semibold py-4 px-6 rounded-2xl shadow-brand flex items-center justify-center gap-2"
                 } as any)}
               >
                 <Sparkles size={18} />
                 Generar Respuesta
               </motion.button>
               <button className="p-4 bg-white/80 border border-gray-100 rounded-2xl text-gray-600 hover:bg-gray-50 transition-all shadow-sm">
                 <Copy size={22} />
               </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
