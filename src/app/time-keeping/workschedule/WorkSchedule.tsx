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
import { fetchWithAuth } from "@/pages/api/fetchWithAuth";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL_ADMINISTRATIVE;

type ShiftEvent = {
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
  }, []);

  // Fetch Time Shifts (page load)
  const fetchTimeShifts = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/getAll/time-shift`);

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

  const handleDateClick = async (arg: DateClickArg) => {
    const { value: shiftCode } = await Swal.fire({
      title: `Enter shift code for ${arg.dateStr}`,
      input: "text",
      inputLabel: "Time Shift Code",
      inputPlaceholder: "e.g. 1Q",
      inputAttributes: {
        list: "shift-list", // attach datalist
      },
      showCancelButton: true,
      confirmButtonText: "Assign",
      inputValidator: (value) => {
        if (!value) {
          return "You need to enter a shift code!";
        }

        // ✅ Check if input matches one of the available timeShift codes
        const valid = timeShift.some((shift) => shift.tsCode === value);

        if (!valid) {
          return "Invalid shift code. Please select from the list.";
        }

        return null; // ✅ valid → button enabled
      },
    });

    if (shiftCode) {
      setEvents((prev) => [
        ...prev.filter((event) => event.date !== arg.dateStr),
        { title: shiftCode, date: arg.dateStr },
      ]);
    }
  };

  const handleEventClick = async (clickInfo: EventClickArg) => {
    const oldCode = clickInfo.event.title;
    const dateStr = clickInfo.event.startStr;

    const result = await Swal.fire({
      title: `Update shift code for ${dateStr}`,
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
        // Only validate when they click "Update"
        if (Swal.getConfirmButton()?.getAttribute("aria-disabled") === "true")
          return null;

        if (!value) {
          return "You need to enter a shift code!";
        }
        const valid = timeShift.some(
          (shift) => shift.tsCode.toLowerCase() === value.toLowerCase()
        );
        if (!valid) {
          return "Invalid shift code. Please select from the list.";
        }
        return null;
      },
    });

    if (result.isConfirmed && result.value) {
      // ✅ Update event
      setEvents((prev) => [
        ...prev.filter((event) => event.date !== dateStr),
        { title: result.value, date: dateStr },
      ]);
    } else if (result.isDenied) {
      // ❌ Delete event
      setEvents((prev) => prev.filter((event) => event.date !== dateStr));
      Swal.fire("Deleted!", "Shift removed from schedule.", "success");
    }
  };

  const handleSave = () => {
    if (!selectedEmployee) {
      Swal.fire({
        title: "Warning",
        text: "Please select an employee to save the schedule.",
        icon: "error",
        confirmButtonText: "OK",
      });
      return;
    }

    // For now, we'll just log the events.
    // Replace this with your actual API call or localStorage saving logic.
    console.log("Saving work schedule for:", selectedEmployee.fullName);
    console.log("Shift Events:", events);

    Swal.fire({
      title: "Success",
      text: "Saved Work Schedules Successfully",
      icon: "success",
      confirmButtonText: "OK",
    });
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
                        {`${shift.timeIn} - ${shift.breakOut}/${shift.breakIn} - ${shift.timeOut}`}
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
                    <strong>{shift.tsCode}</strong> – {shift.timeIn}
                    {` - ${shift.breakOut}`}
                    {`/${shift.breakIn}`}
                    {` - ${shift.timeOut}`}
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
              dateClick={handleDateClick}
              eventClick={handleEventClick} // ✅ Add this line
              editable={true}
              selectable={true}
              height="auto"
            />
            <div className={styles.saveContainer}>
              <button className={styles.saveButton} onClick={handleSave}>
                Save Work Schedule
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
