"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/sidebar/Sidebar";
import React, { useEffect, useState } from "react";
import { localStorageUtil } from "@/lib/utils/localStorageUtil";
import { runtimeConfig } from "@/lib/utils/runtimeConfig";
import { fetchWithAuth } from "@/lib/utils/fetchWithAuth";

interface LayoutClientWrapperProps {
  children: React.ReactNode;
}

export default function LayoutClientWrapper({
  children,
}: LayoutClientWrapperProps) {
  const pathname = usePathname() || "";
  const hideSidebar =
    pathname.endsWith("/login") ||
    pathname.endsWith("/registration");
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [headerUserInfo, setHeaderUserInfo] = useState({
    employeeNo: "",
    fullName: "",
    position: "",
    businessUnit: "",
  });

  useEffect(() => {
    if (hideSidebar) return;

    const employeeNo = localStorageUtil.getEmployeeNo() ?? "";
    const fullName = localStorageUtil.getEmployeeFullname() ?? "";
    const normalizeEmployeeNo = (value?: string | null) =>
      String(value ?? "").trim().toLowerCase();
    const isBaseEntry = (base: unknown) =>
      String(base ?? "").trim().toLowerCase() === "yes" || base === true;

    setHeaderUserInfo((prev) => ({
      ...prev,
      employeeNo,
      fullName,
    }));

    const API_HRM = runtimeConfig.getApiUrl("hrm");
    const API_ADMIN = runtimeConfig.getApiUrl("administrative");
    let cancelled = false;

    const resolveAndLoadHeaderDetails = async () => {
      let resolvedEmployeeId = localStorageUtil.getEmployeeId();

      if (!resolvedEmployeeId && employeeNo) {
        try {
          const empRes = await fetchWithAuth(`${API_HRM}/api/employees/basicInfo`);
          if (empRes.ok) {
            const employees = (await empRes.json()) as Array<{
              employeeId: string | number;
              employeeNo: string;
              fullName?: string;
            }>;

            const matched = employees.find(
              (emp) =>
                normalizeEmployeeNo(emp.employeeNo) === normalizeEmployeeNo(employeeNo)
            );

            if (matched) {
              resolvedEmployeeId = Number(matched.employeeId);
              localStorageUtil.setEmployeeId(resolvedEmployeeId);
              if (!fullName && matched.fullName) {
                localStorageUtil.setEmployeeFullname(matched.fullName);
                setHeaderUserInfo((prev) => ({ ...prev, fullName: matched.fullName ?? prev.fullName }));
              }
            }
          }
        } catch {
          // Continue with currently available header identity.
        }
      }

      if (!resolvedEmployeeId) return;

      Promise.all([
        fetchWithAuth(
          `${API_HRM}/api/employeeAppointment/getLatestEmployeeAppointmentByEmployeeId/${resolvedEmployeeId}`
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetchWithAuth(`${API_ADMIN}/api/job-position/get-all`)
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetchWithAuth(`${API_ADMIN}/api/manage-personnel/get-all`)
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        fetchWithAuth(`${API_ADMIN}/api/businessUnits/get-all`)
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
      ])
        .then(([appointment, jobPositions, personnel, businessUnits]) => {
          if (cancelled) return;

          const jobPositionId = appointment?.jobPositionId;
          const position = (
            jobPositions as { jobPositionId: number; jobPositionName: string }[]
          ).find((jp) => jp.jobPositionId === jobPositionId)?.jobPositionName ?? "";

          const baseEntry = (
            personnel as { employeeId: number | string; base: string | boolean; businessUnitId: number }[]
          ).find(
            (p) =>
              String(p.employeeId) === String(resolvedEmployeeId) &&
              isBaseEntry(p.base)
          );

          const businessUnitId = baseEntry?.businessUnitId;
          const businessUnit = (
            businessUnits as { businessUnitsId: number; businessUnitsName: string }[]
          ).find((bu) => bu.businessUnitsId === businessUnitId)?.businessUnitsName ?? "";

          setHeaderUserInfo((prev) => ({
            ...prev,
            position,
            businessUnit,
          }));
        })
        .catch(() => {
          // Keep header usable even if optional profile details fail to load.
        });
    };

    resolveAndLoadHeaderDetails();

    return () => {
      cancelled = true;
    };
  }, [hideSidebar, pathname]);

  // Auth pages → content only
  if (hideSidebar) {
    return <main style={{ padding: 20 }}>{children}</main>;
  }

  // Protected pages → sidebar + content
  return (
    <>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 38, backgroundColor: "#1a3c6e", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px 0 20px", fontSize: 13, fontWeight: 600, letterSpacing: "0.5px", zIndex: 1100, flexShrink: 0 }}>
        <span>ISOFT HRIS</span>
        <div
          style={{ position: "relative" }}
          onMouseEnter={() => setShowUserDetails(true)}
          onMouseLeave={() => setShowUserDetails(false)}
          onFocus={() => setShowUserDetails(true)}
          onBlur={() => setShowUserDetails(false)}
          tabIndex={0}
          aria-label="Logged-in user information"
        >
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.35)",
              borderRadius: 999,
              padding: "4px 10px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11,
              lineHeight: 1,
              background: "rgba(255,255,255,0.1)",
              maxWidth: "60vw",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={`${headerUserInfo.employeeNo || "No Employee No"} - ${headerUserInfo.fullName || "User"}`}
          >
            <span style={{ opacity: 0.9 }}>{headerUserInfo.employeeNo || "No Employee No"}</span>
            <span style={{ opacity: 0.6 }}>|</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {headerUserInfo.fullName || "User"}
            </span>
          </div>

          {showUserDetails && (
            <div
              style={{
                position: "absolute",
                top: 34,
                right: 0,
                minWidth: 230,
                maxWidth: 320,
                background: "#ffffff",
                color: "#111827",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
                padding: "10px 12px",
                letterSpacing: 0,
                zIndex: 1200,
              }}
            >
              <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>Position</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>
                {headerUserInfo.position || "Not available"}
              </div>
              <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>Business Unit</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>
                {headerUserInfo.businessUnit || "Not available"}
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", minHeight: "100vh", marginTop: 38 }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 260,
          flexShrink: 0,
          position: "sticky",
          top: 38,
          height: "calc(100vh - 38px)",
          zIndex: 1000,
        }}
      >
        <Sidebar />
      </aside>

      {/* Page content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <main style={{ flex: 1, padding: 20 }}>
          {children}
        </main>
      </div>
    </div>
    <footer style={{ position: "fixed", bottom: 12, right: 16, fontSize: 9, color: "#9ca3af", textAlign: "right", lineHeight: 1.5, pointerEvents: "none", zIndex: 999 }}>
      <div>Version 1.0.0 | {new Date().getFullYear()} &copy; ISOFT HRIS. All Rights Reserved.</div>
      <div></div>
    </footer>
    </>
  );
}