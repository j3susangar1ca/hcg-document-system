'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useUIStore } from '@/store/useUIStore';
import { API_BASE, getAuthHeader } from '@/lib/api';

import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// ✅ CORRECCIÓN: Worker global sin espacios y con versión exacta
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentViewerEnhancedProps {
  documentId?: string;
  zoom?: number;
}

export const DocumentViewerEnhanced = ({ documentId: propDocumentId, zoom = 1 }: DocumentViewerEnhancedProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const selectedDocumentId = useUIStore(s => s.selectedDocumentId);

  const documentId = propDocumentId || selectedDocumentId || '';

  // El token se maneja ahora a través de getAuthHeader() directamente en las opciones del Document

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  // ✅ CORRECCIÓN: Opciones sin espacios y con recursos necesarios para fuentes CJK/Especiales
  const options = useMemo(() => ({
    httpHeaders: getAuthHeader(),
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`
  }), []);

  if (!documentId) return null;

  // Construcción de la URL usando el puerto 8080 en desarrollo
  const fileUrl = `${API_BASE}/api/v1/pdfs/${documentId}`;

  return (
    <div className="w-full flex justify-center bg-gray-50/50 p-8 overflow-auto h-full rounded-2xl">
      <div className="origin-top shadow-2xl bg-white rounded-xl overflow-hidden">
        <Document
          file={fileUrl}
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
              <p className="font-bold text-sm">El archivo no está disponible o el token expiró.</p>
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
      </div>
    </div>
  );
};


