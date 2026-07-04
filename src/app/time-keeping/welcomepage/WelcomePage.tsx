"use client";

import React, { useMemo } from "react";
import styles from "@/styles/WelcomePage.module.scss";
import { localStorageUtil } from "@/lib/utils/localStorageUtil";

export default function WelcomePage() {
    const fullName = localStorageUtil.getEmployeeFullname() || "User";

    const firstName = useMemo(() => {
        const cleaned = fullName.trim();
        if (!cleaned) return "User";
        return cleaned.split(/\s+/)[0];
    }, [fullName]);

    return (
        <section className={styles.page}>
            <div className={styles.panel}>
                <p className={styles.kicker}>Welcome back.</p>
                <h1 className={styles.title}>Welcome to the HRIS</h1>
                <p className={styles.subtitle}>Hi {firstName},</p>
                <p className={styles.subtitle}>You are successfully logged in.</p>

                <article className={`${styles.noticeCard} ${styles.warningCard}`}>
                    <div className={`${styles.iconBubble} ${styles.warningIcon}`}>!</div>
                    <div>
                        <h2 className={styles.cardTitle}>IMPORTANT REMINDER</h2>
                        <p className={styles.cardText}>
                            Please note that every activity is monitored closely. For any problem in the system,
                            contact System Administrator for details.
                        </p>
                    </div>
                </article>

                <article className={`${styles.noticeCard} ${styles.infoCard}`}>
                    <div className={`${styles.iconBubble} ${styles.infoIcon}`}>i</div>
                    <div>
                        <h2 className={styles.cardTitle}>SYSTEM NOTE</h2>
                        <p className={styles.cardText}>Click the links under MENU to select operation.</p>
                        <p className={styles.cardText}>It is recommended to logout by clicking logout every time you leave your PC.</p>
                    </div>
                </article>

                <article className={`${styles.noticeCard} ${styles.dangerCard}`}>
                    <div className={`${styles.iconBubble} ${styles.dangerIcon}`}>{">"}</div>
                    <div>
                        <h2 className={styles.cardTitle}>SECURITY NOTICE</h2>
                        <p className={styles.cardText}>If you do not agree with the conditions, please logout now.</p>
                    </div>
                </article>
            </div>
        </section>
    );
}
