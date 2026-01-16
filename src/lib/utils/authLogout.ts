import { AUTH_CONFIG } from "./authConfig";
import { deleteCookie } from "./cookies";

export const authLogout = () => {
  // Delete all cookies defined in AUTH_CONFIG
  Object.values(AUTH_CONFIG.COOKIE).forEach(deleteCookie);

  localStorage.setItem("LOGOUT_SIGNAL", Date.now().toString());
};