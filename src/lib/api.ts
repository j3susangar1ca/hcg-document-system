import { getFromStorage } from './storage';

export const getAuthHeader = (): Record<string, string> => {
  const token = getFromStorage('jwt_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};
