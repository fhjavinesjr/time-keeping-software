"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Main from "../../main/Main";
import modalStyles from "@/styles/Modal.module.scss";
import styles from "@/styles/ManualDTREntry.module.scss";
import Swal from "sweetalert2";
import { fetchWithAuth } from "@/lib/utils/fetchWithAuth";
import { localStorageUtil } from "@/lib/utils/localStorageUtil";
import { Employee } from "@/lib/types/Employee";

const API_BASE_URL_TIMEKEEPING   = process.env.NEXT_PUBLIC_API_BASE_URL_TIMEKEEPING;
const API_BASE_URL_ADMINISTRATIVE = process.env.NEXT_PUBLIC_API_BASE_URL_ADMINISTRATIVE;

type HolidayDTO = {
  holidayDate: string;
  observedDate?: string | null;
  holidayType: string;
  isWorkingHoliday: boolean;
  isActive: boolean;
};

type WorkScheduleEntryDTO = {
  wsDateTime: string;
  isDayOff?: boolean;
};

// Convert "MM-dd-yyyy HH:mm:ss" or "MM-dd-yyyy" custom format → "yyyy-MM-dd"
const toIsoKey = (customDate: string): string => {
  const [month, day, year] = customDate.split(" ")[0].split("-");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

// Convert "yyyy-MM-dd" HTML date input → "MM-dd-yyyy 00:00:00" for API params
const toApiFormat = (isoDate: string): string => {
  const [year, month, day] = isoDate.split("-");
  return `${month}-${day}-${year} 00:00:00`;
};

// Standard PH government schedule in minutes from midnight
const SCHEDULE_IN_MIN  = 8 * 60;   // 08:00
const SCHEDULE_OUT_MIN = 17 * 60;  // 17:00

const parseTimeToMin = (t: string): number => {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// HTML time input gives "HH:mm" — backend needs "HH:mm:ss"
const toTimeString = (t: string): string => (t.length === 5 ? `${t}:00` : t);

const computeMinutes = (
  timeIn: string,
  breakOut: string,
  breakIn: string,
  timeOut: string
) => {
  const inMin  = parseTimeToMin(timeIn);
  const outMin = parseTimeToMin(timeOut);
  let breakMins = 0;
  if (breakOut && breakIn) {
    breakMins = Math.max(0, parseTimeToMin(breakIn) - parseTimeToMin(breakOut));
  }
  const workMinutes      = Math.max(0, outMin - inMin - breakMins);
  const lateMinutes      = Math.max(0, inMin  - SCHEDULE_IN_MIN);
  const undertimeMinutes = outMin < SCHEDULE_OUT_MIN ? Math.max(0, SCHEDULE_OUT_MIN - outMin) : 0;
  const overtimeMinutes  = outMin > SCHEDULE_OUT_MIN ? Math.max(0, outMin - SCHEDULE_OUT_MIN) : 0;
  return { workMinutes, lateMinutes, undertimeMinutes, overtimeMinutes };
};

// Format a JS Date → "MM-dd-yyyy 00:00:00"  (DTRDailyDTO workDate format)
const formatWorkDate = (d: Date): string => {
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}-${dd}-${yyyy} 00:00:00`;
};

const getDatesInRange = (from: string, to: string): Date[] => {
  const result: Date[] = [];
  const start  = new Date(from);
  const end    = new Date(to);
  if (start > end) return result;
  const cursor = new Date(start);
  while (cursor <= end) {
    result.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
};

export default function ManualDTREntryPage() {
  const router = useRouter();

  const [employees, setEmployees]               = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [inputValue, setInputValue]             = useState("");
  const [userRole, setUserRole]                 = useState<string | null>(null);
  const [dateFrom, setDateFrom]                 = useState("");
  const [dateTo, setDateTo]                     = useState("");
  const [timeIn, setTimeIn]                     = useState("08:00");
  const [breakOut, setBreakOut]                 = useState("12:00");
  const [breakIn, setBreakIn]                   = useState("13:00");
  const [timeOut, setTimeOut]                   = useState("17:00");
  const [saving, setSaving]                     = useState(false);

  useEffect(() => {
    const role       = localStorageUtil.getEmployeeRole();
    const fullname   = localStorageUtil.getEmployeeFullname();
    const empNo      = localStorageUtil.getEmployeeNo();
    const employeeId = localStorageUtil.getEmployeeId();

    setUserRole(role);

    const stored = localStorageUtil.getEmployees();
    if (stored?.length > 0) setEmployees(stored);

    if (role !== "1" && empNo) {
      const empFromList = stored?.find(e => e.employeeNo === empNo) ?? null;
      if (empFromList) {
        setSelectedEmployee(empFromList as Employee);
      } else if (fullname) {
        setSelectedEmployee({
          employeeId,
          employeeNo: empNo,
          fullName: fullname,
        } as Employee);
      }
    }
  }, []);

  const handleSave = async () => {
    if (!selectedEmployee?.employeeId) {
      Swal.fire("Warning", "Please select an employee.", "warning");
      return;
    }
    if (!dateFrom || !dateTo) {
      Swal.fire("Warning", "Please select both Date From and Date To.", "warning");
      return;
    }
    if (!timeIn || !timeOut) {
      Swal.fire("Warning", "Time In and Time Out are required.", "warning");
      return;
    }
    if (new Date(dateFrom) > new Date(dateTo)) {
      Swal.fire("Warning", "Date From cannot be after Date To.", "warning");
      return;
    }
    if (parseTimeToMin(timeIn) >= parseTimeToMin(timeOut)) {
      Swal.fire("Warning", "Time Out must be after Time In.", "warning");
      return;
    }

    const dates = getDatesInRange(dateFrom, dateTo);
    const { workMinutes, lateMinutes, undertimeMinutes, overtimeMinutes } =
      computeMinutes(timeIn, breakOut, breakIn, timeOut);

    setSaving(true);

    // ── Pre-fetch holidays and work schedule to skip day-off / non-working holiday dates ──
    const nonWorkingHolidaySet = new Set<string>();
    const dayOffSet            = new Set<string>();

    try {
      const [holidayRes, wsRes] = await Promise.all([
        fetchWithAuth(`${API_BASE_URL_ADMINISTRATIVE}/api/holiday/get-all`),
        fetchWithAuth(
          `${API_BASE_URL_TIMEKEEPING}/api/getListByEmployeeAndDateRange/work-schedule` +
          `?employeeId=${selectedEmployee.employeeId}` +
          `&monthStart=${encodeURIComponent(toApiFormat(dateFrom))}` +
          `&monthEnd=${encodeURIComponent(toApiFormat(dateTo))}`
        ),
      ]);

      if (holidayRes.ok) {
        const holidays: HolidayDTO[] = await holidayRes.json();
        holidays
          .filter((h) => h.isActive && !h.isWorkingHoliday && h.holidayType !== "SPECIAL_WORKING")
          .forEach((h) => {
            const raw = h.observedDate?.trim() && h.observedDate !== h.holidayDate
              ? h.observedDate
              : h.holidayDate;
            nonWorkingHolidaySet.add(toIsoKey(raw));
          });
      }

      if (wsRes.ok && wsRes.status !== 204) {
        const wsData: WorkScheduleEntryDTO[] = await wsRes.json();
        wsData.forEach((ws) => {
          if (ws.isDayOff) dayOffSet.add(toIsoKey(ws.wsDateTime));
        });
      }
    } catch {
      // If schedule/holiday fetch fails, proceed without filtering so admin isn't blocked
    }

    let successCount = 0;
    const failedDates:          string[] = [];
    const skippedHolidayDates:  string[] = [];
    const skippedDayOffDates:   string[] = [];

    for (const date of dates) {
      const isoKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      if (nonWorkingHolidaySet.has(isoKey)) {
        skippedHolidayDates.push(formatWorkDate(date).split(" ")[0]);
        continue;
      }
      if (dayOffSet.has(isoKey)) {
        skippedDayOffDates.push(formatWorkDate(date).split(" ")[0]);
        continue;
      }
      const payload = {
        employeeId:             selectedEmployee.employeeId,
        workDate:               formatWorkDate(date),
        totalWorkMinutes:       workMinutes,
        totalLateMinutes:       lateMinutes,
        totalUndertimeMinutes:  undertimeMinutes,
        totalOvertimeMinutes:   overtimeMinutes,
        attendanceStatus:       "Present",
        segments: [
          {
            segmentNo:         1,
            timeIn:            toTimeString(timeIn),
            breakOut:          breakOut ? toTimeString(breakOut) : null,
            breakIn:           breakIn  ? toTimeString(breakIn)  : null,
            timeOut:           toTimeString(timeOut),
            workMinutes,
            lateMinutes,
            undertimeMinutes,
            overtimeMinutes,
          },
        ],
      };

      try {
        const res = await fetchWithAuth(
          `${API_BASE_URL_TIMEKEEPING}/api/dtr-daily`,
          {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(payload),
          }
        );
        if (res.ok || res.status === 201) {
          successCount++;
        } else {
          failedDates.push(formatWorkDate(date).split(" ")[0]);
        }
      } catch {
        failedDates.push(formatWorkDate(date).split(" ")[0]);
      }
    }

    setSaving(false);

    const skippedLines: string[] = [];
    if (skippedHolidayDates.length > 0)
      skippedLines.push(`<b>Skipped (Non-working holiday):</b> ${skippedHolidayDates.join(", ")}`);
    if (skippedDayOffDates.length > 0)
      skippedLines.push(`<b>Skipped (Day Off):</b> ${skippedDayOffDates.join(", ")}`);
    if (failedDates.length > 0)
      skippedLines.push(`<b>Failed (may already exist):</b> ${failedDates.join(", ")}`);

    if (successCount === 0 && failedDates.length === 0) {
      // Everything was skipped — no records written
      Swal.fire({
        title: "Nothing Saved",
        html: `All dates in the range were skipped.<br/>${skippedLines.join("<br/>") }`,
        icon: "info",
        confirmButtonText: "OK",
      });
    } else if (skippedLines.length === 0) {
      await Swal.fire({
        title:             "Success",
        text:              `${successCount} DTR record(s) saved successfully.`,
        icon:              "success",
        confirmButtonText: "OK",
      });
      router.push("/time-keeping/dtr");
    } else {
      await Swal.fire({
        title: "Done",
        html:  `${successCount} DTR record(s) saved.<br/><br/>${skippedLines.join("<br/>")}`,
        icon:  failedDates.length > 0 ? "warning" : "success",
        confirmButtonText: "OK",
      });
      if (successCount > 0) router.push("/time-keeping/dtr");
    }
  };

  const preview =
    timeIn && timeOut
      ? computeMinutes(timeIn, breakOut, breakIn, timeOut)
      : null;

  return (
    <Main>
      <div className={modalStyles.Modal}>
        <div className={modalStyles.modalContent}>
          <div className={modalStyles.modalHeader}>
            <h2 className={modalStyles.mainTitle}>Add Manual DTR</h2>
          </div>

          <div className={modalStyles.modalBody}>
            <div className={styles.page}>
              <div className={styles.card}>
                <p className={styles.scheduleNote}>
                  Standard schedule: 08:00 Time In &mdash; 12:00 Break Out &mdash; 13:00 Break In &mdash; 17:00 Time Out
                </p>

                {/* ── Employee ── */}
                <p className={styles.sectionTitle}>Employee</p>
                <div className={`${styles.row} ${styles.one}`}>
                  <div className={styles.formGroup}>
                    <label htmlFor="employee">Employee Name</label>
                    <input
                      id="employee"
                      type="text"
                      list={userRole === "1" ? "employee-list" : undefined}
                      placeholder="Employee No / Last name"
                      readOnly={userRole !== "1"}
                      value={
                        userRole === "1"
                          ? inputValue
                          : selectedEmployee
                          ? `[${selectedEmployee.employeeNo}] ${selectedEmployee.fullName}`
                          : ""
                      }
                      onChange={(e) => {
                        if (userRole !== "1") return;
                        setInputValue(e.target.value);
                        const found = employees.find(
                          (emp) =>
                            `[${emp.employeeNo}] ${emp.fullName}`.toLowerCase() ===
                            e.target.value.toLowerCase()
                        );
                        setSelectedEmployee(found || null);
                      }}
                    />
                    {userRole === "1" && (
                      <datalist id="employee-list">
                        {employees.map((emp) => (
                          <option
                            key={emp.employeeNo}
                            value={`[${emp.employeeNo}] ${emp.fullName}`}
                          />
                        ))}
                      </datalist>
                    )}
                  </div>
                </div>

                <hr className={styles.divider} />

                {/* ── Date Range ── */}
                <p className={styles.sectionTitle}>Date Range</p>
                <div className={`${styles.row} ${styles.two}`}>
                  <div className={styles.formGroup}>
                    <label htmlFor="dateFrom">Date From</label>
                    <input
                      id="dateFrom"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="dateTo">Date To</label>
                    <input
                      id="dateTo"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                    <span className={styles.hint}>
                      One DTR entry per day will be created for the entire range.
                    </span>
                  </div>
                </div>

                <hr className={styles.divider} />

                {/* ── Time Entry ── */}
                <p className={styles.sectionTitle}>Time Entry</p>
                <div className={`${styles.row} ${styles.four}`}>
                  <div className={styles.formGroup}>
                    <label htmlFor="timeIn">Time In</label>
                    <input
                      id="timeIn"
                      type="time"
                      value={timeIn}
                      onChange={(e) => setTimeIn(e.target.value)}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="breakOut">
                      Break Out{" "}
                      <span style={{ color: "#9ca3af", fontWeight: 400, textTransform: "none" }}>
                        (optional)
                      </span>
                    </label>
                    <input
                      id="breakOut"
                      type="time"
                      value={breakOut}
                      onChange={(e) => setBreakOut(e.target.value)}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="breakIn">
                      Break In{" "}
                      <span style={{ color: "#9ca3af", fontWeight: 400, textTransform: "none" }}>
                        (optional)
                      </span>
                    </label>
                    <input
                      id="breakIn"
                      type="time"
                      value={breakIn}
                      onChange={(e) => setBreakIn(e.target.value)}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="timeOut">Time Out</label>
                    <input
                      id="timeOut"
                      type="time"
                      value={timeOut}
                      onChange={(e) => setTimeOut(e.target.value)}
                    />
                  </div>
                </div>

                {/* Live minute preview */}
                {preview && (
                  <p className={styles.preview}>
                    Computed &mdash;&nbsp;
                    Work: <b>{preview.workMinutes} min</b>&nbsp;&nbsp;|&nbsp;&nbsp;
                    Late: <b>{preview.lateMinutes} min</b>&nbsp;&nbsp;|&nbsp;&nbsp;
                    Undertime: <b>{preview.undertimeMinutes} min</b>&nbsp;&nbsp;|&nbsp;&nbsp;
                    Overtime: <b>{preview.overtimeMinutes} min</b>
                  </p>
                )}

                {/* ── Actions ── */}
                <div className={styles.actions}>
                  <button
                    className={styles.cancelButton}
                    onClick={() => router.push("/time-keeping/dtr")}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    className={styles.saveButton}
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Main>
  );
}
