import { authToken } from './authToken';

export const logout = () => {
  authToken.clear(); // Clear localStorage token

  // Optional: Clear additional data (user info, etc.)

  // Redirect to login page (can be customized)
  window.location.href = '/login';
};