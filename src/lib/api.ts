// src/lib/api.ts
export const API_BASE = process.env.NODE_ENV === 'development' 
  ? 'http://127.0.0.1:8080' 
  : ''; // En producción, Axum sirve el frontend y la URL es relativa

export const getAuthHeader = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('jwt_token') : null;
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};
