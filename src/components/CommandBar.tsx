import React, { useState, useEffect } from 'react';
import { Search, FileText, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const GlobalCommandBar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);

  // Escucha de teclado Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (text.length < 3) return;
    
    // Consumo del endpoint FTS5
    try {
      const response = await fetch(`/api/v1/documentos/search?q=${encodeURIComponent(text)}`);
      const data = await response.json();
      setResults(data.resultados || []);
    } catch (e) {
      console.error("Search failed:", e);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
          onClick={() => setIsOpen(false)}
        >
          <motion.div 
            initial={{ scale: 0.95, y: -20 }} animate={{ scale: 1, y: 0 }}
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 flex items-center gap-4 border-b">
              <Search className="text-blue-600" size={24} />
              <input 
                autoFocus placeholder="Búsqueda inteligente en documentos indexados..."
                className="flex-1 bg-transparent border-none outline-none text-lg font-medium"
                onChange={(e) => handleSearch(e.target.value)}
              />
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-bold text-gray-400">ESC</kbd>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2">
              {results.map((res: any) => (
                <div key={res.documento_id} className="p-4 hover:bg-blue-50 rounded-2xl cursor-pointer group transition-colors">
                  <div className="flex items-center gap-3 mb-1">
                    <FileText size={16} className="text-gray-400 group-hover:text-blue-600" />
                    <span className="font-bold text-gray-900">{res.tramite_folio}</span>
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-2 italic" 
                     dangerouslySetInnerHTML={{ __html: res.snippet }} />
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
