// src/app/time-keeping/dtr/DTRTable.tsx
import { useState, useRef, useEffect } from 'react';
import Swal from 'sweetalert2';
import styles from '@/styles/DTRTable.module.scss';
import to12HourFormat from '@/lib/utils/convert24To12HrFormat';

type DTRRecord = {
  workDate: string;
  shift: string;
  timeIn: string;
  breakOut: string;
  breakIn: string;
  timeOut: string;
  totalHours: string;
  details?: string;
  lateMin: string;
  underMin: string;
  timeCorrectionFiled?: boolean;
  overtimeFiled?: boolean;
  leaveFiled?: boolean;
};

type Props = {
  records: DTRRecord[];
};

export default function DTRTable({ records }: Props) {
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
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openRow]);

  const handleRecompute = (record: DTRRecord) => {
    console.log('Recomputing for', record.workDate);
    // call backend recompute API here
    setOpenRow(null);
  };

  const handleTimeCorrection = (record: DTRRecord) => {
    console.log('Time correction for', record.workDate);
    // open modal form for correction
    setOpenRow(null);
  };

  const handleShowDetails = (record: DTRRecord) => {
    Swal.fire({
      title: `DTR Details \n${record.workDate}`,
      html: `
        <div style="text-align:left; font-size:14px;">
          <p><b>Shift:</b> ${record.shift}</p>
          <p><b>Late (mins):</b> ${record.lateMin || '0'}</p>
          <p><b>Undertime (mins):</b> ${record.underMin || '0'}</p>
          <p><b>Time Correction Filed:</b> ${
            record.timeCorrectionFiled ? '✅ Yes' : '❌ No'
          }</p>
          <p><b>Overtime Filed:</b> ${record.overtimeFiled ? '✅ Yes' : '❌ No'}</p>
          <p><b>Leave Filed:</b> ${record.leaveFiled ? '✅ Yes' : '❌ No'}</p>
          <p><b>Notes:</b> ${record.details || '—'}</p>
        </div>
      `,
      confirmButtonText: 'Close',
      confirmButtonColor: '#3085d6',
      width: '400px',
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
            <th>Total Hours</th>
            <th>Details</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, index) => (
            <tr key={index}>
              <td>{record.workDate}</td>
              <td>{record.shift}</td>
              <td>{to12HourFormat(record.timeIn)}</td>
              <td>{record.breakOut ? to12HourFormat(record.breakOut) : '—'}</td>
              <td>{record.breakIn ? to12HourFormat(record.breakIn) : '—'}</td>
              <td>{to12HourFormat(record.timeOut)}</td>
              <td>{record.totalHours}</td>
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
                    onClick={() =>
                      setOpenRow(openRow === index ? null : index)
                    }
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