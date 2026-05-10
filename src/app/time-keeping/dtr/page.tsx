"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import DTRTable from "./DTRTable";
import styles from "@/styles/DTRPage.module.scss";
import Main from "../main/Main";
import modalStyles from "@/styles/Modal.module.scss";
import { fetchWithAuth } from "@/lib/utils/fetchWithAuth";
import useSalaryPeriodRange from "@/lib/utils/useSalaryPeriodRange";
import Swal from "sweetalert2";
import {
  toDateInputValue,
  toCustomFormat,
} from "@/lib/utils/dateFormatUtils";
import { localStorageUtil } from "@/lib/utils/localStorageUtil";
import { Employee } from "@/lib/types/Employee";
const API_BASE_URL_TIMEKEEPING =
  process.env.NEXT_PUBLIC_API_BASE_URL_TIMEKEEPING;
const API_BASE_URL_ADMINISTRATIVE =
  process.env.NEXT_PUBLIC_API_BASE_URL_ADMINISTRATIVE;
const API_BASE_URL_HRM =
  process.env.NEXT_PUBLIC_API_BASE_URL_HRM;

type DTRSegmentDTO = {
  dtrSegmentId: number;
  segmentNo: number;
  timeIn: string | null;
  breakOut: string | null;
  breakIn: string | null;
  timeOut: string | null;
  isOvernightShift?: boolean;
  workMinutes: number;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
};

type DTRDailyDTO = {
  dtrDailyId: number;
  employeeId: string;
  workDate: string;
  totalWorkMinutes: number;
  totalLateMinutes: number;
  totalUndertimeMinutes: number;
  totalOvertimeMinutes: number;
  attendanceStatus: string;
  segments: DTRSegmentDTO[];
  holidayDetails?: HolidayDetail[];
};

type HolidayCategory = "regular" | "special" | "working";

type HolidayDetail = {
  name: string;
  holidayType: string;
  holidayScope: string;
  category: HolidayCategory;
};

type HolidayDTO = {
  holidayId?: number;
  name: string;
  holidayDate: string;
  observedDate?: string | null;
  holidayType: string;
  holidayScope: string;
  isWorkingHoliday: boolean;
  isActive: boolean;
};

type WorkScheduleEntryDTO = {
  wsId: number;
  employeeId: string;
  tsCode: string | null;
  wsDateTime: string;
  isDayOff?: boolean;
};

// Leave application — only fields needed for DTR overlay.
// Leave Monetization is excluded: it has no startDate/endDate.
type LeaveApplicationDTO = {
  leaveApplicationId: number;
  leaveType: string;
  startDate: string | null;  // yyyy-MM-dd
  endDate: string | null;    // yyyy-MM-dd
  approvedStatus: string;
};

// Compensatory Time Off — only fields needed for DTR overlay.
type CompensatoryTimeOffDTO = {
  ctoId: number;
  dateOfOffset: string; // yyyy-MM-dd
  status: string;
};

// Pass Slip — only fields needed for DTR overlay.
type PassSlipDTO = {
  passSlipId: number;
  dateFiled: string;      // yyyy-MM-dd — when the slip was filed
  passSlipDate: string;   // yyyy-MM-dd — actual date the pass slip covers (used for DTR match)
  purpose: string;        // "Personal" | "Official"
  departureTime: string;  // HH:mm:ss
  arrivalTime: string;    // HH:mm:ss
  status: string;
};

// Official Engagement Application — only fields needed for DTR overlay.
type OfficialEngagementApplicationDTO = {
  officialEngagementApplicationId: number;
  officialType: string; // "Official Business" | "Official Time"
  startDate: string;    // yyyy-MM-dd
  startTime: string;    // HH:mm:ss
  endDate: string;      // yyyy-MM-dd
  endTime: string;      // HH:mm:ss
  status: string;
};

// Time Correction — only fields needed for DTR overlay.
type TimeCorrectionDTO = {
  timeCorrectionId: number;
  workDate: string; // yyyy-MM-dd — the date being corrected
  correctedTimeIn: string;
  correctedTimeOut: string;
  correctedBreakOut?: string | null;
  correctedBreakIn?: string | null;
  status: string;
};

// Scheduled shift times — resolved from TimeShift (Administrative) via WorkSchedule (TimeKeeping).
type ScheduledTimes = {
  tsCode: string;
  tsName: string;
  timeIn: string;           // HH:mm:ss
  breakOut: string | null;  // HH:mm:ss or null
  breakIn: string | null;   // HH:mm:ss or null
  timeOut: string;          // HH:mm:ss
};

// Detail data surfaced for overlay-status rows (Pass Slip, Time Corrected, OE).
type OverlayDetail =
  | { kind: "PASS_SLIP"; purpose: string; departureTime: string; arrivalTime: string }
  | { kind: "TIME_CORRECTED"; correctedTimeIn: string; correctedTimeOut: string; correctedBreakOut?: string | null; correctedBreakIn?: string | null }
  | { kind: "OFFICIAL_ENGAGEMENT"; officialType: string; startDate: string; startTime: string; endDate: string; endTime: string };

