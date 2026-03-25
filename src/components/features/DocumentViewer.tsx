// src/components/features/DocumentViewer.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { motion } from 'framer-motion';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';

import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

interface DocumentViewerEnhancedProps {
  documentId?: string;
  zoom?: number;
}

export const DocumentViewerEnhanced = ({ documentId: propDocumentId, zoom = 1 }: DocumentViewerEnhancedProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [token, setToken] = useState<string>('');
  const selectedDocumentId = useUIStore(s => s.selectedDocumentId);

  // El ID del documento puede venir del prop (dashboard) o del store global (biblioteca)
  const documentId = propDocumentId || selectedDocumentId || '';

  useEffect(() => {
    // Configurar worker de PDF.js usando la versión de la librería importada
    // Usamos el worker de https://cdn.jsdelivr.net/npm/... para mayor estabilidad en Next.js
    const workerUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    
    // Recuperar token para el middleware JWT de Axum
    setToken(typeof window !== 'undefined' ? localStorage.getItem('jwt_token') || '' : '');
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const options = React.useMemo(() => ({
    httpHeaders: { 'Authorization': `Bearer ${token}` },
    standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`
  }), [token]);

  if (!documentId || !token) return null;

  return (
    <div className="w-full flex justify-center bg-gray-50/50 p-8 overflow-auto h-full rounded-2xl">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="shadow-2xl bg-white origin-top"
      >
        <Document
          file={`/api/v1/pdfs/${documentId}`}
          options={options}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex flex-col items-center justify-center p-32 gap-4 text-brand-600">
              <Loader2 size={48} className="animate-spin" />
              <p className="font-medium text-gray-500 animate-pulse">Cargando stream del Nodo Maestro...</p>
            </div>
          }
          error={
            <div className="p-20 text-center flex flex-col items-center text-red-500">
              <AlertTriangle size={48} className="mb-4" />
              <p className="font-bold">El archivo ya no está disponible en el servidor o el token expiró.</p>
            </div>
          }
        >
          {Array.from(new Array(numPages), (el, index) => (
            <div key={`page_${index + 1}`} className="mb-8 last:mb-0 border-b border-gray-100">
              <Page 
                pageNumber={index + 1} 
                scale={zoom} 
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="max-w-full"
              />
            </div>
          ))}
        </Document>
      </motion.div>
    </div>
  );
};
