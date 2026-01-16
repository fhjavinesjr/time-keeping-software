"use client";

import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { AUTH_CONFIG } from "@/lib/utils/authConfig";
import { getCookie, setCookie, deleteCookie } from "@/lib/utils/cookies";

interface PageAuthenticationProps {
  children: React.ReactNode;
}

export default function PageAuthentication({ children }: PageAuthenticationProps) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const [checking, setChecking] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true); // mark client hydration

    let isRedirecting = false;

    const logout = () => {
      // Delete all auth cookies
      Object.values(AUTH_CONFIG.COOKIE).forEach(deleteCookie);

      // Optional cleanup of localStorage
      localStorage.clear();

      isRedirecting = true;
      router.replace("/time-keeping/login");
    };

    const checkAuth = () => {
      if (isRedirecting) return;

      // Check if logged in
      const cookieLoggedIn = getCookie(AUTH_CONFIG.COOKIE.IS_LOGGED_IN) === "true";

      // Last activity from localStorage or fallback cookie
      const lastActivity =
        Number(localStorage.getItem(AUTH_CONFIG.COOKIE.LAST_ACTIVITY)) ||
        Number(getCookie(AUTH_CONFIG.COOKIE.LAST_ACTIVITY)) ||
        0;

      const now = Date.now();

      // Not logged in → redirect
      if (!cookieLoggedIn && !AUTH_CONFIG.PUBLIC_PAGES.includes(pathname)) {
        logout();
        return;
      }

      // Inactivity timeout
      if (cookieLoggedIn && now - lastActivity > AUTH_CONFIG.INACTIVITY_LIMIT * 1000) {
        logout();
        return;
      }

      // Refresh activity if logged in
      if (cookieLoggedIn) {
        setCookie(
          AUTH_CONFIG.COOKIE.IS_LOGGED_IN,
          "true",
          AUTH_CONFIG.INACTIVITY_LIMIT
        );
        localStorage.setItem(AUTH_CONFIG.COOKIE.LAST_ACTIVITY, now.toString());
      }

      setChecking(false);
    };

    // Initial auth check
    checkAuth();

    // User activity events
    const userEvents = ["click", "keypress", "mousemove", "scroll", "touchstart"];
    userEvents.forEach((e) => window.addEventListener(e, checkAuth));

    // Cross-tab logout sync
    const handleStorage = (event: StorageEvent) => {
      if (event.key === AUTH_CONFIG.COOKIE.IS_LOGGED_IN && event.newValue !== "true") {
        logout();
      }
    };
    window.addEventListener("storage", handleStorage);

    // Periodic inactivity check
    const interval = setInterval(checkAuth, 1000);

    // Cleanup listeners
    return () => {
      userEvents.forEach((e) => window.removeEventListener(e, checkAuth));
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
    };
  }, [pathname, router]);

  // Render blank page until auth is verified
  if (!isClient || checking) {
    return <div style={{ width: "100vw", height: "100vh", backgroundColor: "#fff" }} />;
  }

  return <>{children}</>;
}