const toIsoDateKey = (customDate: string): string => {
  const [month, day, year] = customDate.split(" ")[0].split("-");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

const timeToMinutes = (t: string): number => {
  const parts = t.split(":");
  return Number(parts[0]) * 60 + Number(parts[1]);
};

const toCustomDateStart = (isoDate: string): string => {
  const [year, month, day] = isoDate.split("-");
  return `${month}-${day}-${year} 00:00:00`;
};

const getDateKeysInRange = (fromCustom: string, toCustom: string): string[] => {
  const from = new Date(toIsoDateKey(fromCustom));
  const to = new Date(toIsoDateKey(toCustom));

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return [];
  }

  const dateKeys: string[] = [];
  const cursor = new Date(from);

  while (cursor <= to) {
    const isoDate = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(cursor.getDate()).padStart(2, "0")}`;
    dateKeys.push(isoDate);
    cursor.setDate(cursor.getDate() + 1);
  }

  return dateKeys;
};

const resolveHolidayDate = (holiday: HolidayDTO): string => {
  const observed = holiday.observedDate?.trim();
  if (observed && observed !== holiday.holidayDate) {
    return observed;
  }

  return holiday.holidayDate;
};

const getHolidayCategory = (holiday: HolidayDTO): HolidayCategory => {
  if (holiday.isWorkingHoliday || holiday.holidayType === "SPECIAL_WORKING") {
    return "working";
  }

  if (holiday.holidayType === "REGULAR") {
    return "regular";
  }

  return "special";
};

const buildDTRWithMissingDates = (
  sourceRecords: DTRDailyDTO[],
  holidayMap: Map<string, HolidayDetail[]>,
  dayOffSet: Set<string>,
  fromCustom: string,
  toCustom: string,
  employeeId?: string
): DTRDailyDTO[] => {
  const dateKeys = getDateKeysInRange(fromCustom, toCustom);

  if (dateKeys.length === 0) {
    return sourceRecords;
  }

  const sourceMap = new Map<string, DTRDailyDTO>();
  sourceRecords.forEach((record) => {
    sourceMap.set(toIsoDateKey(record.workDate), record);
  });

  return dateKeys.map((dateKey, index) => {
    const existing = sourceMap.get(dateKey);
    const holidayDetails = holidayMap.get(dateKey) || [];
    const isRestDay = dayOffSet.has(dateKey);

    if (existing) {
      return {
        ...existing,
        holidayDetails,
      };
    }

    let attendanceStatus: string;
    if (holidayDetails.length > 0) {
      attendanceStatus = "HOLIDAY";
    } else if (isRestDay) {
      attendanceStatus = "REST DAY";
    } else {
      attendanceStatus = "ABSENT";
    }

    return {
      dtrDailyId: -(index + 1),
      employeeId: employeeId || "",
      workDate: toCustomDateStart(dateKey),
      totalWorkMinutes: 0,
      totalLateMinutes: 0,
      totalUndertimeMinutes: 0,
      totalOvertimeMinutes: 0,
      attendanceStatus,
      segments: [],
      holidayDetails,
    };
  });
};

type EditSegmentState = {
  record: DTRDailyDTO;
  segment: DTRSegmentDTO;
  timeIn: string;
  breakOut: string;
  breakIn: string;
  timeOut: string;
};

const toTimeStr = (t: string): string => (t.length === 5 ? `${t}:00` : t);

export default function DTRPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [records, setRecords] = useState<DTRDailyDTO[]>([]);
  const { fromDate, setFromDate, toDate, setToDate } = useSalaryPeriodRange(
    API_BASE_URL_ADMINISTRATIVE ?? "",
    "PAYROLL"
  );
  const [userRole, setUserRole] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [holidays, setHolidays] = useState<HolidayDTO[]>([]);
  const [scheduleMap, setScheduleMap] = useState<Map<string, ScheduledTimes>>(new Map());
  const [overlayDetailMap, setOverlayDetailMap] = useState<Map<string, OverlayDetail>>(new Map());
  const [editSegmentState, setEditSegmentState] = useState<EditSegmentState | null>(null);
  const [isSavingSegment, setIsSavingSegment] = useState(false);
  const [dayOffDates, setDayOffDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    const storedEmployees = localStorageUtil.getEmployees();
    if (storedEmployees != null && storedEmployees.length > 0) {
      setEmployees(storedEmployees);
    } else {
      // fallback fetch if not in localStorage
      fetchEmployees();
    }

    fetchHolidays();
  }, []);

  useEffect(() => {
    const role = localStorageUtil.getEmployeeRole();
    const empNo = localStorageUtil.getEmployeeNo();
    const fullname = localStorageUtil.getEmployeeFullname();
    const employeeId = localStorageUtil.getEmployeeId();

    setUserRole(role);

    // Admin (role "1") manages other employees — leave selectedEmployee null
    // so they must pick from the datalist. Non-admin sees their own record (read-only).
    if (role !== "1" && empNo) {
      const storedList = localStorageUtil.getEmployees();
      const empFromList = storedList?.find(e => e.employeeNo === empNo) ?? null;
      if (empFromList) {
        setSelectedEmployee(empFromList);
      } else if (fullname) {
        const emp = { employeeId: employeeId, employeeNo: empNo, fullName: fullname } as Employee;
        setSelectedEmployee(emp);
      }
    }
  }, []);

  // Fetch employees (on focus or page load)
  const fetchEmployees = async () => {
    try {
      const res = await fetchWithAuth(
        `${API_BASE_URL_TIMEKEEPING}/api/employees/basicInfo`
      );

      if (!res.ok) {
        console.error("Failed to fetch employees:", res.status);
        return;
      }

      const data: Employee[] = await res.json();
      // Exclude the admin account from the employee picker (same filter as LoginForm)
      setEmployees(data.filter((emp) => emp.employeeNo !== "admin"));
      console.log("Successfully fetch employees", res.status);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  // Fetch approved regular leave applications for an employee and build a
  // date → leaveType map.  Leave Monetization is excluded (no date range).
  const fetchLeaveMap = async (employeeId: string): Promise<Map<string, string>> => {
    try {
      const res = await fetchWithAuth(
        `${API_BASE_URL_HRM}/api/leave-application/get-all/${employeeId}`
      );
      if (!res.ok || res.status === 204) return new Map();

      const data: LeaveApplicationDTO[] = await res.json();
      const map = new Map<string, string>();

      data.forEach((leave) => {
        if (
          leave.leaveType === "Leave Monetization" ||
          leave.approvedStatus?.toLowerCase() !== "approved" ||
          !leave.startDate ||
          !leave.endDate
        ) return;

        // Expand every day in the inclusive date range
        const cursor = new Date(leave.startDate);
        const end    = new Date(leave.endDate);
        while (cursor <= end) {
          const key = cursor.toISOString().split("T")[0]; // yyyy-MM-dd
          map.set(key, leave.leaveType);
          cursor.setDate(cursor.getDate() + 1);
        }
      });

      return map;
    } catch {
      return new Map();
    }
  };

  // Overlay approved leave applications onto records that are still ABSENT.
  // PRESENT, HOLIDAY, and REST DAY rows are never overwritten.
  const overlayLeaves = (
    rows: DTRDailyDTO[],
    leaveDateMap: Map<string, string>
  ): DTRDailyDTO[] => {
    if (leaveDateMap.size === 0) return rows;
    return rows.map((rec) => {
      if (rec.attendanceStatus !== "ABSENT") return rec;
      const dateKey = toIsoDateKey(rec.workDate);
      const leaveType = leaveDateMap.get(dateKey);
      return leaveType ? { ...rec, attendanceStatus: leaveType } : rec;
    });
  };

  // Fetch approved CTOs for an employee and return a Set of dateOfOffset (yyyy-MM-dd).
  const fetchCtoSet = async (employeeId: string): Promise<Set<string>> => {
    try {
      const res = await fetchWithAuth(
        `${API_BASE_URL_HRM}/api/cto/get-all/${employeeId}`
      );
      if (!res.ok || res.status === 204) return new Set();
      const data: CompensatoryTimeOffDTO[] = await res.json();
      const set = new Set<string>();
      data.forEach((cto) => {
        if (cto.status?.toLowerCase() === "approved" && cto.dateOfOffset) {
          set.add(cto.dateOfOffset); // already yyyy-MM-dd from backend
        }
      });
      return set;
    } catch {
      return new Set();
    }
  };

  // Overlay approved CTOs onto any non-Present record.
  // An approved CTO overrides ABSENT, HOLIDAY, and REST DAY because the employee
  // explicitly used their COC hours for that day. Never overrides Present.
  const overlayCtos = (
    rows: DTRDailyDTO[],
    ctoDateSet: Set<string>
  ): DTRDailyDTO[] => {
    if (ctoDateSet.size === 0) return rows;
    return rows.map((rec) => {
      if (rec.attendanceStatus.toLowerCase().includes("present")) return rec;
      const dateKey = toIsoDateKey(rec.workDate);
      return ctoDateSet.has(dateKey) ? { ...rec, attendanceStatus: "CTO" } : rec;
    });
  };

  // Fetch approved Pass Slips and return a Map<date, OverlayDetail> keyed by passSlipDate.
  const fetchPassSlipDetailMap = async (employeeId: string): Promise<Map<string, OverlayDetail>> => {
    try {
      const res = await fetchWithAuth(
        `${API_BASE_URL_HRM}/api/pass-slip/get-all/${employeeId}`
      );
      if (!res.ok || res.status === 204) return new Map();
      const data: PassSlipDTO[] = await res.json();
      const map = new Map<string, OverlayDetail>();
      data.forEach((ps) => {
        if (ps.status?.toLowerCase() === "approved" && ps.passSlipDate) {
          map.set(ps.passSlipDate, {
            kind: "PASS_SLIP",
            purpose: ps.purpose,
            departureTime: ps.departureTime,
            arrivalTime: ps.arrivalTime,
          });
        }
      });
      return map;
    } catch {
      return new Map();
    }
  };

  // Overlay approved Pass Slips onto any non-Present record.
  // Never overrides a CTO or Present row.
  const overlayPassSlips = (
    rows: DTRDailyDTO[],
    passSlipDetailMap: Map<string, OverlayDetail>
  ): DTRDailyDTO[] => {
    if (passSlipDetailMap.size === 0) return rows;
    return rows.map((rec) => {
      const s = rec.attendanceStatus.toLowerCase();
      if (s.includes("present") || s === "cto") return rec;
      const dateKey = toIsoDateKey(rec.workDate);
      return passSlipDetailMap.has(dateKey)
        ? { ...rec, attendanceStatus: "Pass Slip" }
        : rec;
    });
  };

  // Fetch approved Official Engagement Applications and build a Map<date, OverlayDetail>
  // by expanding each OE's [startDate, endDate] range into individual date keys.
  const fetchOEDetailMap = async (
    employeeId: string
  ): Promise<Map<string, OverlayDetail>> => {
    try {
      const res = await fetchWithAuth(
        `${API_BASE_URL_HRM}/api/official-engagement/get-all/${employeeId}`
      );
      if (!res.ok || res.status === 204) return new Map();
      const data: OfficialEngagementApplicationDTO[] = await res.json();
      const map = new Map<string, OverlayDetail>();
      data.forEach((oe) => {
        if (oe.status?.toLowerCase() !== "approved") return;
        if (!oe.startDate || !oe.endDate) return;
        // Expand the date range into individual keys
        const cursor = new Date(oe.startDate);
        const end = new Date(oe.endDate);
        while (cursor <= end) {
          const key = cursor.toISOString().split("T")[0];
          map.set(key, {
            kind: "OFFICIAL_ENGAGEMENT",
            officialType: oe.officialType,
            startDate: oe.startDate,
            startTime: oe.startTime,
            endDate: oe.endDate,
            endTime: oe.endTime,
          });
          cursor.setDate(cursor.getDate() + 1);
        }
      });
      return map;
    } catch {
      return new Map();
    }
  };

  // Overlay approved Official Engagements onto any non-Present, non-CTO record.
  // Pass Slip is also preserved (OE doesn't override it).
  const overlayOfficialEngagements = (
    rows: DTRDailyDTO[],
    oeDetailMap: Map<string, OverlayDetail>
  ): DTRDailyDTO[] => {
    if (oeDetailMap.size === 0) return rows;
    return rows.map((rec) => {
      const s = rec.attendanceStatus.toLowerCase();
      if (s.includes("present") || s === "cto" || s.includes("pass slip")) return rec;
      const dateKey = toIsoDateKey(rec.workDate);
      const detail = oeDetailMap.get(dateKey);
      return detail && detail.kind === "OFFICIAL_ENGAGEMENT"
        ? { ...rec, attendanceStatus: detail.officialType }
        : rec;
    });
  };

  // Fetch approved Time Corrections and return a Map<date, OverlayDetail> keyed by workDate.
  const fetchTCDetailMap = async (employeeId: string): Promise<Map<string, OverlayDetail>> => {
    try {
      const res = await fetchWithAuth(
        `${API_BASE_URL_HRM}/api/time-correction/get-all/${employeeId}`
      );
      if (!res.ok || res.status === 204) return new Map();
      const data: TimeCorrectionDTO[] = await res.json();
      const map = new Map<string, OverlayDetail>();
      data.forEach((tc) => {
        if (tc.status?.toLowerCase() === "approved" && tc.workDate) {
          map.set(tc.workDate, {
            kind: "TIME_CORRECTED",
            correctedTimeIn: tc.correctedTimeIn,
            correctedTimeOut: tc.correctedTimeOut,
            correctedBreakOut: tc.correctedBreakOut ?? null,
            correctedBreakIn: tc.correctedBreakIn ?? null,
          });
        }
      });
      return map;
    } catch {
      return new Map();
    }
  };

  // Overlay approved Time Corrections onto ABSENT-only records.
  // An approved TC means the employee was actually present with corrected times.
  // Never overrides Present, CTO, Pass Slip, or OE rows.
  // Also computes late/undertime/work minutes from corrected times vs scheduled shift.
  const overlayTimeCorrections = (
    rows: DTRDailyDTO[],
    tcDetailMap: Map<string, OverlayDetail>,
    scheduledTimesMap: Map<string, ScheduledTimes>
  ): DTRDailyDTO[] => {
    if (tcDetailMap.size === 0) return rows;
    return rows.map((rec) => {
      const s = rec.attendanceStatus.toLowerCase();
      if (!s.includes("absent")) return rec;
      const dateKey = toIsoDateKey(rec.workDate);
      const detail = tcDetailMap.get(dateKey);
      if (!detail || detail.kind !== "TIME_CORRECTED") return rec;

      // Compute work/late/undertime from corrected times vs scheduled shift
      const scheduled = scheduledTimesMap.get(dateKey);
      let totalWorkMinutes = 0;
      let totalLateMinutes = 0;
      let totalUndertimeMinutes = 0;

      if (detail.correctedTimeIn && detail.correctedTimeOut) {
        const tcIn = timeToMinutes(detail.correctedTimeIn);
        let tcOut = timeToMinutes(detail.correctedTimeOut);
        if (tcOut < tcIn) tcOut += 24 * 60; // overnight

        // Break duration: prefer corrected break times, fallback to scheduled
        let breakMinutes = 0;
        if (detail.correctedBreakOut && detail.correctedBreakIn) {
          const bo = timeToMinutes(detail.correctedBreakOut);
          const bi = timeToMinutes(detail.correctedBreakIn);
          breakMinutes = Math.max(0, bi - bo);
        } else if (scheduled?.breakOut && scheduled?.breakIn) {
          const bo = timeToMinutes(scheduled.breakOut);
          const bi = timeToMinutes(scheduled.breakIn);
          breakMinutes = Math.max(0, bi - bo);
        }
        totalWorkMinutes = Math.max(0, tcOut - tcIn - breakMinutes);

        if (scheduled) {
          const schedIn = timeToMinutes(scheduled.timeIn);
          const schedOut = timeToMinutes(scheduled.timeOut);

          // Late from clock-in
          totalLateMinutes = Math.max(0, tcIn - schedIn);
          // Undertime from early clock-out
          totalUndertimeMinutes = Math.max(0, schedOut - tcOut);

          // Break-related late/undertime — only when both corrected AND scheduled break exist
          if (detail.correctedBreakOut && detail.correctedBreakIn && scheduled.breakOut && scheduled.breakIn) {
            const tcBO = timeToMinutes(detail.correctedBreakOut);
            const tcBI = timeToMinutes(detail.correctedBreakIn);
            const schedBO = timeToMinutes(scheduled.breakOut);
            const schedBI = timeToMinutes(scheduled.breakIn);
            // Employee left for break early → undertime
            totalUndertimeMinutes += Math.max(0, schedBO - tcBO);
            // Employee returned from break late → late
            totalLateMinutes += Math.max(0, tcBI - schedBI);
          }
        }
      }

      return {
        ...rec,
        attendanceStatus: "Time Corrected",
        totalWorkMinutes,
        totalLateMinutes,
        totalUndertimeMinutes,
      };
    });
  };

  // Fetch DTR records
  const fetchDTR = async () => {
    if (!selectedEmployee) {
      Swal.fire({
        title: "Warning",
        text: "Please select an employee first.",
        icon: "warning",
        confirmButtonText: "OK",
      });
      return;
    }
    if (!selectedEmployee.employeeId) {
      Swal.fire({
        title: "Warning",
        text: "Selected employee has no valid ID. Please re-select.",
        icon: "warning",
        confirmButtonText: "OK",
      });
      return;
    }
    try {
      if (selectedEmployee && fromDate && toDate) {
        const res = await fetchWithAuth(
          `${API_BASE_URL_TIMEKEEPING}/api/dtr-daily?employeeId=${
            selectedEmployee.employeeId
          }&fromDate=${encodeURIComponent(
            fromDate
          )}&toDate=${encodeURIComponent(toDate)}`
        );

        if (res.status === 204) {
          // No DTR records — still build the full date range with ABSENT/REST DAY entries
          const holidayMap = new Map<string, HolidayDetail[]>();
          holidays
            .filter((h) => h.isActive)
            .forEach((holiday) => {
              const dateKey = toIsoDateKey(resolveHolidayDate(holiday));
              const current = holidayMap.get(dateKey) || [];
              holidayMap.set(dateKey, [
                ...current,
                {
                  name: holiday.name,
                  holidayType: holiday.holidayType,
                  holidayScope: holiday.holidayScope,
                  category: getHolidayCategory(holiday),
                },
              ]);
            });
          const [wsRes, tsMap] = await Promise.all([
            fetchWithAuth(
              `${API_BASE_URL_TIMEKEEPING}/api/getListByEmployeeAndDateRange/work-schedule?employeeId=${selectedEmployee.employeeId}&monthStart=${encodeURIComponent(fromDate)}&monthEnd=${encodeURIComponent(toDate)}`
            ),
            fetchTimeShifts(),
          ]);
          const dayOffSet = new Set<string>();
          const scheduledTimesMap204 = new Map<string, ScheduledTimes>();
          if (wsRes.status !== 204 && wsRes.ok) {
            const wsJson: WorkScheduleEntryDTO[] = await wsRes.json();
            wsJson.forEach((ws) => {
              const key = toIsoDateKey(ws.wsDateTime);
              if (ws.isDayOff) {
                dayOffSet.add(key);
              } else if (ws.tsCode) {
                const shift = tsMap.get(ws.tsCode);
                if (shift) scheduledTimesMap204.set(key, shift);
              }
            });
          }
          setScheduleMap(scheduledTimesMap204);
          setDayOffDates(new Set(dayOffSet));
          const [leaveMap204, ctoSet204, passSlipDetailMap204, oeDetailMap204, tcDetailMap204] = await Promise.all([
            fetchLeaveMap(selectedEmployee.employeeId),
            fetchCtoSet(selectedEmployee.employeeId),
            fetchPassSlipDetailMap(selectedEmployee.employeeId),
            fetchOEDetailMap(selectedEmployee.employeeId),
            fetchTCDetailMap(selectedEmployee.employeeId),
          ]);
          setOverlayDetailMap(new Map<string, OverlayDetail>([...passSlipDetailMap204, ...oeDetailMap204, ...tcDetailMap204]));
          setRecords(
            overlayTimeCorrections(
              overlayOfficialEngagements(
                overlayPassSlips(
                  overlayCtos(
                    overlayLeaves(
                      buildDTRWithMissingDates([], holidayMap, dayOffSet, fromDate, toDate, selectedEmployee.employeeId),
                      leaveMap204
                    ),
                    ctoSet204
                  ),
                  passSlipDetailMap204
                ),
                oeDetailMap204
              ),
              tcDetailMap204,
              scheduledTimesMap204
            )
          );
          return;
        }

        if (!res.ok) {
          throw new Error(`Failed to fetch DTR daily records: ${res.status}`);
        }

        const dtrJson: DTRDailyDTO[] = await res.json();

        const holidayMap = new Map<string, HolidayDetail[]>();
        holidays
          .filter((holiday) => holiday.isActive)
          .forEach((holiday) => {
            const dateKey = toIsoDateKey(resolveHolidayDate(holiday));
            const current = holidayMap.get(dateKey) || [];
            holidayMap.set(dateKey, [
              ...current,
              {
                name: holiday.name,
                holidayType: holiday.holidayType,
                holidayScope: holiday.holidayScope,
                category: getHolidayCategory(holiday),
              },
            ]);
          });

        // Fetch work schedules (day off detection + scheduled times) and time shifts in parallel
        const [wsRes, tsMap] = await Promise.all([
          fetchWithAuth(
            `${API_BASE_URL_TIMEKEEPING}/api/getListByEmployeeAndDateRange/work-schedule?employeeId=${selectedEmployee.employeeId}&monthStart=${encodeURIComponent(fromDate)}&monthEnd=${encodeURIComponent(toDate)}`
          ),
          fetchTimeShifts(),
        ]);
        const dayOffSet = new Set<string>();
        const scheduledTimesMap = new Map<string, ScheduledTimes>();
        if (wsRes.status !== 204 && wsRes.ok) {
          const wsJson: WorkScheduleEntryDTO[] = await wsRes.json();
          wsJson.forEach((ws) => {
            const key = toIsoDateKey(ws.wsDateTime);
            if (ws.isDayOff) {
              dayOffSet.add(key);
            } else if (ws.tsCode) {
              const shift = tsMap.get(ws.tsCode);
              if (shift) scheduledTimesMap.set(key, shift);
            }
          });
        }
        setScheduleMap(scheduledTimesMap);
        setDayOffDates(new Set(dayOffSet));

        const [leaveMap, ctoSet, passSlipDetailMap, oeDetailMap, tcDetailMap] = await Promise.all([
          fetchLeaveMap(selectedEmployee.employeeId),
          fetchCtoSet(selectedEmployee.employeeId),
          fetchPassSlipDetailMap(selectedEmployee.employeeId),
          fetchOEDetailMap(selectedEmployee.employeeId),
          fetchTCDetailMap(selectedEmployee.employeeId),
        ]);
        setOverlayDetailMap(new Map<string, OverlayDetail>([...passSlipDetailMap, ...oeDetailMap, ...tcDetailMap]));
        const recordsWithFilledDates = overlayTimeCorrections(
          overlayOfficialEngagements(
            overlayPassSlips(
              overlayCtos(
                overlayLeaves(
                  buildDTRWithMissingDates(
                    dtrJson,
                    holidayMap,
                    dayOffSet,
                    fromDate,
                    toDate,
                    selectedEmployee.employeeId
                  ),
                  leaveMap
                ),
                ctoSet
              ),
              passSlipDetailMap
            ),
            oeDetailMap
          ),
          tcDetailMap,
          scheduledTimesMap
        );

        setRecords(recordsWithFilledDates);
        console.log("Successfully fetch DTR employees", res.status);
      } else {
        console.error("Error fetching DTR employees");
        return;
      }
    } catch (error) {
      console.error("Error fetching DTR employees:", error);
    }
  };

  const fetchHolidays = async () => {
    try {
      const res = await fetchWithAuth(
        `${API_BASE_URL_ADMINISTRATIVE}/api/holiday/get-all`
      );

      if (!res.ok) {
        console.error("Failed to fetch holidays:", res.status);
        return;
      }

      const holidayJson: HolidayDTO[] = await res.json();
      setHolidays(holidayJson || []);
    } catch (error) {
      console.error("Error fetching holidays:", error);
    }
  };

  // Fetch all configured time shifts from Administrative and return a Map<tsCode, ScheduledTimes>.
  const fetchTimeShifts = async (): Promise<Map<string, ScheduledTimes>> => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL_ADMINISTRATIVE}/api/getAll/time-shift`);
      if (!res.ok || res.status === 204) return new Map();
      const data: Array<{ tsCode: string; tsName: string; timeIn: string; breakOut: string | null; breakIn: string | null; timeOut: string }> = await res.json();
      const map = new Map<string, ScheduledTimes>();
      data.forEach((ts) =>
        map.set(ts.tsCode, {
          tsCode: ts.tsCode,
          tsName: ts.tsName,
          timeIn: ts.timeIn,
          breakOut: ts.breakOut,
          breakIn: ts.breakIn,
          timeOut: ts.timeOut,
        })
      );
      return map;
    } catch {
      return new Map();
    }
  };

  const handleEditSegment = (record: DTRDailyDTO, segment: DTRSegmentDTO) => {
    setEditSegmentState({
      record,
      segment,
      timeIn: segment.timeIn?.substring(0, 5) ?? "",
      breakOut: segment.breakOut?.substring(0, 5) ?? "",
      breakIn: segment.breakIn?.substring(0, 5) ?? "",
      timeOut: segment.timeOut?.substring(0, 5) ?? "",
    });
  };

  const handleSaveEditSegment = async () => {
    if (!editSegmentState) return;
    const { record, segment, timeIn, breakOut, breakIn, timeOut } = editSegmentState;

    if (!timeIn) {
      Swal.fire("Validation Error", "Time In is required.", "warning");
      return;
    }

    const dateKey = toIsoDateKey(record.workDate);
    const scheduled = scheduleMap.get(dateKey);
    const SCHED_IN  = scheduled ? timeToMinutes(scheduled.timeIn)  : 8 * 60;
    const SCHED_OUT = scheduled ? timeToMinutes(scheduled.timeOut) : 17 * 60;

    const inMin = timeToMinutes(timeIn);

    // If Time Out is empty the segment is still open — compute what we can from available times
    let workMinutes = 0, lateMinutes = 0, undertimeMinutes = 0, overtimeMinutes = 0;

    // Determine the last known time and break deduction based on what fields are filled.
    // Rules:
    //   - Time Out present              → last = Time Out;  break = BreakOut→BreakIn if both present
    //   - Break In present, no Time Out → last = Break In;  break = BreakOut→BreakIn
    //   - Break Out only, no Break In   → last = Break Out; break = 0 (employee left during break)
    //   - Only Time In                  → nothing to compute yet
    if (timeOut || breakOut) {
      let lastMin: number;
      let breakMins = 0;

      if (timeOut) {
        lastMin = timeToMinutes(timeOut);
        if (lastMin < inMin) lastMin += 24 * 60; // overnight
        if (breakOut && breakIn) {
          breakMins = Math.max(0, timeToMinutes(breakIn) - timeToMinutes(breakOut));
        }
      } else if (breakIn) {
        // Back from break but no Time Out yet — last known = Break In; work excludes break time
        const breakInMin  = timeToMinutes(breakIn);
        const breakOutMin = timeToMinutes(breakOut!);
        breakMins = Math.max(0, breakInMin - breakOutMin);
        lastMin   = breakInMin;
      } else {
        // Only Break Out — last known = Break Out (departed during/at break)
        lastMin = timeToMinutes(breakOut!);
      }

      workMinutes      = Math.max(0, lastMin - inMin - breakMins);
      lateMinutes      = Math.max(0, inMin - SCHED_IN);
      undertimeMinutes = lastMin < SCHED_OUT ? Math.max(0, SCHED_OUT - lastMin) : 0;
      overtimeMinutes  = lastMin > SCHED_OUT ? Math.max(0, lastMin - SCHED_OUT) : 0;
    }

    const updatedSegment: DTRSegmentDTO = {
      ...segment,
      timeIn:   toTimeStr(timeIn),
      breakOut: breakOut ? toTimeStr(breakOut) : null,
      breakIn:  breakIn  ? toTimeStr(breakIn)  : null,
      timeOut:  timeOut  ? toTimeStr(timeOut)  : null,
      workMinutes,
      lateMinutes,
      undertimeMinutes,
      overtimeMinutes,
    };

    const updatedSegments = record.segments.map((s) =>
      s.dtrSegmentId === segment.dtrSegmentId ? updatedSegment : s
    );

    const totalWorkMinutes = updatedSegments.reduce((sum, s) => sum + s.workMinutes, 0);
    const totalLateMinutes = updatedSegments.reduce((sum, s) => sum + s.lateMinutes, 0);
    const totalUndertimeMinutes = updatedSegments.reduce((sum, s) => sum + s.undertimeMinutes, 0);
    const totalOvertimeMinutes = updatedSegments.reduce((sum, s) => sum + s.overtimeMinutes, 0);

    const payload: DTRDailyDTO = {
      ...record,
      segments: updatedSegments,
      totalWorkMinutes,
      totalLateMinutes,
      totalUndertimeMinutes,
      totalOvertimeMinutes,
    };

    setIsSavingSegment(true);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL_TIMEKEEPING}/api/dtr-daily`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      setEditSegmentState(null);
      await Swal.fire({ title: "Saved", text: "Segment updated successfully.", icon: "success", timer: 1500, showConfirmButton: false });
      fetchDTR();
    } catch {
      Swal.fire("Error", "Failed to update segment.", "error");
    } finally {
      setIsSavingSegment(false);
    }
  };

  const handleDeleteSegment = async (record: DTRDailyDTO, segment: DTRSegmentDTO) => {
    const confirm = await Swal.fire({
      title: "Delete Segment?",
      text: `Remove segment ${segment.segmentNo} from ${record.workDate.split(" ")[0]}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
    });
    if (!confirm.isConfirmed) return;

    const updatedSegments = record.segments.filter(
      (s) => s.dtrSegmentId !== segment.dtrSegmentId
    );

    const totalWorkMinutes = updatedSegments.reduce((sum, s) => sum + s.workMinutes, 0);
    const totalLateMinutes = updatedSegments.reduce((sum, s) => sum + s.lateMinutes, 0);
    const totalUndertimeMinutes = updatedSegments.reduce((sum, s) => sum + s.undertimeMinutes, 0);
    const totalOvertimeMinutes = updatedSegments.reduce((sum, s) => sum + s.overtimeMinutes, 0);

    const payload: DTRDailyDTO = {
      ...record,
      segments: updatedSegments,
      totalWorkMinutes,
      totalLateMinutes,
      totalUndertimeMinutes,
      totalOvertimeMinutes,
      attendanceStatus: (() => {
        if (updatedSegments.length > 0) return record.attendanceStatus;
        const isoKey = toIsoDateKey(record.workDate);
        if ((record.holidayDetails?.length ?? 0) > 0) return "HOLIDAY";
        if (dayOffDates.has(isoKey)) return "REST DAY";
        return "ABSENT";
      })(),
    };

    try {
      const res = await fetchWithAuth(`${API_BASE_URL_TIMEKEEPING}/api/dtr-daily`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      await Swal.fire({ title: "Deleted", text: "Segment deleted.", icon: "success", timer: 1500, showConfirmButton: false });
      fetchDTR();
    } catch {
      Swal.fire("Error", "Failed to delete segment.", "error");
    }
  };

  return (
    <Main>
      <div className={modalStyles.Modal}>
        <div className={modalStyles.modalContent}>
          <div className={modalStyles.modalHeader}>
            <h2 className={modalStyles.mainTitle}>
              Daily Time Record
              {userRole === "1" && (
                <Link
                  href="/time-keeping/dtr/manual-entry"
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    padding: "0.4rem 1rem",
                    background: "linear-gradient(120deg, #4c5fb8 0%, #2f87d4 100%)",
                    color: "#fff",
                    borderRadius: "8px",
                    textDecoration: "none",
                    alignSelf: "center",
                    marginBottom: "4px",
                    whiteSpace: "nowrap",
                  }}
                >
                  + Add Manual DTR
                </Link>
              )}
            </h2>
          </div>
          <div className={modalStyles.modalBody}>
            <div className={styles.DTRPage}>
              <div className={styles.filterCard}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label htmlFor="employee">Employee Name</label>
                    <input
                      id="employee"
                      type="text"
                      list={userRole === "1" ? "employee-list" : undefined}
                      placeholder="Employee No / Lastname"
                      value={
                        userRole === "1"
                          ? inputValue // ✅ Admin can type freely
                          : selectedEmployee
                          ? `[${selectedEmployee.employeeNo}] ${selectedEmployee.fullName}`
                          : ""
                      }
                      readOnly={userRole !== "1"} // ✅ Non-admin can't edit
                      onChange={(e) => {
                        if (userRole === "1") {
                          setInputValue(e.target.value); // ✅ Track admin typing

                          const selected = employees.find(
                            (emp) =>
                              `[${emp.employeeNo}] ${emp.fullName}`.toLowerCase() ===
                              e.target.value.toLowerCase()
                          );
                          setSelectedEmployee(selected || null);
                        }
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

                  <div className={styles.formGroup}>
                    <label htmlFor="from">From Date</label>
                    <input
                      id="from"
                      type="date"
                      value={fromDate ? toDateInputValue(fromDate) : ""}
                      onChange={(e) =>
                        setFromDate(toCustomFormat(e.target.value, true))
                      }
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="to">To Date</label>
                    <input
                      id="to"
                      type="date"
                      value={toDate ? toDateInputValue(toDate) : ""}
                      onChange={(e) =>
                        setToDate(toCustomFormat(e.target.value, false))
                      }
                    />
                  </div>

                  <div className={styles.actions}>
                    <button className={styles.searchButton} onClick={fetchDTR}>
                      Search
                    </button>
                  </div>
                </div>
                <p className={styles.helperText}>
                  Tip: Select an employee and date range, then click Search to
                  load summarized attendance with expandable segments.
                </p>
              </div>
            </div>
            {records.length > 0 && (
              <DTRTable
                records={records}
                scheduleMap={scheduleMap}
                overlayDetailMap={overlayDetailMap}
                userRole={userRole}
                onEditSegment={handleEditSegment}
                onDeleteSegment={handleDeleteSegment}
              />
            )}
          </div>
        </div>
      </div>

      {/* Edit Segment Modal — admin only */}
      {editSegmentState && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !isSavingSegment) setEditSegmentState(null); }}
        >
          <div
            style={{
              background: "#fff", borderRadius: 14,
              padding: "2rem 2.2rem", minWidth: 360, maxWidth: 480, width: "100%",
              boxShadow: "0 12px 40px rgba(30,60,120,0.18)",
            }}
          >
            <h3 style={{ margin: "0 0 1.2rem", fontSize: "1.1rem", fontWeight: 700, color: "#243058" }}>
              Edit Segment {editSegmentState.segment.segmentNo} — {editSegmentState.record.workDate.split(" ")[0]}
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.9rem 1.2rem" }}>
              {(
                [
                  { label: "Time In *", key: "timeIn" as const },
                  { label: "Time Out", key: "timeOut" as const },
                  { label: "Break Out", key: "breakOut" as const },
                  { label: "Break In", key: "breakIn" as const },
                ] as const
              ).map(({ label, key }) => (
                <div key={key} style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#445180" }}>{label}</label>
                  <input
                    type="time"
                    value={editSegmentState[key]}
                    disabled={isSavingSegment}
                    onChange={(e) =>
                      setEditSegmentState((prev) => prev ? { ...prev, [key]: e.target.value } : prev)
                    }
                    style={{
                      padding: "0.45rem 0.6rem", borderRadius: 7,
                      border: "1px solid #c5cfe8", fontSize: "0.95rem",
                      background: isSavingSegment ? "#f3f4f6" : "#fff",
                    }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "0.8rem", justifyContent: "flex-end", marginTop: "1.5rem" }}>
              <button
                onClick={() => setEditSegmentState(null)}
                disabled={isSavingSegment}
                style={{
                  padding: "0.55rem 1.3rem", borderRadius: 8, border: "1px solid #d1d5db",
                  background: "#f9fafb", fontWeight: 600, fontSize: "0.9rem",
                  cursor: isSavingSegment ? "not-allowed" : "pointer", color: "#374151",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditSegment}
                disabled={isSavingSegment}
                style={{
                  padding: "0.55rem 1.4rem", borderRadius: 8, border: "none",
                  background: isSavingSegment ? "#94a3b8" : "linear-gradient(120deg,#4c5fb8 0%,#2f87d4 100%)",
                  color: "#fff", fontWeight: 700, fontSize: "0.9rem",
                  cursor: isSavingSegment ? "not-allowed" : "pointer",
                }}
              >
                {isSavingSegment ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Main>
  );
}