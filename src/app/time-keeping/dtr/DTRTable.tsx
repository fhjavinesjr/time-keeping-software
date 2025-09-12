// src/app/time-keeping/dtr/DTRTable.tsx
import { useState, useRef, useEffect } from "react";
import Swal from "sweetalert2";
import styles from "@/styles/DTRTable.module.scss";
import to12HourFormat from "@/lib/utils/convert24To12HrFormat";

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
};

type TimeShift = {
  tsCode: string;
  timeIn: string;
  breakOut: string;
  breakIn: string;
  timeOut: string;
};

type Props = {
  records: DTRRecord[];
  timeShifts: TimeShift[];
};

export default function DTRTable({ records, timeShifts }: Props) {
  const [openRow, setOpenRow] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpenRow(null);
      }
    };

    if (openRow !== null) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openRow]);

  const handleTimeCorrection = (record: DTRRecord) => {
    console.log("Time correction for", record.workDate);
    // open modal form for correction
    setOpenRow(null);
  };

  // Late = arrived after expected
  const lateMinutes = (expected: string, actual: string) => {
    if (!expected || !actual) return 0;
    const [eh, em] = expected.split(":").map(Number);
    const [ah, am] = actual.split(":").map(Number);
    const expectedMin = eh * 60 + em;
    const actualMin = ah * 60 + am;
    return actualMin > expectedMin ? actualMin - expectedMin : 0;
  };

  // Undertime = left earlier than expected
  const undertimeMinutes = (expected: string, actual: string) => {
    if (!expected || !actual) return 0;
    const [eh, em] = expected.split(":").map(Number);
    const [ah, am] = actual.split(":").map(Number);
    const expectedMin = eh * 60 + em;
    const actualMin = ah * 60 + am;
    return actualMin < expectedMin ? expectedMin - actualMin : 0;
  };

  const handleShowDetails = (record: DTRRecord) => {
    const matchedShift = timeShifts.find(
      (ts) => ts.tsCode === record.shiftCode
    );

    let lateTimeIn = 0,
      lateBreakIn = 0,
      underTimeOut = 0,
      underBreakOut = 0;

    if (matchedShift) {
      lateTimeIn = lateMinutes(matchedShift.timeIn, record.timeIn);
      lateBreakIn = record.breakIn
        ? lateMinutes(matchedShift.breakIn, record.breakIn)
        : 0;

      underTimeOut = undertimeMinutes(matchedShift.timeOut, record.timeOut);
      underBreakOut = record.breakOut
        ? undertimeMinutes(matchedShift.breakOut, record.breakOut)
        : 0;
    }

    Swal.fire({
      title: `DTR Details \n${record.workDate}`,
      html: `
      <div style="text-align:left; font-size:14px;">
        <p><b>Shift Code:</b> ${record.shiftCode}</p>
        ${
          matchedShift
            ? `<p><b>Shift:</b> ${to12HourFormat(matchedShift.timeIn)} -
                ${
                  matchedShift.breakOut
                    ? to12HourFormat(matchedShift.breakOut) + " / "
                    : ""
                }
                ${
                  matchedShift.breakIn
                    ? to12HourFormat(matchedShift.breakIn) + " - "
                    : ""
                }
                ${to12HourFormat(matchedShift.timeOut)}</p>`
            : `<p><i>No shift schedule found</i></p>`
        }
        <hr/>
        <h4>Late</h4>
        <p>Time In (mins): ${lateTimeIn}</p>
        <p>Break In (mins): ${lateBreakIn}</p>
        <p><b>Total (mins): ${lateTimeIn + lateBreakIn}</b></p>
        
        <h4>Undertime</h4>
        <p>Time Out (mins): ${underTimeOut}</p>
        <p>Break Out (mins): ${underBreakOut}</p>
        <p><b>Total (mins): ${underTimeOut + underBreakOut}</b></p>

        <hr/>
        <p><b>Time Correction Filed:</b> ${
          record.timeCorrectionFiled ? "✅ Yes" : "❌ No"
        }</p>
        <p><b>Overtime Filed:</b> ${
          record.overtimeFiled ? "✅ Yes" : "❌ No"
        }</p>
        <p><b>Leave Filed:</b> ${record.leaveFiled ? "✅ Yes" : "❌ No"}</p>
        <p><b>Notes:</b> ${record.details || "—"}</p>
      </div>
    `,
      confirmButtonText: "Close",
      confirmButtonColor: "#3085d6",
      width: "480px",
    });
  };

  return (
    <div className={styles.DTRTable}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Work Date</th>
            <th>Shift</th>
            <th>Time In</th>
            <th>Break Out</th>
            <th>Break In</th>
            <th>Time Out</th>
            <th>Details</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, index) => (
            <tr key={index}>
              <td>{record.workDate}</td>
              <td>{record.shiftCode}</td>
              <td>{to12HourFormat(record.timeIn)}</td>
              <td>{record.breakOut ? to12HourFormat(record.breakOut) : "—"}</td>
              <td>{record.breakIn ? to12HourFormat(record.breakIn) : "—"}</td>
              <td>{to12HourFormat(record.timeOut)}</td>
              <td>
                <button
                  className={styles.detailButton}
                  onClick={() => handleShowDetails(record)}
                >
                  📋 View
                </button>
              </td>
              <td>
                <div className={styles.actions} ref={dropdownRef}>
                  <button
                    className={styles.actionButton}
                    onClick={() => setOpenRow(openRow === index ? null : index)}
                  >
                    ⋮
                  </button>
                  {openRow === index && (
                    <div className={styles.dropdown}>
                      <button onClick={() => handleTimeCorrection(record)}>
                        ✏️ Time Correction
                      </button>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}