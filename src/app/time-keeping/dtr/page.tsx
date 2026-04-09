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
} from "@/lib/utils/dateFormatUtils";
import { localStorageUtil } from "@/lib/utils/localStorageUtil";
import { Employee } from "@/lib/types/Employee";
const API_BASE_URL_TIMEKEEPING =
  process.env.NEXT_PUBLIC_API_BASE_URL_TIMEKEEPING;
import Swal from "sweetalert2";

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
};

export default function DTRPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [records, setRecords] = useState<DTRDailyDTO[]>([]);
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
    const employeeId = localStorageUtil.getEmployeeId();

    setUserRole(role);

    if (fullname && empNo) {
      const emp = { employeeId: employeeId, employeeNo: empNo, fullName: fullname } as Employee;
      setSelectedEmployee(emp);

      if (role === "1") {
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
        const res = await fetchWithAuth(
          `${API_BASE_URL_TIMEKEEPING}/api/dtr-daily?employeeId=${
            selectedEmployee.employeeId
          }&fromDate=${encodeURIComponent(
            fromDate
          )}&toDate=${encodeURIComponent(toDate)}`
        );

        if (!res.ok) {
          throw new Error(`Failed to fetch DTR daily records: ${res.status}`);
        }

        const dtrJson = await res.json();

        if (dtrJson.length > 0) {
          setRecords(dtrJson);
        } else {
          Swal.fire({
            title: "No Daily Time Record Found",
            text: "There are no records available for the selected date.",
            icon: "warning",
            confirmButtonText: "OK",
            confirmButtonColor: "#d33",
          });
          setRecords([]);
        }
        console.log("Successfully fetch DTR employees", res.status);
      } else {
        console.error("Error fetching DTR employees");
        return;
      }
    } catch (error) {
      console.error("Error fetching DTR employees:", error);
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
              <DTRTable records={records} />
            )}
          </div>
        </div>
      </div>
    </Main>
  );
}