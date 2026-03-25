"use client";

import React, { useRef, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import { FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const DocumentViewerEnhanced: React.FC<{ pages?: string[] }> = ({ pages = [] }) => {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: pages.length || 1,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 1100, // Altura estimada de página A4 en px
    overscan: 2, 
  });

  if (pages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
        <div className="w-64 h-80 bg-white shadow-glass rounded-sm border border-gray-100 flex flex-col items-center justify-center p-8 text-center">
          <FileText size={48} className="text-gray-200 mb-4" />
          <p className="text-sm font-medium">Arrastra un documento para comenzar el análisis</p>
          <div className="w-full h-1 bg-gray-100 rounded-full mt-6 overflow-hidden">
             <motion.div 
               {...({
                 className: "h-full bg-brand-500/20",
                 animate: { x: [-100, 200] },
                 transition: { repeat: Infinity, duration: 2 },
                 style: { width: '40%' }
               } as any)}
             />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-auto bg-gray-100/50 p-8 scroll-smooth">
      <div 
        style={{ 
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
        className="max-w-4xl mx-auto"
      >
        {virtualizer.getVirtualItems().map((virtualPage) => (
          <div
            key={virtualPage.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualPage.size}px`,
              transform: `translateY(${virtualPage.start}px)`,
            }}
            className="pb-8"
          >
            <PageCanvas 
              index={virtualPage.index}
              src={pages[virtualPage.index]}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const PageCanvas = ({ index, src }: { index: number; src?: string }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <motion.div 
      {...({
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        className: "bg-white shadow-glass-lg rounded-sm overflow-hidden aspect-[1/1.41] flex flex-col relative"
      } as any)}
    >
      <div className="absolute top-4 right-4 bg-black/5 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold text-gray-500 z-10">
        PÁGINA {index + 1}
      </div>
      
      {src ? (
        <img 
          src={src} 
          alt={`Página ${index + 1}`}
          className={cn("w-full h-full object-contain transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0")}
          onLoad={() => setLoaded(true)}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-200">
           <FileText size={64} />
           <p className="mt-4 text-sm font-medium text-gray-400">Página en blanco</p>
        </div>
      )}

      {!loaded && src && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <Loader2 className="animate-spin text-brand-500" size={32} />
        </div>
      )}
    </motion.div>
  );
};
