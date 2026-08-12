"use client";

import { runtimeConfig } from "@/lib/utils/runtimeConfig";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Main from "../../main/Main";
import modalStyles from "@/styles/Modal.module.scss";
import styles from "@/styles/ManualDTREntry.module.scss";
import Swal from "sweetalert2";
import { fetchWithAuth } from "@/lib/utils/fetchWithAuth";
import { localStorageUtil } from "@/lib/utils/localStorageUtil";
import { Employee } from "@/lib/types/Employee";

const API_BASE_URL_TIMEKEEPING   = runtimeConfig.getApiUrl("timekeeping");
const API_BASE_URL_ADMINISTRATIVE = runtimeConfig.getApiUrl("administrative");
const API_BASE_URL_HRM = runtimeConfig.getApiUrl("hrm");

type HolidayDTO = {
  holidayDate: string;
  observedDate?: string | null;
  holidayType: string;
  isWorkingHoliday: boolean;
  isActive: boolean;
};

type WorkScheduleEntryDTO = {
  wsDateTime: string;
  tsCode?: string | null;
  isDayOff?: boolean;
};

type ApprovedOvertimeDTO = {
  overtimeRequestId: number;
  dateTimeFrom: string;
  dateTimeTo: string;
  workType?: string | null;
  dutyShiftCode?: string | null;
};

type ScheduledTimes = {
  tsCode: string;
  tsName: string;
  timeIn: string;
  breakOut: string | null;
  breakIn: string | null;
  timeOut: string;
};

