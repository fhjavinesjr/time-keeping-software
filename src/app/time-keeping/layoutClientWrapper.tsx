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
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 400,
          flexShrink: 0,
          position: "sticky",
          top: 0,
          height: "100vh",
          zIndex: 1000,
        }}
      >
        <Sidebar />
      </aside>

      {/* Page content */}
      <main style={{ flex: 1, padding: 20 }}>
        {children}
      </main>
    </div>
  );
}