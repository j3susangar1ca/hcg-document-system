"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Search, FileText, ChevronRight, ClipboardList, User, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { cn, API_BASE } from '@/lib/utils';

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  type: 'document' | 'tramite' | 'user';
  documento_id?: string;
  curp?: string;
  email?: string;
  fecha?: string;
  folio?: string;
}

export const EnhancedCommandBar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
      if (isOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
        }
        if (e.key === 'Enter' && results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (text.length < 2) {
      setResults([]);
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/api/v1/documentos/search?q=${encodeURIComponent(text)}`);
      const data = await response.json();
      // Map existing results to SearchResult format
      const mappedResults = (data.resultados || []).map((res: any) => ({
        id: res.documento_id,
        title: res.tramite_folio || "Documento",
        snippet: res.snippet,
        type: 'document'
      }));
      setResults(mappedResults);
      setSelectedIndex(0);
    } catch (e) {
      console.error("Search failed:", e);
    }
  };

  const handleSelect = (result: SearchResult) => {
    // router.push(`/document/${result.id}`);
    console.log("Selected:", result);
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            {...({
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              exit: { opacity: 0 },
              className: "fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm",
              onClick: () => setIsOpen(false)
            } as any)}
          />

          <motion.div
            {...({
              initial: { opacity: 0, scale: 0.95, y: -20 },
              animate: { opacity: 1, scale: 1, y: 0 },
              exit: { opacity: 0, scale: 0.95, y: -20 },
              transition: { type: 'spring', stiffness: 400, damping: 30 },
              className: "fixed left-1/2 top-[15vh] z-[101] w-full max-w-2xl -translate-x-1/2 rounded-3xl bg-white shadow-2xl overflow-hidden",
              onClick: (e: React.MouseEvent) => e.stopPropagation()
            } as any)}
          >
            <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100">
              <Search className="text-gray-400" size={22} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Buscar documentos, trámites, usuarios..."
                className="flex-1 bg-transparent text-lg outline-none placeholder:text-gray-400 text-gray-900"
              />
              <kbd className="px-2 py-1 bg-gray-100 rounded-md text-xs font-mono text-gray-500">
                ESC
              </kbd>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {results.length === 0 && query.length >= 2 ? (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl mx-auto mb-4 
                    flex items-center justify-center">
                    <Search className="text-gray-400" size={24} />
                  </div>
                  <p className="text-gray-500">No se encontraron resultados</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Intenta con otros términos
                  </p>
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-1">
                  {results.map((result, index) => (
                    <button
                      key={result.id}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        "w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-left transition-all",
                        index === selectedIndex 
                          ? "bg-brand-50 shadow-sm" 
                          : "hover:bg-gray-50"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        result.type === 'document' ? "bg-blue-50 text-blue-500" :
                        result.type === 'tramite' ? "bg-green-50 text-green-500" :
                        "bg-purple-50 text-purple-500"
                      )}>
                        {result.type === 'document' ? <FileText size={18} /> :
                         result.type === 'tramite' ? <ClipboardList size={18} /> :
                         <User size={18} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">
                          {result.title}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {result.snippet.replace(/<b>/g, '').replace(/<\/b>/g, '')}
                        </p>
                      </div>
                      <ChevronRight className={cn(
                        "transition-colors",
                        index === selectedIndex ? "text-brand-500" : "text-gray-300"
                      )} size={18} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-400 text-sm">
                  Empieza a escribir para buscar...
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 
              flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white rounded border text-[10px]">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-white rounded border text-[10px]">↓</kbd>
                para navegar
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white rounded border text-[10px]">↵</kbd>
                para seleccionar
              </span>
              <span className="ml-auto flex items-center gap-1">
                Powered by FTS5
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