// Normalize supported date formats into "yyyy-MM-dd".
// Work schedule endpoints may return either:
//   - "MM-dd-yyyy HH:mm:ss"
//   - "yyyy-MM-dd"
//   - "yyyy-MM-ddTHH:mm:ss"
// The manual form date input also stores "yyyy-MM-dd" even when the browser displays MM/dd/yyyy.
const toIsoKey = (value: string): string => {
  if (!value) return "";

  const raw = value.trim();
  const datePart = raw.split("T")[0].split(" ")[0].split("/").join("-");
  const parts = datePart.split("-");

  if (parts.length !== 3) return datePart;

  // Already ISO: yyyy-MM-dd
  if (parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // Custom/backend display: MM-dd-yyyy
  const [month, day, year] = parts;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

// Convert "yyyy-MM-dd" HTML date input → "MM-dd-yyyy 00:00:00" for API params
const toApiFormat = (isoDate: string): string => {
  const [year, month, day] = isoDate.split("-");
  return `${month}-${day}-${year} 00:00:00`;
};

// Default fallback schedule in minutes from midnight. Actual saving uses the employee work schedule when available.
const DEFAULT_SCHEDULE_IN_MIN        = 8 * 60;   // 08:00
const DEFAULT_SCHEDULE_BREAK_OUT_MIN = 12 * 60;  // 12:00
const DEFAULT_SCHEDULE_BREAK_IN_MIN  = 13 * 60;  // 13:00
const DEFAULT_SCHEDULE_OUT_MIN       = 17 * 60;  // 17:00

const parseTimeToMin = (t: string): number => {
  if (!t) return 0;

  const trimmed = t.trim();
  const meridiemMatch = trimmed.match(/\s*(AM|PM)$/i);
  const meridiem = meridiemMatch?.[1]?.toUpperCase();
  const timeOnly = trimmed.replace(/\s*(AM|PM)$/i, "");
  const [hourPart, minutePart] = timeOnly.split(":");

  let hour = Number(hourPart);
  const minute = Number(minutePart ?? "0");

  if (Number.isNaN(hour) || Number.isNaN(minute)) return 0;

  // Support both 24-hour values like "14:00" and 12-hour values like "02:00:00 PM".
  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;

  return hour * 60 + minute;
};

// HTML time input gives "HH:mm" — backend needs "HH:mm:ss"
const toTimeString = (t: string): string => (t.length === 5 ? `${t}:00` : t);

const computeMinutes = (
  timeIn: string,
  breakOut: string,
  breakIn: string,
  timeOut: string,
  scheduled?: ScheduledTimes
) => {
  const inMin = parseTimeToMin(timeIn);
  const outMin = normalizeEndMinute(inMin, parseTimeToMin(timeOut));
  const breakOutMin = breakOut ? normalizeEndMinute(inMin, parseTimeToMin(breakOut)) : null;
  const breakInMin = breakIn ? normalizeEndMinute(inMin, parseTimeToMin(breakIn)) : null;

  const schedIn = scheduled ? parseTimeToMin(scheduled.timeIn) : DEFAULT_SCHEDULE_IN_MIN;
  const schedBreakOut = scheduled?.breakOut ? normalizeEndMinute(schedIn, parseTimeToMin(scheduled.breakOut)) : DEFAULT_SCHEDULE_BREAK_OUT_MIN;
  const schedBreakIn = scheduled?.breakIn ? normalizeEndMinute(schedIn, parseTimeToMin(scheduled.breakIn)) : DEFAULT_SCHEDULE_BREAK_IN_MIN;
  const schedOut = scheduled ? normalizeEndMinute(schedIn, parseTimeToMin(scheduled.timeOut)) : DEFAULT_SCHEDULE_OUT_MIN;

  // Productive work minutes:
  // with break punches: (timeIn -> breakOut) + (breakIn -> timeOut)
  // without complete break punches: fallback to timeIn -> timeOut
  const workMinutes =
    breakOutMin !== null && breakInMin !== null
      ? Math.max(0, breakOutMin - inMin) + Math.max(0, outMin - breakInMin)
      : Math.max(0, outMin - inMin);

  // Agency-aligned PH Gov / CSC-style UI separation:
  // LATE  = late time-in + late break-in
  // UNDER = early break-out + early final time-out
  // Printed CSC DTR undertime = LATE + UNDER
  const lateTimeIn = Math.max(0, inMin - schedIn);
  const lateBreakIn =
    breakInMin !== null && scheduled?.breakIn
      ? Math.max(0, breakInMin - schedBreakIn)
      : 0;

  const earlyBreakOut =
    breakOutMin !== null && scheduled?.breakOut
      ? Math.max(0, schedBreakOut - breakOutMin)
      : 0;
  const earlyTimeOut = Math.max(0, schedOut - outMin);

  const lateMinutes = lateTimeIn + lateBreakIn;
  const undertimeMinutes = earlyBreakOut + earlyTimeOut;
  const overtimeMinutes = Math.max(0, outMin - schedOut);

  return { workMinutes, lateMinutes, undertimeMinutes, overtimeMinutes };
};

const asNonWorkingDutyMinutes = (
  result: ReturnType<typeof computeMinutes>,
) => ({
  ...result,
  // A rest day, scheduled day off, or non-working holiday has no
  // ordinary scheduled hours against which late/undertime is charged.
  lateMinutes: 0,
  undertimeMinutes: 0,
  overtimeMinutes: result.workMinutes,
});

const normalizeEndMinute = (startMinute: number, endMinute: number): number =>
  endMinute < startMinute ? endMinute + 24 * 60 : endMinute;

const findMatchingSchedule = (
  schedules: ScheduledTimes[],
  timeIn: string,
  breakOut: string,
  breakIn: string,
  timeOut: string
): ScheduledTimes | undefined => {
  if (schedules.length === 0) return undefined;

  const actualIn = parseTimeToMin(timeIn);
  const actualOut = normalizeEndMinute(actualIn, parseTimeToMin(timeOut));
  const actualBreakOut = breakOut ? parseTimeToMin(breakOut) : null;
  const actualBreakIn = breakIn ? parseTimeToMin(breakIn) : null;

  // First priority: exact schedule match. This handles hospital shifts like
  // 12AM-6AM, 6AM-2PM, and 2PM-10PM without comparing them to 8AM-5PM.
  const exact = schedules.find((schedule) => {
    const schedIn = parseTimeToMin(schedule.timeIn);
    const schedOut = normalizeEndMinute(schedIn, parseTimeToMin(schedule.timeOut));
    const schedBreakOut = schedule.breakOut ? parseTimeToMin(schedule.breakOut) : null;
    const schedBreakIn = schedule.breakIn ? parseTimeToMin(schedule.breakIn) : null;

    const mainTimesMatch = schedIn === actualIn && schedOut === actualOut;
    const breakOutMatches = actualBreakOut === null || schedBreakOut === null || schedBreakOut === actualBreakOut;
    const breakInMatches = actualBreakIn === null || schedBreakIn === null || schedBreakIn === actualBreakIn;

    return mainTimesMatch && breakOutMatches && breakInMatches;
  });

  if (exact) return exact;

  // Second priority: choose the schedule with the biggest overlap with the entered time.
  // This prevents fallback to the default 8AM-5PM schedule when the employee has multiple
  // shifts on the same date and the entered segment belongs to one of them.
  let bestMatch: ScheduledTimes | undefined;
  let bestOverlap = 0;

  schedules.forEach((schedule) => {
    const schedIn = parseTimeToMin(schedule.timeIn);
    const schedOut = normalizeEndMinute(schedIn, parseTimeToMin(schedule.timeOut));
    const overlap = Math.max(0, Math.min(actualOut, schedOut) - Math.max(actualIn, schedIn));

    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestMatch = schedule;
    }
  });

  return bestMatch;
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

const parseAuthorityDateTime = (value: string) => new Date(value.replace(" ", "T"));

const actualIntervalForDate = (date: Date, timeIn: string, timeOut: string) => {
  const start = new Date(date);
  const inMinutes = parseTimeToMin(timeIn);
  start.setHours(Math.floor(inMinutes / 60), inMinutes % 60, 0, 0);
  const end = new Date(date);
  const outMinutes = normalizeEndMinute(inMinutes, parseTimeToMin(timeOut));
  const normalizedOutMinutes = outMinutes % (24 * 60);
  end.setHours(Math.floor(normalizedOutMinutes / 60), normalizedOutMinutes % 60, 0, 0);
  if (outMinutes >= 24 * 60) end.setDate(end.getDate() + 1);
  return { start, end };
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
  const [allowHolidayWork, setAllowHolidayWork] = useState(false);
  const [allowDayOffWork, setAllowDayOffWork]   = useState(false);
  const [previewScheduleByDate, setPreviewScheduleByDate] = useState<Map<string, ScheduledTimes[]>>(new Map());
  const [previewAllTimeShifts, setPreviewAllTimeShifts] = useState<ScheduledTimes[]>([]);
  const [previewHolidayDates, setPreviewHolidayDates] = useState<Set<string>>(new Set());
  const [previewDayOffDates, setPreviewDayOffDates] = useState<Set<string>>(new Set());

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

  const fetchTimeShifts = useCallback(async (): Promise<Map<string, ScheduledTimes>> => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL_ADMINISTRATIVE}/api/getAll/time-shift`);
      if (!res.ok || res.status === 204) return new Map();
      const data: Array<{
        tsCode: string;
        tsName: string;
        timeIn: string;
        breakOut: string | null;
        breakIn: string | null;
        timeOut: string;
      }> = await res.json();
      const map = new Map<string, ScheduledTimes>();
      data.forEach((ts) => {
        map.set(ts.tsCode.trim().toLowerCase(), {
          tsCode: ts.tsCode,
          tsName: ts.tsName,
          timeIn: ts.timeIn,
          breakOut: ts.breakOut,
          breakIn: ts.breakIn,
          timeOut: ts.timeOut,
        });
      });
      return map;
    } catch {
      return new Map();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPreviewSchedules = async () => {
      if (!selectedEmployee?.employeeId || !dateFrom || !dateTo) {
        setPreviewScheduleByDate(new Map());
        setPreviewAllTimeShifts([]);
        setPreviewHolidayDates(new Set());
        setPreviewDayOffDates(new Set());
        return;
      }

      try {
        const [holidayRes, wsRes, timeShiftMap] = await Promise.all([
          fetchWithAuth(`${API_BASE_URL_ADMINISTRATIVE}/api/holiday/get-all`),
          fetchWithAuth(
            `${API_BASE_URL_TIMEKEEPING}/api/getListByEmployeeAndDateRange/work-schedule` +
            `?employeeId=${selectedEmployee.employeeId}` +
            `&monthStart=${encodeURIComponent(toApiFormat(dateFrom))}` +
            `&monthEnd=${encodeURIComponent(toApiFormat(dateTo))}`
          ),
          fetchTimeShifts(),
        ]);

        const nextScheduleByDate = new Map<string, ScheduledTimes[]>();
        const nextHolidayDates = new Set<string>();
        const nextDayOffDates = new Set<string>();
        const allTimeShifts = Array.from(timeShiftMap.values());

        if (holidayRes.ok && holidayRes.status !== 204) {
          const holidays: HolidayDTO[] = await holidayRes.json();
          holidays
            .filter((holiday) =>
              holiday.isActive &&
              !holiday.isWorkingHoliday &&
              holiday.holidayType !== "SPECIAL_WORKING"
            )
            .forEach((holiday) => {
              const raw = holiday.observedDate?.trim() && holiday.observedDate !== holiday.holidayDate
                ? holiday.observedDate
                : holiday.holidayDate;
              nextHolidayDates.add(toIsoKey(raw));
            });
        }

        if (wsRes.ok && wsRes.status !== 204) {
          const wsData: WorkScheduleEntryDTO[] = await wsRes.json();
          wsData.forEach((ws) => {
            const key = toIsoKey(ws.wsDateTime);
            if (ws.isDayOff) {
              nextDayOffDates.add(key);
              return;
            }
            if (!ws.tsCode) return;

            const shift = timeShiftMap.get(ws.tsCode.trim().toLowerCase());
            if (!shift) return;

            const current = nextScheduleByDate.get(key) ?? [];
            nextScheduleByDate.set(key, [...current, shift]);
          });
        }

        if (!cancelled) {
          setPreviewScheduleByDate(nextScheduleByDate);
          setPreviewAllTimeShifts(allTimeShifts);
          setPreviewHolidayDates(nextHolidayDates);
          setPreviewDayOffDates(nextDayOffDates);
        }
      } catch {
        if (!cancelled) {
          setPreviewScheduleByDate(new Map());
          setPreviewAllTimeShifts([]);
          setPreviewHolidayDates(new Set());
          setPreviewDayOffDates(new Set());
        }
      }
    };

    loadPreviewSchedules();

    return () => {
      cancelled = true;
    };
  }, [selectedEmployee?.employeeId, dateFrom, dateTo, fetchTimeShifts]);

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
    // Same-day and overnight shifts are allowed. A time-out earlier than time-in is treated as next day.
    if (timeIn === timeOut) {
      Swal.fire("Warning", "Time In and Time Out cannot be the same.", "warning");
      return;
    }
    if ((breakOut && !breakIn) || (!breakOut && breakIn)) {
      Swal.fire("Warning", "Please provide both Break Out and Break In, or leave both blank.", "warning");
      return;
    }
    if (breakOut && breakIn) {
      const inMin = parseTimeToMin(timeIn);
      const breakOutMin = normalizeEndMinute(inMin, parseTimeToMin(breakOut));
      const breakInMin = normalizeEndMinute(inMin, parseTimeToMin(breakIn));
      const outMin = normalizeEndMinute(inMin, parseTimeToMin(timeOut));

      if (!(inMin <= breakOutMin && breakOutMin <= breakInMin && breakInMin <= outMin)) {
        Swal.fire("Warning", "Time order must be Time In → Break Out → Break In → Time Out.", "warning");
        return;
      }
    }

    const dates = getDatesInRange(dateFrom, dateTo);

    setSaving(true);

    // ── Pre-fetch holidays and work schedule to skip day-off / non-working holiday dates ──
    const nonWorkingHolidaySet = new Set<string>();
    const dayOffSet            = new Set<string>();
    const scheduleByDate       = new Map<string, ScheduledTimes[]>();
    let allAvailableShifts: ScheduledTimes[] = [];
    let approvedAuthorities: ApprovedOvertimeDTO[] = [];
    let authorityLookupAvailable = false;

    try {
      const [holidayRes, wsRes, approvedOtRes, fetchedTimeShiftMap] = await Promise.all([
        fetchWithAuth(`${API_BASE_URL_ADMINISTRATIVE}/api/holiday/get-all`),
        fetchWithAuth(
          `${API_BASE_URL_TIMEKEEPING}/api/getListByEmployeeAndDateRange/work-schedule` +
          `?employeeId=${selectedEmployee.employeeId}` +
          `&monthStart=${encodeURIComponent(toApiFormat(dateFrom))}` +
          `&monthEnd=${encodeURIComponent(toApiFormat(dateTo))}`
        ),
        fetchWithAuth(
          `${API_BASE_URL_HRM}/api/overtime-request/get-approved/${selectedEmployee.employeeId}`
        ),
        fetchTimeShifts(),
      ]);

      allAvailableShifts = Array.from(fetchedTimeShiftMap.values());
      if (approvedOtRes.ok && approvedOtRes.status !== 204) {
        const data: ApprovedOvertimeDTO[] = await approvedOtRes.json();
        approvedAuthorities = Array.isArray(data) ? data : [];
        authorityLookupAvailable = true;
      } else if (approvedOtRes.status === 204) {
        authorityLookupAvailable = true;
      }

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
          const key = toIsoKey(ws.wsDateTime);
          if (ws.isDayOff) {
            dayOffSet.add(key);
            return;
          }
          if (ws.tsCode) {
            const shift = fetchedTimeShiftMap.get(ws.tsCode.trim().toLowerCase());
            if (shift) {
              const current = scheduleByDate.get(key) ?? [];
              scheduleByDate.set(key, [...current, shift]);
            }
          }
        });
      }
    } catch {
      // If schedule/holiday fetch fails, proceed without filtering so admin isn't blocked
    }

    let successCount = 0;
    const failedDates:          string[] = [];
    const skippedHolidayDates:  string[] = [];
    const skippedDayOffDates:   string[] = [];
    const unauthorizedDutyDates: string[] = [];

    for (const date of dates) {
      const isoKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      if (!allowHolidayWork && nonWorkingHolidaySet.has(isoKey)) {
        skippedHolidayDates.push(formatWorkDate(date).split(" ")[0]);
        continue;
      }
      if (!allowDayOffWork && dayOffSet.has(isoKey)) {
        skippedDayOffDates.push(formatWorkDate(date).split(" ")[0]);
        continue;
      }
      const isHolidayDutyDate = nonWorkingHolidaySet.has(isoKey);
      const isDayOffDutyDate = dayOffSet.has(isoKey);
      if (isHolidayDutyDate || isDayOffDutyDate) {
        const actual = actualIntervalForDate(date, timeIn, timeOut);
        const matchingAuthority = authorityLookupAvailable && approvedAuthorities.some((authority) => {
          const authorityStart = parseAuthorityDateTime(authority.dateTimeFrom);
          const authorityEnd = parseAuthorityDateTime(authority.dateTimeTo);
          if (Number.isNaN(authorityStart.getTime()) || Number.isNaN(authorityEnd.getTime())) return false;
          const workType = (authority.workType ?? "").toUpperCase();
          const typeMatches =
            (isHolidayDutyDate && workType === "HOLIDAY_DUTY") ||
            (isDayOffDutyDate && ["DAY_OFF_DUTY", "REST_DAY_DUTY"].includes(workType));
          return typeMatches && actual.start >= authorityStart && actual.end <= authorityEnd;
        });
        if (!matchingAuthority) {
          unauthorizedDutyDates.push(formatWorkDate(date).split(" ")[0]);
          continue;
        }
      }
      const schedulesForDate = scheduleByDate.get(isoKey) ?? [];
      const matchedSchedule =
        findMatchingSchedule(schedulesForDate, timeIn, breakOut, breakIn, timeOut) ??
        findMatchingSchedule(allAvailableShifts, timeIn, breakOut, breakIn, timeOut);
      const computed = computeMinutes(timeIn, breakOut, breakIn, timeOut, matchedSchedule);
      const isPermittedNonWorkingDuty =
        (allowHolidayWork && nonWorkingHolidaySet.has(isoKey)) ||
        (allowDayOffWork && dayOffSet.has(isoKey));
      const { workMinutes, lateMinutes, undertimeMinutes, overtimeMinutes } =
        isPermittedNonWorkingDuty ? asNonWorkingDutyMinutes(computed) : computed;

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
            sourceType:        "MANUAL",
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
    if (unauthorizedDutyDates.length > 0)
      skippedLines.push(`<b>Skipped (No approved matching Overtime/Duty Order):</b> ${unauthorizedDutyDates.join(", ")}`);
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

  const previewDateKey = dateFrom ? toIsoKey(dateFrom) : "";
  const previewSchedules = previewDateKey ? previewScheduleByDate.get(previewDateKey) ?? [] : [];
  const previewMatchedSchedule =
    findMatchingSchedule(previewSchedules, timeIn, breakOut, breakIn, timeOut) ??
    findMatchingSchedule(previewAllTimeShifts, timeIn, breakOut, breakIn, timeOut);
  const previewIsHoliday = previewHolidayDates.has(previewDateKey);
  const previewIsDayOff = previewDayOffDates.has(previewDateKey);
  const previewWillBeSkipped =
    (previewIsHoliday && !allowHolidayWork) ||
    (previewIsDayOff && !allowDayOffWork);
  const preview = (() => {
    if (!timeIn || !timeOut) return null;
    const computed = computeMinutes(timeIn, breakOut, breakIn, timeOut, previewMatchedSchedule);
    const isPermittedNonWorkingDuty =
      (previewIsHoliday && allowHolidayWork) ||
      (previewIsDayOff && allowDayOffWork);
    return isPermittedNonWorkingDuty ? asNonWorkingDutyMinutes(computed) : computed;
  })();

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
                  Computation uses the matching work schedule for the selected date. If the work schedule lookup fails, it matches the entered time against configured Time Shift records before falling back to 08:00-17:00.
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

                <div className={styles.formGroup}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={allowHolidayWork}
                      onChange={(e) => setAllowHolidayWork(e.target.checked)}
                      style={{ width: "auto" }}
                    />
                    Allow manual DTR on non-working holiday
                  </label>
                  <span className={styles.hint}>
                    Requires an approved Holiday Duty Order covering the employee, date, and entered time. Day-off permission is controlled separately.
                  </span>
                </div>

                <div className={styles.formGroup}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={allowDayOffWork}
                      onChange={(e) => setAllowDayOffWork(e.target.checked)}
                      style={{ width: "auto" }}
                    />
                    Allow manual DTR on rest day / scheduled day-off
                  </label>
                  <span className={styles.hint}>
                    Requires an approved Rest-Day or Scheduled Day-Off Order covering the employee, date, and entered time. Work type remains defined by that authority.
                  </span>
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
                    {previewWillBeSkipped && (
                      <>
                        <b>This date will be skipped unless the applicable non-working-day checkbox is enabled.</b>
                        <br />
                      </>
                    )}
                    Computed &mdash;&nbsp;
                    Work: <b>{preview.workMinutes} min</b>&nbsp;&nbsp;|&nbsp;&nbsp;
                    Late: <b>{preview.lateMinutes} min</b>&nbsp;&nbsp;|&nbsp;&nbsp;
                    Undertime: <b>{preview.undertimeMinutes} min</b>&nbsp;&nbsp;|&nbsp;&nbsp;
                    Overtime: <b>{preview.overtimeMinutes} min</b>
                    {previewMatchedSchedule && (
                      <>
                        &nbsp;&nbsp;|&nbsp;&nbsp;Matched Shift: <b>{previewMatchedSchedule.tsCode}</b>{previewSchedules.length === 0 ? " (from Time Shift fallback)" : ""}
                      </>
                    )}
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
