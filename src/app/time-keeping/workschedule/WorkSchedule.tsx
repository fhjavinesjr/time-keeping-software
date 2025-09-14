"use client";

import { useEffect, useState } from "react";
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
  toCustomFormat,
  getFirstDateOfMonth,
  getLastDateOfMonth,
} from "@/lib/utils/dateFormatUtils";
const API_BASE_URL_ADMINISTRATIVE =
  process.env.NEXT_PUBLIC_API_BASE_URL_ADMINISTRATIVE;
const API_BASE_URL_TIMEKEEPING =
  process.env.NEXT_PUBLIC_API_BASE_URL_TIMEKEEPING;
import to12HourFormat from "@/lib/utils/convert24To12HrFormat";
import { WorkScheduleDTO } from "@/lib/types/WorkScheduleDTO";

type ShiftEvent = {
  wsId: number;
  title: string;
  date: string;
};

type TimeShift = {
  tsCode: string;
  timeIn: string;
  breakOut: string;
  breakIn: string;
  timeOut: string;
};

export default function WorkSchedule() {
  const [events, setEvents] = useState<ShiftEvent[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [userRole, setUserRole] = useState<string | null>(null);
  const [employeeInputValue, setEmployeeInputValue] = useState<string>("");
  const [timeShift, setTimeShift] = useState<TimeShift[]>([]);

  // On mount: load role and employee list
  useEffect(() => {
    const role = localStorageUtil.getEmployeeRole();
    const employeeNo = localStorageUtil.getEmployeeNo();

    setUserRole(role);

    const storedEmployees = localStorageUtil.getEmployees();
    setEmployees(storedEmployees);

    const emp = storedEmployees.find((e) => e.employeeNo === employeeNo);
    if (emp) {
      setSelectedEmployee(emp);
      setEmployeeInputValue(`[${emp.employeeNo}] ${emp.fullName}`);
    }

    fetchTimeShifts();

    const today = new Date();
    fetchAllWorkSchedule(employeeNo, today.getFullYear(), today.getMonth() + 1);
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      const today = new Date();
      fetchAllWorkSchedule(
        selectedEmployee.employeeNo,
        today.getFullYear(),
        today.getMonth() + 1
      );
    } else {
      setEvents([]); // clear calendar if no employee
    }
  }, [selectedEmployee]);

  // Fetch Time Shifts (page load)
  const fetchTimeShifts = async () => {
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
  };

  // Fetch All Work Schedule by Selected employee (page load)
  const fetchAllWorkSchedule = async (
    employeeNo: string | null,
    year: number,
    month: number
  ) => {
    try {
      // build start & end dates for the month
      const monthStart = getFirstDateOfMonth(month, year);
      const monthEnd = getLastDateOfMonth(month, year);

      const res = await fetchWithAuth(
        `${API_BASE_URL_TIMEKEEPING}/api/getListByEmployeeAndDateRange/work-schedule?employeeNo=${employeeNo}&monthStart=${monthStart}&monthEnd=${monthEnd}`
      );

      if (res.status === 204) {
        console.log("No work schedule found for this employee/month");
        setEvents([]); // clear calendar
        return;
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch work schedule: ${res.status}`);
      }

      const data = await res.json();

      // map backend DTOs to FullCalendar events
      const mappedEvents: ShiftEvent[] = data.map((ws: WorkScheduleDTO) => ({
        wsId: ws.wsId,
        title: ws.tsCode,
        date: toDateInputValue(ws.wsDateTime),
      }));

      setEvents(mappedEvents);
      console.log("Successfully fetched work schedule", mappedEvents);
    } catch (error) {
      console.error("Error fetching work schedule:", error);
    }
  };

  const saveOrUpdateWorkSchedule = async (
    employeeNo: string,
    tsCode: string | null,
    wsDateTime: string,
    wsId?: number // optional
  ) => {
    try {
      wsDateTime = toCustomFormat(wsDateTime, true);

      const url = wsId
        ? `${API_BASE_URL_TIMEKEEPING}/api/update/work-schedule/${wsId}` // ✅ update
        : `${API_BASE_URL_TIMEKEEPING}/api/create/work-schedule`; // ✅ create

      const method = wsId ? "PUT" : "POST";

      const res = await fetchWithAuth(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeNo, tsCode, wsDateTime }),
      });

      if (!res.ok) {
        throw new Error(`Failed to save work schedule: ${res.status}`);
      }

      const metadata = await res.json();
      wsId = wsId ? (metadata.metaId = wsId) : metadata.metaId;

      console.log("Work schedule saved/updated:", {
        wsId,
        employeeNo,
        tsCode,
        wsDateTime,
      });

      return metadata;
    } catch (err) {
      console.error("Error saving work schedule:", err);
      Swal.fire(
        "Error",
        "Failed to save work schedule. Please try again.",
        "error"
      );
      return false;
    }
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
      Swal.fire(
        "Error",
        "Failed to save work schedule. Please try again.",
        "error"
      );
      return false;
    }
  };

  //Assign/Create Work Schedule
  const handleDateClick = async (arg: DateClickArg) => {
    if (!selectedEmployee) {
      Swal.fire("Warning", "Please select an employee first.", "warning");
      return;
    }

    // 🔒 Prevent assigning if the day already has a shift
    const alreadyAssigned = events.some((event) => event.date === arg.dateStr);
    if (alreadyAssigned) {
      return;
    }

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
        const valid = timeShift.some((shift) => shift.tsCode === value);
        if (!valid) return "Invalid shift code. Please select from the list.";
        return null;
      },
      allowOutsideClick: true, // let user click outside to close
      returnFocus: false, // ✅ don't refocus input after close
    });

    if (tsCode) {
      // Save to backend
      const success = await saveOrUpdateWorkSchedule(
        selectedEmployee.employeeNo,
        tsCode,
        arg.dateStr
      );
      if (success) {
        setEvents((prev) => [
          ...prev.filter((event) => event.date !== arg.dateStr),
          { wsId: success.metaId, title: tsCode, date: arg.dateStr },
        ]);
      }
    }
  };

  //Update/Delete Work Schedule
  const handleEventClick = async (clickInfo: EventClickArg) => {
    if (!selectedEmployee) {
      Swal.fire("Warning", "Please select an employee first.", "warning");
      return;
    }

    // ✅ Safely read wsId since we added it to event.extendedProps
    const wsId = (clickInfo.event.extendedProps as ShiftEvent).wsId;
    const oldCode = clickInfo.event.title;
    const wsDateTime = clickInfo.event.startStr;

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
        const valid = timeShift.some((shift) => shift.tsCode === value);
        if (!valid) return "Invalid shift code. Please select from the list.";
        return null;
      },
      allowOutsideClick: true,
      returnFocus: false, // ✅ stops jumping to top
    });

    if (result.isConfirmed && result.value) {
      if (oldCode === result.value) {
        return;
      }
      const success = await saveOrUpdateWorkSchedule(
        selectedEmployee.employeeNo,
        result.value,
        wsDateTime,
        wsId
      );
      if (success) {
        setEvents((prev) => [
          ...prev.filter((event) => event.date !== wsDateTime),
          { wsId: wsId, title: result.value, date: wsDateTime },
        ]);
      }
    } else if (result.isDenied) {
      const success = await deleteWorkSchedule(wsId);
      if (success) {
        setEvents((prev) => prev.filter((event) => event.date !== wsDateTime));
        Swal.fire({
          title: "Deleted!",
          text: "Shift removed from schedule.",
          icon: "success",
          returnFocus: false, // ✅ prevents scroll jump
        });
      }
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
              {userRole === "ROLE_ADMIN" ? (
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
            {/* 🔻 Time Shift Legend */}
            <div className={styles.legend}>
              <h3>Legend</h3>
              <div className={styles.legendGrid}>
                {timeShift.map((shift) => (
                  <div key={shift.tsCode} className={styles.legendItem}>
                    <strong>{shift.tsCode}</strong> –{" "}
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
            </div>
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "",
              }}
              events={events}
              dateClick={userRole === "ROLE_ADMIN" ? handleDateClick : undefined}
              eventClick={userRole === "ROLE_ADMIN" ? handleEventClick : undefined} // ✅ Add this line
              editable={false}
              selectable={true}
              height="auto"
              eventContent={(arg) => {
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
                  const year = arg.start.getFullYear();
                  const month = arg.start.getMonth() + 2; // 0-based
                  fetchAllWorkSchedule(
                    selectedEmployee.employeeNo,
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
