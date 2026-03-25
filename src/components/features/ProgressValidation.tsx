import React from 'react';

interface ProgressValidationProps {
  current: number;
  total: number;
  message: string;
}

export const ProgressValidation: React.FC<ProgressValidationProps> = ({ current, total, message }) => {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="flex flex-col items-center justify-center h-full p-10 bg-white/50 backdrop-blur-xl rounded-3xl shadow-xl">
      <div className="w-full max-w-md bg-gray-200 rounded-full h-4 mb-6 overflow-hidden">
        <div 
          className="bg-blue-600 h-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <h3 className="text-2xl font-semibold mb-2 text-gray-800">Analizando Documento</h3>
      <p className="text-gray-500 text-lg mb-8">{message}</p>
      
      <div className="flex gap-4">
        {[...Array(total || 1)].map((_, i) => (
          <div 
            key={i}
            className={`w-3 h-3 rounded-full transition-colors duration-300 ${
              i + 1 <= current ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
