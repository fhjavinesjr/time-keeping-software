import React from 'react';
import styles from "@/styles/DashboardSidebar.module.scss";
import { MenuItemProps } from './types';
import Image from "next/image";
import Link from "next/link";

export const MenuItem: React.FC<MenuItemProps> = ({ icon, label, isActive, goto, onClick }) => {
  const className = isActive ? styles.activeMenuItem : styles.menuItem;
  
  if (goto) {
    // Navigation item
    return (
      <Link href={goto} className={className} role="menuitem" tabIndex={0} onClick={onClick}>
        <Image
          loading="lazy"
          src={icon}
          className={styles.menuIcon}
          alt=""
          width={24}
          height={24}
          style={{ display: 'block' }} // removes inline-block space
        />
        <span className={styles.menuLabel}>{label}</span>
      </Link>
    );
  }

  // Action item (e.g., Logout)
  return (
    <button className={className} role="menuitem" tabIndex={0} onClick={onClick}>
      <Image
        loading="lazy"
        src={icon}
        className={styles.menuIcon}
        alt=""
        width={24}
        height={24}
        style={{ display: 'block' }} // removes inline-block space
      />
      <span className={styles.menuLabel}>{label}</span>
    </button>
  );
};