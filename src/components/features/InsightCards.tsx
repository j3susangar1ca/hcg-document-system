import React from 'react';
import { User, ShieldCheck, Mail, Calendar } from 'lucide-react';

export const IdentityCard = ({ identity }: { identity: any }) => (
  <div className="p-6 bg-white/80 backdrop-blur-md rounded-3xl border border-gray-100 shadow-sm mb-6">
    <div className="flex items-center gap-4 mb-4">
      <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><User size={24} /></div>
      <div>
        <h4 className="font-bold text-gray-800">{identity.nombre || 'Nombre no detectado'}</h4>
        <p className="text-sm text-gray-500">{identity.cargo || 'Cargo/Rol'}</p>
      </div>
    </div>
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-sm text-gray-600">
        <ShieldCheck size={16} /> <span className="font-medium">Curp:</span> {identity.curp || 'N/A'}
      </div>
      <div className="flex items-center gap-3 text-sm text-gray-600">
        <Mail size={16} /> <span className="font-medium">Email:</span> {identity.email || 'N/A'}
      </div>
      <div className="flex items-center gap-3 text-sm text-gray-600">
        <Calendar size={16} /> <span className="font-medium">Fecha:</span> {identity.fecha || 'N/A'}
      </div>
    </div>
  </div>
);

export const SummaryTable = ({ points }: { points: string[] }) => (
  <div className="p-6 bg-white/80 backdrop-blur-md rounded-3xl border border-gray-100 shadow-sm mb-6">
    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
      <span className="w-2 h-6 bg-blue-600 rounded-full" />
      Resumen Ejecutivo
    </h4>
    <ul className="space-y-3">
      {(points || ["Analizando puntos clave..."]).map((point, i) => (
        <li key={i} className="flex gap-3 text-sm text-gray-600">
          <span className="text-blue-600 font-bold">•</span>
          {point}
        </li>
      ))}
    </ul>
  </div>
);

export const ActionCard = ({ action }: { action: any }) => (
  <div className="p-6 bg-[#0078D4] text-white rounded-3xl shadow-lg shadow-blue-200">
    <h4 className="font-bold mb-2">Sugerencia de Trámite</h4>
    <p className="text-white text-sm mb-4">{action?.descripcion || "Recomendando siguiente acción basada en historial..."}</p>
    <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-sm font-medium border border-white/30 text-white">
      {action?.tipo || "Clasificando..."}
    </div>
  </div>
);
