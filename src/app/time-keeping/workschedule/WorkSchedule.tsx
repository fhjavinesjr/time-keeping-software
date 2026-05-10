"use client";

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
const API_BASE_URL_ADMINISTRATIVE =
  process.env.NEXT_PUBLIC_API_BASE_URL_ADMINISTRATIVE;
const API_BASE_URL_TIMEKEEPING =
  process.env.NEXT_PUBLIC_API_BASE_URL_TIMEKEEPING;
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
  const [workScheduleEvents, setWorkScheduleEvents] = useState<ShiftEvent[]>([]);
  const [holidayEvents, setHolidayEvents] = useState<HolidayEvent[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [userRole, setUserRole] = useState<string | null>(null);
  const [employeeInputValue, setEmployeeInputValue] = useState<string>("");
  const [timeShift, setTimeShift] = useState<TimeShift[]>([]);
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(new Date());

  // Fetch Time Shifts (page load)
  const fetchTimeShifts = useCallback(async () => {
    try {
      const res = await fetchWithAuth(
        `${API_BASE_URL_ADMINISTRATIVE}/api/getAll/time-shift`
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
        `${API_BASE_URL_ADMINISTRATIVE}/api/holiday/get-all`
      );

      if (!res.ok) {
        console.error("Failed to fetch holidays:", res.status);
        return;
      }

      const data: HolidayDTO[] = await res.json();
      const activeHolidays = (data || []).filter((holiday) => holiday.isActive);

      const mappedHolidayEvents: HolidayEvent[] = activeHolidays.map((holiday) => {
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
      });

      setHolidayEvents(mappedHolidayEvents);
      console.log("Successfully fetched holidays", mappedHolidayEvents);
    } catch (error) {
      console.error("Error fetching holidays:", error);
    }
  }, []);

  // Fetch All Work Schedule by Selected employee (page load)
  const fetchAllWorkSchedule = useCallback(async (
    employeeId: string | null,
    year: number,
    month: number
  ) => {
    try {
      // build start & end dates for the month
      const monthStart = getFirstDateOfMonth(month, year);
      const monthEnd = getLastDateOfMonth(month, year);

      const res = await fetchWithAuth(
        `${API_BASE_URL_TIMEKEEPING}/api/getListByEmployeeAndDateRange/work-schedule?employeeId=${employeeId}&monthStart=${monthStart}&monthEnd=${monthEnd}`
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
          eventType: ws.isDayOff ? ("dayOff" as const) : ("workSchedule" as const),
          isDayOff: ws.isDayOff ?? false,
        },
      }));

      setWorkScheduleEvents(mappedEvents);
      console.log("Successfully fetched work schedule", mappedEvents);
    } catch (error) {
      console.error("Error fetching work schedule:", error);
    }
  }, []);

  // On mount: load role and employee list
  useEffect(() => {
    const role = localStorageUtil.getEmployeeRole();
    const employeeNo = localStorageUtil.getEmployeeNo();
    const employeeId = localStorageUtil.getEmployeeId();

    setUserRole(role);

    const storedEmployees = localStorageUtil.getEmployees();
    setEmployees(storedEmployees);

    const emp = storedEmployees.find((e) => e.employeeNo === employeeNo);
    if (emp) {
      setSelectedEmployee(emp);
      setEmployeeInputValue(`[${emp.employeeNo}] ${emp.fullName}`);
    } else if (employeeNo && role !== "1") {
      // Fallback when employees list is empty: use individual localStorage keys
      const fullname = localStorageUtil.getEmployeeFullname();
      if (fullname) {
        setSelectedEmployee({ employeeId: employeeId ?? "", employeeNo, fullName: fullname, role: role ?? "" } as Employee);
        setEmployeeInputValue(`[${employeeNo}] ${fullname}`);
      }
    }

    fetchTimeShifts();
    fetchHolidays();

    const today = new Date();
    fetchAllWorkSchedule(employeeId, today.getFullYear(), today.getMonth() + 1);
  }, [fetchAllWorkSchedule, fetchHolidays, fetchTimeShifts]);

  useEffect(() => {
    if (selectedEmployee) {
      const today = new Date();
      fetchAllWorkSchedule(
        selectedEmployee.employeeId,
        today.getFullYear(),
        today.getMonth() + 1
      );
    } else {
      setWorkScheduleEvents([]); // clear schedule-only events if no employee
    }
  }, [fetchAllWorkSchedule, selectedEmployee]);

  const saveOrUpdateWorkSchedule = async (
    employeeId: string,
    tsCode: string | null,
    workDate: string,
    wsId?: number // optional
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
      (event) => event.date === dateStr && event.wsId !== excludedWsId
    );

  // Utility: Get shift by code
  const getShiftByCode = (code: string) => {
    const normalizedCode = normalizeShiftCode(code);
    return timeShift.find(
      (shift) => normalizeShiftCode(shift.tsCode) === normalizedCode
    );
  };

  const hasDuplicateShiftCode = (
    dateStr: string,
    shiftCode: string,
    excludedWsId?: number
  ) => {
    const normalizedCode = normalizeShiftCode(shiftCode);

    return getEventsForDate(dateStr, excludedWsId).some(
      (event) => normalizeShiftCode(event.title) === normalizedCode
    );
  };


  // Utility: Check overlap (with type safety, handles overnight)
  const isOverlapping = (newShift: TimeShift, existingShifts: TimeShift[]): boolean => {
    if (!newShift || !newShift.timeIn || !newShift.timeOut) return false;
    const [newStart, newEnd] = getShiftRange(newShift);
    return existingShifts.filter(Boolean).some(s => {
      if (!s || !s.timeIn || !s.timeOut) return false;
      const [sStart, sEnd] = getShiftRange(s);
      return (newStart < sEnd && newEnd > sStart); // overlap
    });
  };

  // Utility: Get total minutes for all shifts (with type safety, handles overnight)
  const getTotalMinutes = (shifts: TimeShift[]): number =>
    shifts.filter(Boolean).reduce((sum, s) => {
      if (!s || !s.timeIn || !s.timeOut) return sum;
      const [start, end] = getShiftRange(s);
      return sum + (end - start);
    }, 0);

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
      const wsDateTime = format(parseISO(`${arg.dateStr}T00:00:00`), "MM-dd-yyyy HH:mm:ss");
      try {
        const res = await fetchWithAuth(`${API_BASE_URL_TIMEKEEPING}/api/create/work-schedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId: selectedEmployee.employeeId, wsDateTime, isDayOff: true }),
        });
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
        Swal.fire({ title: "Done!", text: "Rest day saved.", icon: "success", returnFocus: false });
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
    const hasDayOffEvent = dayEvents.some((e) => e.extendedProps?.eventType === "dayOff");
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
      .map(e => getShiftByCode(e.title))
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
        if (isOverlapping(shift, dayShifts)) return "Shift overlaps with existing shift.";
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
        arg.dateStr
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
          Swal.fire({ title: "Removed!", text: "Rest day removed from schedule.", icon: "success", returnFocus: false });
        }
      }
      return;
    }

    if (eventType === "holiday") {
      const sourceDate = clickInfo.event.extendedProps?.sourceDate;
      const holidayType = (clickInfo.event.extendedProps?.holidayType || "") as string;
      const withPay = clickInfo.event.extendedProps?.withPay ? "Yes" : "No";
      const workingHoliday = clickInfo.event.extendedProps?.isWorkingHoliday ? "Yes" : "No";

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
      showDenyButton: true,
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
        wsId
      );
      if (success) {
        // Re-fetch all work schedules for the current employee and month
        const dateObj = new Date(wsDateTime);
        fetchAllWorkSchedule(
          selectedEmployee.employeeId,
          dateObj.getFullYear(),
          dateObj.getMonth() + 1
        );
      }
    } else if (result.isDenied) {
      const success = await deleteWorkSchedule(wsId);
      if (success) {
        setWorkScheduleEvents((prev) =>
          prev.filter((event) => event.wsId !== wsId)
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
          <label><input type="checkbox" id="af-sun" /> Sun</label>
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
          .filter(({ d }) => (document.getElementById(`af-${d}`) as HTMLInputElement)?.checked)
          .map(({ i }) => i);
        const monthInput = document.getElementById("af-month") as HTMLInputElement;
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
      (d) => !existingDates.has(toDateInputValue(d))
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
        }
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
      fetchAllWorkSchedule(
        selectedEmployee.employeeId,
        year,
        monthNum
      );
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

  return (
    <div id="workScheduleModal" className={modalStyles.Modal}>
      <div className={modalStyles.modalContent}>
        <div className={modalStyles.modalHeader}>
          <h2 className={modalStyles.mainTitle}>Work Schedule</h2>
        </div>
        <div className={modalStyles.modalBody}>
          {/* 📅 Calendar */}
          <div className={styles.WorkSchedule}>
            {/* ✅ Employee Name field */}
            <div className={styles.formGroup}>
              <label htmlFor="employee">Employee Name&nbsp;</label>
              {userRole === "1" ? (
                <>
                  <input
                    id="employee"
                    type="text"
                    list="employee-list"
                    placeholder="Employee No / Lastname"
                    value={employeeInputValue}
                    onChange={(e) => {
                      const inputVal = e.target.value;
                      setEmployeeInputValue(inputVal);

                      const selected = employees.find(
                        (emp) =>
                          `[${emp.employeeNo}] ${emp.fullName}`.toLowerCase() ===
                          inputVal.toLowerCase()
                      );
                      setSelectedEmployee(selected || null);
                    }}
                  />

                  <datalist id="employee-list">
                    {employees.map((emp) => (
                      <option
                        key={emp.employeeNo}
                        value={`[${emp.employeeNo}] ${emp.fullName}`}
                      />
                    ))}
                  </datalist>

                  {/* Shift list for SweetAlert autocomplete */}
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
                </>
              ) : (
                <input
                  type="text"
                  readOnly
                  value={
                    selectedEmployee
                      ? `[${selectedEmployee.employeeNo}] ${selectedEmployee.fullName}`
                      : ""
                  }
                />
              )}
            </div>
            {/* 🔻 Time Shift Legend with Tooltip */}
            <div className={styles.legend}>
              <h3>Legend</h3>
              <div className={styles.legendGrid}>
                {timeShift.map((shift) => (
                  <div key={shift.tsCode} className={styles.legendItem}>
                    <span
                      title={shift.tsName || ''}
                      style={{
                        cursor: 'help',
                        borderBottom: '1px dotted #888',
                        padding: '2px 4px',
                        borderRadius: '3px',
                        background: '#f9f9f9',
                        fontWeight: 'bold',
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
            {userRole === "1" && (
              <div className={styles.autoFillContainer}>
                <button
                  className={styles.autoFillButton}
                  onClick={handleAutoFillDayOff}
                  title="Bulk-add rest days for a selected month"
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
              dateClick={userRole === "1" ? handleDateClick : undefined}
              eventClick={userRole === "1" ? handleEventClick : undefined} // ✅ Add this line
              editable={false}
              selectable={true}
              height="auto"
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
                  (s) => s.tsCode === arg.event.title
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
                    (arg.start.getTime() + arg.end.getTime()) / 2
                  );
                  const year = midDate.getFullYear();
                  const month = midDate.getMonth() + 1;
                  setCurrentCalendarDate(new Date(year, month - 1, 1));
                  fetchAllWorkSchedule(
                    selectedEmployee.employeeId,
                    year,
                    month
                  );
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
