"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Layers, 
  Scan, 
  Sparkles, 
  Database,
  Clock 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProgressValidationProps {
  current: number;
  total: number;
  message: string;
  stage?: 'rasterizing' | 'ocr' | 'vlm' | 'indexing';
}

export const EnhancedProgressValidation = ({ 
  current, 
  total, 
  message,
  stage = 'rasterizing'
}: ProgressValidationProps) => {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  
  const stages = [
    { id: 'rasterizing', label: 'Rasterizando', icon: Layers },
    { id: 'ocr', label: 'Extrayendo OCR', icon: Scan },
    { id: 'vlm', label: 'Analizando VLM', icon: Sparkles },
    { id: 'indexing', label: 'Indexando', icon: Database },
  ] as const;
  
  const currentStageIndex = stages.findIndex(s => s.id === stage);

  return (
    <motion.div
      {...({
        initial: { opacity: 0, scale: 0.95 },
        animate: { opacity: 1, scale: 1 },
        className: "flex flex-col items-center justify-center h-full max-w-lg mx-auto p-10 bg-white/50 backdrop-blur-xl rounded-4xl shadow-glass"
      } as any)}
    >
      {/* Main Progress Circle */}
      <div className="relative w-48 h-48 mb-8">
        {/* Background Circle */}
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="96" cy="96" r="88"
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="8"
          />
          {/* Progress Circle */}
          <motion.circle
            {...({
              cx: "96", cy: "96", r: "88",
              fill: "none",
              stroke: "url(#progressGradient)",
              strokeWidth: "8",
              strokeLinecap: "round",
              strokeDasharray: 2 * Math.PI * 88,
              initial: { strokeDashoffset: 2 * Math.PI * 88 },
              animate: { strokeDashoffset: 2 * Math.PI * 88 * (1 - percentage / 100) },
              transition: { duration: 0.5, ease: 'easeOut' }
            } as any)}
          />
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0078D4" />
              <stop offset="100%" stopColor="#00D9FF" />
            </linearGradient>
          </defs>
        </svg>
        
        {/* Center Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span 
            {...({
              key: percentage,
              initial: { scale: 1.2, opacity: 0 },
              animate: { scale: 1, opacity: 1 },
              className: "text-4xl font-bold text-gray-900"
            } as any)}
          >
            {Math.round(percentage)}%
          </motion.span>
          <span className="text-sm text-gray-500">
            Página {current} de {total}
          </span>
        </div>
        
        {/* Pulse Animation */}
        <motion.div
          {...({
            className: "absolute inset-0 rounded-full border-4 border-brand-200",
            animate: { scale: [1, 1.05, 1], opacity: [0.5, 0, 0.5] },
            transition: { duration: 2, repeat: Infinity }
          } as any)}
        />
      </div>

      {/* Stage Progress */}
      <div className="w-full mb-6">
        <div className="flex items-center justify-between mb-4">
          {stages.map((s, i) => (
            <div key={s.id} className="flex flex-col items-center gap-2">
              <motion.div
                {...({
                  className: cn("w-10 h-10 rounded-xl flex items-center justify-center", i < currentStageIndex ? "bg-brand-500 text-white" : i === currentStageIndex ? "bg-brand-100 text-brand-600 ring-2 ring-brand-300" : "bg-gray-100 text-gray-400"),
                  animate: i === currentStageIndex ? { scale: [1, 1.1, 1] } : {},
                  transition: { duration: 1, repeat: Infinity }
                } as any)}
              >
                <s.icon size={18} />
              </motion.div>
              <span className={cn(
                "text-xs font-medium",
                i <= currentStageIndex ? "text-gray-700" : "text-gray-400"
              )}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
        
        {/* Progress Line */}
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            {...({
              className: "h-full bg-gradient-to-r from-brand-500 to-brand-400",
              initial: { width: 0 },
              animate: { width: `${(currentStageIndex / (stages.length - 1)) * 100}%` },
              transition: { duration: 0.5 }
            } as any)}
          />
        </div>
      </div>

      {/* Message */}
      <motion.p
        {...({
          key: message,
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          className: "text-gray-600 text-center font-medium"
        } as any)}
      >
        {message}
      </motion.p>

      {/* Time Estimate */}
      <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
        <Clock size={14} />
        <span>Tiempo estimado: ~{Math.ceil((total - current) * 40 / 60)} min</span>
      </div>
    </motion.div>
  );
};
