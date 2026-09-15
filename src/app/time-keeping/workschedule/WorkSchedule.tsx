"use client";

import { runtimeConfig } from "@/lib/utils/runtimeConfig";
import { useCallback, useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import { EventClickArg } from "@fullcalendar/core";

import styles from "@/styles/WorkSchedule.module.scss";
import modalStyles from "@/styles/Modal.module.scss";
import { localStorageUtil } from "@/lib/utils/localStorageUtil";
import { Employee } from "@/lib/types/Employee"; // ✅ Shared employee type
import Swal from "sweetalert2";
import { fetchWithAuth } from "@/lib/utils/fetchWithAuth";
import {
  toDateInputValue,
  getFirstDateOfMonth,
  getLastDateOfMonth,
} from "@/lib/utils/dateFormatUtils";
const API_BASE_URL_ADMINISTRATIVE = runtimeConfig.getApiUrl("administrative");
const API_BASE_URL_TIMEKEEPING = runtimeConfig.getApiUrl("timekeeping");
import to12HourFormat from "@/lib/utils/convert24To12HrFormat";
import { WorkScheduleDTO } from "@/lib/types/WorkScheduleDTO";
import { format, parseISO } from "date-fns";

type ShiftEvent = {
  wsId: number;
  title: string;
  date: string;
  classNames?: string[];
  extendedProps?: {
    eventType: "workSchedule" | "dayOff";
    isDayOff?: boolean;
  };
};

type HolidayDTO = {
  holidayId?: number;
  name: string;
  holidayDate: string;
  observedDate?: string | null;
  holidayType: string;
  withPay: boolean;
  isWorkingHoliday: boolean;
  isActive: boolean;
};

type HolidayEvent = {
  id: string;
  title: string;
  date: string;
  classNames: string[];
  extendedProps: {
    eventType: "holiday";
    holidayCategory: "regular" | "special" | "working";
    holidayType: string;
    withPay: boolean;
    isWorkingHoliday: boolean;
    sourceDate: "holidayDate" | "observedDate";
  };
};

type TimeShift = {
  tsCode: string;
  timeIn: string;
  breakOut: string;
  breakIn: string;
  timeOut: string;
  tsName?: string; // Optional, for tooltip
};

type Area = {
  areasId: number;
  areasName: string;
  areasDescription?: string;
};

type BusinessUnit = {
  businessUnitsId: number;
  businessUnitsName: string;
  businessUnitsCode: string;
  areasId: number;
};

const getHolidayDisplayDate = (holiday: HolidayDTO) => {
  const observed = holiday.observedDate?.trim();
  if (observed && observed !== holiday.holidayDate) {
    return { value: observed, source: "observedDate" as const };
  }

  return { value: holiday.holidayDate, source: "holidayDate" as const };
};

const getHolidayCategory = (holiday: HolidayDTO) => {
  if (holiday.isWorkingHoliday || holiday.holidayType === "SPECIAL_WORKING") {
    return "working" as const;
  }

  if (holiday.holidayType === "REGULAR") {
    return "regular" as const;
  }

  return "special" as const;
};

export default function WorkSchedule() {
  const [workScheduleEvents, setWorkScheduleEvents] = useState<ShiftEvent[]>(
    [],
  );
  const [holidayEvents, setHolidayEvents] = useState<HolidayEvent[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [employeeInputValue, setEmployeeInputValue] = useState<string>("");
  const [timeShift, setTimeShift] = useState<TimeShift[]>([]);
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(
    new Date(),
  );
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedWorkDates, setSelectedWorkDates] = useState<Set<string>>(
    () => new Set(),
  );
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const canAdd = localStorageUtil.canAdd("tk.workSchedule");
  const canEdit = localStorageUtil.canEdit("tk.workSchedule");
  const canDelete = localStorageUtil.canDelete("tk.workSchedule");
  const [activeTab, setActiveTab] = useState<"calendar" | "report">("calendar");
  const [areas, setAreas] = useState<Area[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [reportAreaId, setReportAreaId] = useState<number | "">("");
  const [reportBusinessUnitId, setReportBusinessUnitId] = useState<number | "">(
    "",
  );
  const [reportFromDate, setReportFromDate] = useState("");
  const [reportToDate, setReportToDate] = useState("");
  const [reportPreparedBy, setReportPreparedBy] = useState("");
  const [reportPreparedByPos, setReportPreparedByPos] = useState("");
  const [reportPreparedByEmployee, setReportPreparedByEmployee] =
    useState<Employee | null>(null);
  const [reportApprovedBy, setReportApprovedBy] = useState("");
  const [reportApprovedByPos, setReportApprovedByPos] = useState("");
  const [reportApprovedByEmployee, setReportApprovedByEmployee] =
    useState<Employee | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const filteredReportBusinessUnits = businessUnits.filter(
    (unit) => reportAreaId !== "" && unit.areasId === reportAreaId,
  );

  const toEmployeeOption = (employee: Employee) =>
    `[${employee.employeeNo}] ${employee.fullName}`;

  const findEmployeeFromOption = (value: string) =>
    employees.find(
      (employee) =>
        toEmployeeOption(employee).toLowerCase() === value.toLowerCase(),
    ) ?? null;

  const fetchCurrentAppointmentPosition = useCallback(
    async (employeeId: string) => {
      if (!employeeId) return "";

      try {
        const response = await fetchWithAuth(
          `${API_BASE_URL_TIMEKEEPING}/api/work-schedule/signatory-position?employeeId=${encodeURIComponent(employeeId)}`,
        );

        if (!response.ok) {
          return "";
        }

        const data: { position?: string | null } = await response.json();
        return data.position ?? "";
      } catch (error) {
        console.error("Failed to fetch signatory position:", error);
        return "";
      }
    },
    [],
  );

  const handlePreparedByChange = async (value: string) => {
    setReportPreparedBy(value);

    const matchedEmployee = findEmployeeFromOption(value);
    setReportPreparedByEmployee(matchedEmployee);

    if (!matchedEmployee) {
      setReportPreparedByPos("");
      return;
    }

    const position = await fetchCurrentAppointmentPosition(
      String(matchedEmployee.employeeId),
    );
    setReportPreparedByPos(position);
  };

  const handleApprovedByChange = async (value: string) => {
    setReportApprovedBy(value);

    const matchedEmployee = findEmployeeFromOption(value);
    setReportApprovedByEmployee(matchedEmployee);

    if (!matchedEmployee) {
      setReportApprovedByPos("");
      return;
    }

    const position = await fetchCurrentAppointmentPosition(
      String(matchedEmployee.employeeId),
    );
    setReportApprovedByPos(position);
  };

  useEffect(() => {
    fetchWithAuth(`${API_BASE_URL_ADMINISTRATIVE}/api/areas/get-all`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.statusText)))
      .then((data: Area[]) => setAreas(data || []))
      .catch(() => setAreas([]));

    fetchWithAuth(`${API_BASE_URL_ADMINISTRATIVE}/api/businessUnits/get-all`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.statusText)))
      .then((data: BusinessUnit[]) => setBusinessUnits(data || []))
      .catch(() => setBusinessUnits([]));
  }, []);

  // Fetch Time Shifts (page load)
  const fetchTimeShifts = useCallback(async () => {
    try {
      const res = await fetchWithAuth(
        `${API_BASE_URL_ADMINISTRATIVE}/api/getAll/time-shift`,
      );

      if (!res.ok) {
        console.error("Failed to fetch time-shift:", res.status);
        return;
      }

      const data = await res.json();
      setTimeShift(data);
      console.log("Successfully fetch time-shift", res.status);
    } catch (error) {
      console.error("Error fetching time-shift:", error);
    }
  }, []);

  const fetchHolidays = useCallback(async () => {
    try {
      const res = await fetchWithAuth(
        `${API_BASE_URL_ADMINISTRATIVE}/api/holiday/get-all`,
      );

      if (!res.ok) {
        console.error("Failed to fetch holidays:", res.status);
        return;
      }

      const data: HolidayDTO[] = await res.json();
      const activeHolidays = (data || []).filter((holiday) => holiday.isActive);

      const mappedHolidayEvents: HolidayEvent[] = activeHolidays.map(
        (holiday) => {
          const effectiveDate = getHolidayDisplayDate(holiday);
          const holidayCategory = getHolidayCategory(holiday);

          return {
            id: `holiday-${holiday.holidayId ?? holiday.name}-${effectiveDate.value}`,
            title: holiday.name,
            date: toDateInputValue(effectiveDate.value),
            classNames: ["holiday-event", `holiday-${holidayCategory}`],
            extendedProps: {
              eventType: "holiday",
              holidayCategory,
              holidayType: holiday.holidayType,
              withPay: holiday.withPay,
              isWorkingHoliday: holiday.isWorkingHoliday,
              sourceDate: effectiveDate.source,
            },
          };
        },
      );

      setHolidayEvents(mappedHolidayEvents);
      console.log("Successfully fetched holidays", mappedHolidayEvents);
    } catch (error) {
      console.error("Error fetching holidays:", error);
    }
  }, []);

  // Fetch All Work Schedule by Selected employee (page load)
  const fetchAllWorkSchedule = useCallback(
    async (employeeId: string | null, year: number, month: number) => {
      try {
        // build start & end dates for the month
        const monthStart = getFirstDateOfMonth(month, year);
        const monthEnd = getLastDateOfMonth(month, year);

        const res = await fetchWithAuth(
          `${API_BASE_URL_TIMEKEEPING}/api/getListByEmployeeAndDateRange/work-schedule?employeeId=${employeeId}&monthStart=${monthStart}&monthEnd=${monthEnd}`,
        );

        if (res.status === 204) {
          console.log("No work schedule found for this employee/month");
          setWorkScheduleEvents([]); // clear schedule-only events
          return;
        }

        if (!res.ok) {
          throw new Error(`Failed to fetch work schedule: ${res.status}`);
        }

        const data = await res.json();

        // map backend DTOs to FullCalendar events
        const mappedEvents: ShiftEvent[] = data.map((ws: WorkScheduleDTO) => ({
          wsId: ws.wsId,
          title: ws.isDayOff ? "Day Off" : (ws.tsCode ?? ""),
          date: toDateInputValue(ws.wsDateTime),
          classNames: ws.isDayOff ? ["day-off-event"] : ["work-schedule-event"],
          extendedProps: {
            eventType: ws.isDayOff
              ? ("dayOff" as const)
              : ("workSchedule" as const),
            isDayOff: ws.isDayOff ?? false,
          },
        }));

        setWorkScheduleEvents(mappedEvents);
        console.log("Successfully fetched work schedule", mappedEvents);
      } catch (error) {
        console.error("Error fetching work schedule:", error);
      }
    },
    [],
  );

  // On mount: load role and employee list
  useEffect(() => {
    const stored = localStorageUtil.getEmployees();
    if (stored && stored.length > 0) {
      setEmployees(stored);
    }
    const role = localStorageUtil.getEmployeeRole();
    const empNo = localStorageUtil.getEmployeeNo();
    const employeeId = localStorageUtil.getEmployeeId();
    const fullname = localStorageUtil.getEmployeeFullname();

    const storedEmployees = localStorageUtil.getEmployees();
    setEmployees(storedEmployees);

    if (
      empNo &&
      ((!canAdd && !canEdit) || (canAdd && !canEdit) || (!canAdd && canEdit))
    ) {
      const empFromList = stored?.find((e) => e.employeeNo === empNo) ?? null;
      if (empFromList) {
        setSelectedEmployee(empFromList);
        setEmployeeInputValue(
          `[${empFromList.employeeNo}] ${empFromList.fullName}`,
        );
      } else if (fullname) {
        const own: Employee = {
          employeeId: String(employeeId ?? ""),
          employeeNo: empNo,
          fullName: fullname,
          role: role ?? "",
          biometricNo: "",
          isSearched: false,
          isCleared: false,
        };
        setSelectedEmployee(own);
        setEmployeeInputValue(`[${empNo}] ${fullname}`);
      }
    }

    fetchTimeShifts();
    fetchHolidays();

    const today = new Date();
    fetchAllWorkSchedule(employeeId, today.getFullYear(), today.getMonth() + 1);
  }, [canAdd, canEdit, fetchAllWorkSchedule, fetchHolidays, fetchTimeShifts]);

  useEffect(() => {
    if (selectedEmployee) {
      const today = new Date();
      fetchAllWorkSchedule(
        selectedEmployee.employeeId,
        today.getFullYear(),
        today.getMonth() + 1,
      );
    } else {
      setWorkScheduleEvents([]); // clear schedule-only events if no employee
    }
  }, [fetchAllWorkSchedule, selectedEmployee]);

  useEffect(() => {
    setSelectedWorkDates(new Set());
    setIsMultiSelectMode(false);
  }, [selectedEmployee]);

  const saveOrUpdateWorkSchedule = async (
    employeeId: string,
    tsCode: string | null,
    workDate: string,
    wsId?: number, // optional
  ) => {
    try {
      if (!tsCode) {
        throw new Error("Time shift code is required.");
      }

      const wsDateTime = buildWsDateTime(workDate, tsCode);

      const url = wsId
        ? `${API_BASE_URL_TIMEKEEPING}/api/update/work-schedule/${wsId}` // ✅ update
        : `${API_BASE_URL_TIMEKEEPING}/api/create/work-schedule`; // ✅ create

      const method = wsId ? "PUT" : "POST";

      const res = await fetchWithAuth(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, tsCode, wsDateTime }),
      });

      if (!res.ok) {
        throw new Error(`Failed to save work schedule: ${res.status}`);
      }

      const metadata = await res.json();
      wsId = wsId ? (metadata.metaId = wsId) : metadata.metaId;

      console.log("Work schedule saved/updated:", {
        wsId,
        employeeId,
        tsCode,
        wsDateTime,
      });

      return metadata;
    } catch (err) {
      console.error("Error saving work schedule:", err);
      Swal.fire({
        title: "Error",
        text: "Failed to save work schedule. Please try again.",
        icon: "error",
        returnFocus: false,
      });
      return false;
    }
  };

  const normalizeWorkDate = (workDate: string) => {
    if (!workDate) return workDate;
    if (workDate.includes("T")) return workDate.split("T")[0];
    if (workDate.includes(" ")) return workDate.split(" ")[0];
    return workDate;
  };

  const buildWsDateTime = (workDate: string, tsCode: string) => {
    const shift = getShiftByCode(tsCode);
    if (!shift) {
      throw new Error(`Time shift not found for code: ${tsCode}`);
    }

    const normalizedWorkDate = normalizeWorkDate(workDate);
    const isoDateTime = `${normalizedWorkDate}T${shift.timeIn}`;

    return format(parseISO(isoDateTime), "MM-dd-yyyy HH:mm:ss");
  };

  const deleteWorkSchedule = async (wsId?: number) => {
    try {
      const url = `${API_BASE_URL_TIMEKEEPING}/api/delete/work-schedule/${wsId}`; // ✅ delete

      const method = "DELETE";

      const res = await fetchWithAuth(url, {
        method,
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        throw new Error(`Failed to delete work schedule: ${res.status}`);
      }

      console.log("Work schedule deleted:", {
        wsId,
      });

      return true;
    } catch (err) {
      console.error("Error saving work schedule:", err);
      Swal.fire({
        title: "Error",
        text: "Failed to save work schedule. Please try again.",
        icon: "error",
        returnFocus: false,
      });
      return false;
    }
  };

  // Utility: Parse time string (HH:mm) to minutes
  const parseTime = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  // Utility: Get shift start/end in minutes, handling overnight
  const getShiftRange = (shift: TimeShift) => {
    const start = parseTime(shift.timeIn);
    let end = parseTime(shift.timeOut);
    if (end <= start) end += 24 * 60; // overnight or 24hr shift
    return [start, end];
  };

  const normalizeShiftCode = (code: string) => code.trim().toUpperCase();

  // Utility: Get all events for a date
  const getEventsForDate = (dateStr: string, excludedWsId?: number) =>
    workScheduleEvents.filter(
      (event) => event.date === dateStr && event.wsId !== excludedWsId,
    );

  // Utility: Get shift by code
  const getShiftByCode = (code: string) => {
    const normalizedCode = normalizeShiftCode(code);
    return timeShift.find(
      (shift) => normalizeShiftCode(shift.tsCode) === normalizedCode,
    );
  };

  const hasDuplicateShiftCode = (
    dateStr: string,
    shiftCode: string,
    excludedWsId?: number,
  ) => {
    const normalizedCode = normalizeShiftCode(shiftCode);

    return getEventsForDate(dateStr, excludedWsId).some(
      (event) => normalizeShiftCode(event.title) === normalizedCode,
    );
  };

  // Utility: Check overlap (with type safety, handles overnight)
  const isOverlapping = (
    newShift: TimeShift,
    existingShifts: TimeShift[],
  ): boolean => {
    if (!newShift || !newShift.timeIn || !newShift.timeOut) return false;
    const [newStart, newEnd] = getShiftRange(newShift);
    return existingShifts.filter(Boolean).some((s) => {
      if (!s || !s.timeIn || !s.timeOut) return false;
      const [sStart, sEnd] = getShiftRange(s);
      return newStart < sEnd && newEnd > sStart; // overlap
    });
  };

  // Utility: Get total minutes for all shifts (with type safety, handles overnight)
  const getTotalMinutes = (shifts: TimeShift[]): number =>
    shifts.filter(Boolean).reduce((sum, s) => {
      if (!s || !s.timeIn || !s.timeOut) return sum;
      const [start, end] = getShiftRange(s);
      return sum + (end - start);
    }, 0);

  const toggleWorkDateSelection = (date: string) => {
    const normalizedDate = normalizeWorkDate(date);
    setSelectedWorkDates((currentDates) => {
      const nextDates = new Set(currentDates);
      if (nextDates.has(normalizedDate)) {
        nextDates.delete(normalizedDate);
      } else {
        nextDates.add(normalizedDate);
      }
      return nextDates;
    });
  };

  const cancelMultiSelect = () => {
    setSelectedWorkDates(new Set());
    setIsMultiSelectMode(false);
  };

  const getShiftConflict = (date: string, shift: TimeShift) => {
    const dayEvents = getEventsForDate(date);
    if (
      dayEvents.some((event) => event.extendedProps?.eventType === "dayOff")
    ) {
      return "is marked as a Rest Day";
    }
    if (hasDuplicateShiftCode(date, shift.tsCode)) {
      return `already has shift ${shift.tsCode}`;
    }

    const dayShifts = dayEvents
      .map((event) => getShiftByCode(event.title))
      .filter((existingShift): existingShift is TimeShift => !!existingShift);
    if (isOverlapping(shift, dayShifts)) {
      return "has an overlapping shift";
    }
    if (getTotalMinutes([...dayShifts, shift]) > 24 * 60) {
      return "would exceed 24 total shift hours";
    }
    return null;
  };

  const handleBulkAssignShift = async () => {
    if (!selectedEmployee || selectedWorkDates.size === 0 || isBulkSaving) {
      return;
    }

    const selectedDates = Array.from(selectedWorkDates).sort();
    const shiftOptions = Object.fromEntries(
      timeShift.map((shift) => [
        shift.tsCode,
        `${shift.tsCode} (${to12HourFormat(shift.timeIn)} - ${to12HourFormat(shift.timeOut)})`,
      ]),
    );
    const { value: selectedShiftCode, isConfirmed } = await Swal.fire({
      title: `Assign one shift to ${selectedDates.length} date(s)`,
      input: "select",
      inputOptions: shiftOptions,
      inputPlaceholder: "Select a time shift",
      showCancelButton: true,
      confirmButtonText: "Assign Shift",
      inputValidator: (value) => {
        if (!value) return "Please select a time shift.";
        const shift = getShiftByCode(value);
        if (!shift) return "The selected time shift is invalid.";

        const conflicts = selectedDates
          .map((date) => {
            const reason = getShiftConflict(date, shift);
            return reason ? `${date} ${reason}` : null;
          })
          .filter((conflict): conflict is string => !!conflict);
        if (conflicts.length > 0) {
          const preview = conflicts.slice(0, 3).join("; ");
          const remaining = conflicts.length - 3;
          return `${preview}${remaining > 0 ? `; and ${remaining} more` : ""}. Deselect conflicting dates first.`;
        }
        return null;
      },
      allowOutsideClick: false,
      returnFocus: false,
    });

    if (!isConfirmed || !selectedShiftCode) return;

    const shift = getShiftByCode(selectedShiftCode);
    if (!shift) return;

    setIsBulkSaving(true);
    try {
      const results = await Promise.allSettled(
        selectedDates.map(async (workDate) => {
          const res = await fetchWithAuth(
            `${API_BASE_URL_TIMEKEEPING}/api/create/work-schedule`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                employeeId: selectedEmployee.employeeId,
                tsCode: shift.tsCode,
                wsDateTime: buildWsDateTime(workDate, shift.tsCode),
              }),
            },
          );
          if (!res.ok) {
            throw new Error(`Failed to save ${workDate}: ${res.status}`);
          }
          return workDate;
        }),
      );

      const failedDates = results.flatMap((result, index) =>
        result.status === "rejected" ? [selectedDates[index]] : [],
      );
      const savedCount = selectedDates.length - failedDates.length;

      await fetchAllWorkSchedule(
        selectedEmployee.employeeId,
        currentCalendarDate.getFullYear(),
        currentCalendarDate.getMonth() + 1,
      );

      if (failedDates.length === 0) {
        cancelMultiSelect();
        await Swal.fire({
          title: "Done!",
          text: `${shift.tsCode} was assigned to ${savedCount} date(s).`,
          icon: "success",
          returnFocus: false,
        });
      } else {
        setSelectedWorkDates(new Set(failedDates));
        await Swal.fire({
          title: "Partially saved",
          text: `${savedCount} date(s) were saved, but ${failedDates.length} failed. The failed dates remain selected so you can retry.`,
          icon: "warning",
          returnFocus: false,
        });
      }
    } finally {
      setIsBulkSaving(false);
    }
  };

  // Assign/Create Work Schedule (multiple shifts per day, no overlap, max 24h)
  const handleDateClick = async (arg: DateClickArg) => {
    if (!selectedEmployee) {
      Swal.fire({
        title: "Warning",
        text: "Please select an employee first.",
        icon: "warning",
        returnFocus: false,
      });
      return;
    }

    if (isMultiSelectMode) {
      toggleWorkDateSelection(arg.dateStr);
      return;
    }

    const dayEvents = getEventsForDate(arg.dateStr);

    const choice = await Swal.fire({
      title: `Assign for ${arg.dateStr}`,
      text: "What would you like to assign for this date?",
      showCancelButton: true,
      confirmButtonText: "Assign Shift",
      denyButtonText: "Mark as Day Off",
      showDenyButton: true,
      returnFocus: false,
    });

    if (choice.isDismissed) return;

    if (choice.isDenied) {
      // --- Day Off path ---
      if (dayEvents.length > 0) {
        await Swal.fire({
          title: "Warning",
          text: "This date already has entries. Remove them first before marking as Day Off.",
          icon: "warning",
          returnFocus: false,
        });
        return;
      }
      const wsDateTime = format(
        parseISO(`${arg.dateStr}T00:00:00`),
        "MM-dd-yyyy HH:mm:ss",
      );
      try {
        const res = await fetchWithAuth(
          `${API_BASE_URL_TIMEKEEPING}/api/create/work-schedule`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              employeeId: selectedEmployee.employeeId,
              wsDateTime,
              isDayOff: true,
            }),
          },
        );
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const metadata = await res.json();
        setWorkScheduleEvents((prev) => [
          ...prev,
          {
            wsId: metadata.metaId,
            title: "Day Off",
            date: arg.dateStr,
            classNames: ["day-off-event"],
            extendedProps: { eventType: "dayOff" as const, isDayOff: true },
          },
        ]);
        Swal.fire({
          title: "Done!",
          text: "Rest day saved.",
          icon: "success",
          returnFocus: false,
        });
      } catch (err) {
        console.error("Error saving day off:", err);
        Swal.fire({
          title: "Error",
          text: "Failed to save rest day. Please try again.",
          icon: "error",
          returnFocus: false,
        });
      }
      return;
    }

    // --- Shift assignment path (isConfirmed) ---
    const hasDayOffEvent = dayEvents.some(
      (e) => e.extendedProps?.eventType === "dayOff",
    );
    if (hasDayOffEvent) {
      await Swal.fire({
        title: "Warning",
        text: "This date is marked as a Rest Day. Remove the Day Off entry first.",
        icon: "warning",
        returnFocus: false,
      });
      return;
    }

    // Only include valid shift objects
    const dayShifts = dayEvents
      .map((e) => getShiftByCode(e.title))
      .filter((s): s is TimeShift => !!s);

    const { value: tsCode } = await Swal.fire({
      title: `Enter shift code for ${arg.dateStr}`,
      input: "text",
      inputLabel: "Time Shift Code",
      inputPlaceholder: "e.g. 1Q",
      inputAttributes: {
        list: "shift-list",
      },
      showCancelButton: true,
      confirmButtonText: "Assign",
      inputValidator: (value) => {
        if (!value) return "You need to enter a shift code!";
        const shift = getShiftByCode(value);
        if (!shift) return "Invalid shift code. Please select from the list.";
        // Duplicate check
        if (hasDuplicateShiftCode(arg.dateStr, value)) {
          return "This shift code is already assigned for this day.";
        }
        // Overlap check (robust)
        if (isOverlapping(shift, dayShifts))
          return "Shift overlaps with existing shift.";
        // 24h check (robust)
        const total = getTotalMinutes([...dayShifts, shift]);
        if (total > 24 * 60) return "Total shift hours exceed 24 hours.";
        return null;
      },
      allowOutsideClick: true,
      returnFocus: false,
    });

    if (tsCode) {
      const shift = getShiftByCode(tsCode);
      if (!shift) {
        return;
      }

      // Save to backend
      const success = await saveOrUpdateWorkSchedule(
        selectedEmployee.employeeId,
        shift.tsCode,
        arg.dateStr,
      );
      if (success) {
        setWorkScheduleEvents((prev) => [
          ...prev,
          {
            wsId: success.metaId,
            title: shift.tsCode,
            date: arg.dateStr,
            classNames: ["work-schedule-event"],
            extendedProps: { eventType: "workSchedule" as const },
          },
        ]);
      }
    }
  };

  //Update/Delete Work Schedule
  const handleEventClick = async (clickInfo: EventClickArg) => {
    if (isMultiSelectMode) {
      if (clickInfo.event.startStr) {
        toggleWorkDateSelection(clickInfo.event.startStr);
      }
      return;
    }

    const eventType = (clickInfo.event.extendedProps?.eventType || "") as
      | "holiday"
      | "workSchedule"
      | "dayOff"
      | "";

    if (eventType === "dayOff") {
      if (!selectedEmployee) return;
      const wsId = (clickInfo.event.extendedProps as ShiftEvent).wsId;
      const wsDateTime = clickInfo.event.startStr;
      const result = await Swal.fire({
        title: `Rest Day — ${wsDateTime}`,
        html: `<p><strong>${selectedEmployee.fullName}</strong></p><p style="color:#555;margin-top:0.4rem">This date is marked as a Rest Day.</p>`,
        icon: "info",
        showDenyButton: true,
        showCancelButton: false,
        confirmButtonText: "Close",
        denyButtonText: "Remove Day Off",
        returnFocus: false,
      });
      if (result.isDenied) {
        const success = await deleteWorkSchedule(wsId);
        if (success) {
          setWorkScheduleEvents((prev) => prev.filter((e) => e.wsId !== wsId));
          Swal.fire({
            title: "Removed!",
            text: "Rest day removed from schedule.",
            icon: "success",
            returnFocus: false,
          });
        }
      }
      return;
    }

    if (eventType === "holiday") {
      const sourceDate = clickInfo.event.extendedProps?.sourceDate;
      const holidayType = (clickInfo.event.extendedProps?.holidayType ||
        "") as string;
      const withPay = clickInfo.event.extendedProps?.withPay ? "Yes" : "No";
      const workingHoliday = clickInfo.event.extendedProps?.isWorkingHoliday
        ? "Yes"
        : "No";

      Swal.fire({
        title: clickInfo.event.title,
        html: `
          <div style="text-align:left;line-height:1.6;">
            <div><strong>Type:</strong> ${holidayType.replaceAll("_", " ")}</div>
            <div><strong>Applied Date:</strong> ${clickInfo.event.startStr}</div>
            <div><strong>Source:</strong> ${sourceDate === "observedDate" ? "Observed Date" : "Holiday Date"}</div>
            <div><strong>With Pay:</strong> ${withPay}</div>
            <div><strong>Working Holiday:</strong> ${workingHoliday}</div>
          </div>
        `,
        icon: "info",
        confirmButtonText: "OK",
        returnFocus: false,
      });
      return;
    }

    if (!selectedEmployee) {
      Swal.fire({
        title: "Warning",
        text: "Please select an employee first.",
        icon: "warning",
        returnFocus: false,
      });
      return;
    }

    // ✅ Safely read wsId since we added it to event.extendedProps
    const wsId = (clickInfo.event.extendedProps as ShiftEvent).wsId;
    const oldCode = clickInfo.event.title;
    const wsDateTime = clickInfo.event.startStr;
    const dayEvents = getEventsForDate(wsDateTime, wsId);
    const dayShifts = dayEvents
      .map((event) => getShiftByCode(event.title))
      .filter((shift): shift is TimeShift => !!shift);

    const result = await Swal.fire({
      title: `Update shift code for ${wsDateTime}`,
      input: "text",
      inputValue: oldCode,
      inputAttributes: {
        list: "shift-list",
      },
      showCancelButton: true,
      showDenyButton: canDelete ? true : false,
      confirmButtonText: "Update",
      denyButtonText: "Delete",
      cancelButtonText: "Cancel",
      inputValidator: (value) => {
        if (Swal.getConfirmButton()?.getAttribute("aria-disabled") === "true")
          return null;
        if (!value) return "You need to enter a shift code!";
        const shift = getShiftByCode(value);
        if (!shift) return "Invalid shift code. Please select from the list.";
        if (hasDuplicateShiftCode(wsDateTime, value, wsId)) {
          return "This shift code is already assigned for this day.";
        }
        if (isOverlapping(shift, dayShifts)) {
          return "Shift overlaps with existing shift.";
        }
        const total = getTotalMinutes([...dayShifts, shift]);
        if (total > 24 * 60) return "Total shift hours exceed 24 hours.";
        return null;
      },
      allowOutsideClick: true,
      returnFocus: false, // ✅ stops jumping to top
    });

    if (result.isConfirmed && result.value) {
      const shift = getShiftByCode(result.value);
      if (!shift) {
        return;
      }

      if (normalizeShiftCode(oldCode) === normalizeShiftCode(shift.tsCode)) {
        return;
      }
      const success = await saveOrUpdateWorkSchedule(
        selectedEmployee.employeeId,
        shift.tsCode,
        wsDateTime,
        wsId,
      );
      if (success) {
        // Re-fetch all work schedules for the current employee and month
        const dateObj = new Date(wsDateTime);
        fetchAllWorkSchedule(
          selectedEmployee.employeeId,
          dateObj.getFullYear(),
          dateObj.getMonth() + 1,
        );
      }
    } else if (result.isDenied) {
      const success = await deleteWorkSchedule(wsId);
      if (success) {
        setWorkScheduleEvents((prev) =>
          prev.filter((event) => event.wsId !== wsId),
        );
        Swal.fire({
          title: "Deleted!",
          text: "Shift removed from schedule.",
          icon: "success",
          returnFocus: false, // ✅ prevents scroll jump
        });
      }
    }
  };

  const handleAutoFillDayOff = async () => {
    if (!selectedEmployee) {
      Swal.fire({
        title: "Warning",
        text: "Please select an employee first.",
        icon: "warning",
        returnFocus: false,
      });
      return;
    }

    const defaultMonth = `${currentCalendarDate.getFullYear()}-${String(currentCalendarDate.getMonth() + 1).padStart(2, "0")}`;

    const { value: formValues, isConfirmed } = await Swal.fire({
      title: "Auto-fill Rest Days",
      html: `
        <p style="margin-bottom:0.75rem">Employee: <strong>${selectedEmployee.fullName}</strong></p>
        <p style="font-size:0.88rem;color:#555;margin-bottom:0.5rem">Select which weekdays are rest days:</p>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.4rem 1rem;margin:0.5rem 0 1rem;text-align:left">
          <label><input type="checkbox" id="af-sun" checked /> Sun</label>
          <label><input type="checkbox" id="af-mon" /> Mon</label>
          <label><input type="checkbox" id="af-tue" /> Tue</label>
          <label><input type="checkbox" id="af-wed" /> Wed</label>
          <label><input type="checkbox" id="af-thu" /> Thu</label>
          <label><input type="checkbox" id="af-fri" /> Fri</label>
          <label><input type="checkbox" id="af-sat" checked /> Sat</label>
        </div>
        <div>
          <label style="font-size:0.9rem">Month:&nbsp;<input type="month" id="af-month" value="${defaultMonth}" style="padding:0.25rem 0.5rem;border:1px solid #ccc;border-radius:4px" /></label>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Preview & Apply",
      preConfirm: () => {
        const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
        const days: number[] = dayNames
          .map((d, i) => ({ d, i }))
          .filter(
            ({ d }) =>
              (document.getElementById(`af-${d}`) as HTMLInputElement)?.checked,
          )
          .map(({ i }) => i);
        const monthInput = document.getElementById(
          "af-month",
        ) as HTMLInputElement;
        if (!monthInput?.value) {
          Swal.showValidationMessage("Please select a month.");
          return false;
        }
        if (days.length === 0) {
          Swal.showValidationMessage("Please select at least one rest day.");
          return false;
        }
        return { days, month: monthInput.value };
      },
      allowOutsideClick: false,
      returnFocus: false,
    });

    if (!isConfirmed || !formValues) return;

    const { days, month } = formValues as { days: number[]; month: string };
    const [yearStr, monthStr] = month.split("-");
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);

    // Generate all dates in the month that fall on selected weekdays
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const generatedDates: string[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, monthNum - 1, day);
      if (days.includes(date.getDay())) {
        const mm = String(monthNum).padStart(2, "0");
        const dd = String(day).padStart(2, "0");
        generatedDates.push(`${mm}-${dd}-${year} 00:00:00`);
      }
    }

    // Filter out dates that already have any WorkSchedule entry
    const existingDates = new Set(workScheduleEvents.map((e) => e.date));
    const filteredDates = generatedDates.filter(
      (d) => !existingDates.has(toDateInputValue(d)),
    );

    if (filteredDates.length === 0) {
      Swal.fire({
        title: "Info",
        text: "All matching dates already have entries. Nothing to add.",
        icon: "info",
        returnFocus: false,
      });
      return;
    }

    const confirm = await Swal.fire({
      title: "Confirm Auto-fill",
      text: `Add ${filteredDates.length} rest day(s) for ${selectedEmployee.fullName} in ${month}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, apply",
      returnFocus: false,
    });
    if (!confirm.isConfirmed) return;

    const payload = filteredDates.map((d) => ({
      employeeId: selectedEmployee.employeeId,
      wsDateTime: d,
      isDayOff: true,
    }));

    try {
      const res = await fetchWithAuth(
        `${API_BASE_URL_TIMEKEEPING}/api/bulk/day-off/work-schedule`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const autoFillResult = await res.json();
      await Swal.fire({
        title: "Done!",
        text: `${autoFillResult.metaId} rest day(s) added to the schedule.`,
        icon: "success",
        returnFocus: false,
      });
      // Use year/monthNum from formValues directly — currentCalendarDate can
      // lag or point to the wrong month depending on how datesSet fired.
      fetchAllWorkSchedule(selectedEmployee.employeeId, year, monthNum);
    } catch (err) {
      console.error("Error auto-filling rest days:", err);
      Swal.fire({
        title: "Error",
        text: "Failed to save rest days. Please try again.",
        icon: "error",
        returnFocus: false,
      });
    }
  };

  const handleGenerateWorkScheduleReport = async () => {
    if (reportAreaId === "") {
      await Swal.fire({
        icon: "warning",
        title: "Missing Area",
        text: "Please select an area first.",
      });
      return;
    }
    if (!reportFromDate || !reportToDate) {
      await Swal.fire({
        icon: "warning",
        title: "Missing Date Range",
        text: "Please select Date From and Date To.",
      });
      return;
    }
    if (new Date(reportFromDate) > new Date(reportToDate)) {
      await Swal.fire({
        icon: "warning",
        title: "Invalid Date Range",
        text: "Date From cannot be after Date To.",
      });
      return;
    }

    setIsGeneratingReport(true);
    try {
      const params = new URLSearchParams({
        areaId: String(reportAreaId),
        fromDate: reportFromDate,
        toDate: reportToDate,
        preparedBy: (
          reportPreparedByEmployee?.fullName ?? reportPreparedBy
        ).trim(),
        preparedByPos: reportPreparedByPos.trim(),
        approvedBy: (
          reportApprovedByEmployee?.fullName ?? reportApprovedBy
        ).trim(),
        approvedByPos: reportApprovedByPos.trim(),
      });
      if (reportBusinessUnitId !== "") {
        params.set("businessUnitId", String(reportBusinessUnitId));
      }

      const response = await fetchWithAuth(
        `${API_BASE_URL_TIMEKEEPING}/api/work-schedule/report?${params.toString()}`,
      );
      if (!response.ok) {
        throw new Error(
          `Failed to generate Work Schedule report (${response.status})`,
        );
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `WorkSchedule_${reportFromDate}_${reportToDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: "Report Failed",
        text: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <div id="workScheduleModal" className={modalStyles.Modal}>
      <div className={modalStyles.modalContent}>
        <div className={modalStyles.modalHeader}>
          <h2 className={modalStyles.mainTitle}>Work Schedule</h2>
        </div>
        <div className={modalStyles.modalBody}>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              marginBottom: "1rem",
              borderBottom: "1px solid #dbe3ef",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab("calendar")}
              style={{
                padding: "0.65rem 1rem",
                border: "none",
                borderBottom:
                  activeTab === "calendar"
                    ? "3px solid #2563eb"
                    : "3px solid transparent",
                background: "transparent",
                color: activeTab === "calendar" ? "#1d4ed8" : "#475569",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Work Schedule
            </button>
            {canAdd && canEdit ? (
              <button
                type="button"
                onClick={() => setActiveTab("report")}
                style={{
                  padding: "0.65rem 1rem",
                  border: "none",
                  borderBottom:
                    activeTab === "report"
                      ? "3px solid #2563eb"
                      : "3px solid transparent",
                  background: "transparent",
                  color: activeTab === "report" ? "#1d4ed8" : "#475569",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Report
              </button>
            ) : (
              ""
            )}
          </div>

          {activeTab === "calendar" ? (
            <div className={styles.WorkSchedule}>
              {/* ✅ Employee Name field */}
              <div className={styles.formGroup}>
                <label htmlFor="employee">Employee Name&nbsp;</label>
                <input
                  id="employee"
                  type="text"
                  list={"employee-list"}
                  placeholder="Employee No / Last Name"
                  value={employeeInputValue}
                  readOnly={
                    (!canAdd && !canEdit) ||
                    (canAdd && !canEdit) ||
                    (!canAdd && canEdit)
                  }
                  onChange={(e) => {
                    if (
                      (!canAdd && !canEdit) ||
                      (canAdd && !canEdit) ||
                      (!canAdd && canEdit)
                    )
                      return;
                    setEmployeeInputValue(e.target.value);
                    const match = employees.find(
                      (emp) =>
                        `[${emp.employeeNo}] ${emp.fullName}`.toLowerCase() ===
                        e.target.value.toLowerCase(),
                    );
                    if (match) {
                      setSelectedEmployee(match);
                    } else {
                      setSelectedEmployee(null);
                    }
                  }}
                  className={styles.searchInput}
                  style={{ width: "35%" }}
                />
                {
                  <datalist id="employee-list">
                    {employees.map((emp) => (
                      <option
                        key={emp.employeeNo}
                        value={`[${emp.employeeNo}] ${emp.fullName}`}
                      />
                    ))}
                  </datalist>
                }
                {
                  <datalist id="shift-list">
                    {timeShift.map((shift) => (
                      <option key={shift.tsCode} value={shift.tsCode}>
                        {to12HourFormat(shift.timeIn) + "-"}
                        {shift.breakOut != null
                          ? to12HourFormat(shift.breakOut) + "/"
                          : ""}
                        {shift.breakIn != null
                          ? to12HourFormat(shift.breakIn) + "-"
                          : ""}
                        {to12HourFormat(shift.timeOut)}
                      </option>
                    ))}
                  </datalist>
                }
              </div>
              {/* 🔻 Time Shift Legend with Tooltip */}
              <div className={styles.legend}>
                <h3>Legend</h3>
                <div className={styles.legendGrid}>
                  {timeShift.map((shift) => (
                    <div key={shift.tsCode} className={styles.legendItem}>
                      <span
                        title={shift.tsName || ""}
                        style={{
                          cursor: "help",
                          borderBottom: "1px dotted #888",
                          padding: "2px 4px",
                          borderRadius: "3px",
                          background: "#f9f9f9",
                          fontWeight: "bold",
                        }}
                      >
                        {shift.tsCode}
                      </span>
                      {" – "}
                      {to12HourFormat(shift.timeIn) + "-"}
                      {shift.breakOut != null
                        ? to12HourFormat(shift.breakOut) + "/"
                        : ""}
                      {shift.breakIn != null
                        ? to12HourFormat(shift.breakIn) + "-"
                        : ""}
                      {to12HourFormat(shift.timeOut)}
                    </div>
                  ))}
                </div>
                <div className={styles.holidayLegendRow}>
                  <div className={styles.holidayLegendItem}>
                    <span
                      className={`${styles.holidayLegendSwatch} ${styles.holidayRegular}`}
                      aria-hidden="true"
                    />
                    <span>Regular Holiday</span>
                  </div>
                  <div className={styles.holidayLegendItem}>
                    <span
                      className={`${styles.holidayLegendSwatch} ${styles.holidaySpecial}`}
                      aria-hidden="true"
                    />
                    <span>Special Holiday</span>
                  </div>
                  <div className={styles.holidayLegendItem}>
                    <span
                      className={`${styles.holidayLegendSwatch} ${styles.holidayWorking}`}
                      aria-hidden="true"
                    />
                    <span>Working Holiday</span>
                  </div>
                  <div className={styles.holidayLegendItem}>
                    <span
                      className={`${styles.holidayLegendSwatch} ${styles.dayOffSwatch}`}
                      aria-hidden="true"
                    />
                    <span>Day Off / Rest Day</span>
                  </div>
                </div>
              </div>
              {canAdd && (
                <div className={styles.scheduleActions}>
                  {canEdit && !isMultiSelectMode ? (
                    <button
                      type="button"
                      className={styles.bulkAssignButton}
                      onClick={() => setIsMultiSelectMode(true)}
                      disabled={!selectedEmployee}
                      title={
                        selectedEmployee
                          ? "Select several calendar dates and assign one shift"
                          : "Select an employee first"
                      }
                    >
                      Select Multiple Dates
                    </button>
                  ) : canEdit ? (
                    <>
                      <span className={styles.selectionHint}>
                        Click date boxes to select them ({selectedWorkDates.size}{" "}
                        selected)
                      </span>
                      <button
                        type="button"
                        className={styles.bulkAssignButton}
                        onClick={() => void handleBulkAssignShift()}
                        disabled={selectedWorkDates.size === 0 || isBulkSaving}
                      >
                        {isBulkSaving
                          ? "Saving..."
                          : `Assign Shift (${selectedWorkDates.size})`}
                      </button>
                      <button
                        type="button"
                        className={styles.cancelSelectionButton}
                        onClick={cancelMultiSelect}
                        disabled={isBulkSaving}
                      >
                        Cancel
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className={styles.autoFillButton}
                    onClick={handleAutoFillDayOff}
                    title="Bulk-add rest days for a selected month"
                    disabled={isMultiSelectMode || isBulkSaving}
                  >
                    Auto-fill Rest Days
                  </button>
                </div>
              )}
              <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "",
                }}
                events={[...workScheduleEvents, ...holidayEvents]}
                dateClick={canAdd && canEdit ? handleDateClick : undefined}
                eventClick={canAdd && canEdit ? handleEventClick : undefined} // ✅ Add this line
                editable={false}
                selectable={true}
                height="auto"
                dayCellClassNames={(arg) =>
                  selectedWorkDates.has(format(arg.date, "yyyy-MM-dd"))
                    ? [styles.selectedDate]
                    : []
                }
                eventContent={(arg) => {
                  const eventType = arg.event.extendedProps?.eventType as
                    | "holiday"
                    | "workSchedule"
                    | "dayOff"
                    | undefined;

                  if (eventType === "holiday") {
                    return (
                      <div>
                        <strong>Holiday</strong>
                        <div style={{ fontSize: "0.78em", lineHeight: "1.2" }}>
                          {arg.event.title}
                        </div>
                      </div>
                    );
                  }

                  if (eventType === "dayOff") {
                    return (
                      <div>
                        <strong>Day Off</strong>
                      </div>
                    );
                  }

                  const shift = timeShift.find(
                    (s) => s.tsCode === arg.event.title,
                  );
                  return (
                    <div>
                      <strong>{arg.event.title}</strong>
                      {shift && (
                        <div style={{ fontSize: "0.75em", lineHeight: "1.2" }}>
                          <div>
                            {to12HourFormat(shift.timeIn) + "-"}
                            {shift.breakOut != null
                              ? to12HourFormat(shift.breakOut)
                              : ""}
                          </div>
                          <div>
                            {shift.breakIn != null
                              ? to12HourFormat(shift.breakIn) + "-"
                              : ""}
                            {to12HourFormat(shift.timeOut)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }}
                datesSet={(arg) => {
                  if (selectedEmployee) {
                    // Use the midpoint of the visible range to reliably get
                    // the displayed month (arg.start can be in the previous month
                    // when the month doesn't start on Sunday, but equals the
                    // 1st of the displayed month when it does — midpoint is always
                    // inside the correct month).
                    const midDate = new Date(
                      (arg.start.getTime() + arg.end.getTime()) / 2,
                    );
                    const year = midDate.getFullYear();
                    const month = midDate.getMonth() + 1;
                    setSelectedWorkDates(new Set());
                    setCurrentCalendarDate(new Date(year, month - 1, 1));
                    fetchAllWorkSchedule(
                      selectedEmployee.employeeId,
                      year,
                      month,
                    );
                  }
                }}
              />
            </div>
          ) : (
            <div className={styles.WorkSchedule}>
              <div style={{ maxWidth: 720, display: "grid", gap: "1rem" }}>
                <div
                  style={{
                    padding: "1rem",
                    border: "1px solid #dbe3ef",
                    borderRadius: "0.75rem",
                    background: "#f8fafc",
                  }}
                >
                  <h3
                    style={{
                      marginTop: 0,
                      marginBottom: "0.75rem",
                      color: "#1e3a8a",
                    }}
                  >
                    Work Schedule Report
                  </h3>
                  <p style={{ marginTop: 0, color: "#64748b" }}>
                    Generate work schedule report by Area, Business Unit, and
                    date range.
                  </p>

                  <datalist id="report-employee-list">
                    {employees.map((employee) => (
                      <option
                        key={employee.employeeNo}
                        value={toEmployeeOption(employee)}
                      />
                    ))}
                  </datalist>

                  <div style={{ display: "grid", gap: "0.75rem" }}>
                    <div className={styles.formGroup}>
                      <label>Area</label>
                      <select
                        value={reportAreaId}
                        onChange={(e) => {
                          setReportAreaId(
                            e.target.value ? Number(e.target.value) : "",
                          );
                          setReportBusinessUnitId("");
                        }}
                        className={styles.searchInput}
                        style={{ width: "100%" }}
                      >
                        <option value="">Select Area</option>
                        {areas.map((area) => (
                          <option key={area.areasId} value={area.areasId}>
                            {area.areasName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label>Business Unit</label>
                      <select
                        value={reportBusinessUnitId}
                        onChange={(e) =>
                          setReportBusinessUnitId(
                            e.target.value ? Number(e.target.value) : "",
                          )
                        }
                        disabled={reportAreaId === ""}
                        className={styles.searchInput}
                        style={{ width: "100%" }}
                      >
                        <option value="">All Business Units</option>
                        {filteredReportBusinessUnits.map((unit) => (
                          <option
                            key={unit.businessUnitsId}
                            value={unit.businessUnitsId}
                          >
                            {unit.businessUnitsName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "0.75rem",
                      }}
                    >
                      <div className={styles.formGroup}>
                        <label>Date From</label>
                        <input
                          type="date"
                          value={reportFromDate}
                          onChange={(e) => {
                            const newDateFrom = e.target.value;

                            setReportFromDate(newDateFrom);

                            // Clear Date To if it is earlier than the new Date From
                            if (reportToDate && reportToDate < newDateFrom) {
                              setReportToDate("");
                            }
                          }}
                          className={styles.searchInput}
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label>Date To</label>
                        <input
                          type="date"
                          value={reportToDate}
                          min={reportFromDate || undefined}
                          onChange={(e) => {
                            const newDateTo = e.target.value;

                            // Prevent Date To from being earlier than Date From
                            if (reportFromDate && newDateTo < reportFromDate) {
                              return;
                            }

                            setReportToDate(newDateTo);
                          }}
                          className={styles.searchInput}
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "0.75rem",
                      }}
                    >
                      <div className={styles.formGroup}>
                        <label>Prepared By</label>
                        <input
                          type="text"
                          list="report-employee-list"
                          value={reportPreparedBy}
                          onChange={(e) => {
                            void handlePreparedByChange(e.target.value);
                          }}
                          placeholder="Employee No / Last Name"
                          className={styles.searchInput}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label>Approved By</label>
                        <input
                          type="text"
                          list="report-employee-list"
                          value={reportApprovedBy}
                          onChange={(e) => {
                            void handleApprovedByChange(e.target.value);
                          }}
                          placeholder="Employee No / Last Name"
                          className={styles.searchInput}
                        />
                      </div>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={handleGenerateWorkScheduleReport}
                        disabled={isGeneratingReport}
                        className={styles.autoFillButton}
                      >
                        {isGeneratingReport
                          ? "Generating..."
                          : "Generate Report"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
