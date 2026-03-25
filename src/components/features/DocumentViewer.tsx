'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Loader2, AlertTriangle, FileText, ZoomIn, ZoomOut } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';

import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// Configuración global del worker (fuera del componente)
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentViewerEnhancedProps {
  documentId?: string;
  zoom?: number;
}

export const DocumentViewerEnhanced = ({ documentId: propDocumentId, zoom = 1 }: DocumentViewerEnhancedProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [token, setToken] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  const selectedDocumentId = useUIStore(s => s.selectedDocumentId);

  const documentId = propDocumentId || selectedDocumentId || '';

  useEffect(() => {
    const savedToken = localStorage.getItem('jwt_token');
    if (savedToken) setToken(savedToken);
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    setError(null);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error('PDF Load Error:', err);
    setError(err.message || 'Error al cargar el documento');
    setIsLoading(false);
  };

  // Opciones memorizadas para evitar re-renderizados innecesarios
  const options = useMemo(() => ({
    httpHeaders: { 'Authorization': `Bearer ${token}` },
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`
  }), [token]);

  // Controles de zoom
  const [currentZoom, setCurrentZoom] = useState(zoom);
  const handleZoomIn = () => setCurrentZoom(prev => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setCurrentZoom(prev => Math.max(prev - 0.2, 0.5));

  if (!documentId || !token) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-gray-500">
        <div className="text-center">
          <FileText size={64} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Ningún documento seleccionado</p>
          <p className="text-sm opacity-75">Selecciona un documento para visualizarlo aquí</p>
        </div>
      </div>
    );
  }

  const apiBase = process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8080' : '';
  const fileUrl = `${apiBase}/api/v1/pdfs/${documentId}`;

  return (
    <div className="w-full flex flex-col bg-gray-50/50 p-4 overflow-auto h-full rounded-2xl">
      {/* Barra de herramientas */}
      <div className="flex items-center justify-between mb-4 p-2 bg-white rounded-lg shadow-sm border">
        <div className="flex items-center gap-2">
          <button 
            onClick={handleZoomOut}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="Acercar"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-sm font-medium w-12 text-center">
            {Math.round(currentZoom * 100)}%
          </span>
          <button 
            onClick={handleZoomIn}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="Alejar"
          >
            <ZoomIn size={18} />
          </button>
        </div>
        
        <div className="text-sm text-gray-500">
          Páginas: {numPages > 0 ? numPages : '?'}
        </div>
      </div>

      {/* Contenedor del PDF */}
      <div className="flex-1 overflow-auto bg-white shadow-inner rounded-xl p-4">
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-brand-600">
            <Loader2 size={48} className="animate-spin" />
            <p className="font-medium text-gray-500">Cargando documento...</p>
          </div>
        )}

        {error && (
          <div className="p-8 text-center flex flex-col items-center text-red-500">
            <AlertTriangle size={48} className="mb-4" />
            <p className="font-bold text-sm">Error al cargar el documento</p>
            <p className="text-xs mt-2 text-gray-500">{error}</p>
          </div>
        )}

        {!error && (
          <Document
            file={fileUrl}
            options={options}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={<div className="h-full flex items-center justify-center"><Loader2 className="animate-spin" /></div>}
            error={<div className="h-full flex items-center justify-center text-red-500">Error</div>}
          >
            {Array.from(new Array(numPages), (el, index) => (
              <div key={`page_${index + 1}`} className="mb-4 last:mb-0 border-b border-gray-100 pb-4 last:border-0">
                <Page 
                  pageNumber={index + 1} 
                  scale={currentZoom} 
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="max-w-full mx-auto shadow-sm"
                />
              </div>
            ))}
          </Document>
        )}
      </div>
    </div>
  );
};
