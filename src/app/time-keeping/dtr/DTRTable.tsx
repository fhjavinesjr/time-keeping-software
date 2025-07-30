// src/app/time-keeping/dtr/DTRTable.tsx
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
  notes?: string;
};

type Props = {
  records: DTRRecord[];
};

export default function DTRTable({ records }: Props) {
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
            <th>Notes</th>
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
              <td>{record.notes || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}