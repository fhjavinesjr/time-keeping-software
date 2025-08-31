import { localStorageUtil } from '../../lib/utils/localStorageUtil';

export const logout = () => {
  localStorageUtil.clear(); // Clear localStorage token

  // Optional: Clear additional data (user info, etc.)

  // Redirect to login page (can be customized)
  window.location.href = '/login';
};