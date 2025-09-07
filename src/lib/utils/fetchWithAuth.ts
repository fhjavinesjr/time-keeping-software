import { localStorageUtil } from './localStorageUtil';

export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = localStorageUtil.get();

  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
};