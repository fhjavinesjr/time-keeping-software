"use client";

import { useState, useEffect } from "react";
import DTRTable from "./DTRTable";
import styles from "@/styles/DTRPage.module.scss";
import Main from "../main/Main";
import modalStyles from "@/styles/Modal.module.scss";
import { fetchWithAuth } from "@/lib/utils/fetchWithAuth";
import useCurrentMonthRange from "@/lib/utils/useCurrentMonthRange";
import {
  toDateInputValue,
  toCustomFormat,
  getFirstDateOfMonth,
  getLastDateOfMonth,
  toDateInputValueExplicit,
} from "@/lib/utils/dateFormatUtils";
import { localStorageUtil } from "@/lib/utils/localStorageUtil";
import { Employee } from "@/lib/types/Employee";
const API_BASE_URL_TIMEKEEPING =
  process.env.NEXT_PUBLIC_API_BASE_URL_TIMEKEEPING;
const API_BASE_URL_ADMINISTRATIVE =
  process.env.NEXT_PUBLIC_API_BASE_URL_ADMINISTRATIVE;
import { WorkScheduleDTO } from "@/lib/types/WorkScheduleDTO";
import Swal from "sweetalert2";

type DTRRecord = {
  workDate: string;
  shiftCode: string;
  shift: string;
  timeIn: string;
  breakOut: string;
  breakIn: string;
  timeOut: string;
  details?: string;
  lateMin: string;
  underMin: string;
  timeCorrectionFiled?: boolean;
  overtimeFiled?: boolean;
  leaveFiled?: boolean;
  dtrDate: string;
};

type TimeShift = {
  tsCode: string;
  timeIn: string;
  breakOut: string;
  breakIn: string;
  timeOut: string;
};

export default function DTRPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [records, setRecords] = useState<DTRRecord[]>([]);
  const [timeShift, setTimeShift] = useState<TimeShift[]>([]);

  const { fromDate, setFromDate, toDate, setToDate } = useCurrentMonthRange();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    const storedEmployees = localStorageUtil.getEmployees();
    if (storedEmployees != null && storedEmployees.length > 0) {
      setEmployees(storedEmployees);
    } else {
      // fallback fetch if not in localStorage
      fetchEmployees();
    }
  }, []);

  useEffect(() => {
    const role = localStorageUtil.getEmployeeRole();
    const fullname = localStorageUtil.getEmployeeFullname();
    const empNo = localStorageUtil.getEmployeeNo();

    setUserRole(role);

    if (fullname && empNo) {
      const emp = { employeeNo: empNo, fullName: fullname } as Employee;
      setSelectedEmployee(emp);

      if (role === "ROLE_ADMIN") {
        setInputValue(`[${emp.employeeNo}] ${emp.fullName}`);
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

      const data = await res.json();
      setEmployees(data);
      console.log("Successfully fetch employees", res.status);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  // Fetch DTR records
  const fetchDTR = async () => {
    try {
      if (selectedEmployee && fromDate && toDate) {
        // build start & end dates for the month
        const monthStart = getFirstDateOfMonth(
          new Date(fromDate).getMonth() + 1,
          new Date(fromDate).getFullYear()
        );
        const monthEnd = getLastDateOfMonth(
          new Date(toDate).getMonth() + 1,
          new Date(toDate).getFullYear()
        );

        const res = await fetchWithAuth(
          `${API_BASE_URL_TIMEKEEPING}/api/employee/dtr?employeeNo=${
            selectedEmployee.employeeNo
          }&fromDate=${encodeURIComponent(
            fromDate
          )}&toDate=${encodeURIComponent(toDate)}`
        );
        const dtrJson = await res.json();

        if (dtrJson.length > 0) {
          const resWs = await fetchWithAuth(
            `${API_BASE_URL_TIMEKEEPING}/api/getListByEmployeeAndDateRange/work-schedule?employeeNo=${selectedEmployee.employeeNo}&monthStart=${monthStart}&monthEnd=${monthEnd}`
          );

          let workScheduleJson = null;
          if (resWs.ok && resWs.status !== 204) {
            workScheduleJson = await resWs.json();
          }

          // merge WorkSchedule shift code into DTR records
          const mappedRecords: DTRRecord[] = dtrJson.map(
            (record: DTRRecord) => {
              const ws = workScheduleJson.find(
                (schedule: WorkScheduleDTO) =>
                  toDateInputValueExplicit(schedule.wsDateTime) ===
                  toDateInputValueExplicit(record.dtrDate)
              );

              return {
                ...record,
                shiftCode: ws ? ws.tsCode : "-", // add shiftCode if found, else fallback
              };
            }
          );

          setRecords(mappedRecords);
        } else {
          if (dtrJson.length == 0) {
            Swal.fire({
              title: "No Daily Time Record Found",
              text: "There are no records available for the selected date.",
              icon: "warning", // ✅ warning icon
              confirmButtonText: "OK",
              confirmButtonColor: "#d33", // optional: red confirm button
            });
            return;
          }

          setRecords(dtrJson);
        }

        fetchTimeSfhit();

        console.log("Successfully fetch DTR employees", res.status);
      } else {
        console.error("Error fetching DTR employees");
        return;
      }
    } catch (error) {
      console.error("Error fetching DTR employees:", error);
    }
  };

  //fetch All TimeShift from administrative db table
  const fetchTimeSfhit = async () => {
    try {
      const res = await fetchWithAuth(
        `${API_BASE_URL_ADMINISTRATIVE}/api/getAll/time-shift`
      );

      if (!res.ok) {
        throw new Error(`Failed to fetch timeshifts: ${res.status}`);
      }

      const data = await res.json();
      setTimeShift(data);
    } catch (err) {
      console.error("Failed to fetch timeshifts:", err);
    }
  };

  return (
    <Main>
      <div className={modalStyles.Modal}>
        <div className={modalStyles.modalContent}>
          <div className={modalStyles.modalHeader}>
            <h2 className={modalStyles.mainTitle}>Daily Time Record</h2>
          </div>
          <div className={modalStyles.modalBody}>
            <div className={styles.DTRPage}>
              <div className={styles.formGroup}>
                <label htmlFor="employee">Employee Name</label>
                <input
                  id="employee"
                  type="text"
                  list={userRole === "ROLE_ADMIN" ? "employee-list" : undefined}
                  placeholder="Employee No / Lastname"
                  value={
                    userRole === "ROLE_ADMIN"
                      ? inputValue // ✅ Admin can type freely
                      : selectedEmployee
                      ? `[${selectedEmployee.employeeNo}] ${selectedEmployee.fullName}`
                      : ""
                  }
                  readOnly={userRole !== "ROLE_ADMIN"} // ✅ Non-admin can't edit
                  onChange={(e) => {
                    if (userRole === "ROLE_ADMIN") {
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
                {userRole === "ROLE_ADMIN" && (
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

              <button className={styles.searchButton} onClick={fetchDTR}>
                Search
              </button>
            </div>
            {records.length > 0 && (
              <DTRTable records={records} timeShifts={timeShift} />
            )}
          </div>
        </div>
      </div>
    </Main>
  );
}
