'use client'

import React from "react";
import { MenuItem } from "./MenuItem";
import styles from "@/styles/DashboardSidebar.module.scss";
import { usePathname } from 'next/navigation';
// import { usePathname, useRouter } from 'next/navigation';

const menuItems = [
  {
    id: 1,
    icon: "/dashboard.png",
    label: "Dashboard",
    goto: "/main/dashboard",
    isActive: true,
  },
  {
    id: 2,
    icon: "/time_keeping.png",
    label: "Time Keeping",
    goto: "/",
    isActive: false,
  },
];

const otherItems = [
  {
    id: 3,
    icon: "/time_shift.png",
    label: "Time Shift",
    goto: "/",
    isActive: false,
  },
  {
    id: 4,
    icon: "/accounts.png",
    label: "Accounts",
    goto: "/accounts",
    isActive: false,
  },
  {
    id: 5,
    icon: "/help.png",
    label: "Help",
    goto: "/",
    isActive: false,
  },
];

export default function Sidebar() {
  const pathname = usePathname(); // Use usePathname for the current route
  // const router = useRouter();    // Use useRouter for navigation

  return (
    <nav className={styles.Sidebar} role="navigation" aria-label="Main navigation">
      <div className={styles.brand}>
        <div className={styles.brandIcon}>TKS</div>
        <div className={styles.brandName}>Time Keeping Software</div>
      </div>

      <div className={styles.menuSection}>
        <h2 className={styles.menuHeader}>MENU</h2>
        <div role="menu">
          {menuItems.map((item, index) => (
            <MenuItem key={index} icon={item.icon} label={item.label} goto={item.goto} isActive={pathname === item.goto} onClick={() => {}} />
          ))}
        </div>
      </div>

      <div className={styles.menuSection}>
        <h2 className={styles.menuHeader}>OTHERS</h2>
        <div role="menu">
          {otherItems.map((item, index) => (
            <MenuItem key={index} icon={item.icon} label={item.label} goto={item.goto} isActive={pathname === item.goto} onClick={() => {}} />
          ))}
        </div>
      </div>
    </nav>
  );
};
