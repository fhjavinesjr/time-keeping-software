import { AUTH_CONFIG } from "./authConfig";
import { setCookie } from "./cookies";
import { runtimeConfig } from "./runtimeConfig";

export type SsoTarget = "administrative" | "hrm" | "timekeeping" | "payroll";

type PermissionRuleset = {
  permissionName: string;
  isAdministrator: boolean;
  permissionData?: string | null;
};

type SsoExchangeResponse = {
  token: string;
  employeeNo: string;
  employeeRole: string;
  target: SsoTarget;
  permission: PermissionRuleset | null;
  systemConfig: Array<{ configKey: string; configValue: string }>;
};

type EmployeeBootstrap = {
  employeeId: number;
  employeeNo: string;
  biometricNo?: string;
  fullName: string;
};

const normalizeEmployeeNo = (value: string) => value.trim().toLowerCase();

export async function bootstrapSso(code: string, target: SsoTarget): Promise<void> {
  const exchangeResponse = await fetch(
    `${runtimeConfig.getApiUrl("administrative")}/api/sso/exchange`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, target }),
    }
  );

  if (!exchangeResponse.ok) {
    const body = await exchangeResponse.json().catch(() => null) as
      | { detail?: string; message?: string }
      | null;
    throw new Error(body?.detail ?? body?.message ?? "The single sign-on link is invalid or expired.");
  }

  const exchange = await exchangeResponse.json() as SsoExchangeResponse;
  if (exchange.target !== target) {
    throw new Error("The single sign-on response was issued for another module.");
  }
  localStorage.setItem("authToken", exchange.token);

  const configMap: Record<string, string> = {};
  exchange.systemConfig.forEach((item) => { configMap[item.configKey] = item.configValue; });
  localStorage.setItem("systemConfig", JSON.stringify(configMap));

  const employeesResponse = await fetch(
    `${runtimeConfig.getApiUrl("hrm")}/api/employees/basicInfo`,
    { headers: { Authorization: `Bearer ${exchange.token}` } }
  );
  if (!employeesResponse.ok) {
    throw new Error("Your employee profile could not be prepared for this module.");
  }

  const employees = await employeesResponse.json() as EmployeeBootstrap[];
  const currentEmployee = employees.find(
    (employee) => normalizeEmployeeNo(employee.employeeNo) === normalizeEmployeeNo(exchange.employeeNo)
  );
  if (!currentEmployee) {
    throw new Error("The signed-in employee record could not be found.");
  }

  localStorage.setItem("employees", JSON.stringify(
    employees.filter((employee) => normalizeEmployeeNo(employee.employeeNo) !== "admin")
  ));
  localStorage.setItem("employeeNo", currentEmployee.employeeNo);
  localStorage.setItem("employeeFullname", currentEmployee.fullName);
  localStorage.setItem("employeeId", String(currentEmployee.employeeId));
  localStorage.setItem("biometricNo", currentEmployee.biometricNo ?? "");
  localStorage.setItem("userRole", exchange.employeeRole);

  const isInstallAdmin = normalizeEmployeeNo(currentEmployee.employeeNo) === "admin";
  if (!isInstallAdmin && !exchange.permission) {
    throw new Error("No permission ruleset is assigned to this account.");
  }
  localStorage.setItem(
    "isAdministrator",
    isInstallAdmin || exchange.permission?.isAdministrator ? "true" : "false"
  );
  localStorage.setItem("permissionName", exchange.permission?.permissionName ?? "");
  if (isInstallAdmin) {
    localStorage.setItem("permissionData", "__superadmin__");
  } else {
    try {
      const permissionData: unknown = JSON.parse(exchange.permission?.permissionData ?? "{}");
      localStorage.setItem(
        "permissionData",
        JSON.stringify(permissionData && typeof permissionData === "object" ? permissionData : {})
      );
    } catch {
      localStorage.setItem("permissionData", "{}");
    }
  }

  const now = Date.now();
  setCookie(AUTH_CONFIG.COOKIE.IS_LOGGED_IN, "true", AUTH_CONFIG.INACTIVITY_LIMIT);
  setCookie(AUTH_CONFIG.COOKIE.LAST_ACTIVITY, now.toString(), AUTH_CONFIG.INACTIVITY_LIMIT);
  localStorage.setItem(AUTH_CONFIG.COOKIE.IS_LOGGED_IN, "true");
  localStorage.setItem(AUTH_CONFIG.COOKIE.LAST_ACTIVITY, now.toString());
}

