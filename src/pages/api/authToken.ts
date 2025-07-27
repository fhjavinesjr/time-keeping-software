// Use localStorage for now
// Later, you can update this file to use cookies instead (e.g., using js-cookie or let the backend handle it entirely).

export const authToken = {
  get: () => localStorage.getItem("authToken"),
  set: (token: string) => localStorage.setItem("authToken", token),
  clear: () => localStorage.removeItem("authToken"),
};