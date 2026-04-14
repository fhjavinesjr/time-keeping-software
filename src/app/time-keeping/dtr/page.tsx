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
const API_BASE_URL_ADMINISTRATIVE =
  process.env.NEXT_PUBLIC_API_BASE_URL_ADMINISTRATIVE;

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

const toIsoDateKey = (customDate: string): string => {
  const [month, day, year] = customDate.split(" ")[0].split("-");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
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

export default function DTRPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [records, setRecords] = useState<DTRDailyDTO[]>([]);
  const { fromDate, setFromDate, toDate, setToDate } = useCurrentMonthRange();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [holidays, setHolidays] = useState<HolidayDTO[]>([]);

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

        // Fetch work schedules to detect Day Off (isDayOff=true) entries
        const wsRes = await fetchWithAuth(
          `${API_BASE_URL_TIMEKEEPING}/api/getListByEmployeeAndDateRange/work-schedule?employeeId=${selectedEmployee.employeeId}&monthStart=${encodeURIComponent(fromDate)}&monthEnd=${encodeURIComponent(toDate)}`
        );
        const dayOffSet = new Set<string>();
        if (wsRes.status !== 204 && wsRes.ok) {
          const wsJson: WorkScheduleEntryDTO[] = await wsRes.json();
          wsJson.forEach((ws) => {
            if (ws.isDayOff) {
              dayOffSet.add(toIsoDateKey(ws.wsDateTime));
            }
          });
        }

        const recordsWithFilledDates = buildDTRWithMissingDates(
          dtrJson,
          holidayMap,
          dayOffSet,
          fromDate,
          toDate,
          selectedEmployee.employeeId
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