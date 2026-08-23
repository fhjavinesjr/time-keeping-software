/**
 * runtimeConfig — resolves configuration values at runtime.
 *
 * Priority: centralized startup settings → deployment environment fallback
 *           → cached post-login settings → baked environment fallback.
 *
 * This allows an administrator to update URLs and settings in the
 * Technical Settings UI without requiring a rebuild. Changes take
 * effect on the next full page load.
 */

import { localStorageUtil } from "./localStorageUtil";

declare global {
  interface Window {
    __ISOFT_RUNTIME_CONFIG__?: Record<string, string | undefined>;
  }
}

function deployedConfig(): Record<string, string | undefined> {
  return typeof window === "undefined" ? {} : window.__ISOFT_RUNTIME_CONFIG__ ?? {};
}

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

const API_ENV_KEY_MAP: Record<ApiService, string> = {
  administrative: "NEXT_PUBLIC_API_BASE_URL_ADMINISTRATIVE",
  hrm: "NEXT_PUBLIC_API_BASE_URL_HRM",
  timekeeping: "NEXT_PUBLIC_API_BASE_URL_TIMEKEEPING",
  payroll: "NEXT_PUBLIC_API_BASE_URL_PAYROLL",
};

const UI_ENV_KEY_MAP: Record<UiApp, string> = {
  administrative: "NEXT_PUBLIC_UI_URL_ADMINISTRATIVE",
  hrm: "NEXT_PUBLIC_UI_URL_HRM",
  timekeeping: "NEXT_PUBLIC_UI_URL_TIMEKEEPING",
  payroll: "NEXT_PUBLIC_UI_URL_PAYROLL",
  "employee-portal": "NEXT_PUBLIC_UI_URL_EMPLOYEE_PORTAL",
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
  "employee-portal": process.env.NEXT_PUBLIC_UI_URL_EMPLOYEE_PORTAL ?? "http://localhost:3081",
};

export const runtimeConfig = {
  getApiUrl(service: ApiService): string {
    const deployed = deployedConfig();
    const centralized = deployed[API_KEY_MAP[service]];
    if (centralized) return centralized;
    const runtimeFallback = deployed[API_ENV_KEY_MAP[service]];
    if (runtimeFallback) return runtimeFallback;
    if (typeof window !== "undefined") {
      const stored = localStorageUtil.getSystemConfig(API_KEY_MAP[service]);
      if (stored) return stored;
    }
    return API_ENV_MAP[service] ?? "";
  },

  getUiUrl(app: UiApp): string {
    const deployed = deployedConfig();
    const centralized = deployed[UI_KEY_MAP[app]];
    if (centralized) return centralized;
    const runtimeFallback = deployed[UI_ENV_KEY_MAP[app]];
    if (runtimeFallback) return runtimeFallback;
    if (typeof window !== "undefined") {
      const stored = localStorageUtil.getSystemConfig(UI_KEY_MAP[app]);
      if (stored) return stored;
    }
    return UI_ENV_MAP[app];
  },

  getInactivityTimeout(): number {
    const deployed = deployedConfig();
    const centralized = deployed["security.inactivity.timeout"];
    if (centralized) return parseInt(centralized, 10);
    const runtimeFallback = deployed.NEXT_PUBLIC_INACTIVITY_TIMEOUT;
    if (runtimeFallback) return parseInt(runtimeFallback, 10);
    if (typeof window !== "undefined") {
      const stored = localStorageUtil.getSystemConfig("security.inactivity.timeout");
      if (stored) return parseInt(stored, 10);
    }
    return parseInt(
      process.env.NEXT_PUBLIC_INACTIVITY_TIMEOUT ??
        "1800",
      10
    );
  },
};
