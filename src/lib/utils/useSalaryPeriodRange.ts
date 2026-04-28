import { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/utils/fetchWithAuth";

interface SalaryPeriodSettingDTO {
  salaryPeriodSettingId: number;
  salaryType: string;
  nthOrder: number;
  periodContext: string;
  cutoffStartDay: number;
  cutoffStartMonthOffset: number;
  cutoffEndDay: number;
  cutoffEndMonthOffset: number;
  salaryReleaseStartDay: number | null;
  salaryReleaseEndDay: number | null;
  isActive: boolean;
}

function formatApiDate(date: Date, endOfDay = false): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  const time = endOfDay ? "23:59:59" : "00:00:00";
  return `${mm}-${dd}-${yyyy} ${time}`;
}

/** Clamp day to the last day of the given month */
function clampDay(day: number, year: number, month: number): number {
  const maxDay = new Date(year, month + 1, 0).getDate();
  return Math.min(day, maxDay);
}

function resolveDate(day: number, monthOffset: number, ref: Date, endOfDay = false): string {
  const targetDate = new Date(ref.getFullYear(), ref.getMonth() + monthOffset, 1);
  const clamped = clampDay(day, targetDate.getFullYear(), targetDate.getMonth());
  const resolved = new Date(targetDate.getFullYear(), targetDate.getMonth(), clamped);
  return formatApiDate(resolved, endOfDay);
}

function fallback(): { fromDate: string; toDate: string } {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    fromDate: formatApiDate(firstDay, false),
    toDate: formatApiDate(lastDay, true),
  };
}

/**
 * Fetches salary period settings for the given context from the Administrative API
 * and resolves which period contains today.
 *
 * Falls back to the full calendar month if no setting is found or the API is unavailable.
 *
 * @param adminApiUrl  base URL for the Administrative backend (e.g. http://localhost:8082)
 * @param context      "PAYROLL" or "LEAVE"
 */
export default function useSalaryPeriodRange(
  adminApiUrl: string,
  context: "PAYROLL" | "LEAVE"
) {
  const { fromDate: fbFrom, toDate: fbTo } = fallback();
  const [fromDate, setFromDate] = useState<string>(fbFrom);
  const [toDate, setToDate] = useState<string>(fbTo);

  useEffect(() => {
    if (!adminApiUrl) return;

    const fetchPeriod = async () => {
      try {
        const res = await fetchWithAuth(
          `${adminApiUrl}/api/salary-period-setting/get-by-context?context=${context}`
        );
        if (!res.ok) {
          applyFallback();
          return;
        }
        const json = await res.json();
        const settings: SalaryPeriodSettingDTO[] = Array.isArray(json) ? json : [];

        if (!settings.length) {
          applyFallback();
          return;
        }

        const today = new Date();

        // Try monthDelta values: 0 (current), -1 (previous), +1 (next)
        for (const delta of [0, -1, 1]) {
          const ref = new Date(today.getFullYear(), today.getMonth() + delta, 1);

          for (const s of settings) {
            const startStr = resolveDate(s.cutoffStartDay, s.cutoffStartMonthOffset, ref, false);
            const endStr = resolveDate(s.cutoffEndDay, s.cutoffEndMonthOffset, ref, true);
            const start = new Date(
              parseInt(startStr.slice(6, 10)),
              parseInt(startStr.slice(0, 2)) - 1,
              parseInt(startStr.slice(3, 5))
            );
            const end = new Date(
              parseInt(endStr.slice(6, 10)),
              parseInt(endStr.slice(0, 2)) - 1,
              parseInt(endStr.slice(3, 5))
            );

            if (today >= start && today <= end) {
              setFromDate(startStr);
              setToDate(endStr);
              return;
            }
          }
        }

        // No period matched today — use fallback
        applyFallback();
      } catch {
        applyFallback();
      }
    };

    const applyFallback = () => {
      const { fromDate: f, toDate: t } = fallback();
      setFromDate(f);
      setToDate(t);
    };

    fetchPeriod();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminApiUrl, context]);

  return { fromDate, setFromDate, toDate, setToDate };
}
