export const dynamic = "force-dynamic";

const PUBLIC_RUNTIME_KEYS = [
  "api.url.administrative",
  "api.url.hrm",
  "api.url.timekeeping",
  "api.url.payroll",
  "api.url.primehr",
  "ui.url.administrative",
  "ui.url.hrm",
  "ui.url.timekeeping",
  "ui.url.payroll",
  "ui.url.employee-portal",
  "ui.url.primehr",
  "security.inactivity.timeout",
] as const;

const isValidHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
};

const isValidRuntimeValue = (key: string, value: string): boolean => {
  if (key.startsWith("api.url.") || key.startsWith("ui.url.")) {
    return isValidHttpUrl(value);
  }
  if (key === "security.inactivity.timeout") {
    return /^\d+$/.test(value) && Number(value) > 0;
  }
  return false;
};

export async function GET(): Promise<Response> {
  const runtimeConfig: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("NEXT_PUBLIC_") && typeof value === "string") {
      runtimeConfig[key] = value;
    }
  }

  const bootstrapUrl = (
    process.env.HRIS_CONFIG_BOOTSTRAP_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL_ADMINISTRATIVE ??
    ""
  ).trim().replace(/\/$/, "");

  if (bootstrapUrl) {
    try {
      const response = await fetch(`${bootstrapUrl}/api/public/runtime-config`, {
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const centralizedConfig: unknown = await response.json();
      if (!centralizedConfig || typeof centralizedConfig !== "object") {
        throw new Error("Unexpected response body");
      }

      for (const key of PUBLIC_RUNTIME_KEYS) {
        const value = (centralizedConfig as Record<string, unknown>)[key];
        if (typeof value === "string" && isValidRuntimeValue(key, value.trim())) {
          runtimeConfig[key] = value.trim().replace(/\/$/, "");
        }
      }
    } catch (error) {
      console.warn("Unable to load centralized HRIS runtime configuration; using deployment fallbacks.", error);
    }
  }

  const serializedConfig = JSON.stringify(runtimeConfig).replace(/</g, "\\u003c");
  return new Response(`window.__ISOFT_RUNTIME_CONFIG__ = ${serializedConfig};\n`, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/javascript; charset=utf-8",
    },
  });
}
