import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines Tailwind CSS classes with clsx and merges them with tailwind-merge.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Define dinámicamente la URL base según el entorno
export const API_BASE = process.env.NODE_ENV === 'development' 
  ? 'http://127.0.0.1:8080' 
  : ''; // En producción (Zero-Install), la URL relativa funcionará nativamente
