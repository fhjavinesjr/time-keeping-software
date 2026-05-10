"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/sidebar/Sidebar";
import React from "react";

interface LayoutClientWrapperProps {
  children: React.ReactNode;
}

export default function LayoutClientWrapper({
  children,
}: LayoutClientWrapperProps) {
  const pathname = usePathname() || "";

  // Hide sidebar on auth pages
  const hideSidebar =
    pathname.endsWith("/login") ||
    pathname.endsWith("/registration");

  // Auth pages → content only
  if (hideSidebar) {
    return <main style={{ padding: 20 }}>{children}</main>;
  }

  // Protected pages → sidebar + content
  return (
    <>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 38, backgroundColor: "#1a3c6e", color: "#fff", display: "flex", alignItems: "center", paddingLeft: 20, fontSize: 13, fontWeight: 600, letterSpacing: "0.5px", zIndex: 1100, flexShrink: 0 }}>
        Bayanihan GovSuite
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
      <div>Version 1.0.0 | {new Date().getFullYear()} &copy; Bayanihan GovSuite. All Rights Reserved.</div>
      <div>A product of VERF IT Solutions. In partnership with ISOF and authorized distribution partners.</div>
    </footer>
    </>
  );
}