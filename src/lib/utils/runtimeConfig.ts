/**
 * runtimeConfig — resolves configuration values at runtime.
 *
 * Priority: localStorage (populated at login from the backend SystemConfig API)
 *           → process.env fallback (baked at build time)
 *
 * This allows an administrator to update URLs and settings in the
 * Technical Settings UI without requiring a rebuild. Changes take
 * effect on the next login or full page refresh.
 */

import { localStorageUtil } from "./localStorageUtil";

type ApiService = "administrative" | "hrm" | "timekeeping" | "payroll";
type UiApp = "administrative" | "hrm" | "timekeeping" | "payroll" | "employee-portal";

const API_KEY_MAP: Record<ApiService, string> = {
  administrative: "api.url.administrative",
  hrm: "api.url.hrm",
  timekeeping: "api.url.timekeeping",
  payroll: "api.url.payroll",
};

const UI_KEY_MAP: Record<UiApp, string> = {
  administrative: "ui.url.administrative",
  hrm: "ui.url.hrm",
  timekeeping: "ui.url.timekeeping",
  payroll: "ui.url.payroll",
  "employee-portal": "ui.url.employee-portal",
};

const API_ENV_MAP: Record<ApiService, string | undefined> = {
  administrative: process.env.NEXT_PUBLIC_API_BASE_URL_ADMINISTRATIVE,
  hrm: process.env.NEXT_PUBLIC_API_BASE_URL_HRM,
  timekeeping: process.env.NEXT_PUBLIC_API_BASE_URL_TIMEKEEPING,
  payroll: process.env.NEXT_PUBLIC_API_BASE_URL_PAYROLL,
};

const UI_ENV_MAP: Record<UiApp, string> = {
  administrative: process.env.NEXT_PUBLIC_UI_URL_ADMINISTRATIVE ?? "http://localhost:3082",
  hrm: process.env.NEXT_PUBLIC_UI_URL_HRM ?? "http://localhost:3085",
  timekeeping: process.env.NEXT_PUBLIC_UI_URL_TIMEKEEPING ?? "http://localhost:3083",
  payroll: process.env.NEXT_PUBLIC_UI_URL_PAYROLL ?? "http://localhost:3087",
  "employee-portal": "http://localhost:3081",
};

export const runtimeConfig = {
  getApiUrl(service: ApiService): string {
    if (typeof window !== "undefined") {
      const stored = localStorageUtil.getSystemConfig(API_KEY_MAP[service]);
      if (stored) return stored;
    }
    return API_ENV_MAP[service] ?? "";
  },

  getUiUrl(app: UiApp): string {
    if (typeof window !== "undefined") {
      const stored = localStorageUtil.getSystemConfig(UI_KEY_MAP[app]);
      if (stored) return stored;
    }
    return UI_ENV_MAP[app];
  },

  getInactivityTimeout(): number {
    if (typeof window !== "undefined") {
      const stored = localStorageUtil.getSystemConfig("security.inactivity.timeout");
      if (stored) return parseInt(stored, 10);
    }
    return parseInt(process.env.NEXT_PUBLIC_INACTIVITY_TIMEOUT ?? "1800", 10);
  },
};
