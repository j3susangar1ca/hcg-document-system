// src/app/library/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Search, Filter, Clock } from 'lucide-react';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import { useUIStore } from '@/store/useUIStore';
import { useRouter } from 'next/navigation';
import { API_BASE } from '@/lib/utils';

interface Tramite {
  id: string;
  folio: string;
  status: string;
  remitente: string;
  asunto: string;
  fecha_ingreso: string;
}

export default function LibraryPage() {
  const [tramites, setTramites] = useState<Tramite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const setSelectedDocument = useUIStore(s => s.setSelectedDocument);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    const fetchTramites = async () => {
      try {
        const token = localStorage.getItem('jwt_token');
        const res = await fetch(`${API_BASE}/api/v1/tramites`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.ok) {
          const json = await res.json();
          setTramites(json.data || []);
        }
      } catch (error) {
        console.error("Error cargando la biblioteca:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTramites();
  }, []);

  if (!mounted) return null;

  const filteredTramites = tramites.filter(t => 
    t.asunto?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.folio?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDocumentClick = (id: string) => {
    setSelectedDocument(id);
    router.push('/');
  };

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-surface-base p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header y Buscador Local */}
        <header className="flex items-end justify-between">
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Biblioteca Digital</h1>
            <p className="text-gray-500 font-medium mt-2">Consulta y gestiona los oficios procesados</p>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl shadow-sm border border-gray-100 min-w-[300px]">
              <Search className="text-gray-400" size={20} />
              <input 
                placeholder="Filtrar oficios..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none w-full text-sm font-medium"
              />
            </div>
            <button className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100 text-gray-600 hover:text-brand-600 transition-colors">
              <Filter size={20} />
            </button>
          </div>
        </header>

        {/* Grid de Resultados */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {[...Array(6)].map((_, i) => (
               <div key={i} className="h-48 bg-gray-100 rounded-3xl animate-pulse" />
             ))}
          </div>
        ) : (
          <motion.div 
            {...({
              variants: staggerContainer,
              initial: "hidden", 
              animate: "visible",
              className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            } as any)}
          >
            <AnimatePresence>
              {filteredTramites.map((tramite) => (
                <motion.div 
                  key={tramite.id} 
                  {...({
                    variants: fadeInUp,
                    whileHover: { y: -5, scale: 1.01 },
                    onClick: () => handleDocumentClick(tramite.id),
                    className: "p-6 bg-white/90 backdrop-blur-xl rounded-2xl border border-gray-100 shadow-glass cursor-pointer group"
                  } as any)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-brand-50 text-brand-600 rounded-xl group-hover:bg-brand-500 group-hover:text-white transition-colors">
                      <FileText size={24} />
                    </div>
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-full">
                      {tramite.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-1">{tramite.folio}</h3>
                  <p className="text-sm text-brand-600 font-semibold mb-3">{tramite.remitente}</p>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-4 leading-relaxed">{tramite.asunto}</p>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                    <Clock size={14} />
                    {new Date(tramite.fecha_ingreso).toLocaleDateString('es-MX')}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
