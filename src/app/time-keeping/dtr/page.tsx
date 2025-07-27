"use client";

import { useState } from "react";
import DTRTable from "./DTRTable";
import styles from "@/styles/DTRPage.module.scss";
import Main from "../main/Main";
import modalStyles from "@/styles/Modal.module.scss";
import { fetchWithAuth } from "@/pages/api/fetchWithAuth";
import useCurrentMonthRange from "@/lib/utils/useCurrentMonthRange";
import { toDateInputValue, toCustomFormat } from '@/lib/utils/dateFormatUtils';

type DTRRecord = {
  workDate: string;
  shift: string;
  timeIn: string;
  breakOut: string;
  breakIn: string;
  timeOut: string;
  totalHours: string;
  notes?: string;
};

type Employee = {
  id: number;
  employeeNo: string;
  fullName: string;
};

export default function DTRPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [records, setRecords] = useState<DTRRecord[]>([]);

  const { fromDate, setFromDate, toDate, setToDate } = useCurrentMonthRange();

  // Fetch employees (on focus or page load)
  const fetchEmployees = async () => {
    try {
      const res = await fetchWithAuth("http://localhost:8084/api/employees/basicInfo");

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
        const res = await fetchWithAuth(`http://localhost:8084/api/employee/dtr?employeeNo=${selectedEmployee.employeeNo}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`);
        const data = await res.json();
        setRecords(data);
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
              <div className={styles.formGroup}>
                <label htmlFor="employee">Employee Name</label>
                <input
                  id="employee"
                  type="text"
                  list="employee-list"
                  placeholder="Employee No / Lastname"
                  onFocus={fetchEmployees}
                  onChange={(e) => {
                    const selected = employees.find(
                      (emp) =>
                        `[${emp.employeeNo}] ${emp.fullName}`.toLowerCase() ===
                        e.target.value.toLowerCase()
                    );
                    setSelectedEmployee(selected || null);
                  }}
                />
                <datalist id="employee-list">
                  {employees.map((emp) => (
                    <option
                      key={emp.employeeNo}
                      value={`[${emp.employeeNo}] ${emp.fullName}`} //bear in mind if the value field was changed need to change also the onChange in input element
                    />
                  ))}
                </datalist>
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
            {records.length > 0 && <DTRTable records={records} />}
          </div>
        </div>
      </div>
    </Main>
  );
}
