
export const setCookie = (
  name: string,
  value: string,
  maxAgeSeconds: number
) => {
  if (typeof document === "undefined") return;

  const expires = new Date(
    Date.now() + maxAgeSeconds * 1000
  ).toUTCString();

  document.cookie = `${name}=${value}; path=/; expires=${expires}; SameSite=Lax`;
};

export const getCookie = (name: string) => {
  if (typeof document === "undefined") return null;

  const match = document.cookie.match(
    new RegExp(`(^| )${name}=([^;]+)`)
  );
  return match ? match[2] : null;
};

export const deleteCookie = (name: string) => {
  if (typeof document === "undefined") return;

  document.cookie = `${name}=; path=/; max-age=0`;
};