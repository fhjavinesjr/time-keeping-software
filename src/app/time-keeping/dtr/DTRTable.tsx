import React, { useState } from "react";
import styles from "@/styles/DTRTable.module.scss";
import to12HourFormat from "@/lib/utils/convert24To12HrFormat";
import {
  getNextWorkDate,
  hasOvernightSegments,
  isOvernightSegment,
  toWorkDateOnly,
} from "@/lib/utils/dtrSegmentUtils";

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

type Props = {
  records: DTRDailyDTO[];
};

const formatDate = (dateStr: string) => {
  // Expects MM-dd-yyyy HH:mm:ss, returns MM-dd-yyyy
  return toWorkDateOnly(dateStr);
};
const formatTime = (timeStr: string) => {
  // Expects HH:mm:ss, returns HH:mm:ss AM/PM
  return timeStr ? to12HourFormat(timeStr) : "";
};

const getStatusClass = (status: string) => {
  const normalized = status.toLowerCase();

  if (normalized.includes("present")) return styles.statusPresent;
  if (normalized.includes("late")) return styles.statusLate;
  if (normalized.includes("absent")) return styles.statusAbsent;

  return styles.statusDefault;
};

export default function DTRTable({ records }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const handleExpand = (idx: number) => {
    setExpanded(expanded === idx ? null : idx);
  };

  return (
    <div className={styles.tableContainer}>
      <table className={styles.summaryTable}>
        <thead>
          <tr>
              <th>Date</th>
              <th>Status</th>
              <th>Work Min</th>
              <th>Late</th>
              <th>Under</th>
              <th>Over</th>
              <th>Segments</th>
            </tr>
          </thead>
          <tbody>
            {records.map((rec, idx) => (
              <React.Fragment key={rec.dtrDailyId}>
                <tr>
                  <td>
                    <div className={styles.workDateCell}>
                      <span>{formatDate(rec.workDate)}</span>
                      {hasOvernightSegments(rec.segments) && (
                        <span className={styles.workDateHint}>
                          {`${formatDate(rec.workDate)} -> ${getNextWorkDate(
                            rec.workDate
                          )}`}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`${styles.statusBadge} ${getStatusClass(
                        rec.attendanceStatus
                      )}`}
                    >
                      {rec.attendanceStatus}
                    </span>
                  </td>
                  <td>{rec.totalWorkMinutes}</td>
                  <td>{rec.totalLateMinutes}</td>
                  <td>{rec.totalUndertimeMinutes}</td>
                  <td>{rec.totalOvertimeMinutes}</td>
                  <td>
                    <button
                      className={styles.segmentToggleButton}
                      aria-label={expanded === idx ? "Hide segments" : "Show segments"}
                      onClick={() => handleExpand(idx)}
                    >
                      {expanded === idx ? "Hide" : "Show"}
                    </button>
                  </td>
                </tr>
                {expanded === idx && (
                  <tr>
                    <td className={styles.segmentCell} colSpan={7}>
                      <div className={styles.segmentPanel}>
                        <table className={styles.segmentTable}>
                          <thead>
                            <tr>
                              <th>Segment</th>
                              <th>Time In</th>
                              <th>Break Out</th>
                              <th>Break In</th>
                              <th>Time Out</th>
                              <th>
                                <span className={styles.headerWithHelp}>
                                  Type
                                  <span
                                    className={styles.helpIcon}
                                    title="Overnight means Time Out occurred on the next calendar day."
                                    aria-label="Overnight means Time Out occurred on the next calendar day."
                                  >
                                    i
                                  </span>
                                </span>
                              </th>
                              <th>Work</th>
                              <th>Late</th>
                              <th>Under</th>
                              <th>Over</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rec.segments && rec.segments.length > 0 ? (
                              rec.segments.map((seg) => {
                                const overnight = isOvernightSegment(seg);

                                return (
                                  <tr key={seg.dtrSegmentId}>
                                    <td>{seg.segmentNo}</td>
                                    <td>{formatTime(seg.timeIn ?? "")}</td>
                                    <td>{formatTime(seg.breakOut ?? "")}</td>
                                    <td>{formatTime(seg.breakIn ?? "")}</td>
                                    <td>
                                      <span className={styles.timeOutCell}>
                                        {formatTime(seg.timeOut ?? "")}
                                        {overnight && (
                                          <span className={styles.nextDayMarker}>
                                            (+1 day)
                                          </span>
                                        )}
                                      </span>
                                    </td>
                                    <td>
                                      {overnight ? (
                                        <span
                                          className={`${styles.segmentTypeBadge} ${styles.segmentTypeOvernight}`}
                                        >
                                          Overnight
                                        </span>
                                      ) : (
                                        <span
                                          className={`${styles.segmentTypeBadge} ${styles.segmentTypeSameDay}`}
                                        >
                                          Same day
                                        </span>
                                      )}
                                    </td>
                                    <td>{seg.workMinutes}</td>
                                    <td>{seg.lateMinutes}</td>
                                    <td>{seg.undertimeMinutes}</td>
                                    <td>{seg.overtimeMinutes}</td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td className={styles.noSegments} colSpan={10}>
                                  No segments
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
  );
}