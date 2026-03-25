import React from 'react';
import { Search, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface DocumentViewerProps {
  zoom?: number;
  rotation?: number;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ zoom = 100, rotation = 0 }) => {
  return (
    <div className="flex-1 overflow-auto bg-[#f3f3f3] flex flex-col items-center p-8">
      <div className="sticky top-0 z-20 w-full flex justify-between items-center mb-6 px-4 py-2 bg-white/60 backdrop-blur-md rounded-2xl shadow-sm border border-gray-100">
        <div className="flex gap-2">
          <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"><ZoomIn size={20} /></button>
          <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"><ZoomOut size={20} /></button>
          <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"><RotateCcw size={20} /></button>
        </div>
        <div className="flex-1 mx-8 max-w-lg relative text-gray-400 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-blue-600" size={18} />
          <input 
            type="text" 
            placeholder="Buscar en el documento (FTS5)..." 
            className="w-full bg-gray-50/50 border border-gray-100 rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:bg-white transition-all"
          />
        </div>
        <div className="text-gray-500 font-medium">Page 1 of 1</div>
      </div>

      <div 
        className="bg-white shadow-2xl rounded-sm transition-all duration-300 ease-out"
        style={{ 
          width: '850px', 
          height: '1100px',
          transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
        }}
      >
        <div className="flex flex-col items-center justify-center h-full text-gray-200">
             <div className="w-1/2 h-4 bg-gray-100 rounded-full mb-4" />
             <div className="w-2/3 h-4 bg-gray-100 rounded-full mb-4" />
             <div className="w-1/3 h-4 bg-gray-100 rounded-full mb-8" />
             <div className="w-full h-64 bg-gray-50 rounded-xl mx-8" />
        </div>
      </div>
    </div>
  );
};
