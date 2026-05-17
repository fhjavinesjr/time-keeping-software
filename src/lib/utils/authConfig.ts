// src/lib/utils/auth.config.ts

export const AUTH_CONFIG = {
  COOKIE: {
    IS_LOGGED_IN: "isLoggedIn",
    LAST_ACTIVITY: "lastActivity",
    TOKEN: "authToken",
  },

  PUBLIC_PAGES: [
    "/administrative/login",
    "/administrative/registration",
    "/employee-portal/login",
    "/employee-portal/registration",
    "/time-keeping/login",
    "/time-keeping/registration",
  ],

  INACTIVITY_LIMIT: parseInt(process.env.NEXT_PUBLIC_INACTIVITY_TIMEOUT ?? '1800', 10), // seconds (configurable via NEXT_PUBLIC_INACTIVITY_TIMEOUT)
};