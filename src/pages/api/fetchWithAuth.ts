import { authToken } from './authToken';

export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = authToken.get();

  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
};