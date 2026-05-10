"use client";

import React from "react";
import { MenuItem } from "./MenuItem";
import styles from "@/styles/DashboardSidebar.module.scss";
import { usePathname } from "next/navigation";
import { authLogout } from "@/lib/utils/authLogout";
import { useRouter } from "next/navigation";

const menuItems = [
  {
    id: 2,
    icon: "/time_keeping.png",
    label: "Daily Time Record",
    goto: "/time-keeping/dtr",
    isActive: false,
  },
  {
    id: 3,
    icon: "/time_shift.png",
    label: "Work Schedule",
    goto: "/time-keeping/workschedule",
    isActive: false,
  },
];

const otherItems = [
  {
    id: 4,
    icon: "/accounts.png",
    label: "Accounts",
    goto: "/time-keeping/accounts",
    isActive: false,
  },
  {
    id: 5,
    icon: "/help.png",
    label: "Help",
    goto: "/time-keeping",
    isActive: false,
  },
  {
    id: 6,
    icon: "/logout.png",
    label: "Logout",
    action: "logout",
  },
];

export default function Sidebar() {
  const pathname = usePathname(); // Use usePathname for the current route
  const router = useRouter(); // Use useRouter for navigation

  return (
    <nav
      className={styles.Sidebar}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className={styles.brand}>
        <div className={styles.brandIcon}>TKUI</div>
        <div className={styles.brandName}>Time Keeping UI</div>
      </div>

      <div className={styles.menuSection}>
        <h2 className={styles.menuHeader}>MENU</h2>
        <div role="menu">
          {menuItems.map((item, index) => (
            <MenuItem
              key={index}
              icon={item.icon}
              label={item.label}
              goto={item.goto}
              isActive={pathname === item.goto}
              onClick={() => {}}
            />
          ))}
        </div>
      </div>

      <div className={styles.menuSection}>
        <h2 className={styles.menuHeader}>UTILITIES</h2>
        <div role="menu">
          {otherItems.map((item, index) => (
            <MenuItem
              key={index}
              icon={item.icon}
              label={item.label}
              isActive={pathname === item.goto}
              onClick={() => {
                if (item.action === "logout") {
                  authLogout();
                  router.replace("/time-keeping/login");
                } else if (item.goto) {
                  router.push(item.goto);
                }
              }}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}
