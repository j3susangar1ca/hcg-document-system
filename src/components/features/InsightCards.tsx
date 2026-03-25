"use client";

import React from 'react';
import { 
  User, 
  ShieldCheck, 
  Mail, 
  Calendar, 
  Briefcase, 
  Hash,
  Sparkles
} from 'lucide-react';
import { motion } from 'framer-motion';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import { Skeleton } from '@/components/ui/Skeleton';

interface IdentityData {
  nombre: string;
  cargo: string;
  curp?: string;
  email?: string;
  fecha?: string;
  folio?: string;
}

interface IdentityProps {
  identity: Partial<IdentityData>;
  isLoading?: boolean;
}


export const EnhancedIdentityCard = ({ identity, isLoading }: IdentityProps) => {
  if (isLoading) {
    return <IdentityCardSkeleton />;
  }

  return (
    <motion.div
      {...({
        variants: staggerContainer,
        initial: "hidden",
        animate: "visible",
        className: "relative p-6 bg-white/90 backdrop-blur-xl rounded-3xl border border-gray-100/50 shadow-glass overflow-hidden"
      } as any)}
    >
      {/* Gradient Accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r 
        from-brand-500 via-brand-400 to-brand-300" />
      
      {/* Header */}
      <motion.div 
        {...({
          variants: fadeInUp,
          className: "flex items-center gap-4 mb-5"
        } as any)}
      >
        <div className="relative">
          <div className="w-14 h-14 bg-gradient-to-br from-brand-50 to-brand-100 
            rounded-2xl flex items-center justify-center shadow-inner-glow">
            <User className="text-brand-500" size={24} />
          </div>
          {/* Status Indicator */}
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-success 
            rounded-full border-2 border-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg text-gray-900 truncate">
            {identity.nombre || 'Nombre no detectado'}
          </h3>
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <Briefcase size={14} className="text-gray-400" />
            {identity.cargo || 'Cargo/Rol'}
          </p>
        </div>
      </motion.div>

      {/* Details Grid */}
      <motion.div 
        {...({
          variants: fadeInUp,
          className: "grid grid-cols-2 gap-3"
        } as any)}
      >
        <DetailItem icon={ShieldCheck} label="CURP" value={identity.curp} />
        <DetailItem icon={Mail} label="Email" value={identity.email} />
        <DetailItem icon={Calendar} label="Fecha" value={identity.fecha} />
        <DetailItem icon={Hash} label="Folio" value={identity.folio} />
      </motion.div>

      {/* Decorative Pattern */}
      <div className="absolute bottom-0 right-0 w-32 h-32 opacity-5 pointer-events-none">
        <svg viewBox="0 0 100 100" className="w-full h-full text-brand-500">
          <circle cx="80" cy="80" r="60" fill="currentColor" />
        </svg>
      </div>
    </motion.div>
  );
};

const DetailItem = ({ icon: Icon, label, value }: { icon: any, label: string, value?: string }) => (
  <div className="flex items-start gap-2 p-3 bg-gray-50/50 rounded-xl">
    <Icon size={16} className="text-gray-400 mt-0.5" />
    <div className="min-w-0">
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-sm text-gray-700 font-medium truncate">{value || '—'}</p>
    </div>
  </div>
);

const IdentityCardSkeleton = () => (
  <div className="p-6 bg-white/90 backdrop-blur-xl rounded-3xl border border-gray-100/50">
    <div className="flex items-center gap-4 mb-5">
      <Skeleton className="w-14 h-14 rounded-2xl" />
      <div className="flex-1">
        <Skeleton className="h-5 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-14 rounded-xl" />
      ))}
    </div>
  </div>
);

export const SummaryTable = ({ points }: { points: string[] }) => (
  <motion.div 
    {...({
      variants: fadeInUp,
      initial: "hidden",
      animate: "visible",
      className: "p-6 bg-white/80 backdrop-blur-md rounded-3xl border border-gray-100 shadow-glass mb-6"
    } as any)}
  >
    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
      <span className="w-2 h-6 bg-brand-600 rounded-full" />
      Resumen Ejecutivo
    </h4>
    <ul className="space-y-3">
      {(points || ["Analizando puntos clave..."]).map((point, i) => (
        <motion.li 
          {...({
            key: i,
            initial: { opacity: 0, x: -10 },
            animate: { opacity: 1, x: 0 },
            transition: { delay: i * 0.1 },
            className: "flex gap-3 text-sm text-gray-600"
          } as any)}
        >
          <span className="text-brand-600 font-bold">•</span>
          {point}
        </motion.li>
      ))}
    </ul>
  </motion.div>
);

export const ActionCard = ({ action }: { action: any }) => (
  <motion.div 
    {...({
      variants: fadeInUp,
      initial: "hidden",
      animate: "visible",
      whileHover: { scale: 1.02 },
      className: "p-6 bg-brand-600 text-white rounded-3xl shadow-brand-lg"
    } as any)}
  >
    <h4 className="font-bold mb-2 flex items-center gap-2">
      <Sparkles size={18} />
      Sugerencia de Trámite
    </h4>
    <p className="text-brand-50 text-sm mb-4">{action?.descripcion || "Recomendando siguiente acción basada en historial..."}</p>
    <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-sm font-medium border border-white/30 inline-block">
      {action?.tipo || "Clasificando..."}
    </div>
  </motion.div>
);
