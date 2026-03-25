"use client";

import { SidebarItem } from '@/components/SidebarItem';
import { useIngesta } from '@/hooks/useIngesta';
import { ProgressValidation } from '@/components/ProgressValidation';
import { DocumentViewer } from '@/components/DocumentViewer';
import { IdentityCard, SummaryTable, ActionCard } from '@/components/InsightCards';
import { useState } from 'react';
import { 
  LayoutDashboard, 
  Library, 
  Settings, 
  Bell, 
  User as UserIcon, 
  Copy, 
  Search,
  FileText,
  FileSearch,
  BookOpen
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

// Mock types/interfaces
interface AnalysisResult {
  identity: {
    nombre: string;
    cargo: string;
    curp: string;
    email: string;
    fecha: string;
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
  const [activeTab, setActiveTab] = useState('dashboard');

  // Mock result for demonstration after "processing"
  const handleTestFinish = () => {
    setResult({
      identity: {
        nombre: "Jesus Langarica",
        cargo: "Director de Innovación",
        curp: "LANJ880101HGR",
        email: "jesus@hcg.gob.mx",
        fecha: "25 de Marzo, 2026"
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
    // En Tauri v2, con protocolos asset, podríamos obtener el path o usar un dialog
    // Para este ejemplo, simulamos un path
    const mockPath = "/home/jesuslangarica/Documentos/oficio_presupuesto.pdf";
    await iniciarIngesta(mockPath);
    
    // Simulación de finalización de análisis
    setTimeout(handleTestFinish, 5000);
  };

  return (
    <main 
      className="flex h-screen w-screen bg-white/80 backdrop-blur-md overflow-hidden text-gray-900"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleFileDrop}
    >
      
      {/* 1. Navegación Global (Ancla) */}
      <nav className="w-20 bg-white/40 backdrop-blur-xl border-r border-gray-200/50 flex flex-col items-center py-8 gap-8 z-30">
        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-blue-200">
          <FileText size={24} />
        </div>
        
        <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
        <SidebarItem icon={Library} label="Biblioteca" active={activeTab === 'library'} onClick={() => setActiveTab('library')} />
        <SidebarItem icon={FileSearch} label="Buscador FTS5" active={activeTab === 'search'} onClick={() => setActiveTab('search')} />
        <SidebarItem icon={BookOpen} label="Gufa de Estilos" active={activeTab === 'docs'} onClick={() => setActiveTab('docs')} />
        
        <div className="mt-auto flex flex-col gap-6">
          <button className="text-gray-400 hover:text-blue-600 transition-colors"><Bell size={22} /></button>
          <button className="text-gray-400 hover:text-blue-600 transition-colors"><Settings size={22} /></button>
          <div className="w-10 h-10 bg-gray-200 rounded-full border-2 border-white shadow-sm overflow-hidden">
             <UserIcon className="w-full h-full p-2 text-gray-500" />
          </div>
        </div>
      </nav>

      {/* 2. Visor (Lienzo Inteligente) */}
      <section className="flex-1 relative flex flex-col bg-[#f0f2f5] overflow-hidden">
         {isAnalyzing ? (
           <div className="flex-1 flex items-center justify-center">
             <ProgressValidation 
               current={progreso.pagina} 
               total={progreso.total || 10} 
               message={progreso.mensaje || "Inicializando motor de IA..."} 
             />
           </div>
         ) : (
           <DocumentViewer />
         )}

         {/* Backdrop Drop Zone Overlay */}
         <div className="absolute inset-0 pointer-events-none border-4 border-dashed border-blue-600/0 hover:border-blue-600/20 transition-all flex items-center justify-center">
            {/* Solo visible al arrastrar */}
         </div>
      </section>

      {/* 3. Panel de Inteligencia (Insight) */}
      <AnimatePresence>
        {result && (
          <motion.aside 
            initial={{ x: 450 }}
            animate={{ x: 0 }}
            exit={{ x: 450 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-[450px] bg-white/60 backdrop-blur-2xl border-l border-gray-200/50 shadow-2xl flex flex-col z-20"
          >
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Análisis VLM</h2>
                <div className="flex gap-2">
                  <button className="p-2 hover:bg-white/80 rounded-xl text-gray-500 transition-all shadow-sm"><Copy size={18} /></button>
                </div>
              </div>

              {/* Tarjetas de Datos basadas en el DER */}
              <IdentityCard identity={result.identity} />
              <SummaryTable points={result.summary} />
              <ActionCard action={result.action} />
            </div>
            
            {/* Zócalo de Acción */}
            <div className="p-8 border-t border-gray-100 bg-white/40 backdrop-blur-md flex gap-4">
               <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all active:scale-95">
                 Generar Respuesta
               </button>
               <button className="p-4 bg-white/80 border border-gray-100 rounded-2xl text-gray-600 hover:bg-gray-50 transition-all shadow-sm">
                 <Copy size={22} />
               </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </main>
  );
}
